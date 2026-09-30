import crypto from "crypto";
import { prisma } from "./prisma";
import { logAudit } from "./church";
import { notifyRoles } from "./push";
import { won } from "./format";
import { parseBankMessage, splitMessages } from "./bank-sms";
import { accountTag, balanceGaps, gapKey, parseGapKey } from "./bank-balance";
import { autoLinkGivers } from "./offering-givers";
import type { BankAlertModel } from "@/generated/prisma/models";
import type { Prisma } from "@/generated/prisma/client";

/**
 * 은행 입출금 알림을 받아 쌓고, 가능하면 장부(헌금·지출)에 바로 기록한다.
 *
 * 흐름
 *   휴대폰 단축어 → /api/bank/inbound/[token] → ingestBankText()
 *     → BankAlert 저장 → (자동 기록이 켜져 있고 판단이 서면) 헌금/지출 생성
 *     → 회계 담당자에게 푸시 알림
 * 판단이 서지 않는 건은 '입출금 알림함'(/finance/bank)에 남아 사람이 한 번 눌러 확정한다.
 */

export const BANK_AUTO_NOTE = "은행 알림으로 자동 기록";

export type Suggestion = {
  accountId: string | null;
  memberId: string | null;
  /** 제안의 근거. 화면에 짧게 보여준다. */
  reason: string | null;
  /** 자동 기록을 켰을 때 사람 확인 없이 기록해도 될 만큼 확실한지 */
  confident: boolean;
};

/**
 * 지난 기록들에서 가장 많이 쓴 항목. 한 항목이 share 이상을 차지할 때만 돌려준다.
 * (예: '스타필드고' 출금 10건 중 9건이 소모품비 → 소모품비, 반반이면 사람에게 묻는다)
 */
function dominant<T extends { accountId: string }>(rows: T[], share: number) {
  if (rows.length === 0) return null;
  const count = new Map<string, number>();
  for (const r of rows) count.set(r.accountId, (count.get(r.accountId) ?? 0) + 1);
  const [accountId, n] = [...count.entries()].sort((a, b) => b[1] - a[1])[0];
  if (n / rows.length < share) return null;
  return { accountId, ratio: n / rows.length, total: rows.length, sample: rows.find((r) => r.accountId === accountId)! };
}

type IngestResult = {
  saved: BankAlertModel[];
  duplicates: number;
  unreadable: number;
  /** 잔액이 맞지 않아 새로 만든 '문자 없이 오간 돈' 알림 */
  gaps: BankAlertModel[];
};

export function newBankToken() {
  return crypto.randomBytes(24).toString("base64url");
}

function dedupKey(text: string) {
  return crypto
    .createHash("sha256")
    .update(text.replace(/\s+/g, " ").trim())
    .digest("hex")
    .slice(0, 40);
}

