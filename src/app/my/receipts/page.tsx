import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { getMemberYearOfferings } from "@/lib/finance";
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
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form";
import { AddressFields } from "@/components/address-fields";
import { IconChevronRight, IconReceipt } from "@/components/icons";
import { cancelReceipt, requestReceipt } from "@/actions/receipts";

export const metadata = { title: "기부금영수증" };

const MESSAGES: Record<string, { tone: "expense" | "income" | "warn"; text: string }> = {
  regno: {
    tone: "expense",
    text: "주민등록번호 13자리를 정확히 입력해 주세요.",
  },
  address: { tone: "expense", text: "주소를 입력해 주세요." },
  year: { tone: "expense", text: "신청 연도를 다시 선택해 주세요." },
  duplicate: {
    tone: "warn",
    text: "해당 연도는 이미 신청하셨습니다. 아래 목록에서 확인해 주세요.",
  },
  "no-offering": {
    tone: "warn",
    text: "해당 연도에 공제 대상 헌금 기록이 없습니다. 교회 사무실에 문의해 주세요.",
  },
  "already-issued": {
    tone: "warn",
    text: "이미 발급된 영수증은 교회 사무실을 통해서만 취소할 수 있습니다.",
  },
  requested: {
    tone: "income",
    text: "신청이 접수되었습니다. 교회에서 확인 후 발급해 드립니다.",
  },
  canceled: { tone: "income", text: "신청이 취소되었습니다." },
};

export default async function MyReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;

  if (!user.memberId) {
    return (
      <>
        <PageHeader title="기부금영수증" />
        <Alert tone="warn">교적 정보가 연결되어 있지 않습니다. 교회 사무실에 문의해 주세요.</Alert>
      </>
    );
  }

  const memberId = user.memberId;
  const thisYear = new Date().getFullYear();
  const candidateYears = [thisYear - 1, thisYear, thisYear - 2, thisYear - 3];

  const [member, church, receipts, yearTotals] = await Promise.all([
    prisma.member.findUnique({ where: { id: memberId } }),
    getChurch(user.churchId),
    prisma.donationReceipt.findMany({
      where: { churchId: user.churchId, memberId },
      orderBy: { year: "desc" },
    }),
    Promise.all(
      candidateYears.map(async (y) => ({
        year: y,
        total: (await getMemberYearOfferings(memberId, y)).deductibleTotal,
      })),
    ),
  ]);

  // 아직 신청하지 않았고 헌금이 있는 연도만 신청 대상으로 보여 준다.
  const requestedYears = new Set(
    receipts.filter((r) => r.status !== "CANCELED").map((r) => r.year),
  );
  const availableYears = yearTotals
    .filter((y) => y.total > 0 && !requestedYears.has(y.year))
    .sort((a, b) => b.year - a.year);

  const message = sp.error ? MESSAGES[sp.error] : sp.ok ? MESSAGES[sp.ok] : undefined;

  return (
    <>
      <PageHeader
        title="기부금영수증"
        description="연말정산용 기부금영수증을 온라인으로 신청하고 바로 출력하실 수 있습니다."
      />

      {message && (
        <div className="mb-5">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {/* 신청 폼 */}
      {availableYears.length > 0 ? (
        <Card className="mb-5">
          <CardTitle>영수증 신청</CardTitle>
          <form action={requestReceipt} className="space-y-4">
            <Field label="신청 연도" required>
              <select name="year" className="field" required defaultValue={availableYears[0].year}>
                {availableYears.map((y) => (
                  <option key={y.year} value={y.year}>
                    {y.year}년 귀속 · {won(y.total)}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="주민등록번호"
              required
              hint="연말정산 서류 발급에 필요합니다. 암호화하여 안전하게 보관되며 영수증 발급 외의 용도로 쓰이지 않습니다."
            >
              <input
                name="regNo"
                className="field tnum"
                inputMode="numeric"
                placeholder="예) 901231-1234567"
                maxLength={14}
                required
              />
            </Field>

            <AddressFields
              label="주소"
              required
              defaultPostal={member?.postalCode ?? ""}
              defaultAddress={member?.address ?? ""}
              defaultDetail={member?.addressDetail ?? ""}
            />

            <Field label="연락처">
              <input
                name="phone"
                type="tel"
                className="field"
                defaultValue={member?.phone ?? ""}
              />
            </Field>

            <div className="rounded-xl bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-2">
              {church.receiptAutoIssue
                ? "신청하시면 바로 발급되어 곧장 화면에서 확인·출력하실 수 있습니다."
                : "신청 후 교회에서 확인하면 발급됩니다. 발급되면 이 화면에서 바로 확인하실 수 있습니다."}
            </div>

            <SubmitButton className="btn btn-primary w-full py-3" pendingLabel="신청 중…">
              {church.receiptAutoIssue ? "신청하고 바로 발급받기" : "영수증 신청하기"}
            </SubmitButton>
          </form>
        </Card>
      ) : (
        <Card className="mb-5">
          <EmptyState
            icon={<IconReceipt />}
            title="지금 신청할 수 있는 연도가 없습니다"
            description={
              receipts.length > 0
                ? "이미 모든 연도를 신청하셨습니다. 아래에서 발급 상태를 확인해 주세요."
                : "아직 기록된 헌금이 없거나 공제 대상 헌금이 없습니다. 교회 사무실에 문의해 주세요."
            }
          />
        </Card>
      )}

      {/* 신청·발급 목록 */}
      {receipts.length > 0 && (
        <>
          <h2 className="mb-2.5 px-1 text-[0.95rem] font-bold text-ink">신청 내역</h2>
          <Card padded={false}>
            <ul className="divide-y divide-line">
              {receipts.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="tnum text-sm font-semibold text-ink">{r.year}년 귀속</p>
                    <p className="tnum text-xs text-ink-3">
                      {won(r.totalAmount)}
                      {r.issuedAt
                        ? ` · 발급 ${ymd(r.issuedAt)}`
                        : ` · 신청 ${ymd(r.requestedAt)}`}
                    </p>
                    {r.status === "REJECTED" && r.rejectReason && (
                      <p className="mt-1 text-xs text-expense">사유: {r.rejectReason}</p>
                    )}
                  </div>

                  <Badge
                    tone={
                      r.status === "ISSUED"
                        ? "income"
                        : r.status === "REJECTED"
                          ? "expense"
                          : r.status === "CANCELED"
                            ? "neutral"
                            : "warn"
                    }
                  >
                    {RECEIPT_STATUS[r.status as ReceiptStatus] ?? r.status}
                  </Badge>

                  {r.status === "ISSUED" ? (
                    <Link href={`/my/receipts/${r.id}`} className="btn btn-primary btn-sm">
                      열기
                      <IconChevronRight width={14} height={14} />
                    </Link>
                  ) : r.status === "REQUESTED" ? (
                    <form action={cancelReceipt.bind(null, r.id)}>
                      <ConfirmSubmitButton
                        className="btn btn-danger btn-sm"
                        message={`${r.year}년 영수증 신청을 취소할까요?`}
                      >
                        취소
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <p className="mt-6 text-center text-xs leading-relaxed text-ink-3">
        발급된 영수증은 화면에서 바로 인쇄하거나 PDF로 저장하실 수 있습니다.
        <br />
        문의: {church.name} 사무실{church.phone && ` · ${church.phone}`}
      </p>
    </>
  );
}
