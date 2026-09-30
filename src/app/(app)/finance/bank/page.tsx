import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { suggestFor } from "@/lib/bank";
import { won } from "@/lib/format";
import { Alert, Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form";
import { IconClock, IconSettings } from "@/components/icons";
import {
  deleteBankAlert,
  ignoreBankAlert,
  pasteBankMessages,
  quickRecordBankAlert,
  recordBankAlert,
  reopenBankAlert,
} from "./actions";

export const metadata = { title: "입출금 알림함" };

const OK: Record<string, string> = {
  recorded: "장부에 기록했습니다.",
  already: "이미 기록된 알림입니다.",
  ignored: "장부와 무관한 거래로 표시했습니다.",
  deleted: "알림을 지웠습니다.",
};

const ERROR: Record<string, string> = {
  account: "헌금·지출 항목을 골라 주세요.",
  empty: "붙여넣은 문자가 없습니다.",
};

function when(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function BankInboxPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    ok?: string;
    error?: string;
    saved?: string;
    dup?: string;
    bad?: string;
  }>;
}) {
  const staff = await requireFinance();
  const sp = await searchParams;
  const tab = sp.tab === "done" ? "done" : "pending";

  const [church, pendingCount, alerts, incomeAccounts, expenseAccounts] = await Promise.all([
    prisma.church.findUnique({
      where: { id: staff.churchId },
      select: { bankToken: true, bankAutoRecord: true },
    }),
    prisma.bankAlert.count({ where: { churchId: staff.churchId, status: "PENDING" } }),
    prisma.bankAlert.findMany({
      where:
        tab === "pending"
          ? { churchId: staff.churchId, status: "PENDING" }
          : { churchId: staff.churchId, status: { in: ["RECORDED", "IGNORED"] } },
      include: {
        offering: { include: { account: true, member: true } },
        expense: { include: { account: true } },
      },
      orderBy: { occurredAt: tab === "pending" ? "asc" : "desc" },
      take: tab === "pending" ? 100 : 60,
    }),
    prisma.account.findMany({
      where: { churchId: staff.churchId, type: "INCOME", active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.account.findMany({
      where: { churchId: staff.churchId, type: "EXPENSE", active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, category: true },
    }),
  ]);

  // 대기 중인 알림마다 "이렇게 기록하면 될 것 같다" 는 추천을 붙인다.
  const suggestions =
    tab === "pending" ? await Promise.all(alerts.map((a) => suggestFor(a))) : [];
  const memberIds = suggestions.map((s) => s.memberId).filter((v): v is string => !!v);
  const members = memberIds.length
    ? await prisma.member.findMany({
        where: { id: { in: memberIds }, churchId: staff.churchId },
        select: { id: true, name: true, position: true },
      })
    : [];
  const memberName = new Map(members.map((m) => [m.id, `${m.name}${m.position ? ` ${m.position}` : ""}`]));
  const accountName = new Map(
    [...incomeAccounts, ...expenseAccounts].map((a) => [a.id, a.name] as const),
  );

  return (
    <>
      <PageHeader
        title="입출금 알림함"
        description="교회 통장의 입출금 문자가 여기에 모입니다. 헌금·지출로 한 번에 기록하세요."
        back={{ href: "/finance", label: "회계 관리" }}
        actions={
          <Link href="/finance/bank/setup" className="btn btn-ghost">
            <IconSettings width={16} height={16} />
            알림 받기 설정
          </Link>
        }
      />

      {!church?.bankToken && (
        <div className="mb-5">
          <Alert tone="warn">
            아직 휴대폰과 연결되지 않았습니다.{" "}
            <Link href="/finance/bank/setup" className="underline">
              알림 받기 설정
            </Link>
            에서 한 번만 연결해 두면 입출금 문자가 자동으로 들어옵니다.
          </Alert>
        </div>
      )}

      {sp.ok === "pasted" ? (
        <div className="mb-5">
          <Alert tone={Number(sp.saved) > 0 ? "income" : "warn"}>
            {Number(sp.saved) || 0}건을 알림함에 넣었습니다.
            {Number(sp.dup) > 0 && ` 이미 들어와 있던 문자 ${sp.dup}건은 건너뛰었습니다.`}
            {Number(sp.bad) > 0 && ` 입출금 문자로 읽지 못한 글 ${sp.bad}건이 있습니다.`}
          </Alert>
        </div>
      ) : (
        sp.ok &&
        OK[sp.ok] && (
          <div className="mb-5">
            <Alert tone="income">{OK[sp.ok]}</Alert>
          </div>
        )
      )}
      {sp.error && ERROR[sp.error] && (
        <div className="mb-5">
          <Alert tone="expense">{ERROR[sp.error]}</Alert>
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-xl bg-surface-2 p-1 text-sm font-semibold">
        <Link
          href="/finance/bank"
          className={`flex-1 rounded-lg px-3 py-2 text-center ${tab === "pending" ? "bg-surface text-ink shadow-sm" : "text-ink-3"}`}
        >
          확인 대기 {pendingCount > 0 && <span className="text-primary">{pendingCount}</span>}
        </Link>
        <Link
          href="/finance/bank?tab=done"
          className={`flex-1 rounded-lg px-3 py-2 text-center ${tab === "done" ? "bg-surface text-ink shadow-sm" : "text-ink-3"}`}
        >
          처리 완료
        </Link>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconClock />}
            title={tab === "pending" ? "확인할 알림이 없습니다" : "처리한 알림이 없습니다"}
            description={
              tab === "pending"
                ? church?.bankAutoRecord
                  ? "자동 기록이 켜져 있어, 판단이 서는 거래는 바로 장부에 들어갑니다."
                  : "새 입출금 문자가 오면 여기에 나타납니다."
                : undefined
            }
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {alerts.map((a, i) => {
            const isIn = a.direction === "IN";
            const fromBalance = a.source === "BALANCE";
            const s = suggestions[i];
            const accounts = isIn ? incomeAccounts : expenseAccounts;
            return (
              <li key={a.id} id={`a-${a.id}`} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={isIn ? "income" : "expense"}>{isIn ? "입금" : "출금"}</Badge>
                      {fromBalance && <Badge tone="warn">문자 없음</Badge>}
                      {a.bankName && <span className="text-xs text-ink-3">{a.bankName}</span>}
                      <span className="text-xs text-ink-3">
                        {fromBalance
                          ? `${when(new Date(a.occurredAt.getTime() + 1000))} 이전`
                          : when(a.occurredAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 truncate font-semibold text-ink">
                      {fromBalance
                        ? `문자로 오지 않은 ${isIn ? "입금" : "출금"}`
                        : (a.counterparty ?? "(이름 없음)")}
                    </p>
                    {fromBalance && tab === "pending" && (
                      <p className="mt-0.5 text-xs text-ink-3">
                        잔액 차이로 찾았습니다.{" "}
                        {isIn ? "누구의 헌금인지 확인해 주세요." : "어디에 쓴 돈인지 확인해 주세요."}
                      </p>
                    )}
                  </div>
                  <p
                    className={`tnum shrink-0 whitespace-nowrap text-lg font-bold ${isIn ? "text-income" : "text-expense"}`}
                  >
                    {isIn ? "+" : "−"}
                    {won(a.amount)}
                  </p>
                </div>

                {a.balance !== null && (
                  <p className="tnum mt-0.5 text-right text-xs text-ink-3">잔액 {won(a.balance)}</p>
                )}

                {tab === "pending" ? (
                  <>
                    {s?.accountId && (
                      <form action={quickRecordBankAlert.bind(null, a.id)} className="mt-3">
                        <div className="rounded-xl bg-primary-soft px-3 py-2.5 text-sm text-primary-soft-ink">
                          <p>
                            추천: <b>{accountName.get(s.accountId) ?? "항목"}</b>
                            {s.memberId && (
                              <>
                                {" · "}교인 <b>{memberName.get(s.memberId) ?? ""}</b>
                              </>
                            )}
                            {s.reason && <span className="opacity-80"> ({s.reason})</span>}
                          </p>
                          <SubmitButton className="btn btn-primary btn-sm mt-2 w-full" pendingLabel="기록 중…">
                            추천대로 기록
                          </SubmitButton>
                        </div>
                      </form>
                    )}

                    <details className="mt-3 group" open={!s?.accountId}>
                      <summary className="cursor-pointer text-sm font-semibold text-ink-2">
                        {s?.accountId ? "다른 항목으로 기록" : "항목을 골라 기록"}
                      </summary>
                      <form action={recordBankAlert.bind(null, a.id)} className="mt-2 space-y-2">
                        <select
                          name="accountId"
                          className="field"
                          required
                          defaultValue={s?.accountId ?? ""}
                        >
                          <option value="">{isIn ? "헌금 항목 선택" : "지출 항목 선택"}</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {"category" in acc && acc.category ? `[${acc.category}] ` : ""}
                              {acc.name}
                            </option>
                          ))}
                        </select>
                        {isIn && s?.memberId && (
                          <label className="flex items-center gap-2 text-sm text-ink-2">
                            <input type="checkbox" name="memberId" value={s.memberId} defaultChecked />
                            교인 {memberName.get(s.memberId)} 님의 헌금으로 연결
                          </label>
                        )}
                        {!isIn && (
                          <input
                            name="description"
                            className="field"
                            placeholder="적요 (예: 6월 전기요금) — 선택"
                          />
                        )}
                        <div className="flex flex-wrap gap-2">
                          <SubmitButton className="btn btn-primary btn-sm" pendingLabel="기록 중…">
                            {isIn ? "헌금으로 기록" : "지출로 기록"}
                          </SubmitButton>
                          <Link
                            href={
                              isIn
                                ? `/finance/offerings/new?bank=${a.id}`
                                : `/finance/expenses/new?bank=${a.id}`
                            }
                            className="btn btn-ghost btn-sm"
                          >
                            {isIn ? "교인 찾아서 자세히 입력" : "영수증 붙여 자세히 입력"}
                          </Link>
                        </div>
                      </form>
                    </details>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                      <details className="min-w-0 text-xs text-ink-3">
                        <summary className="cursor-pointer">{fromBalance ? "계산 근거 보기" : "받은 문자 보기"}</summary>
                        <pre className="mt-1 whitespace-pre-wrap break-words font-sans">{a.rawText}</pre>
                      </details>
                      <form action={ignoreBankAlert.bind(null, a.id)} className="shrink-0">
                        <SubmitButton className="btn btn-quiet btn-sm" pendingLabel="처리 중…">
                          장부와 무관
                        </SubmitButton>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                    {a.status === "IGNORED" ? (
                      <span className="text-ink-3">장부와 무관한 거래로 표시함</span>
                    ) : a.offering ? (
                      <Link href={`/finance/offerings/${a.offering.id}`} className="text-primary">
                        헌금 · {a.offering.account.name}
                        {a.offering.member ? ` · ${a.offering.member.name}` : ""} →
                      </Link>
                    ) : a.expense ? (
                      <Link href={`/finance/expenses/${a.expense.id}`} className="text-primary">
                        지출 · {a.expense.account.name} →
                      </Link>
                    ) : (
                      <span className="text-warn">연결된 기록이 지워졌습니다</span>
                    )}
                    <div className="flex gap-1">
                      {(a.status === "IGNORED" || (!a.offering && !a.expense)) && (
                        <form action={reopenBankAlert.bind(null, a.id)}>
                          <SubmitButton className="btn btn-ghost btn-sm" pendingLabel="…">
                            다시 확인하기
                          </SubmitButton>
                        </form>
                      )}
                      {a.status === "IGNORED" && (
                        <form action={deleteBankAlert.bind(null, a.id)}>
                          <ConfirmSubmitButton
                            className="btn btn-quiet btn-sm"
                            message="이 알림을 지울까요?"
                          >
                            지우기
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Card className="mt-6">
        <CardTitle>문자 직접 붙여넣기</CardTitle>
        <p className="mb-3 text-sm text-ink-3">
          자동 연결 전이거나 빠진 문자가 있으면, 은행 문자를 길게 눌러 복사한 뒤 여기에 붙여넣으세요.
          여러 통을 한꺼번에 붙여넣어도 됩니다. 이미 들어온 문자는 두 번 쌓이지 않습니다.
        </p>
        <form action={pasteBankMessages} className="space-y-3">
          <textarea
            name="text"
            rows={5}
            className="field"
            placeholder={"[Web발신]\n농협 입금50,000원\n06/12 11:02 301-****-2640-41 홍길동 잔액1,305,428원"}
            required
          />
          <div className="flex justify-end">
            <SubmitButton pendingLabel="읽는 중…">알림함에 넣기</SubmitButton>
          </div>
        </form>
      </Card>
    </>
  );
}
