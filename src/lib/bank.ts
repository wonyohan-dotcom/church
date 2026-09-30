import crypto from "crypto";
import { prisma } from "./prisma";
import { logAudit } from "./church";
import { notifyRoles } from "./push";
import { won } from "./format";
import { parseBankMessage, splitMessages } from "./bank-sms";
import type { BankAlertModel } from "@/generated/prisma/models";

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
};

type IngestResult = {
  saved: BankAlertModel[];
  duplicates: number;
  unreadable: number;
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
  const result: IngestResult = { saved: [], duplicates: 0, unreadable: 0 };

  for (const message of messages) {
    const parsed = parseBankMessage(message);
    if (!parsed) {
      result.unreadable++;
      continue;
    }
    try {
      const alert = await prisma.bankAlert.create({
        data: {
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
        },
      });
      result.saved.push(alert);
    } catch (e) {
      if ((e as { code?: string }).code === "P2002") {
        result.duplicates++;
        continue;
      }
      throw e;
    }
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
      const confident = alert.direction === "IN" ? !!s.accountId : !!s.accountId && !!s.reason;
      if (confident && s.accountId) {
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

  return result;
}

/**
 * 이 입출금을 어떻게 기록하면 될지 추천한다.
 *  1) 같은 사람·같은 곳과 거래해서 기록한 적이 있으면 그때와 똑같이
 *  2) 입금자 이름과 똑같은 교인이 한 명뿐이면 그 교인
 *  3) 입금은 설정해 둔 기본 헌금 항목
 */
export async function suggestFor(alert: BankAlertModel): Promise<Suggestion> {
  const { churchId, counterparty } = alert;

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
      };
    }
    if (previous?.expense) {
      return { accountId: previous.expense.accountId, memberId: null, reason: "지난번과 같은 항목" };
    }
  }

  if (alert.direction === "OUT") {
    if (counterparty) {
      const lastExpense = await prisma.expense.findFirst({
        where: { churchId, payee: counterparty },
        orderBy: { date: "desc" },
        select: { accountId: true },
      });
      if (lastExpense) {
        return { accountId: lastExpense.accountId, memberId: null, reason: "같은 지급처의 지난 지출" };
      }
    }
    return { accountId: null, memberId: null, reason: null };
  }

  let memberId: string | null = null;
  if (counterparty) {
    const same = await prisma.member.findMany({
      where: { churchId, name: counterparty, status: "ACTIVE" },
      select: { id: true },
      take: 2,
    });
    if (same.length === 1) memberId = same[0].id;
  }

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
    reason: memberId ? "입금자와 이름이 같은 교인" : null,
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
