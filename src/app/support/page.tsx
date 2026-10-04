import Link from "next/link";
import { LegalSection, LegalShell } from "@/components/legal-shell";
import { OPERATOR } from "@/lib/legal";

export const metadata = { title: "고객지원" };

export default function SupportPage() {
  const { service, email } = OPERATOR;
  return (
    <LegalShell title="고객지원">
      <p>
        {service}는 작은 교회가 교적·출석·심방·헌금·지출·기부금영수증을 한곳에서 관리하도록 만든 서비스입니다. 궁금한
        점이나 불편한 점은 언제든 알려 주세요.
      </p>

      <LegalSection title="문의하기">
        <p>
          이메일:{" "}
          <a href={`mailto:${email}`} className="font-semibold text-primary underline">
            {email}
          </a>
        </p>
        <p className="text-sm text-ink-3">보통 1~2일 안에 답을 드립니다.</p>
      </LegalSection>

      <LegalSection title="사진·댓글·채팅 신고와 차단">
        <p>
          교회 소통(사진·댓글·채팅)에서 부적절한 글을 보셨다면 글 옆 <b>⋯</b> 메뉴(채팅은 말풍선)에서 <b>신고</b> 또는
          <b> 차단</b>을 눌러 주세요. 신고된 글은 교회 관리자가 확인해 삭제하며, 앱 운영자에게도 {email} 로 알려 주실 수
          있습니다. 보통 1~2일 안에 조치합니다.
        </p>
      </LegalSection>

      <LegalSection title="자주 묻는 질문">
        <p>
          <b>우리 교회도 쓸 수 있나요?</b>
          <br />
          네. 웹 브라우저로 <Link href="/register-church" className="text-primary underline">교회 등록</Link>에서 교회를
          만든 뒤, 같은 아이디로 앱에 로그인하시면 됩니다. 교회마다 자료가 완전히 분리됩니다.
        </p>
        <p>
          <b>먼저 둘러볼 수 있나요?</b>
          <br />
          로그인 화면의 <b>체험해 보기</b>를 누르면 예시 자료가 든 체험용 교회로 들어갑니다. 체험용 자료는 매일 새로
          채워집니다.
        </p>
        <p>
          <b>성도는 어떻게 가입하나요?</b>
          <br />
          로그인 화면의 <b>성도 가입 신청</b>에서 교회를 고르고 신청하면, 교회 관리자가 승인한 뒤 본인의 헌금 내역과
          기부금영수증을 볼 수 있습니다.
        </p>
        <p>
          <b>계정을 지우고 싶어요.</b>
          <br />앱에서 <b>내 정보 → 계정 삭제</b>를 누르면 바로 지워집니다. 교회 관리자가 혼자라면 교회 전체를 삭제할
          수 있습니다.
        </p>
        <p>
          <b>개인정보는 어떻게 다루나요?</b>
          <br />
          <Link href="/privacy" className="text-primary underline">개인정보처리방침</Link>을 확인해 주세요.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
