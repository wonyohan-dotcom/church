import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { getChurch } from "@/lib/church";
import { ROLES, type Role } from "@/lib/constants";
import { ymd } from "@/lib/format";
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
  image: { tone: "expense", text: "이미지를 저장하지 못했습니다. 8MB 이하인지 확인해 주세요." },
  "user-input": {
    tone: "expense",
    text: "이름과 아이디를 입력하고 비밀번호는 8자 이상으로 정해 주세요.",
  },
  "user-duplicate": { tone: "expense", text: "이미 사용 중인 아이디입니다." },
  self: { tone: "warn", text: "본인 계정은 잠글 수 없습니다." },
  "last-admin": {
    tone: "warn",
    text: "마지막 관리자의 권한은 낮출 수 없습니다. 다른 관리자를 먼저 지정해 주세요.",
  },
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const admin = await requireAdmin();
  const sp = await searchParams;

  const [church, users, logs] = await Promise.all([
    getChurch(),
    prisma.user.findMany({
      include: { member: { select: { code: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.auditLog.findMany({
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
      <PageHeader
        title="설정"
        description="교회 기본 정보와 사용 계정을 관리합니다."
      />

      {message && (
        <div className="mb-5">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      {/* 교회 정보 */}
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
            <Field
              label="고유번호 / 사업자등록번호"
              hint="기부금영수증에 인쇄됩니다."
            >
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
            <Field label="우편번호">
              <input
                name="postalCode"
                className="field tnum"
                defaultValue={church.postalCode ?? ""}
              />
            </Field>
            <Field label="주소" className="sm:col-span-2">
              <input name="address" className="field" defaultValue={church.address ?? ""} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <PhotoInput name="logo" label="교회 로고" currentUrl={church.logoUrl} hint="선택 사항입니다." />
            <PhotoInput
              name="seal"
              label="직인 이미지"
              currentUrl={church.sealUrl}
              hint="기부금영수증 수령인 서명란에 겹쳐 인쇄됩니다. 배경이 투명한 PNG를 권합니다."
            />
          </div>

          <div className="rounded-xl bg-surface-2 px-4 py-3.5">
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
                  꺼 두면 교회에서 확인한 뒤 발급합니다.
                </span>
              </span>
            </label>
          </div>

          <div className="flex justify-end">
            <SubmitButton>저장하기</SubmitButton>
          </div>
        </form>
      </Card>

      {/* 직원 계정 */}
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

        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>이름</th>
                <th>아이디</th>
                <th>권한</th>
                <th>최근 로그인</th>
                <th>상태</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {staffUsers.map((u) => (
                <tr key={u.id}>
                  <td className="font-semibold text-ink">
                    {u.name}
                    {u.id === admin.id && (
                      <span className="ml-1.5 text-xs font-medium text-ink-3">(나)</span>
                    )}
                  </td>
                  <td className="tnum text-ink-2">{u.loginId}</td>
                  <td>
                    <RoleForm userId={u.id} role={u.role as Role} />
                  </td>
                  <td className="tnum text-ink-3">{ymd(u.lastLoginAt)}</td>
                  <td>
                    <Badge tone={u.active ? "income" : "neutral"}>
                      {u.active ? "사용" : "잠김"}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <form action={toggleUserActive.bind(null, u.id)}>
                        <SubmitButton className="btn btn-quiet btn-sm" pendingLabel="…">
                          {u.active ? "잠금" : "해제"}
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
      </Card>

      {/* 성도 계정 */}
      <Card className="mb-5">
        <CardTitle>성도 로그인 계정 ({memberUsers.length})</CardTitle>
        {memberUsers.length === 0 ? (
          <p className="py-4 text-sm text-ink-3">
            아직 발급된 성도 계정이 없습니다. 교적 관리에서 교인을 선택해 계정을 발급할 수
            있습니다.
          </p>
        ) : (
          <TableWrap>
            <table className="table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>아이디</th>
                  <th>교적번호</th>
                  <th>최근 로그인</th>
                  <th>상태</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {memberUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium text-ink">{u.name}</td>
                    <td className="tnum text-ink-2">{u.loginId}</td>
                    <td className="tnum text-ink-3">{u.member?.code ?? "-"}</td>
                    <td className="tnum text-ink-3">{ymd(u.lastLoginAt)}</td>
                    <td>
                      <Badge tone={u.active ? "income" : "neutral"}>
                        {u.active ? "사용" : "잠김"}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <form action={toggleUserActive.bind(null, u.id)}>
                        <SubmitButton className="btn btn-quiet btn-sm" pendingLabel="…">
                          {u.active ? "잠금" : "해제"}
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      {/* 활동 기록 */}
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

/** 권한 선택 즉시 저장되는 작은 폼 */
function RoleForm({ userId, role }: { userId: string; role: Role }) {
  return (
    <form action={changeUserRole.bind(null, userId)} className="flex items-center gap-1">
      <select name="role" defaultValue={role} className="field w-[6.5rem] px-2 py-1 text-sm">
        {(["ADMIN", "FINANCE", "PASTOR"] as Role[]).map((r) => (
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
