import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { decryptSensitive } from "@/lib/crypto";
import { RECEIPT_STATUS, type ReceiptStatus } from "@/lib/constants";
import { ymd } from "@/lib/format";
import { Alert, Badge, Card, CardTitle, Field } from "@/components/ui";
import { ConfirmSubmitButton, PrintButton, SubmitButton } from "@/components/form";
import { ReceiptDocument } from "@/components/receipt-document";
import { cancelReceipt, issueReceipt, refreshReceipt, rejectReceipt } from "@/actions/receipts";

export const metadata = { title: "기부금영수증 상세" };

const MESSAGES: Record<string, string> = {
  issued: "영수증이 발급되었습니다. 아래 문서를 인쇄하거나 PDF로 저장할 수 있습니다.",
  refreshed: "최신 헌금 내역으로 금액을 다시 계산했습니다.",
};

export default async function ReceiptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const staff = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;

  const receipt = await prisma.donationReceipt.findUnique({
    where: { id },
    include: { items: true, member: true, issuedBy: true },
  });
  if (!receipt || receipt.churchId !== staff.churchId) notFound();

  const church = await getChurch(staff.churchId);
  const isIssued = receipt.status === "ISSUED";

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/receipts"
          className="inline-flex items-center gap-1 text-sm text-ink-3 transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> 기부금영수증
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={
              isIssued
                ? "income"
                : receipt.status === "REJECTED"
                  ? "expense"
                  : receipt.status === "CANCELED"
                    ? "neutral"
                    : "warn"
            }
          >
            {RECEIPT_STATUS[receipt.status as ReceiptStatus] ?? receipt.status}
          </Badge>
          {isIssued && (
            <>
              <form action={refreshReceipt.bind(null, receipt.id)}>
                <SubmitButton className="btn btn-ghost" pendingLabel="계산 중…">
                  금액 재계산
                </SubmitButton>
              </form>
              <PrintButton className="btn btn-primary" />
            </>
          )}
          {receipt.status === "REQUESTED" && (
            <form action={issueReceipt.bind(null, receipt.id)}>
              <SubmitButton pendingLabel="발급 중…">발급하기</SubmitButton>
            </form>
          )}
        </div>
      </div>

      {sp.ok && MESSAGES[sp.ok] && (
        <div className="no-print mb-5">
          <Alert tone="income">{MESSAGES[sp.ok]}</Alert>
        </div>
      )}

      {!isIssued && (
        <div className="no-print mb-5">
          <Alert tone="warn">
            아직 발급되지 않은 신청입니다. 아래는 발급될 내용의 미리보기입니다.
          </Alert>
        </div>
      )}

      <ReceiptDocument
        receipt={{
          receiptNo: receipt.receiptNo,
          year: receipt.year,
          donorName: receipt.donorName,
          donorRegNo: receipt.donorRegNoEnc
            ? decryptSensitive(receipt.donorRegNoEnc)
            : null,
          donorAddress: receipt.donorAddress,
          donorPhone: receipt.donorPhone,
          totalAmount: receipt.totalAmount,
          issuedAt: receipt.issuedAt,
          items: receipt.items,
        }}
        church={{
          name: church.name,
          regNo: church.regNo,
          representative: church.representative,
          address: church.address,
          sealUrl: church.sealUrl,
        }}
      />

      {/* 처리 이력 및 관리 */}
      <div className="no-print mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>처리 정보</CardTitle>
          <dl className="divide-y divide-line text-sm">
            <Row term="신청일">{ymd(receipt.requestedAt)}</Row>
            <Row term="발급일">{receipt.issuedAt ? ymd(receipt.issuedAt) : "-"}</Row>
            <Row term="발급자">{receipt.issuedBy?.name ?? "-"}</Row>
            <Row term="교적번호">{receipt.member.code}</Row>
            <Row term="연락처">{receipt.donorPhone ?? "-"}</Row>
            {receipt.rejectReason && <Row term="반려 사유">{receipt.rejectReason}</Row>}
          </dl>
        </Card>

        <Card>
          <CardTitle>영수증 관리</CardTitle>
          <div className="space-y-4">
            {receipt.status === "REQUESTED" && (
              <form action={rejectReceipt.bind(null, receipt.id)} className="space-y-2">
                <Field label="반려 사유">
                  <input
                    name="reason"
                    className="field"
                    placeholder="예) 주민등록번호 확인 필요"
                  />
                </Field>
                <ConfirmSubmitButton
                  className="btn btn-danger w-full"
                  message="이 신청을 반려할까요?"
                >
                  신청 반려
                </ConfirmSubmitButton>
              </form>
            )}

            {receipt.status !== "CANCELED" && (
              <form action={cancelReceipt.bind(null, receipt.id)}>
                <ConfirmSubmitButton
                  className="btn btn-danger w-full"
                  message="이 영수증을 취소할까요? 성도님이 다시 신청할 수 있게 됩니다."
                >
                  영수증 취소
                </ConfirmSubmitButton>
              </form>
            )}

            <p className="text-xs leading-relaxed text-ink-3">
              발급 후 헌금 내역이 수정되었다면 &lsquo;금액 재계산&rsquo;을 눌러 최신 장부와
              맞춘 뒤 다시 인쇄해 주세요.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-2.5">
      <dt className="font-medium text-ink-3">{term}</dt>
      <dd className="tnum min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}
