import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import {
  ROLES,
  ROLE_DESCRIPTIONS,
  USER_STATUS,
  type Role,
  type UserStatus,
} from "@/lib/constants";
import { phone as fmtPhone, ymd } from "@/lib/format";
import {
  Alert,
  Badge,
  Card,
  CardTitle,
  Field,
  PageHeader,
  TableWrap,
} from "@/components/ui";
import { PhotoInput, SubmitButton } from "@/components/form";
import { AddressFields } from "@/components/address-fields";
import { PushToggle } from "@/components/push-toggle";
import { approveUser, rejectUser } from "@/actions/account";
import {
  changeUserRole,
  createStaffUser,
  resetUserPassword,
  toggleUserActive,
  updateChurch,
} from "./actions";

export const metadata = { title: "설정" };

const MESSAGES: Record<string, { tone: "income" | "expense" | "warn"; text: string }> = {
  church: { tone: "income", text: "교회 정보가 저장되었습니다." },
  "user-created": { tone: "income", text: "계정이 생성되었습니다." },
  "password-reset": { tone: "income", text: "비밀번호가 재설정되었습니다." },
  approved: { tone: "income", text: "가입을 승인했습니다. 바로 사용하실 수 있습니다." },
  rejected: { tone: "income", text: "가입 신청을 거절했습니다." },
  image: { tone: "expense", text: "이미지를 저장하지 못했습니다. 8MB 이하인지 확인해 주세요." },
  "user-input": {
    tone: "expense",
    text: "이름과 아이디를 입력하고 비밀번호는 8자 이상으로 정해 주세요.",
  },
  "user-duplicate": { tone: "expense", text: "이미 사용 중인 아이디입니다." },
  "not-found": { tone: "expense", text: "대상을 찾을 수 없습니다." },
  "member-taken": {
    tone: "expense",
    text: "그 교적에는 이미 다른 계정이 연결되어 있습니다.",
  },
  self: { tone: "warn", text: "본인 계정은 정지할 수 없습니다." },
  "last-admin": {
    tone: "warn",
    text: "마지막 관리자의 권한은 낮출 수 없습니다. 다른 관리자를 먼저 지정해 주세요.",
  },
};

