import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { RECEIPT_STATUS, type ReceiptStatus } from "@/lib/constants";
import { won, ymd } from "@/lib/format";
import {
  Alert,
  Badge,
  Card,
  CardTitle,
  EmptyState,
  Field,
  PageHeader,
  StatCard,
  TableWrap,
} from "@/components/ui";
import { SubmitButton } from "@/components/form";
import { IconReceipt } from "@/components/icons";
import { YearSelect } from "@/components/year-select";
import { issueReceipt, issueReceiptForMember } from "@/actions/receipts";

export const metadata = { title: "기부금영수증" };

const MESSAGES: Record<string, { tone: "income" | "expense"; text: string }> = {
  issued: { tone: "income", text: "영수증이 발급되었습니다." },
  rejected: { tone: "income", text: "신청이 반려되었습니다." },
  canceled: { tone: "income", text: "영수증이 취소되었습니다." },
  input: { tone: "expense", text: "교인과 연도를 선택해 주세요." },
  "no-offering": { tone: "expense", text: "해당 연도에 공제 대상 헌금 기록이 없습니다." },
};

const STATUS_TONE: Record<ReceiptStatus, "income" | "warn" | "expense" | "neutral"> = {
  ISSUED: "income",
  REQUESTED: "warn",
  REJECTED: "expense",
  CANCELED: "neutral",
};

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; status?: string; ok?: string; error?: string }>;
}) {
  const staff = await requireStaff();
  const sp = await searchParams;

  const now = new Date();
  const year = Number(sp.year) || now.getFullYear() - 1;
  const status = sp.status ?? "ALL";
  const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  const [receipts, church, counts, members] = await Promise.all([
    prisma.donationReceipt.findMany({
      where: { churchId: staff.churchId, year, ...(status !== "ALL" ? { status } : {}) },
      include: { member: true, issuedBy: true },
      orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    }),
    getChurch(staff.churchId),
    prisma.donationReceipt.groupBy({
      by: ["status"],
      where: { churchId: staff.churchId, year },
      _count: true,
    }),
    prisma.member.findMany({
      where: { churchId: staff.churchId, status: "ACTIVE" },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const issuedTotal = receipts
    .filter((r) => r.status === "ISSUED")
    .reduce((s, r) => s + r.totalAmount, 0);

  const message = sp.ok ? MESSAGES[sp.ok] : sp.error ? MESSAGES[sp.error] : undefined;

  return (
    <>
      <PageHeader
        title="기부금영수증"
        description="성도님이 온라인으로 신청한 영수증을 확인하고 발급합니다."
        actions={<YearSelect year={year} years={years} basePath="/receipts" />}
      />

      {message && (
        <div className="mb-5">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {!church.regNo && (
        <div className="mb-5">
          <Alert tone="warn">
            교회 고유번호(사업자등록번호)가 등록되지 않았습니다. 영수증에 빈칸으로 인쇄되니{" "}
            <Link href="/settings" className="underline">
              설정
            </Link>
            에서 먼저 입력해 주세요.
          </Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="신청 대기" value={`${countOf("REQUESTED")}건`} tone="expense" />
        <StatCard label="발급 완료" value={`${countOf("ISSUED")}건`} tone="income" />
        <StatCard label="발급 금액" value={won(issuedTotal)} />
        <StatCard
          label="자동 발급"
          value={church.receiptAutoIssue ? "켜짐" : "꺼짐"}
          sub={church.receiptAutoIssue ? "신청 즉시 발급" : "확인 후 수동 발급"}
        />
      </div>

      {/* 상태 필터 */}
      <form method="get" className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <input type="hidden" name="year" value={year} />
        <div className="w-[9rem]">
          <label className="label" htmlFor="status">
            상태
          </label>
          <select id="status" name="status" defaultValue={status} className="field">
            <option value="ALL">전체</option>
            {Object.entries(RECEIPT_STATUS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">
          조회
        </button>
      </form>

      {receipts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconReceipt />}
            title={`${year}년 귀속 신청 내역이 없습니다`}
            description="성도님이 신청하시면 이곳에 표시됩니다. 아래에서 교회가 직접 발급할 수도 있습니다."
          />
        </Card>
      ) : (
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>일련번호</th>
                <th>성도</th>
                <th className="text-right">금액</th>
                <th>신청일</th>
                <th>상태</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td className="tnum text-ink-3">{r.receiptNo}</td>
                  <td>
                    <Link
                      href={`/members/${r.memberId}`}
                      className="font-semibold text-primary hover:underline"
                    >
                      {r.donorName}
                    </Link>
                    <span className="tnum block text-xs text-ink-3">{r.member.code}</span>
                  </td>
                  <td className="tnum whitespace-nowrap text-right font-semibold text-ink">
                    {won(r.totalAmount)}
                  </td>
                  <td className="tnum whitespace-nowrap text-ink-2">{ymd(r.requestedAt)}</td>
                  <td>
                    <Badge tone={STATUS_TONE[r.status as ReceiptStatus] ?? "neutral"}>
                      {RECEIPT_STATUS[r.status as ReceiptStatus] ?? r.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1.5">
                      {r.status === "REQUESTED" && (
                        <form action={issueReceipt.bind(null, r.id)}>
                          <SubmitButton className="btn btn-primary btn-sm" pendingLabel="발급 중…">
                            발급
                          </SubmitButton>
                        </form>
                      )}
                      <Link href={`/receipts/${r.id}`} className="btn btn-ghost btn-sm">
                        보기
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}

      {/* 교회가 직접 발급 */}
      <div className="mt-5">
        <Card>
          <CardTitle>교회에서 직접 발급</CardTitle>
          <p className="mb-4 text-sm leading-relaxed text-ink-3">
            온라인 신청이 어려운 성도님을 위해 교회가 대신 발급할 수 있습니다.
            주민등록번호는 비워 두어도 발급되며, 나중에 다시 입력할 수 있습니다.
          </p>
          <form action={issueReceiptForMember} className="grid gap-4 sm:grid-cols-2">
            <Field label="교인" required>
              <select name="memberId" className="field" required>
                <option value="">선택하세요</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="귀속 연도" required>
              <select name="year" className="field" required defaultValue={year}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}년
                  </option>
                ))}
              </select>
            </Field>
            <Field label="주민등록번호">
              <input
                name="regNo"
                className="field tnum"
                inputMode="numeric"
                maxLength={14}
                placeholder="예) 901231-1234567"
              />
            </Field>
            <Field label="주소">
              <input name="address" className="field" placeholder="비우면 교적의 주소를 씁니다" />
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <SubmitButton pendingLabel="발급 중…">발급하기</SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
