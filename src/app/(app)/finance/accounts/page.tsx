import { prisma } from "@/lib/prisma";
import { requireFinance } from "@/lib/auth";
import { Alert, Badge, Card, CardTitle, Field, PageHeader, TableWrap } from "@/components/ui";
import { ConfirmSubmitButton, SubmitButton } from "@/components/form";
import { createAccount, deleteAccount, toggleAccountActive } from "../actions";

export const metadata = { title: "계정과목 관리" };

const MESSAGES: Record<string, { tone: "expense" | "income"; text: string }> = {
  input: { tone: "expense", text: "코드와 이름을 모두 입력해 주세요." },
  duplicate: { tone: "expense", text: "이미 사용 중인 코드입니다." },
  "in-use": {
    tone: "expense",
    text: "이미 거래가 입력된 과목은 삭제할 수 없습니다. 대신 '사용 안 함'으로 바꿔 주세요.",
  },
  created: { tone: "income", text: "계정과목이 추가되었습니다." },
  deleted: { tone: "income", text: "계정과목이 삭제되었습니다." },
};

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const staff = await requireFinance();
  const sp = await searchParams;

  const accounts = await prisma.account.findMany({
    where: { churchId: staff.churchId },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    include: { _count: { select: { offerings: true, expenses: true } } },
  });

  const income = accounts.filter((a) => a.type === "INCOME");
  const expense = accounts.filter((a) => a.type === "EXPENSE");
  const message = sp.error ? MESSAGES[sp.error] : sp.ok ? MESSAGES[sp.ok] : undefined;

  return (
    <>
      <PageHeader
        title="계정과목 관리"
        description="헌금 종류와 지출 항목을 교회 실정에 맞게 정리합니다."
        back={{ href: "/finance", label: "회계 관리" }}
      />

      {message && (
        <div className="mb-5">
          <Alert tone={message.tone}>{message.text}</Alert>
        </div>
      )}

      <div className="mb-5">
        <Card>
          <CardTitle>과목 추가</CardTitle>
          <form action={createAccount} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="코드" required hint="예) 1090, 2400">
              <input name="code" className="field tnum" required placeholder="1090" />
            </Field>
            <Field label="과목 이름" required>
              <input name="name" className="field" required placeholder="예) 장학헌금" />
            </Field>
            <Field label="구분" required>
              <select name="type" className="field" defaultValue="INCOME">
                <option value="INCOME">수입</option>
                <option value="EXPENSE">지출</option>
              </select>
            </Field>
            <Field label="대분류">
              <input name="category" className="field" placeholder="예) 헌금, 사역비" />
            </Field>
            <div className="sm:col-span-2 lg:col-span-3">
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" name="isOffering" value="1" defaultChecked />
                  헌금 항목입니다
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  <input type="checkbox" name="deductible" value="1" defaultChecked />
                  기부금영수증 공제 대상
                </label>
              </div>
            </div>
            <div className="flex items-end">
              <SubmitButton className="btn btn-primary w-full">추가하기</SubmitButton>
            </div>
          </form>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <AccountTable title="수입 과목" accounts={income} />
        <AccountTable title="지출 과목" accounts={expense} />
      </div>
    </>
  );
}

type AccountRow = {
  id: string;
  code: string;
  name: string;
  type: string;
  category: string | null;
  deductible: boolean;
  active: boolean;
  _count: { offerings: number; expenses: number };
};

function AccountTable({ title, accounts }: { title: string; accounts: AccountRow[] }) {
  return (
    <div>
      <h2 className="mb-2.5 px-1 text-[0.95rem] font-bold text-ink">
        {title} <span className="text-ink-3">({accounts.length})</span>
      </h2>
      <TableWrap>
        <table className="table">
          <thead>
            <tr>
              <th>코드</th>
              <th>이름</th>
              <th>거래</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const used = a._count.offerings + a._count.expenses;
              return (
                <tr key={a.id}>
                  <td className="tnum text-ink-3">{a.code}</td>
                  <td>
                    <span className="font-medium text-ink">{a.name}</span>
                    <span className="block text-xs text-ink-3">
                      {a.category ?? "-"}
                      {a.type === "INCOME" && !a.deductible && " · 공제 제외"}
                    </span>
                  </td>
                  <td className="tnum text-ink-3">{used}건</td>
                  <td>
                    <Badge tone={a.active ? "income" : "neutral"}>
                      {a.active ? "사용" : "미사용"}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <form action={toggleAccountActive.bind(null, a.id)}>
                        <SubmitButton className="btn btn-quiet btn-sm" pendingLabel="…">
                          {a.active ? "중지" : "재개"}
                        </SubmitButton>
                      </form>
                      {used === 0 && (
                        <form action={deleteAccount.bind(null, a.id)}>
                          <ConfirmSubmitButton
                            className="btn btn-danger btn-sm"
                            message={`'${a.name}' 과목을 삭제할까요?`}
                          >
                            삭제
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </div>
  );
}
