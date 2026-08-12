/**
 * 샘플 데이터 생성 스크립트.
 *   npm run db:seed
 *
 * 화면을 둘러보거나 교육용으로 쓰기 위한 가상의 자료입니다.
 * 교회 두 곳을 만들어, 서로의 자료가 섞이지 않는지도 함께 확인할 수 있습니다.
 * 실제 교회 데이터를 넣기 전에 `npm run db:reset`으로 비우고 시작하세요.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { DEFAULT_ACCOUNTS } from "../src/lib/constants";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const NAMES = [
  ["김은혜", "F", "권사"], ["박성실", "M", "장로"], ["이믿음", "F", "집사"],
  ["최소망", "M", "안수집사"], ["정사랑", "F", "권사"], ["강온유", "F", "성도"],
  ["조화평", "M", "서리집사"], ["윤기쁨", "F", "성도"], ["장충성", "M", "장로"],
  ["임순종", "F", "권사"], ["한겸손", "M", "서리집사"], ["오지혜", "F", "집사"],
  ["신실한", "M", "성도"], ["권능력", "M", "안수집사"], ["황평강", "F", "성도"],
  ["안위로", "F", "집사"], ["송찬양", "M", "성도"], ["문축복", "F", "권사"],
  ["양선한", "M", "성도"], ["백진리", "F", "성도"], ["남기도", "M", "서리집사"],
  ["구원해", "F", "성도"], ["표성령", "M", "목사"], ["하나님", "F", "성도"],
] as const;

const SECOND_NAMES = [
  ["서은총", "F", "권사"], ["노평안", "M", "장로"], ["유소망", "F", "집사"],
  ["배기쁨", "M", "성도"], ["심자비", "F", "성도"], ["추영광", "M", "목사"],
] as const;

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function clearAll() {
  console.log("기존 샘플 데이터를 정리합니다…");
  await prisma.donationReceiptItem.deleteMany();
  await prisma.donationReceipt.deleteMany();
  await prisma.offering.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.budget.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.historyPhoto.deleteMany();
  await prisma.historyEvent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.member.deleteMany();
  await prisma.household.deleteMany();
  await prisma.district.deleteMany();
  await prisma.account.deleteMany();
  await prisma.church.deleteMany();
}

/** 교회 하나를 통째로 만든다. */
async function seedChurch(opts: {
  name: string;
  regNo: string;
  representative: string;
  address: string;
  phone: string;
  people: ReadonlyArray<readonly [string, string, string]>;
  idPrefix: string;
  withHistory: boolean;
  years: number;
}) {
  const church = await prisma.church.create({
    data: {
      name: opts.name,
      regNo: opts.regNo,
      representative: opts.representative,
      postalCode: "06234",
      address: opts.address,
      phone: opts.phone,
      receiptAutoIssue: true,
      accounts: {
        create: DEFAULT_ACCOUNTS.map((a, i) => ({
          code: a.code,
          name: a.name,
          type: a.type,
          category: a.category ?? null,
          isOffering: a.isOffering ?? false,
          deductible: a.deductible ?? true,
          sortOrder: i,
        })),
      },
    },
  });
  const churchId = church.id;

  const accounts = await prisma.account.findMany({ where: { churchId } });
  const incomeAccounts = accounts.filter((a) => a.type === "INCOME" && a.isOffering);
  const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE");

  const districts = await Promise.all(
    ["1교구", "2교구", "3교구", "청년부"].map((name, i) =>
      prisma.district.create({
        data: { churchId, name, sortOrder: i, leaderName: pick(opts.people)[0] },
      }),
    ),
  );

  const members = [];
  for (const [i, [name, gender, position]] of opts.people.entries()) {
    const district = districts[i % districts.length];

    const household =
      i % 2 === 0
        ? await prisma.household.create({
            data: {
              churchId,
              name: `${name} ${position === "성도" ? "" : position} 가정`.replace("  ", " "),
              districtId: district.id,
              address: `서울특별시 강남구 삼성로 ${randInt(1, 200)}`,
              addressDetail: `${randInt(101, 2005)}호`,
              phone: `010-${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
            },
          })
        : null;

    const member = await prisma.member.create({
      data: {
        churchId,
        code: String(i + 1).padStart(4, "0"),
        name,
        gender,
        position,
        status: i === opts.people.length - 1 ? "TRANSFERRED" : "ACTIVE",
        birthDate: new Date(randInt(1945, 2010), randInt(0, 11), randInt(1, 28)),
        phone: `010-${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
        email: `${opts.idPrefix}${i + 1}@example.com`,
        postalCode: "06234",
        address: `서울특별시 강남구 삼성로 ${randInt(1, 200)}`,
        addressDetail: `${randInt(101, 2005)}호`,
        districtId: district.id,
        householdId: household?.id ?? null,
        householdRel: household ? "본인" : null,
        registeredAt: new Date(randInt(1998, 2024), randInt(0, 11), randInt(1, 28)),
        baptizedAt:
          Math.random() > 0.3
            ? new Date(randInt(1999, 2024), randInt(0, 11), randInt(1, 28))
            : null,
        job: pick(["회사원", "자영업", "교사", "주부", "학생", "공무원", "의료인"]),
      },
    });
    members.push(member);
  }

  // ── 헌금 · 지출 ──
  const thisYear = new Date().getFullYear();
  const activeMembers = members.filter((m) => m.status === "ACTIVE");

  for (let y = 0; y < opts.years; y++) {
    const year = thisYear - y;
    const lastMonth = year === thisYear ? new Date().getMonth() : 11;

    for (let month = 0; month <= lastMonth; month++) {
      for (let week = 0; week < 4; week++) {
        const day = 1 + week * 7 + randInt(0, 2);
        const date = new Date(year, month, Math.min(day, 28));

        for (const member of activeMembers) {
          if (Math.random() > 0.55) continue;
          await prisma.offering.create({
            data: {
              churchId,
              date,
              amount: randInt(1, 20) * 10_000,
              accountId: pick(incomeAccounts).id,
              memberId: member.id,
              method: pick(["CASH", "TRANSFER", "TRANSFER"]),
            },
          });
        }
      }

      for (let i = 0; i < randInt(6, 10); i++) {
        await prisma.expense.create({
          data: {
            churchId,
            date: new Date(year, month, randInt(1, 28)),
            amount: randInt(3, 70) * 10_000,
            accountId: pick(expenseAccounts).id,
            payee: pick([
              "한국전력", "○○문구", "행복마트", "정수기렌탈", "교회버스정비", "도서출판",
            ]),
            description: pick([
              "주일학교 교재 구입",
              "예배실 소모품",
              "전기요금",
              "선교지 후원",
              "차량 유류비",
              "성가대 악보",
            ]),
            method: "TRANSFER",
          },
        });
      }
    }
  }

  await Promise.all(
    accounts.map((a) =>
      prisma.budget.create({
        data: {
          churchId,
          year: thisYear,
          accountId: a.id,
          amount:
            a.type === "INCOME" ? randInt(500, 3000) * 10_000 : randInt(100, 1500) * 10_000,
        },
      }),
    ),
  );

  // ── 교회 역사 ──
  if (opts.withHistory) {
    const events: Array<[string, string, string, string]> = [
      ["1987-03-15", "교회 창립 예배", "FOUNDING", "서울 강남의 작은 상가 2층에서 12명의 성도가 모여 첫 예배를 드렸습니다."],
      ["1992-09-06", "제1성전 입당 예배", "BUILDING", "5년간의 기도와 헌신 끝에 첫 예배당을 마련하고 입당 예배를 드렸습니다."],
      ["1998-05-24", "초대 장로 임직식", "ORDINATION", "두 분이 장로로 임직하였습니다."],
      ["2005-11-13", "필리핀 선교사 파송", "MISSION", "첫 해외 선교사를 파송하며 교회의 선교 사역이 시작되었습니다."],
      ["2011-04-17", "새 성전 기공 예배", "BUILDING", "성도 500명을 수용하는 새 성전 건축을 시작했습니다."],
      ["2013-10-06", "새 성전 헌당 예배", "BUILDING", "2년 6개월의 공사를 마치고 하나님께 새 성전을 봉헌했습니다."],
      ["2019-03-10", "담임목사 취임", "PASTOR", `제3대 담임목사로 ${opts.representative}가 취임하였습니다.`],
      ["2022-06-05", "창립 35주년 감사예배", "EVENT", "지난 35년의 은혜를 돌아보며 감사예배를 드렸습니다."],
    ];

    for (const [date, title, category, content] of events) {
      await prisma.historyEvent.create({
        data: {
          churchId,
          date: new Date(`${date}T00:00:00`),
          title,
          category,
          content,
          pinned: category === "FOUNDING" || category === "BUILDING",
        },
      });
    }
  }

  return { church, members };
}

async function main() {
  await clearAll();
  const pw = await bcrypt.hash("church1234", 10);

  // ── 첫 번째 교회 ──
  console.log("은혜교회를 만듭니다…");
  const graceChurch = await seedChurch({
    name: "은혜교회",
    regNo: "123-82-00456",
    representative: "표성령 목사",
    address: "서울특별시 강남구 테헤란로 123",
    phone: "02-1234-5678",
    people: NAMES,
    idPrefix: "member",
    withHistory: true,
    years: 2,
  });

  const graceId = graceChurch.church.id;
  await prisma.user.create({
    data: {
      loginId: "admin", name: "관리자", password: pw, role: "ADMIN",
      status: "ACTIVE", churchId: graceId, approvedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      loginId: "finance", name: "이믿음 집사", password: pw, role: "FINANCE",
      status: "ACTIVE", churchId: graceId, approvedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      loginId: "pastor", name: "표성령 목사", password: pw, role: "PASTOR",
      status: "ACTIVE", churchId: graceId, approvedAt: new Date(),
    },
  });
  await prisma.user.create({
    data: {
      loginId: "member", name: graceChurch.members[0].name, password: pw, role: "MEMBER",
      status: "ACTIVE", churchId: graceId, memberId: graceChurch.members[0].id,
      approvedAt: new Date(),
    },
  });
  // 승인 대기 화면을 바로 볼 수 있도록 신청 상태의 계정도 하나 만들어 둔다.
  await prisma.user.create({
    data: {
      loginId: "waiting", name: "새신자 김믿음", phone: "010-2345-6789",
      password: pw, role: "MEMBER", status: "PENDING", churchId: graceId,
    },
  });

  // ── 두 번째 교회 (자료 격리 확인용) ──
  console.log("소망교회를 만듭니다…");
  const hopeChurch = await seedChurch({
    name: "소망교회",
    regNo: "456-82-00789",
    representative: "추영광 목사",
    address: "경기도 성남시 분당구 판교로 55",
    phone: "031-987-6543",
    people: SECOND_NAMES,
    idPrefix: "hope",
    withHistory: false,
    years: 1,
  });

  await prisma.user.create({
    data: {
      loginId: "hopeadmin", name: "소망교회 관리자", password: pw, role: "ADMIN",
      status: "ACTIVE", churchId: hopeChurch.church.id, approvedAt: new Date(),
    },
  });

  const counts = {
    교회: await prisma.church.count(),
    교인: await prisma.member.count(),
    헌금: await prisma.offering.count(),
    지출: await prisma.expense.count(),
    연혁: await prisma.historyEvent.count(),
    계정: await prisma.user.count(),
  };

  console.log("\n샘플 데이터 생성이 끝났습니다.");
  console.table(counts);
  console.log(`
로그인 계정 (비밀번호는 모두 church1234)

  [은혜교회]
  admin      관리자   — 모든 기능
  finance    회계     — 교적 조회 + 회계 입력
  pastor     교역자   — 교적·역사 관리
  member     성도     — 본인 헌금 내역 / 기부금영수증
  waiting    승인대기 — 승인 대기 화면 확인용

  [소망교회]
  hopeadmin  관리자   — 은혜교회 자료가 보이지 않는지 확인용
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
