import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff, canManageFinance } from "@/lib/auth";
import { GENDERS, MEMBER_STATUS, type MemberStatus } from "@/lib/constants";
import { age, phone as fmtPhone, won, ymd } from "@/lib/format";
import {
  Alert,
  Avatar,
  Badge,
  Card,
  CardTitle,
  DescItem,
  DescList,
  PageHeader,
  TableWrap,
} from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form";
import { createMemberAccount, deleteMember, resetMemberPassword } from "../actions";

const STATUS_TONE: Record<MemberStatus, "income" | "warn" | "neutral"> = {
  ACTIVE: "income",
  INACTIVE: "warn",
  TRANSFERRED: "neutral",
  DECEASED: "neutral",
};

const MESSAGES: Record<string, { tone: "expense" | "income"; text: string }> = {
  "has-offerings": {
    tone: "expense",
    text: "헌금 기록이 있는 교인은 삭제할 수 없습니다. 회계 이력이 끊기지 않도록 '이명' 또는 '소천' 상태로 변경해 주세요.",
  },
  "account-input": {
    tone: "expense",
    text: "아이디를 입력하고 비밀번호는 8자 이상으로 정해 주세요.",
  },
  "account-duplicate": { tone: "expense", text: "이미 사용 중인 아이디입니다." },
  "account-created": {
    tone: "income",
    text: "성도 계정이 발급되었습니다. 아이디와 비밀번호를 성도님께 안내해 주세요.",
  },
  "password-reset": { tone: "income", text: "비밀번호가 재설정되었습니다." },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = await prisma.member.findUnique({ where: { id }, select: { name: true } });
  return { title: member ? `${member.name} 교적` : "교인 상세" };
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const staff = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;

  const member = await prisma.member.findUnique({
    where: { id },
    include: { district: true, household: true, user: true },
  });
  if (!member || member.churchId !== staff.churchId) notFound();

  const showFinance = canManageFinance(staff.role);
  const thisYear = new Date().getFullYear();

  // 같은 가정에 속한 다른 교인
  const family = member.householdId
    ? await prisma.member.findMany({
        where: {
          churchId: staff.churchId,
          householdId: member.householdId,
          id: { not: member.id },
        },
        orderBy: { birthDate: "asc" },
      })
    : [];

  // 헌금 요약은 회계 권한이 있는 사람에게만 보여준다.
  const [recentOfferings, yearTotal, receipts] = showFinance
    ? await Promise.all([
        prisma.offering.findMany({
          where: { memberId: member.id },
          include: { account: true },
          orderBy: { date: "desc" },
          take: 8,
        }),
        prisma.offering.aggregate({
          where: {
            memberId: member.id,
            date: {
              gte: new Date(thisYear, 0, 1),
              lt: new Date(thisYear + 1, 0, 1),
            },
          },
          _sum: { amount: true },
        }),
        prisma.donationReceipt.findMany({
          where: { memberId: member.id },
          orderBy: { year: "desc" },
        }),
      ])
    : [[], { _sum: { amount: null } }, []];

  const message = sp.error
    ? MESSAGES[sp.error]
    : sp.ok
      ? MESSAGES[sp.ok]
      : undefined;

  return (
    <>
      <PageHeader
        title={member.name}
        description={`교적번호 ${member.code}`}
        back={{ href: "/members", label: "교적 관리" }}
        actions={
          <>
            <Link href={`/members/${member.id}/edit`} className="btn btn-ghost">
              수정
            </Link>
            <form action={deleteMember.bind(null, member.id)}>
              <ConfirmSubmitButton message={`${member.name} 교인의 교적을 삭제할까요?`}>
                삭제
              </ConfirmSubmitButton>
            </form>
          </>
        }
      />

      {message && (
        <div className="mb-5">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        {/* 좌측 — 프로필 요약 */}
        <div className="space-y-5">
          <Card>
            <div className="flex flex-col items-center text-center">
              <Avatar src={member.photoUrl} name={member.name} size="lg" />
              <h2 className="mt-3 text-lg font-bold tracking-[-0.01em] text-ink">
                {member.name}
                {member.nameHanja && (
                  <span className="ml-1.5 text-sm font-medium text-ink-3">
                    {member.nameHanja}
                  </span>
                )}
              </h2>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                {member.position && <Badge tone="primary">{member.position}</Badge>}
                <Badge tone={STATUS_TONE[member.status as MemberStatus] ?? "neutral"}>
                  {MEMBER_STATUS[member.status as MemberStatus] ?? member.status}
                </Badge>
              </div>
              {member.phone && (
                <a
                  href={`tel:${member.phone.replace(/\D/g, "")}`}
                  className="btn btn-ghost btn-sm mt-4 w-full"
                >
                  전화 걸기 · {fmtPhone(member.phone)}
                </a>
              )}
            </div>
          </Card>

          {/* 성도 로그인 계정 */}
          <Card>
            <CardTitle>성도 로그인 계정</CardTitle>
            {member.user ? (
              <div className="space-y-3">
                <DescList>
                  <DescItem term="아이디">
                    <span className="tnum">{member.user.loginId}</span>
                  </DescItem>
                  <DescItem term="최근 로그인">{ymd(member.user.lastLoginAt)}</DescItem>
                </DescList>
                <form action={resetMemberPassword.bind(null, member.id)} className="space-y-2">
                  <input
                    name="password"
                    type="password"
                    className="field"
                    placeholder="새 비밀번호 (8자 이상)"
                    minLength={8}
                    required
                  />
                  <SubmitButton className="btn btn-ghost btn-sm w-full">
                    비밀번호 재설정
                  </SubmitButton>
                </form>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-ink-3">
                  계정을 발급하면 성도님이 직접 로그인해 본인 헌금 내역을 보고 기부금영수증을
                  신청·출력할 수 있습니다.
                </p>
                <form action={createMemberAccount.bind(null, member.id)} className="space-y-2">
                  <input
                    name="loginId"
                    className="field"
                    placeholder="아이디"
                    autoCapitalize="none"
                    spellCheck={false}
                    defaultValue={member.phone?.replace(/\D/g, "") ?? ""}
                    required
                  />
                  <input
                    name="password"
                    type="password"
                    className="field"
                    placeholder="임시 비밀번호 (8자 이상)"
                    minLength={8}
                    required
                  />
                  <SubmitButton className="btn btn-primary btn-sm w-full">
                    계정 발급하기
                  </SubmitButton>
                </form>
              </div>
            )}
          </Card>
        </div>

        {/* 우측 — 상세 정보 */}
        <div className="space-y-5">
          <Card>
            <CardTitle>인적 사항</CardTitle>
            <DescList>
              <DescItem term="성별">
                {member.gender ? GENDERS[member.gender as keyof typeof GENDERS] : "-"}
              </DescItem>
              <DescItem term="생년월일">
                {member.birthDate ? (
                  <>
                    <span className="tnum">{ymd(member.birthDate)}</span>
                    {member.birthIsLunar && (
                      <span className="ml-1.5 text-xs text-ink-3">(음력)</span>
                    )}
                    {age(member.birthDate) !== null && (
                      <span className="ml-1.5 text-ink-3">만 {age(member.birthDate)}세</span>
                    )}
                  </>
                ) : (
                  "-"
                )}
              </DescItem>
              <DescItem term="휴대전화">
                <span className="tnum">{fmtPhone(member.phone)}</span>
              </DescItem>
              <DescItem term="이메일">{member.email ?? "-"}</DescItem>
              <DescItem term="주소">
                {member.address
                  ? `${member.postalCode ? `(${member.postalCode}) ` : ""}${member.address} ${member.addressDetail ?? ""}`
                  : "-"}
              </DescItem>
              <DescItem term="직업">{member.job ?? "-"}</DescItem>
            </DescList>
          </Card>

          <Card>
            <CardTitle>교회 소속 · 신앙 이력</CardTitle>
            <DescList>
              <DescItem term="교구·구역">{member.district?.name ?? "-"}</DescItem>
              <DescItem term="소속 가정">
                {member.household ? (
                  <>
                    {member.household.name}
                    {member.householdRel && (
                      <span className="ml-1.5 text-ink-3">({member.householdRel})</span>
                    )}
                  </>
                ) : (
                  "-"
                )}
              </DescItem>
              <DescItem term="등록일">
                <span className="tnum">{ymd(member.registeredAt)}</span>
              </DescItem>
              <DescItem term="학습">
                <span className="tnum">{ymd(member.catechumenAt)}</span>
              </DescItem>
              <DescItem term="세례">
                <span className="tnum">{ymd(member.baptizedAt)}</span>
              </DescItem>
              <DescItem term="입교">
                <span className="tnum">{ymd(member.confirmedAt)}</span>
              </DescItem>
              <DescItem term="이전 교회">{member.previousChurch ?? "-"}</DescItem>
              {member.transferredAt && (
                <DescItem term="이명">
                  <span className="tnum">{ymd(member.transferredAt)}</span>
                  {member.transferTo && (
                    <span className="ml-1.5 text-ink-3">→ {member.transferTo}</span>
                  )}
                </DescItem>
              )}
              {member.deceasedAt && (
                <DescItem term="소천">
                  <span className="tnum">{ymd(member.deceasedAt)}</span>
                </DescItem>
              )}
              <DescItem term="비고">{member.note ?? "-"}</DescItem>
            </DescList>
          </Card>

          {family.length > 0 && (
            <Card>
              <CardTitle>같은 가정 교인</CardTitle>
              <ul className="divide-y divide-line">
                {family.map((f) => (
                  <li key={f.id}>
                    <Link href={`/members/${f.id}`} className="flex items-center gap-3 py-2.5">
                      <Avatar src={f.photoUrl} name={f.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">{f.name}</span>
                        <span className="block text-xs text-ink-3">
                          {[f.householdRel, f.position].filter(Boolean).join(" · ") || "-"}
                        </span>
                      </span>
                      <span className="tnum text-xs text-ink-3">
                        {age(f.birthDate) !== null ? `만 ${age(f.birthDate)}세` : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {showFinance && (
            <Card>
              <CardTitle
                action={
                  <Link
                    href={`/finance/offerings?member=${member.id}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    전체 보기
                  </Link>
                }
              >
                헌금 내역
              </CardTitle>

              <div className="mb-4 rounded-xl bg-surface-2 px-4 py-3">
                <p className="text-xs font-semibold text-ink-3">{thisYear}년 누계</p>
                <p className="tnum mt-0.5 text-xl font-bold text-income">
                  {won(yearTotal._sum.amount ?? 0)}
                </p>
              </div>

              {recentOfferings.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-3">헌금 기록이 없습니다.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {recentOfferings.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">
                          {o.account.name}
                        </span>
                        <span className="tnum block text-xs text-ink-3">{ymd(o.date)}</span>
                      </span>
                      <span className="tnum shrink-0 text-sm font-semibold text-ink">
                        {won(o.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {receipts.length > 0 && (
                <div className="mt-5">
                  <p className="label">기부금영수증</p>
                  <TableWrap>
                    <table className="table">
                      <thead>
                        <tr>
                          <th>귀속연도</th>
                          <th className="text-right">금액</th>
                          <th>상태</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {receipts.map((r) => (
                          <tr key={r.id}>
                            <td className="tnum">{r.year}년</td>
                            <td className="tnum text-right">{won(r.totalAmount)}</td>
                            <td>
                              <Badge tone={r.status === "ISSUED" ? "income" : "warn"}>
                                {r.status === "ISSUED" ? "발급완료" : "신청접수"}
                              </Badge>
                            </td>
                            <td className="text-right">
                              <Link
                                href={`/receipts/${r.id}`}
                                className="text-sm font-semibold text-primary hover:underline"
                              >
                                열기
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableWrap>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
