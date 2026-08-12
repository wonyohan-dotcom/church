import { won, ymd } from "@/lib/format";

export type ReceiptDoc = {
  receiptNo: string;
  year: number;
  donorName: string;
  donorRegNo: string | null; // 이미 복호화된 값 (없으면 null)
  donorAddress: string | null;
  donorPhone: string | null;
  totalAmount: number;
  issuedAt: Date | null;
  items: Array<{ accountName: string; amount: number; count: number; donationCode: string }>;
};

export type ChurchDoc = {
  name: string;
  regNo: string | null;
  representative: string | null;
  address: string | null;
  sealUrl: string | null;
};

function formatRegNo(v: string | null) {
  if (!v) return "";
  const d = v.replace(/\D/g, "");
  if (d.length !== 13) return v;
  return `${d.slice(0, 6)} - ${d.slice(6)}`;
}

/**
 * 소득세법 시행규칙 별지 제45호의2 서식(기부금영수증)의 구성을 따른 인쇄용 문서.
 * 화면과 종이에서 같은 모양으로 보이도록 테두리를 직접 그린다.
 */
export function ReceiptDocument({
  receipt,
  church,
}: {
  receipt: ReceiptDoc;
  church: ChurchDoc;
}) {
  const issued = receipt.issuedAt ?? new Date();
  const cell = "border border-line-strong px-2.5 py-2 align-middle";
  const head = `${cell} bg-surface-2 text-xs font-semibold text-ink-2 whitespace-nowrap`;

  return (
    <article className="print-page card mx-auto max-w-3xl overflow-x-auto p-6 sm:p-8">
      <header className="mb-5 text-center">
        <p className="text-xs text-ink-3">일련번호 {receipt.receiptNo}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[0.2em] text-ink">기부금영수증</h1>
        <p className="mt-1.5 text-sm text-ink-2">
          {receipt.year}년 귀속 ({receipt.year}. 01. 01. ~ {receipt.year}. 12. 31.)
        </p>
      </header>

      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <tbody>
          {/* ① 기부자 */}
          <tr>
            <th className={`${head} w-24`} rowSpan={2}>
              ① 기부자
            </th>
            <th className={`${head} w-24`}>성명</th>
            <td className={`${cell} font-semibold text-ink`}>{receipt.donorName}</td>
            <th className={`${head} w-28`}>주민등록번호</th>
            <td className={`${cell} tnum`}>{formatRegNo(receipt.donorRegNo) || "-"}</td>
          </tr>
          <tr>
            <th className={head}>주소</th>
            <td className={cell} colSpan={3}>
              {receipt.donorAddress ?? "-"}
            </td>
          </tr>

          {/* ② 기부금 단체 */}
          <tr>
            <th className={head} rowSpan={2}>
              ② 기부금
              <br />
              단체
            </th>
            <th className={head}>단체명</th>
            <td className={`${cell} font-semibold text-ink`}>{church.name}</td>
            <th className={head}>
              사업자등록번호
              <br />
              (고유번호)
            </th>
            <td className={`${cell} tnum`}>{church.regNo ?? "-"}</td>
          </tr>
          <tr>
            <th className={head}>소재지</th>
            <td className={cell} colSpan={3}>
              {church.address ?? "-"}
            </td>
          </tr>

          {/* ③ 기부내용 */}
          <tr>
            <th className={head} rowSpan={receipt.items.length + 2}>
              ③ 기부내용
            </th>
            <th className={head}>유형</th>
            <th className={head}>코드</th>
            <th className={head}>내용</th>
            <th className={`${head} text-right`}>금액</th>
          </tr>
          {receipt.items.length === 0 ? (
            <tr>
              <td className={`${cell} text-center text-ink-3`} colSpan={4}>
                해당 연도에 공제 대상 기부금이 없습니다.
              </td>
            </tr>
          ) : (
            receipt.items.map((item, i) => (
              <tr key={`${item.accountName}-${i}`}>
                <td className={`${cell} whitespace-nowrap`}>종교단체 기부금</td>
                <td className={`${cell} tnum text-center`}>{item.donationCode}</td>
                <td className={cell}>
                  {item.accountName}
                  <span className="ml-1.5 text-xs text-ink-3">({item.count}회)</span>
                </td>
                <td className={`${cell} tnum text-right font-semibold`}>{won(item.amount)}</td>
              </tr>
            ))
          )}
          <tr>
            <th className={`${head} text-center`} colSpan={3}>
              합계
            </th>
            <td className={`${cell} tnum bg-surface-2 text-right text-base font-bold text-ink`}>
              {won(receipt.totalAmount)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="mt-6 text-center text-sm leading-relaxed text-ink">
        「소득세법」 제34조, 「조세특례제한법」 제76조·제88조의4에 따른 기부금을
        <br />
        위와 같이 기부하였음을 증명하여 주시기 바랍니다.
      </p>

      <p className="mt-6 text-center text-sm font-medium text-ink">
        {issued.getFullYear()}년 {issued.getMonth() + 1}월 {issued.getDate()}일
      </p>

      <div className="mt-6 space-y-3 text-sm">
        <p className="flex items-center justify-end gap-3">
          <span className="text-ink-2">신청인</span>
          <span className="min-w-[7rem] border-b border-line-strong pb-0.5 text-center font-semibold text-ink">
            {receipt.donorName}
          </span>
          <span className="text-ink-3">(서명 또는 인)</span>
        </p>
        <p className="flex items-center justify-end gap-3">
          <span className="text-ink-2">기부금 수령인</span>
          <span className="relative min-w-[7rem] border-b border-line-strong pb-0.5 text-center font-semibold text-ink">
            {church.representative ?? church.name}
            {church.sealUrl && (
              // 직인 이미지는 관리자가 올린 파일이라 next/image 대신 기본 img를 쓴다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={church.sealUrl}
                alt=""
                className="absolute -right-6 -top-3 h-12 w-12 object-contain opacity-90"
              />
            )}
          </span>
          <span className="text-ink-3">(서명 또는 인)</span>
        </p>
      </div>

      <footer className="mt-8 border-t border-line pt-3 text-center text-xs text-ink-3">
        {church.name}
        {church.address && ` · ${church.address}`}
        <br />
        발급일 {ymd(issued)} · 일련번호 {receipt.receiptNo}
      </footer>
    </article>
  );
}
