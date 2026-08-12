/**
 * 샘플 데이터 생성 스크립트.
 *   npm run db:seed
 * 화면을 둘러보거나 교육용으로 쓰기 위한 가상의 자료입니다.
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

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
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

  // ── 교회 정보 ──
  await prisma.churchSetting.upsert({
    where: { id: "singleton" },
    update: {
      name: "은혜교회",
      regNo: "123-82-00456",
      representative: "표성령 목사",
      postalCode: "06234",
      address: "서울특별시 강남구 테헤란로 123",
      phone: "02-1234-5678",
      receiptAutoIssue: true,
    },
    create: {
      id: "singleton",
      name: "은혜교회",
      regNo: "123-82-00456",
      representative: "표성령 목사",
      postalCode: "06234",
      address: "서울특별시 강남구 테헤란로 123",
      phone: "02-1234-5678",
      receiptAutoIssue: true,
    },
  });

  // ── 계정과목 ──
  await prisma.account.createMany({
    data: DEFAULT_ACCOUNTS.map((a, i) => ({
      code: a.code,
      name: a.name,
      type: a.type,
      category: a.category ?? null,
      isOffering: a.isOffering ?? false,
      deductible: a.deductible ?? true,
      sortOrder: i,
    })),
  });
  const accounts = await prisma.account.findMany();
  const incomeAccounts = accounts.filter((a) => a.type === "INCOME" && a.isOffering);
  const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE");

  // ── 교구 ──
  const districts = await Promise.all(
    ["1교구", "2교구", "3교구", "청년부"].map((name, i) =>
      prisma.district.create({
        data: { name, sortOrder: i, leaderName: `${pick(NAMES)[0]}` },
      }),
    ),
  );

  // ── 가정 · 교인 ──
  console.log("교인을 등록합니다…");
  const members = [];
  for (const [i, [name, gender, position]] of NAMES.entries()) {
    const district = districts[i % districts.length];

    const household =
      i % 2 === 0
        ? await prisma.household.create({
            data: {
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
        code: String(i + 1).padStart(4, "0"),
        name,
        gender,
        position,
        status: i === 23 ? "TRANSFERRED" : "ACTIVE",
        birthDate: new Date(randInt(1945, 2010), randInt(0, 11), randInt(1, 28)),
        phone: `010-${randInt(1000, 9999)}-${randInt(1000, 9999)}`,
        email: `member${i + 1}@example.com`,
        postalCode: "06234",
        address: `서울특별시 강남구 삼성로 ${randInt(1, 200)}`,
        addressDetail: `${randInt(101, 2005)}호`,
        districtId: district.id,
        householdId: household?.id ?? null,
        householdRel: household ? "본인" : null,
        registeredAt: new Date(randInt(1998, 2024), randInt(0, 11), randInt(1, 28)),
        baptizedAt: Math.random() > 0.3
          ? new Date(randInt(1999, 2024), randInt(0, 11), randInt(1, 28))
          : null,
        job: pick(["회사원", "자영업", "교사", "주부", "학생", "공무원", "의료인"]),
      },
    });
    members.push(member);
  }

  // ── 사용자 계정 ──
  console.log("계정을 만듭니다…");
  const pw = await bcrypt.hash("church1234", 10);
  await prisma.user.create({
    data: { loginId: "admin", name: "관리자", password: pw, role: "ADMIN" },
  });
  await prisma.user.create({
    data: { loginId: "finance", name: "이믿음 집사", password: pw, role: "FINANCE" },
  });
  await prisma.user.create({
    data: { loginId: "pastor", name: "표성령 목사", password: pw, role: "PASTOR" },
  });
  // 성도 포털을 바로 확인할 수 있도록 첫 번째 교인에게 계정을 붙여 둔다.
  await prisma.user.create({
    data: {
      loginId: "member",
      name: members[0].name,
      password: pw,
      role: "MEMBER",
      memberId: members[0].id,
    },
  });

  // ── 헌금 · 지출 (최근 2년) ──
  console.log("회계 자료를 만듭니다…");
  const thisYear = new Date().getFullYear();
  const activeMembers = members.filter((m) => m.status === "ACTIVE");

  for (const year of [thisYear - 1, thisYear]) {
    const lastMonth = year === thisYear ? new Date().getMonth() : 11;

    for (let month = 0; month <= lastMonth; month++) {
      // 주일마다 교인 절반 정도가 헌금한다고 가정
      for (let week = 0; week < 4; week++) {
        const day = 1 + week * 7 + randInt(0, 2);
        const date = new Date(year, month, Math.min(day, 28));

        for (const member of activeMembers) {
          if (Math.random() > 0.55) continue;
          await prisma.offering.create({
            data: {
              date,
              amount: randInt(1, 20) * 10_000,
              accountId: pick(incomeAccounts).id,
              memberId: member.id,
              method: pick(["CASH", "TRANSFER", "TRANSFER"]),
            },
          });
        }
      }

      // 월별 지출 6~10건
      for (let i = 0; i < randInt(6, 10); i++) {
        await prisma.expense.create({
          data: {
            date: new Date(year, month, randInt(1, 28)),
            amount: randInt(3, 70) * 10_000,
            accountId: pick(expenseAccounts).id,
            payee: pick(["한국전력", "○○문구", "행복마트", "정수기렌탈", "교회버스정비", "도서출판"]),
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

  // ── 예산 ──
  await Promise.all(
    accounts.map((a) =>
      prisma.budget.create({
        data: {
          year: thisYear,
          accountId: a.id,
          amount: a.type === "INCOME" ? randInt(500, 3000) * 10_000 : randInt(100, 1500) * 10_000,
        },
      }),
    ),
  );

  // ── 교회 역사 ──
  console.log("교회 연혁을 기록합니다…");
  const events: Array<[string, string, string, string]> = [
    ["1987-03-15", "은혜교회 창립 예배", "FOUNDING", "서울 강남의 작은 상가 2층에서 12명의 성도가 모여 첫 예배를 드렸습니다."],
    ["1992-09-06", "제1성전 입당 예배", "BUILDING", "5년간의 기도와 헌신 끝에 첫 예배당을 마련하고 입당 예배를 드렸습니다."],
    ["1998-05-24", "초대 장로 임직식", "ORDINATION", "박성실, 장충성 두 분이 장로로 임직하였습니다."],
    ["2005-11-13", "필리핀 선교사 파송", "MISSION", "첫 해외 선교사를 파송하며 교회의 선교 사역이 시작되었습니다."],
    ["2011-04-17", "새 성전 기공 예배", "BUILDING", "성도 500명을 수용하는 새 성전 건축을 시작했습니다."],
    ["2013-10-06", "새 성전 헌당 예배", "BUILDING", "2년 6개월의 공사를 마치고 하나님께 새 성전을 봉헌했습니다."],
    ["2019-03-10", "표성령 목사 담임 취임", "PASTOR", "제3대 담임목사로 표성령 목사가 취임하였습니다."],
    ["2022-06-05", "창립 35주년 감사예배", "EVENT", "지난 35년의 은혜를 돌아보며 감사예배를 드렸습니다."],
  ];

  for (const [date, title, category, content] of events) {
    await prisma.historyEvent.create({
      data: {
        date: new Date(`${date}T00:00:00`),
        title,
        category,
        content,
        pinned: category === "FOUNDING" || category === "BUILDING",
      },
    });
  }

  const counts = {
    교인: await prisma.member.count(),
    헌금: await prisma.offering.count(),
    지출: await prisma.expense.count(),
    연혁: await prisma.historyEvent.count(),
  };

  console.log("\n샘플 데이터 생성이 끝났습니다.");
  console.table(counts);
  console.log(`
로그인 계정 (비밀번호는 모두 church1234)
  admin    관리자   — 모든 기능
  finance  회계     — 교적 조회 + 회계 입력
  pastor   교역자   — 교적·역사 관리
  member   성도     — 본인 헌금 내역 / 기부금영수증
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