/** 날짜·시각에서 날짜만 남긴다 (장부는 날짜 단위로 적는다) */
function dayOf(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function ingestBankText(
  churchId: string,
  text: string,
  source: "SHORTCUT" | "MANUAL",
): Promise<IngestResult> {
  // 단축어는 문자 한 통씩 보낸다. 직접 붙여넣을 때만 여러 통으로 나눠 본다.
  const messages = source === "MANUAL" ? splitMessages(text) : [text.trim()];
  const result: IngestResult = { saved: [], duplicates: 0, unreadable: 0, gaps: [] };

  const rows: Prisma.BankAlertCreateManyInput[] = [];
  for (const message of messages) {
    const parsed = parseBankMessage(message);
    if (!parsed) {
      result.unreadable++;
      continue;
    }
    rows.push({
      churchId,
      direction: parsed.direction,
      amount: parsed.amount,
      balance: parsed.balance,
      counterparty: parsed.counterparty,
      bankName: parsed.bankName,
      occurredAt: parsed.occurredAt ?? new Date(),
      rawText: message.slice(0, 2000),
      source,
      dedupKey: dedupKey(message),
    });
  }

  if (rows.length > 0) {
    // 문자 두 통이 거의 동시에 들어와도 잔액을 차례로 맞춰 볼 수 있도록 교회별로 줄을 세운다.
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`bank:${churchId}`}))`;
        // 이미 받은 문자는 건너뛴다 (같은 문자가 두 번 와도 한 번만 쌓인다).
        result.saved = await tx.bankAlert.createManyAndReturn({ data: rows, skipDuplicates: true });
        result.duplicates = rows.length - result.saved.length;
        result.gaps = await reconcileBalances(tx, churchId, result.saved);
      },
      { timeout: 20_000, maxWait: 20_000 },
    );
  }

  const church = await prisma.church.findUnique({
    where: { id: churchId },
    select: { bankAutoRecord: true },
  });

  for (const alert of result.saved) {
    let recorded = false;
    if (church?.bankAutoRecord) {
      const s = await suggestFor(alert);
      // 입금은 헌금 항목만 정해지면 기록한다. 출금은 전에 같은 곳에 보낸 기록이 있을 때만.
      if (s.confident && s.accountId) {
        await recordAlert(alert, {
          accountId: s.accountId,
          memberId: s.memberId,
          userId: null,
          note: BANK_AUTO_NOTE,
        });
        recorded = true;
      }
    }

    const kind = alert.direction === "IN" ? "입금" : "출금";
    await notifyRoles(churchId, ["ADMIN", "FINANCE"], {
      title: `${kind} ${won(alert.amount)}${alert.counterparty ? ` · ${alert.counterparty}` : ""}`,
      body: recorded
        ? `${alert.direction === "IN" ? "헌금" : "지출"}으로 자동 기록했습니다.`
        : "입출금 알림함에서 헌금·지출로 기록해 주세요.",
      url: "/finance/bank",
      tag: `bank-${alert.id}`,
    }).catch(() => {});
  }

  // 문자 없이 오간 돈은 누구의 헌금인지 알 수 없으므로 자동 기록하지 않고 사람에게 묻는다.
  for (const gap of result.gaps) {
    const isIn = gap.direction === "IN";
    await notifyRoles(churchId, ["ADMIN", "FINANCE"], {
      title: `문자 없이 ${isIn ? "들어온 입금" : "나간 출금"} ${won(gap.amount)}`,
      body: isIn
        ? "잔액을 맞춰 보니 입금 문자가 빠졌습니다. 누구의 헌금인지 확인해 주세요."
        : "잔액을 맞춰 보니 출금 문자가 빠졌습니다. 어디에 쓴 돈인지 확인해 주세요.",
      url: "/finance/bank",
      tag: `bank-${gap.id}`,
    }).catch(() => {});
  }

  return result;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** 같은 통장인지 가르는 열쇠: 은행 + 계좌번호 끝자리 */
function accountKey(a: Pick<BankAlertModel, "bankName" | "rawText">) {
  return `${a.bankName ?? ""}|${accountTag(a.rawText) ?? ""}`;
}

function shortWhen(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 새로 들어온 문자의 잔액을 앞뒤 문자와 맞춰 본다.
 * 잔액이 이어지지 않으면 그 차이만큼 '문자 없이 오간 돈' 알림(source BALANCE)을 만든다.
 * 늦게 들어온 문자가 그 틈을 메우면, 아직 확인 전인 차이 알림은 지운다.
 */
async function reconcileBalances(tx: Tx, churchId: string, saved: BankAlertModel[]) {
  const created: BankAlertModel[] = [];
  const withBalance = saved.filter((a) => a.balance !== null && a.bankName);
  const keys = new Set(withBalance.map(accountKey));

  for (const key of keys) {
    const mine = withBalance.filter((a) => accountKey(a) === key);
    const newIds = new Set(mine.map((a) => a.id));
    const times = mine.map((a) => a.occurredAt.getTime());
    const from = new Date(Math.min(...times));
    const to = new Date(Math.max(...times));
    const base = {
      churchId,
      bankName: mine[0].bankName,
      balance: { not: null },
      source: { not: "BALANCE" },
    } as const;

    // 새 문자 앞뒤로 몇 통씩만 본다. 같은 은행의 다른 통장 문자는 계좌번호로 걸러낸다.
    const [before, within, after] = await Promise.all([
      tx.bankAlert.findMany({ where: { ...base, occurredAt: { lt: from } }, orderBy: { occurredAt: "desc" }, take: 20 }),
      tx.bankAlert.findMany({ where: { ...base, occurredAt: { gte: from, lte: to } } }),
      tx.bankAlert.findMany({ where: { ...base, occurredAt: { gt: to } }, orderBy: { occurredAt: "asc" }, take: 20 }),
    ]);
    const window = [...before, ...within, ...after].filter((a) => accountKey(a) === key);
    const windowIds = new Set(window.map((a) => a.id));
    const gaps = balanceGaps(window);
    const pairs = new Set(gaps.map((g) => gapKey(g.prev.id, g.next.id)));

    // 새 문자가 끼어들어 더는 앞뒤가 아닌 차이 알림은, 아직 확인 전이면 지운다.
    const oldGaps = await tx.bankAlert.findMany({
      where: { churchId, source: "BALANCE", status: "PENDING", dedupKey: { startsWith: "gap-" } },
      select: { id: true, dedupKey: true },
    });
    const stale = oldGaps.filter((g) => {
      const ids = parseGapKey(g.dedupKey);
      return ids && windowIds.has(ids[0]) && windowIds.has(ids[1]) && !pairs.has(g.dedupKey);
    });
    if (stale.length > 0) {
      await tx.bankAlert.deleteMany({ where: { id: { in: stale.map((g) => g.id) } } });
    }

    const fresh = gaps.filter((g) => newIds.has(g.prev.id) || newIds.has(g.next.id));
    if (fresh.length === 0) continue;
    const rows = await tx.bankAlert.createManyAndReturn({
      data: fresh.map((g) => ({
        churchId,
        direction: g.gap > 0 ? "IN" : "OUT",
        amount: Math.abs(g.gap),
        balance: null,
        counterparty: null,
        bankName: g.next.bankName,
        // 정확한 시각은 알 수 없다. 다음 문자 바로 앞으로 둔다.
        occurredAt: new Date(g.next.occurredAt.getTime() - 1000),
        rawText: [
          `잔액으로 계산한 ${g.gap > 0 ? "입금" : "출금"}입니다 (${g.gap > 0 ? "입금" : "출금"} 문자가 오지 않았습니다).`,
          `· ${shortWhen(g.prev.occurredAt)} 문자 뒤 잔액: ${won(g.prev.balance ?? 0)}`,
          `· ${shortWhen(g.next.occurredAt)} ${g.next.direction === "IN" ? "입금" : "출금"} ${won(g.next.amount)} 전 잔액: ${won(g.expectedBefore)}`,
          `· 차이: ${g.gap > 0 ? "+" : "−"}${won(Math.abs(g.gap))}`,
          "두 문자 사이에 여러 건이 오갔다면 합친 금액입니다.",
        ].join("\n"),
        source: "BALANCE",
        dedupKey: gapKey(g.prev.id, g.next.id),
      })),
      skipDuplicates: true,
    });
    created.push(...rows);
  }
  return created;
}

/**
 * 이 입출금을 어떻게 기록하면 될지 추천한다.
 *  1) 같은 사람·같은 곳과 거래해서 기록한 적이 있으면 그때와 똑같이
 *  2) 입금자 이름과 똑같은 교인이 한 명뿐이면 그 교인
 *  3) 입금은 설정해 둔 기본 헌금 항목
 */
export async function suggestFor(alert: BankAlertModel): Promise<Suggestion> {
  const { churchId, counterparty } = alert;
  const none: Suggestion = { accountId: null, memberId: null, reason: null, confident: false };

  // 1) 알림함에서 같은 상대를 기록한 적이 있으면 그대로
  if (counterparty) {
    const previous = await prisma.bankAlert.findFirst({
      where: {
        churchId,
        counterparty,
        direction: alert.direction,
        status: "RECORDED",
        id: { not: alert.id },
        ...(alert.direction === "IN" ? { offeringId: { not: null } } : { expenseId: { not: null } }),
      },
      orderBy: { occurredAt: "desc" },
      include: {
        offering: { select: { accountId: true, memberId: true } },
        expense: { select: { accountId: true } },
      },
    });
    if (previous?.offering) {
      return {
        accountId: previous.offering.accountId,
        memberId: previous.offering.memberId,
        reason: "지난번과 같은 방식",
        confident: true,
      };
    }
    if (previous?.expense) {
      return { accountId: previous.expense.accountId, memberId: null, reason: "지난번과 같은 항목", confident: true };
    }
  }

  // 2) 장부(엑셀로 가져온 기록 포함)에서 같은 상대의 최근 기록을 보고 판단
  if (alert.direction === "OUT") {
    if (!counterparty) return none;
    const past = await prisma.expense.findMany({
      where: { churchId, payee: counterparty },
      orderBy: { date: "desc" },
      take: 12,
      select: { accountId: true },
    });
    const top = dominant(past, 0.7);
    if (top) {
      return {
        accountId: top.accountId,
        memberId: null,
        reason: `같은 곳 지난 지출 ${top.total}건 기준`,
        confident: top.total >= 2 || past.length === 1,
      };
    }
    // 반반으로 갈리면 가장 최근 항목을 추천만 한다
    return past[0]
      ? { accountId: past[0].accountId, memberId: null, reason: "같은 곳의 최근 지출", confident: false }
      : none;
  }

  if (counterparty) {
    const past = await prisma.offering.findMany({
      where: { churchId, OR: [{ donorName: counterparty }, { member: { name: counterparty } }] },
      orderBy: { date: "desc" },
      take: 12,
      select: { accountId: true, memberId: true },
    });
    const top = dominant(past, 0.7);
    if (top) {
      return {
        accountId: top.accountId,
        memberId: top.sample.memberId,
        reason: `같은 이름 지난 입금 ${top.total}건 기준`,
        confident: true,
      };
    }
    if (past[0]) {
      return { accountId: past[0].accountId, memberId: past[0].memberId, reason: "같은 이름의 최근 입금", confident: false };
    }
  }

  // 3) 처음 보는 이름: 같은 금액의 최근 입금이 거의 한 항목이면 그 항목
  //    (예: 10,000원은 대부분 바이블PT 참가비, 35,000원은 책값)
  const sameAmount = await prisma.offering.findMany({
    where: {
      churchId,
      amount: alert.amount,
      date: { gte: new Date(alert.occurredAt.getTime() - 120 * 24 * 3600 * 1000) },
    },
    orderBy: { date: "desc" },
    take: 30,
    select: { accountId: true, memberId: true },
  });
  const byAmount = sameAmount.length >= 5 ? dominant(sameAmount, 0.8) : null;

  let memberId: string | null = null;
  if (counterparty) {
    const same = await prisma.member.findMany({
      where: { churchId, name: counterparty, status: "ACTIVE" },
      select: { id: true },
      take: 2,
    });
    if (same.length === 1) memberId = same[0].id;
  }
  if (byAmount) {
    return {
      accountId: byAmount.accountId,
      memberId,
      reason: `같은 금액 최근 입금 ${byAmount.total}건 기준`,
      confident: true,
    };
  }

  // 4) 설정해 둔 기본 헌금 항목
  const church = await prisma.church.findUnique({
    where: { id: churchId },
    select: { bankIncomeAccountId: true },
  });
  const account = church?.bankIncomeAccountId
    ? await prisma.account.findFirst({
        where: { id: church.bankIncomeAccountId, churchId, type: "INCOME", active: true },
        select: { id: true },
      })
    : null;

  return {
    accountId: account?.id ?? null,
    memberId,
    reason: memberId ? "입금자와 이름이 같은 교인" : account ? "기본 헌금 항목" : null,
    confident: !!account,
  };
}

/** 알림 한 건을 헌금(입금) 또는 지출(출금)로 장부에 적고 서로 연결한다. */
export async function recordAlert(
  alert: BankAlertModel,
  input: {
    accountId: string;
    memberId?: string | null;
    userId: string | null;
    note?: string | null;
    description?: string | null;
  },
) {
  const date = dayOf(alert.occurredAt);
  const note = input.note ?? null;

  // 두 사람이 동시에 누르거나 단축어가 겹쳐도 한 번만 기록되도록,
  // 아직 대기 중인 경우에만 상태를 바꾸는 것으로 잠근다.
  const claimed = await prisma.bankAlert.updateMany({
    where: { id: alert.id, status: "PENDING" },
    data: { status: "RECORDED" },
  });
  if (claimed.count === 0) return null;

  try {
    if (alert.direction === "IN") {
      const offering = await prisma.offering.create({
        data: {
          churchId: alert.churchId,
          date,
          amount: alert.amount,
          accountId: input.accountId,
          memberId: input.memberId ?? null,
          donorName: input.memberId ? null : alert.counterparty,
          method: "TRANSFER",
          note,
          createdById: input.userId,
        },
        include: { account: true },
      });
      await prisma.bankAlert.update({ where: { id: alert.id }, data: { offeringId: offering.id } });
      // 교인을 정하지 않았으면 입금자명으로 찾는다 (예: "김동진최창일" → 두 분 모두)
      if (!input.memberId) {
        await autoLinkGivers(alert.churchId, offering.id, alert.counterparty, input.accountId);
      }
      await logAudit({
        churchId: alert.churchId,
        action: "CREATE",
        entity: "Offering",
        entityId: offering.id,
        summary: `헌금 입력(은행 알림): ${offering.account.name} ${won(alert.amount)}`,
        userId: input.userId,
      });
      return offering.id;
    }

    const expense = await prisma.expense.create({
      data: {
        churchId: alert.churchId,
        date,
        amount: alert.amount,
        accountId: input.accountId,
        payee: alert.counterparty,
        method: "TRANSFER",
        description: input.description ?? null,
        note,
        createdById: input.userId,
      },
      include: { account: true },
    });
    await prisma.bankAlert.update({ where: { id: alert.id }, data: { expenseId: expense.id } });
    await logAudit({
      churchId: alert.churchId,
      action: "CREATE",
      entity: "Expense",
      entityId: expense.id,
      summary: `지출 입력(은행 알림): ${expense.account.name} ${won(alert.amount)}`,
      userId: input.userId,
    });
    return expense.id;
  } catch (e) {
    await prisma.bankAlert.update({ where: { id: alert.id }, data: { status: "PENDING" } });
    throw e;
  }
}

/** 헌금·지출 입력 화면에서 알림 내용을 채우기 위해 대기 중인 알림 하나를 가져온다. */
export async function pendingAlert(churchId: string, id: string | undefined, direction: "IN" | "OUT") {
  if (!id) return null;
  return prisma.bankAlert.findFirst({ where: { id, churchId, direction, status: "PENDING" } });
}

/** 입력 화면에서 직접 저장한 헌금·지출을 알림과 연결한다. */
export async function linkAlert(
  churchId: string,
  id: string | null,
  target: { offeringId: string } | { expenseId: string },
) {
  if (!id) return;
  await prisma.bankAlert.updateMany({
    where: {
      id,
      churchId,
      status: "PENDING",
      direction: "offeringId" in target ? "IN" : "OUT",
    },
    data: { status: "RECORDED", ...target },
  });
}

/** 연결된 헌금·지출을 지우면 알림은 다시 확인 대기로 돌아간다. */
export async function unlinkAlert(target: { offeringId: string } | { expenseId: string }) {
  await prisma.bankAlert.updateMany({
    where: target,
    data: { status: "PENDING", offeringId: null, expenseId: null },
  });
}
