import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { Alert, Card, CardTitle, Field, PageHeader } from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form";
import { CopyButton } from "@/components/copy-button";
import { PushToggle } from "@/components/push-toggle";
import {
  disableBankInbox,
  enableBankInbox,
  regenerateBankToken,
  saveBankOptions,
} from "../actions";

export const metadata = { title: "입출금 알림 받기 설정" };

const OK: Record<string, string> = {
  enabled: "연결 주소를 만들었습니다. 아래 2단계에서 복사해 단축어에 넣어 주세요.",
  regenerated: "새 주소를 만들었습니다. 이전 주소는 이제 쓸 수 없으니 단축어의 주소도 바꿔 주세요.",
  disabled: "연결을 끊었습니다. 휴대폰 단축어가 보내는 문자는 더 이상 받지 않습니다.",
  saved: "저장했습니다.",
};

async function siteOrigin() {
  // Vercel 에서는 고정된 대표 주소를 쓴다. 미리보기 주소로 연결해 두면 나중에 끊기기 때문이다.
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function Step({ n, title, children, id }: { n: number; title: string; children: React.ReactNode; id?: string }) {
  return (
    <Card>
      <div id={id} className="mb-3 flex scroll-mt-20 items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-ink">
          {n}
        </span>
        <h2 className="text-[0.95rem] font-bold text-ink">{title}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-ink-2">{children}</div>
    </Card>
  );
}

export default async function BankSetupPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const staff = await requireFinance();
  const sp = await searchParams;

  const [church, incomeAccounts] = await Promise.all([
    prisma.church.findUnique({
      where: { id: staff.churchId },
      select: { bankToken: true, bankAutoRecord: true, bankIncomeAccountId: true },
    }),
    prisma.account.findMany({
      where: { churchId: staff.churchId, type: "INCOME", active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const url = church?.bankToken
    ? `${await siteOrigin()}/api/bank/inbound/${church.bankToken}`
    : null;

  return (
    <>
      <PageHeader
        title="입출금 알림 받기 설정"
        description="교회 통장(기업은행·농협)에 돈이 들어오거나 나갈 때 오는 문자를 자동으로 받아 장부에 넣습니다."
        back={{ href: "/finance/bank", label: "입출금 알림함" }}
      />

      {sp.ok && OK[sp.ok] && (
        <div className="mb-5">
          <Alert tone="income">{OK[sp.ok]}</Alert>
        </div>
      )}

      <div className="space-y-4">
        <Card className="bg-surface-2">
          <p className="text-sm leading-relaxed text-ink-2">
            <b className="text-ink">어떻게 동작하나요?</b>
            <br />
            아이폰은 보안 때문에 다른 앱(은행 앱)의 <b>푸시 알림</b>을 읽을 수 없게 막아 두었습니다.
            대신 <b>문자(SMS)</b>는 아이폰의 기본 앱인 ‘단축어’가 읽어서 보낼 수 있습니다. 그래서
            은행 입출금 알림을 <b>문자</b>로 받도록 바꾸고, 단축어가 그 문자를 이 앱으로 보내게 합니다.
            휴대폰에서 한 번만 설정하면 그다음부터는 아무것도 누르지 않아도 됩니다.
          </p>
        </Card>

        <Step n={1} title="은행에서 입출금 ‘문자(SMS)’ 알림 신청">
          <p>교회 통장 알림을 받는 휴대폰으로, 앱 푸시가 아니라 <b>문자</b>로 받도록 신청합니다.</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <b>기업은행</b>: i-ONE Bank(기업) 앱 또는 지점에서 <b>‘입출금 문자(SMS) 통지’</b> 신청
            </li>
            <li>
              <b>농협</b>: NH기업뱅킹·NH스마트뱅킹 앱 또는 지점에서 <b>‘입출금 문자(SMS) 알림’</b> 신청
            </li>
          </ul>
          <p className="text-xs text-ink-3">
            문자 알림은 은행에 따라 한 달에 몇백 원~천 원 정도 이용료가 있을 수 있습니다. 교회(단체)
            명의 통장은 지점 창구에서 신청해야 할 수도 있습니다.
          </p>
          <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
            <b>입금·출금 둘 다</b> 문자로 받도록 해 주세요. 출금 문자만 오고 있다면 은행 알림 설정에서
            입금도 켜야 합니다. 그 전까지는 문자에 찍힌 <b>잔액</b>을 앞뒤로 맞춰 보고, 문자 없이
            들어온 돈을 알림함에 ‘문자 없음’으로 띄워 드립니다.
          </p>
        </Step>

        <Step n={2} title="이 교회 전용 연결 주소 만들기" id="step-2">
          {url ? (
            <>
              <p>아래 주소를 복사해 두세요. 3단계에서 단축어에 붙여넣습니다.</p>
              <div className="rounded-xl border border-line bg-surface-2 p-3">
                <p className="break-all font-mono text-xs text-ink">{url}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyButton text={url} label="주소 복사" className="btn btn-primary btn-sm" />
                <a href={url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
                  연결 확인 (새 창)
                </a>
              </div>
              <p className="text-xs text-ink-3">
                이 주소는 비밀번호와 같습니다. 단축어에만 넣고 다른 사람에게 보내지 마세요.
                주소를 아는 사람은 알림함에 글을 넣을 수 있습니다(장부를 보거나 고칠 수는 없습니다).
              </p>
            </>
          ) : (
            <form action={enableBankInbox}>
              <SubmitButton pendingLabel="만드는 중…">연결 주소 만들기</SubmitButton>
            </form>
          )}
        </Step>

        <Step n={3} title="아이폰 ‘단축어’ 앱에 자동화 만들기 (한 번만)">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              아이폰에서 <b>단축어</b> 앱을 엽니다. (없으면 App Store 에서 ‘단축어’ 설치)
            </li>
            <li>
              아래쪽 <b>자동화</b> 탭 → 오른쪽 위 <b>＋</b> (처음이면 ‘새로운 자동화’)
            </li>
            <li>
              목록에서 <b>메시지</b>를 고릅니다.
            </li>
            <li>
              <b>메시지 포함</b> 칸에 <b>잔액</b> 이라고 적습니다. (기업은행·농협 입출금 문자에는
              모두 ‘잔액’이 들어 있어, 인증번호 같은 다른 문자는 보내지 않습니다)
            </li>
            <li>
              아래에서 <b>즉시 실행</b>을 고르고, ‘실행 시 알림’은 꺼 둡니다. → 오른쪽 위 <b>다음</b>
            </li>
            <li>
              <b>새로운 빈 자동화</b> → <b>동작 추가</b> → 검색창에 <b>URL</b> →{" "}
              <b>URL 콘텐츠 가져오기</b>
            </li>
            <li>
              파란 글씨 <b>URL</b>을 누르고 2단계에서 복사한 주소를 붙여넣습니다.
            </li>
            <li>
              동작 오른쪽의 <b>›</b> (펼치기)를 누르고:
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>
                  방법: <b>POST</b>
                </li>
                <li>
                  요청 본문: <b>JSON</b> → <b>새로운 필드 추가</b> → <b>텍스트</b>
                </li>
                <li>
                  키: <b>text</b> (영어 소문자)
                </li>
                <li>
                  값: 칸을 누르고 키보드 위에 뜨는 <b>단축어 입력</b>을 고른 다음, 다시 그
                  ‘단축어 입력’을 눌러 <b>내용</b>으로 바꿉니다.
                </li>
              </ul>
            </li>
            <li>
              오른쪽 위 <b>완료</b>. 끝입니다.
            </li>
          </ol>
          <p className="text-xs text-ink-3">
            iOS 버전에 따라 글자가 조금 다를 수 있습니다(예: ‘메시지에 포함’, ‘Contents’). 휴대폰이
            잠겨 있어도 동작합니다. 교회 통장 문자를 받는 휴대폰에서 설정해야 합니다.
          </p>
        </Step>

        <Step n={4} title="잘 되는지 확인">
          <p>
            교회 통장에 입출금이 생겨 문자가 오면, 몇 초 안에{" "}
            <Link href="/finance/bank" className="text-primary underline">
              입출금 알림함
            </Link>
            에 나타납니다. 알림 켜기를 해 두셨다면 회계 담당자 휴대폰으로 푸시 알림도 갑니다.
          </p>
          <p>
            바로 시험해 보려면, 전에 받은 은행 문자를 복사해 알림함 아래 ‘문자 직접 붙여넣기’에 넣어
            보세요. 제대로 읽히는지 확인할 수 있습니다.
          </p>
        </Step>

        <Step n={5} title="이 휴대폰으로 알림 받기 (선택)">
          <p>
            입출금이 들어와 자동으로 기록되거나 확인이 필요할 때, 이 휴대폰으로 알림을 보냅니다. 아이폰은 사파리에서 이
            사이트를 연 뒤 <b>공유 → 홈 화면에 추가</b>로 설치한 아이콘에서 켜야 합니다. (TestFlight 앱에서는 아이폰
            정책상 이 알림이 오지 않습니다)
          </p>
          <PushToggle />
        </Step>

        <Card>
          <div id="options" className="scroll-mt-20" />
          <CardTitle>자동 기록</CardTitle>
          <form action={saveBankOptions} className="space-y-4">
            <label className="flex items-start gap-2.5 text-sm text-ink-2">
              <input
                type="checkbox"
                name="autoRecord"
                value="1"
                defaultChecked={church?.bankAutoRecord ?? false}
                className="mt-0.5"
              />
              <span>
                <b className="text-ink">확인 없이 바로 장부에 기록</b>
                <br />
                입금은 아래 기본 헌금 항목으로(입금자 이름과 같은 교인이 한 명뿐이면 그 교인으로),
                출금은 전에 같은 곳으로 보낸 기록이 있을 때 그 항목으로 자동 기록합니다. 판단이 서지
                않는 거래만 알림함에 남습니다. 기록된 내용은 언제든 고칠 수 있습니다.
              </span>
            </label>
            <Field
              label="입금 기본 헌금 항목"
              hint="추천·자동 기록에 쓰입니다. 같은 사람이 전에 다른 항목으로 기록된 적이 있으면 그 항목을 먼저 씁니다."
            >
              <select
                name="incomeAccountId"
                className="field"
                defaultValue={church?.bankIncomeAccountId ?? ""}
              >
                <option value="">정하지 않음 (매번 고르기)</option>
                {incomeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end">
              <SubmitButton>저장</SubmitButton>
            </div>
          </form>
        </Card>

        {url && (
          <Card>
            <CardTitle>연결 관리</CardTitle>
            <p className="mb-3 text-sm text-ink-3">
              주소가 다른 사람에게 알려졌다면 새 주소를 만드세요. 이전 주소는 바로 막힙니다.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action={regenerateBankToken}>
                <ConfirmSubmitButton
                  className="btn btn-ghost btn-sm"
                  message="새 주소를 만들면 휴대폰 단축어의 주소도 바꿔야 합니다. 계속할까요?"
                >
                  새 주소 만들기
                </ConfirmSubmitButton>
              </form>
              <form action={disableBankInbox}>
                <ConfirmSubmitButton
                  className="btn btn-quiet btn-sm"
                  message="연결을 끊을까요? 이미 들어온 알림은 그대로 남습니다."
                >
                  연결 끊기
                </ConfirmSubmitButton>
              </form>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
