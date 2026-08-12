import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { decryptSensitive } from "@/lib/crypto";
import { Alert } from "@/components/ui";
import { PrintButton } from "@/components/form";
import { ReceiptDocument } from "@/components/receipt-document";

export const metadata = { title: "기부금영수증" };

export default async function MyReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  const receipt = await prisma.donationReceipt.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!receipt) notFound();

  // 본인 영수증만 볼 수 있다.
  if (receipt.churchId !== user.churchId || receipt.memberId !== user.memberId) {
    redirect("/my/receipts");
  }
  if (receipt.status !== "ISSUED") redirect("/my/receipts");

  const church = await getChurch(user.churchId);

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/my/receipts"
          className="inline-flex items-center gap-1 text-sm text-ink-3 transition-colors hover:text-ink"
        >
          <span aria-hidden>←</span> 기부금영수증
        </Link>
        <PrintButton className="btn btn-primary" />
      </div>

      {sp.ok === "issued" && (
        <div className="no-print mb-5">
          <Alert tone="income">
            영수증이 발급되었습니다. 아래 문서를 인쇄하거나 PDF로 저장해 사용하세요.
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

      <p className="no-print mt-5 text-center text-xs leading-relaxed text-ink-3">
        이 문서에는 주민등록번호가 포함되어 있습니다. 출력물 관리에 유의해 주세요.
      </p>
    </>
  );
}