const STAFF_ROLE_OPTIONS: Role[] = ["ADMIN", "FINANCE", "PASTOR", "MEMBER"];

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  const [church, users, pending, members, logs] = await Promise.all([
    getChurch(admin.churchId),
    prisma.user.findMany({
      where: { churchId: admin.churchId, status: { not: "PENDING" } },
      include: { member: { select: { code: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.user.findMany({
      where: { churchId: admin.churchId, status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.member.findMany({
      where: { churchId: admin.churchId, status: "ACTIVE", user: null },
      select: { id: true, name: true, code: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.auditLog.findMany({
      where: { churchId: admin.churchId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const staffUsers = users.filter((u) => u.role !== "MEMBER");
  const memberUsers = users.filter((u) => u.role === "MEMBER");
  const message = sp.ok ? MESSAGES[sp.ok] : sp.error ? MESSAGES[sp.error] : undefined;

  return (
    <>
      <PageHeader title="설정" description={`${church.name}의 정보와 사용 계정을 관리합니다.`} />

      {message && (
        <div className="mb-5">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {/* ── 가입 신청 승인 ── */}
      <Card className="mb-5">
        <CardTitle>
          가입 신청 {pending.length > 0 && <span className="text-expense">({pending.length})</span>}
        </CardTitle>

        {pending.length === 0 ? (
          <p className="py-3 text-sm text-ink-3">
            대기 중인 가입 신청이 없습니다. 성도님이 신청하시면 이곳에 표시됩니다.
          </p>
        ) : (
          <ul className="space-y-4">
            {pending.map((u) => (
              <li key={u.id} className="rounded-xl border border-line-strong bg-surface-2 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-bold text-ink">{u.name}</span>
                  <span className="tnum text-sm text-ink-3">{u.loginId}</span>
                  {u.phone && (
                    <span className="tnum text-sm text-ink-3">{fmtPhone(u.phone)}</span>
                  )}
                  <span className="tnum ml-auto text-xs text-ink-3">
                    신청 {ymd(u.createdAt)}
                  </span>
                </div>

                <form
                  action={approveUser.bind(null, u.id)}
                  className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                >
                  <Field label="앱 사용 범위" required>
                    <select name="role" className="field" defaultValue="MEMBER">
                      {STAFF_ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {ROLES[r]} — {ROLE_DESCRIPTIONS[r]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field
                    label="교적 연결"
                    hint="연결하면 그 교인의 헌금 내역과 영수증이 바로 이어집니다."
                  >
                    <select name="memberId" className="field" defaultValue="">
                      <option value="">새 교적 만들기</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.code}
                          {m.phone ? ` · ${fmtPhone(m.phone)}` : ""})
                        </option>
                      ))}
                    </select>
                  </Field>

                  <div className="flex items-end">
                    <input type="hidden" name="createMember" value="1" />
                    <SubmitButton className="btn btn-primary w-full" pendingLabel="승인 중…">
                      승인
                    </SubmitButton>
                  </div>
                </form>

                <form
                  action={rejectUser.bind(null, u.id)}
                  className="mt-2 flex items-end gap-2"
                >
                  <input
                    name="reason"
                    className="field flex-1"
                    placeholder="거절 사유 (선택) — 신청자에게 보입니다"
                  />
                  <SubmitButton className="btn btn-danger shrink-0" pendingLabel="처리 중…">
                    거절
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── 알림 ── */}
      <Card className="mb-5">
        <CardTitle>알림 받기</CardTitle>
        <p className="mb-4 text-sm leading-relaxed text-ink-3">
          켜 두면 <b className="font-semibold text-ink-2">새 가입 신청</b>과{" "}
          <b className="font-semibold text-ink-2">기부금영수증 신청</b>이 들어올 때 이 기기로
          알려 드립니다. 기기마다 따로 켜야 합니다.
        </p>
        <PushToggle />
      </Card>

      {/* ── 교회 정보 ── */}
      <Card className="mb-5">
        <CardTitle>교회 기본 정보</CardTitle>
        <form action={updateChurch} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="교회 이름" required>
              <input name="name" className="field" required defaultValue={church.name} />
            </Field>
            <Field label="대표자 (담임목사)">
              <input
                name="representative"
                className="field"
                defaultValue={church.representative ?? ""}
              />
            </Field>
            <Field label="고유번호 / 사업자등록번호" hint="기부금영수증에 인쇄됩니다.">
              <input
                name="regNo"
                className="field tnum"
                placeholder="000-00-00000"
                defaultValue={church.regNo ?? ""}
              />
            </Field>
            <Field label="대표 전화">
              <input
                name="phone"
                type="tel"
                className="field"
                defaultValue={church.phone ?? ""}
              />
            </Field>
            <div className="sm:col-span-2">
              <AddressFields
                label="교회 주소"
                defaultPostal={church.postalCode ?? ""}
                defaultAddress={church.address ?? ""}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <PhotoInput
              name="logo"
              label="교회 로고"
              currentUrl={church.logoUrl}
              hint="선택 사항입니다."
            />
            <PhotoInput
              name="seal"
              label="직인 이미지"
              currentUrl={church.sealUrl}
              hint="기부금영수증 수령인 서명란에 겹쳐 인쇄됩니다. 배경이 투명한 PNG를 권합니다."
            />
          </div>

          <div className="space-y-3 rounded-xl bg-surface-2 px-4 py-3.5">
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                name="receiptAutoIssue"
                value="1"
                defaultChecked={church.receiptAutoIssue}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold text-ink">기부금영수증 자동 발급</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">
                  켜 두면 성도님이 신청하는 즉시 영수증이 발급되어 바로 출력하실 수 있습니다.
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                name="joinOpen"
                value="1"
                defaultChecked={church.joinOpen}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold text-ink">온라인 가입 신청 받기</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-2">
                  꺼 두면 성도님이 직접 가입 신청을 할 수 없고, 교회에서 계정을 만들어
                  드려야 합니다.
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end">
            <SubmitButton>저장하기</SubmitButton>
          </div>
        </form>
      </Card>

      {/* ── 직원 계정 ── */}
      <Card className="mb-5">
        <CardTitle>교역자 · 직원 계정</CardTitle>
        <form action={createStaffUser} className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="이름" required>
            <input name="name" className="field" required />
          </Field>
          <Field label="아이디" required>
            <input name="loginId" className="field" autoCapitalize="none" required />
          </Field>
          <Field label="비밀번호" required hint="8자 이상">
            <input name="password" type="password" className="field" minLength={8} required />
          </Field>
          <Field label="권한" required>
            <select name="role" className="field" defaultValue="PASTOR">
              <option value="ADMIN">관리자</option>
              <option value="FINANCE">회계</option>
              <option value="PASTOR">교역자</option>
            </select>
          </Field>
          <div className="flex items-end">
            <SubmitButton className="btn btn-primary w-full">계정 추가</SubmitButton>
          </div>
        </form>

        <UserTable users={staffUsers} adminId={admin.id} showRoleSelect />
      </Card>

      {/* ── 성도 계정 ── */}
      <Card className="mb-5">
        <CardTitle>성도 로그인 계정 ({memberUsers.length})</CardTitle>
        {memberUsers.length === 0 ? (
          <p className="py-4 text-sm text-ink-3">
            아직 성도 계정이 없습니다. 성도님이 가입 신청을 하시거나, 교적 관리에서 직접
            발급할 수 있습니다.
          </p>
        ) : (
          <UserTable users={memberUsers} adminId={admin.id} showRoleSelect />
        )}
      </Card>

      {/* ── 활동 기록 ── */}
      <Card padded={false}>
        <div className="p-5 pb-3">
          <CardTitle>최근 활동 기록</CardTitle>
        </div>
        {logs.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-ink-3">기록이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-line">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {l.summary ?? `${l.entity} ${l.action}`}
                </span>
                <span className="shrink-0 text-xs text-ink-3">{l.user?.name ?? "시스템"}</span>
                <span className="tnum shrink-0 text-xs text-ink-3">{ymd(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

type UserRow = {
  id: string;
  name: string;
  loginId: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  member: { code: string } | null;
};

function UserTable({
  users,
  adminId,
  showRoleSelect,
}: {
  users: UserRow[];
  adminId: string;
  showRoleSelect?: boolean;
}) {
  return (
    <TableWrap>
      <table className="table">
        <thead>
          <tr>
            <th>이름</th>
            <th>아이디</th>
            <th>앱 사용 범위</th>
            <th>교적</th>
            <th>최근 로그인</th>
            <th>상태</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="font-semibold text-ink">
                {u.name}
                {u.id === adminId && (
                  <span className="ml-1.5 text-xs font-medium text-ink-3">(나)</span>
                )}
              </td>
              <td className="tnum text-ink-2">{u.loginId}</td>
              <td>
                {showRoleSelect ? (
                  <RoleForm userId={u.id} role={u.role as Role} />
                ) : (
                  ROLES[u.role as Role]
                )}
              </td>
              <td className="tnum text-ink-3">{u.member?.code ?? "-"}</td>
              <td className="tnum text-ink-3">{ymd(u.lastLoginAt)}</td>
              <td>
                <Badge
                  tone={
                    u.status === "ACTIVE"
                      ? "income"
                      : u.status === "REJECTED"
                        ? "expense"
                        : "neutral"
                  }
                >
                  {USER_STATUS[u.status as UserStatus] ?? u.status}
                </Badge>
              </td>
              <td>
                <div className="flex items-center justify-end gap-1">
                  <form action={toggleUserActive.bind(null, u.id)}>
                    <SubmitButton className="btn btn-quiet btn-sm" pendingLabel="…">
                      {u.status === "SUSPENDED" ? "사용 재개" : "정지"}
                    </SubmitButton>
                  </form>
                  <details className="relative">
                    <summary className="btn btn-quiet btn-sm list-none">비밀번호</summary>
                    <form
                      action={resetUserPassword.bind(null, u.id)}
                      className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-lg)]"
                    >
                      <input
                        name="password"
                        type="password"
                        className="field"
                        placeholder="새 비밀번호 (8자 이상)"
                        minLength={8}
                        required
                      />
                      <SubmitButton className="btn btn-primary btn-sm mt-2 w-full">
                        재설정
                      </SubmitButton>
                    </form>
                  </details>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

/** 권한을 고르고 '변경'을 눌러 저장한다. */
function RoleForm({ userId, role }: { userId: string; role: Role }) {
  return (
    <form action={changeUserRole.bind(null, userId)} className="flex items-center gap-1">
      <select name="role" defaultValue={role} className="field w-[6.5rem] px-2 py-1 text-sm">
        {STAFF_ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {ROLES[r]}
          </option>
        ))}
      </select>
      <SubmitButton className="btn btn-quiet btn-sm" pendingLabel="…">
        변경
      </SubmitButton>
    </form>
  );
}
