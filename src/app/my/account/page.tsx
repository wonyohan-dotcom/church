import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getChurch, otherAdminCount } from "@/lib/church";
import { ROLES } from "@/lib/constants";
import { Alert, Card, CardTitle, PageHeader } from "@/components/ui";
import { ConfirmSubmitButton } from "@/components/form";
import { deleteMyAccount, deleteMyChurch } from "./actions";

export const metadata = { title: "내 정보" };

const ERROR: Record<string, string> = {
  demo: "체험용 계정과 체험용 교회는 삭제할 수 없습니다. 매일 새벽 원래대로 돌아갑니다.",
  confirm: "확인 칸에 ‘삭제’ 두 글자를 적어 주세요.",
  "last-admin": "교회의 마지막 관리자라서 계정만 지울 수 없습니다. 아래에서 다른 관리자를 지정하거나 교회를 삭제해 주세요.",
  "church-name": "교회 이름이 맞지 않습니다. 화면에 보이는 이름을 그대로 적어 주세요.",
};

export default async function MyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const church = await getChurch(user.churchId);
  const lastAdmin = user.role === "ADMIN" && (await otherAdminCount(user.churchId, user.id)) === 0;

  return (
    <>
      <PageHeader title="내 정보" />

      {sp.error && ERROR[sp.error] && (
        <div className="mb-5">
          <Alert tone="warn">{ERROR[sp.error]}</Alert>
        </div>
      )}

      <Card className="mb-5">
        <dl className="grid grid-cols-[5rem_1fr] gap-y-2 text-sm">
          <dt className="text-ink-3">이름</dt>
          <dd className="font-semibold text-ink">{user.name}</dd>
          <dt className="text-ink-3">아이디</dt>
          <dd className="text-ink">{user.loginId}</dd>
          <dt className="text-ink-3">교회</dt>
          <dd className="text-ink">{church.name}</dd>
          <dt className="text-ink-3">역할</dt>
          <dd className="text-ink">{ROLES[user.role]}</dd>
        </dl>
        <p className="mt-4 text-xs text-ink-3">
          개인정보를 어떻게 다루는지는{" "}
          <Link href="/privacy" className="text-primary underline">
            개인정보처리방침
          </Link>
          에서 볼 수 있습니다.
        </p>
      </Card>

      <Card>
        <CardTitle>계정 삭제</CardTitle>
        {church.isDemo ? (
          <p className="text-sm text-ink-2">체험용 계정은 삭제할 수 없습니다. 자료는 매일 새벽 원래대로 돌아갑니다.</p>
        ) : !lastAdmin ? (
          <form action={deleteMyAccount} className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-2">
              계정을 지우면 아이디·비밀번호와 알림 설정이 바로 지워지고 다시 로그인할 수 없습니다. 교회가 관리하는
              교적·헌금 기록은 교회에 남습니다. 그 기록도 지우려면 교회 사무실에 요청해 주세요.
            </p>
            <label className="block text-sm">
              <span className="label">확인을 위해 ‘삭제’라고 적어 주세요</span>
              <input name="confirm" className="field" autoComplete="off" required />
            </label>
            <ConfirmSubmitButton className="btn btn-danger w-full" message="정말 계정을 삭제할까요? 되돌릴 수 없습니다.">
              내 계정 삭제
            </ConfirmSubmitButton>
          </form>
        ) : (
          <form action={deleteMyChurch} className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-2">
              <b>계정 삭제를 지원합니다.</b> 이 교회의 <b>마지막 관리자</b>라서, 계정을 지우면 교회 전체가 함께 삭제됩니다. 교인·출석·심방·헌금·지출·
              영수증·사진 등 <b>모든 자료가 바로 지워지고 되돌릴 수 없습니다.</b>
            </p>
            <p className="text-sm text-ink-3">
              교회는 두고 내 계정만 지우려면, 먼저{" "}
              <Link href="/settings" className="text-primary underline">
                설정 → 사용자
              </Link>
              에서 다른 분을 관리자로 지정해 주세요.
            </p>
            <label className="block text-sm">
              <span className="label">
                확인을 위해 교회 이름 <b>{church.name}</b> 을(를) 적어 주세요
              </span>
              <input name="churchName" className="field" autoComplete="off" required />
            </label>
            <ConfirmSubmitButton
              className="btn btn-danger w-full"
              message="교회와 모든 자료를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?"
            >
              계정 삭제 (교회 자료도 모두 삭제)
            </ConfirmSubmitButton>
          </form>
        )}
      </Card>
    </>
  );
}
