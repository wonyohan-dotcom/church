import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { DEFAULT_ACCOUNTS } from "./constants";
import { newBankToken } from "./bank";

/**
 * 체험용 교회
 *  - 로그인 화면의 '체험해 보기', 앱스토어 심사원 계정으로 쓴다.
 *  - 매일 새벽(vercel.json 크론) 예시 자료를 새로 채운다. 누가 무엇을 바꿔도 다음 날이면 원래대로.
 *  - 교회와 체험 계정의 id 는 그대로 둔다. 전날 로그인한 사람의 세션이 끊기지 않게 하려는 것이다.
 * 자료는 모두 지어낸 것이다. 같은 날에는 같은 자료가 나오도록 날짜로 난수를 고정한다.
 */

export const DEMO = {
  churchName: "새소망교회 (체험용)",
  admin: { loginId: "demo", password: "demo1234", name: "체험 관리자" },
  member: { loginId: "demo-member", password: "demo1234" },
} as const;

export async function isDemoChurch(churchId: string) {
  const c = await prisma.church.findUnique({ where: { id: churchId }, select: { isDemo: true } });
  return !!c?.isDemo;
}

/** 체험용 교회가 없으면 만든다. 체험 관리자 계정을 돌려준다. */
export async function ensureDemo() {
  const existing = await prisma.user.findUnique({
    where: { loginId: DEMO.admin.loginId },
    include: { church: { select: { id: true, name: true, isDemo: true } } },
  });
  if (existing) {
    if (!existing.church.isDemo) throw new Error("체험용 아이디(demo)를 실제 교회 계정이 쓰고 있습니다.");
    return existing;
  }
  await resetDemo();
  return prisma.user.findUniqueOrThrow({
    where: { loginId: DEMO.admin.loginId },
    include: { church: { select: { id: true, name: true, isDemo: true } } },
  });
}

/** 체험용 교회의 자료를 모두 지우고 예시 자료로 다시 채운다. */
export async function resetDemo(now = new Date()) {
  const rand = seeded(Number(`${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}`));
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)];
  const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const password = await hashPassword(DEMO.admin.password);

  return prisma.$transaction(
    async (tx) => {
      // 둘이 동시에 다시 만들지 않도록 줄을 세운다.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('demo-church'))`;

      let church = await tx.church.findFirst({ where: { isDemo: true } });
      const churchData = {
        name: DEMO.churchName,
        regNo: "000-00-00000",
        representative: "김목자 목사",
        postalCode: "04524",
        address: "서울특별시 중구 세종대로 110 (예시 주소)",
        phone: "02-000-0000",
        logoUrl: null,
        sealUrl: null,
        receiptAutoIssue: true,
        joinOpen: false,
        showBalanceToMembers: true,
        // 알림함이 '휴대폰과 연결되지 않았습니다' 로 보이지 않게 연결된 상태로 둔다 (체험용 주소).
        bankToken: newBankToken(),
        bankAutoRecord: true,
        bankIncomeAccountId: null,
        isDemo: true,
      };
      if (church) {
        const churchId = church.id;
        // 헌금·지출이 계정과목을 붙잡고 있으므로 먼저 지운다.
        await tx.bankAlert.deleteMany({ where: { churchId } });
        await tx.offering.deleteMany({ where: { churchId } });
        await tx.expense.deleteMany({ where: { churchId } });
        await tx.budget.deleteMany({ where: { churchId } });
        await tx.donationReceipt.deleteMany({ where: { churchId } });
        await tx.attendanceRecord.deleteMany({ where: { churchId } });
        await tx.visit.deleteMany({ where: { churchId } });
        await tx.historyPhoto.deleteMany({ where: { churchId } });
        await tx.historyEvent.deleteMany({ where: { churchId } });
        await tx.auditLog.deleteMany({ where: { churchId } });
        await tx.contentReport.deleteMany({ where: { churchId } });
        await tx.post.deleteMany({ where: { churchId } });
        await tx.chatMessage.deleteMany({ where: { churchId } });
        await tx.setlist.deleteMany({ where: { churchId } });
        await tx.user.deleteMany({
          where: { churchId, loginId: { notIn: [DEMO.admin.loginId, DEMO.member.loginId] } },
        });
        await tx.member.deleteMany({ where: { churchId } });
        await tx.household.deleteMany({ where: { churchId } });
        await tx.district.deleteMany({ where: { churchId } });
        await tx.account.deleteMany({ where: { churchId } });
        church = await tx.church.update({ where: { id: churchId }, data: churchData });
      } else {
        church = await tx.church.create({ data: churchData });
      }
      const churchId = church.id;

      // ── 계정과목 · 예산 ──
      await tx.account.createMany({
        data: DEFAULT_ACCOUNTS.map((a, i) => ({
          churchId,
          code: a.code,
          name: a.name,
          type: a.type,
          category: a.category ?? null,
          isOffering: a.isOffering ?? false,
          deductible: a.deductible ?? true,
          sortOrder: i,
        })),
      });
      const accounts = await tx.account.findMany({ where: { churchId } });
      const byName = (name: string) => accounts.find((a) => a.name === name) ?? accounts[0];
      const giving = accounts.filter((a) => a.type === "INCOME" && a.isOffering);
      const spending = accounts.filter((a) => a.type === "EXPENSE");
      await tx.budget.createMany({
        data: accounts.map((a) => ({
          churchId,
          year: now.getFullYear(),
          accountId: a.id,
          amount: a.type === "INCOME" ? int(30, 300) * 100_000 : int(10, 150) * 100_000,
        })),
      });

      // ── 교구 · 교인 ──
      const districtNames = ["1교구", "2교구", "3교구", "청년부"];
      await tx.district.createMany({
        data: districtNames.map((name, i) => ({ churchId, name, sortOrder: i })),
      });
      const districts = await tx.district.findMany({ where: { churchId }, orderBy: { sortOrder: "asc" } });

      const people = PEOPLE.map(([name, gender, position], i) => {
        // 몇 분은 생일이 이번 주, 몇 분은 최근 등록한 새가족으로 둔다.
        const birth =
          i % 9 === 0
            ? new Date(int(1950, 1995), now.getMonth(), Math.min(28, now.getDate() + (i % 5)))
            : new Date(int(1945, 2008), int(0, 11), int(1, 28));
        const registeredAt = i >= PEOPLE.length - 3 ? day(-int(7, 60)) : new Date(int(1998, 2024), int(0, 11), int(1, 28));
        return {
          churchId,
          code: String(i + 1).padStart(4, "0"),
          name,
          gender,
          position,
          status: "ACTIVE",
          birthDate: birth,
          phone: `010-0000-${String(1000 + i).padStart(4, "0")}`,
          email: `demo${i + 1}@example.com`,
          address: `서울특별시 중구 예시로 ${int(1, 200)}`,
          districtId: districts[i % districts.length].id,
          registeredAt,
          baptizedAt: rand() > 0.3 ? new Date(int(1999, 2024), int(0, 11), int(1, 28)) : null,
          job: pick(["회사원", "자영업", "교사", "주부", "학생", "공무원", "의료인"]),
        };
      });
      await tx.member.createMany({ data: people });
      const members = await tx.member.findMany({ where: { churchId }, orderBy: { code: "asc" } });

      // ── 계정 (관리자 · 성도) ──
      const adminData = {
        name: DEMO.admin.name,
        password,
        role: "ADMIN",
        status: "ACTIVE",
        churchId,
        mustChangePw: false,
        approvedAt: now,
        communityAgreedAt: null, // 체험할 때마다 이용 안내를 볼 수 있게
      };
      await tx.user.upsert({
        where: { loginId: DEMO.admin.loginId },
        update: adminData,
        create: { loginId: DEMO.admin.loginId, ...adminData },
      });
      const memberData = { ...adminData, name: members[0].name, role: "MEMBER", memberId: members[0].id };
      await tx.user.upsert({
        where: { loginId: DEMO.member.loginId },
        update: memberData,
        create: { loginId: DEMO.member.loginId, ...memberData },
      });

      // ── 교회 소통: 예시 글 · 채팅 · 이번 주 주보 ──
      const demoAdmin = await tx.user.findUniqueOrThrow({ where: { loginId: DEMO.admin.loginId } });
      const demoMember = await tx.user.findUniqueOrThrow({ where: { loginId: DEMO.member.loginId } });
      const ago = (min: number) => new Date(now.getTime() - min * 60_000);
      const p1 = await tx.post.create({
        data: { churchId, authorId: demoAdmin.id, body: "이번 주일 예배 후에 함께 식사합니다. 모두 환영합니다 🙂", createdAt: ago(300) },
      });
      const p2 = await tx.post.create({
        data: { churchId, authorId: demoMember.id, body: "어제 새가족 환영회 사진을 곧 올릴게요. 함께해 주셔서 감사합니다!", createdAt: ago(95) },
      });
      await tx.postComment.createMany({
        data: [
          { postId: p1.id, authorId: demoMember.id, body: "참석하겠습니다!", createdAt: ago(240) },
          { postId: p2.id, authorId: demoAdmin.id, body: "수고 많으셨습니다 😊", createdAt: ago(60) },
        ],
      });
      await tx.chatMessage.createMany({
        data: [
          { churchId, authorId: demoAdmin.id, body: "안녕하세요, 우리 교회 대화방입니다. 편하게 이야기 나눠요.", createdAt: ago(180) },
          { churchId, authorId: demoMember.id, body: "안녕하세요! 이번 주 찬양 연습은 몇 시인가요?", createdAt: ago(40) },
          { churchId, authorId: demoAdmin.id, body: "토요일 오후 3시입니다. 이번 주 주보는 ‘주보’ 탭에서 확인하세요.", createdAt: ago(35) },
        ],
      });
      const sundayAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay()) % 7));
      await tx.setlist.create({
        data: {
          churchId,
          title: "주일 예배 주보",
          serviceDate: sundayAhead,
          sermonTitle: "은혜 안에서 자라가는 교회",
          scripture: "에베소서 4:11-16",
          note: "찬양 연습은 토요일 오후 3시입니다. (예시 자료)",
          worshipOrder: "묵도\n찬송 | 다 같이\n대표 기도 | 김장로\n성경 봉독 | 에베소서 4:11-16\n찬양 | 찬양팀\n말씀 | 담임목사\n봉헌 기도\n광고\n축도",
          announcements: "예배 후 12시 30분에 교육관에서 함께 식사합니다.\n새가족 환영회가 다음 주일 오후 1시에 있습니다.\n청년부 가을 수련회 신청을 받습니다. (사무실)",
          prayers: "아픈 성도들의 회복을 위해\n새로 오신 가정이 교회에 잘 정착하도록\n다음 세대가 믿음 안에서 자라도록",
          songs: {
            create: [
              { sortOrder: 0, title: "예배합니다", musicKey: "G" },
              { sortOrder: 1, title: "주님 말씀하시면", musicKey: "D" },
              { sortOrder: 2, title: "은혜 아니면", musicKey: "A" },
            ],
          },
        },
      });

      // ── 헌금 (지난 1년, 주일마다) · 지출 ──
      const sunday = day(-now.getDay());
      const offerings = [];
      for (let w = 0; w < 52; w++) {
        const date = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() - w * 7);
        for (const [i, m] of members.entries()) {
          if (rand() > 0.5) continue;
          offerings.push({
            churchId,
            date,
            amount: pick([10, 20, 30, 50, 50, 100, 100, 200, 300]) * 1_000,
            accountId: (w % 4 === 0 && i % 3 === 0 ? byName("십일조") : pick(giving)).id,
            memberId: m.id,
            method: pick(["CASH", "TRANSFER", "TRANSFER"]),
          });
        }
        // 이름만 적힌 헌금 · 무명 헌금도 조금 섞는다 ('이름으로 헌금자 연결', '꾹 눌러 고르기' 체험용)
        if (w % 3 === 0) {
          offerings.push({
            churchId,
            date,
            amount: 100_000,
            accountId: byName("감사헌금").id,
            donorName: `${members[1].name}${members[2].name}.감사`,
            method: "TRANSFER",
          });
        }
        if (w % 2 === 0) {
          offerings.push({ churchId, date, amount: int(1, 5) * 10_000, accountId: byName("주일헌금").id, method: "CASH" });
        }
      }
      // 이번 달 초에도 헌금이 보이도록 최근 며칠의 계좌이체 헌금을 조금 넣는다.
      for (let d = 0; d < 4; d++) {
        const date = day(-d);
        if (date.getMonth() !== now.getMonth()) break;
        for (let k = 0; k < 3; k++) {
          offerings.push({
            churchId,
            date,
            amount: pick([30, 50, 100, 200]) * 1_000,
            accountId: pick(giving).id,
            memberId: pick(members).id,
            method: "TRANSFER",
          });
        }
      }
      await tx.offering.createMany({ data: offerings });

      const expenses = [];
      for (let mth = 0; mth < 12; mth++) {
        // 이번 달은 지난 날짜만큼만 (달 초에 지출만 잔뜩 보이지 않게)
        const count = mth === 0 ? Math.floor((4 * now.getDate()) / 30) : 4;
        for (let k = 0; k < count; k++) {
          const [payee, description, accountName] = pick(PAYEES);
          expenses.push({
            churchId,
            date: new Date(now.getFullYear(), now.getMonth() - mth, int(1, mth === 0 ? Math.max(1, now.getDate()) : 28)),
            amount: int(3, 40) * 10_000,
            accountId: (spending.find((a) => a.name === accountName) ?? pick(spending)).id,
            payee,
            description,
            method: "TRANSFER",
          });
        }
      }
      for (let mth = 0; mth < 12; mth++) {
        const date = new Date(now.getFullYear(), now.getMonth() - mth, 25);
        if (date > now) continue;
        expenses.push(
          { churchId, date, amount: 1_800_000, accountId: byName("교역자 사례비").id, payee: "담임목사", description: "월 사례비", method: "TRANSFER" },
          { churchId, date, amount: 500_000, accountId: byName("임대료").id, payee: "○○빌딩", description: "예배당 월세", method: "TRANSFER" },
        );
      }
      await tx.expense.createMany({ data: expenses });

      // ── 출석 (최근 10주) · 심방 ──
      const away = new Set(members.slice(-6, -3).map((m) => m.id)); // 3주째 결석 중인 분
      for (let w = 9; w >= 0; w--) {
        const date = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() - w * 7);
        const record = await tx.attendanceRecord.create({
          data: { churchId, date, service: "SUNDAY", visitorCount: int(0, 4) },
        });
        const present = members.filter((m) => !(away.has(m.id) && w < 3) && rand() < 0.85);
        await tx.attendanceCheck.createMany({
          data: present.map((m) => ({ recordId: record.id, memberId: m.id })),
        });
      }
      const admin = await tx.user.findUniqueOrThrow({ where: { loginId: DEMO.admin.loginId } });
      await tx.visit.createMany({
        data: VISITS.map(([kind, content, prayer], i) => ({
          churchId,
          memberId: members[i * 4 + 2].id,
          date: day(-(i * 5 + 1)),
          kind,
          content,
          prayer,
          createdById: admin.id,
        })),
      });

      // ── 연혁 ──
      await tx.historyEvent.createMany({
        data: HISTORY.map(([date, title, category, content]) => ({
          churchId,
          date: new Date(`${date}T00:00:00`),
          title,
          category,
          content,
          pinned: category === "FOUNDING",
        })),
      });

      // ── 입출금 알림함 (확인 대기) ──
      // 문자에 찍힌 잔액이 장부와 이어지도록, 지금 장부 잔액에서 이어 붙인다.
      const ledger =
        offerings.reduce((n, o) => n + o.amount, 0) - expenses.reduce((n, e) => n + e.amount, 0);
      const at = (h: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, 12);
      await tx.bankAlert.createMany({
        data: [
          {
            churchId,
            direction: "IN",
            amount: 50_000,
            balance: ledger + 50_000,
            counterparty: members[5].name,
            bankName: "IBK기업",
            occurredAt: at(9),
            rawText: `[Web발신]\n입금 50,000원\n잔액 ${(ledger + 50_000).toLocaleString("ko-KR")}원\n${members[5].name}\n000***00000000\n기업`,
            source: "SHORTCUT",
            dedupKey: "demo-1",
          },
          {
            churchId,
            direction: "OUT",
            amount: 132_000,
            balance: ledger + 50_000 - 132_000,
            counterparty: "한국전력공사",
            bankName: "IBK기업",
            occurredAt: at(10),
            rawText: `[Web발신]\n출금 132,000원\n잔액 ${(ledger + 50_000 - 132_000).toLocaleString("ko-KR")}원\n한국전력공사\n000***00000000\n기업`,
            source: "SHORTCUT",
            dedupKey: "demo-2",
          },
        ],
      });

      return church;
    },
    { timeout: 60_000, maxWait: 20_000 },
  );
}

/** 날짜로 고정한 난수 (mulberry32) */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE: ReadonlyArray<readonly [string, "M" | "F", string]> = [
  ["김은혜", "F", "권사"], ["박성실", "M", "장로"], ["이믿음", "F", "집사"], ["최소망", "M", "안수집사"],
  ["정사랑", "F", "권사"], ["강온유", "F", "성도"], ["조화평", "M", "서리집사"], ["윤기쁨", "F", "성도"],
  ["장충성", "M", "장로"], ["임순종", "F", "권사"], ["한겸손", "M", "서리집사"], ["오지혜", "F", "집사"],
  ["신실한", "M", "성도"], ["권능력", "M", "안수집사"], ["황평강", "F", "성도"], ["안위로", "F", "집사"],
  ["송찬양", "M", "성도"], ["문축복", "F", "권사"], ["양선한", "M", "성도"], ["백진리", "F", "성도"],
  ["남기도", "M", "서리집사"], ["구원해", "F", "성도"], ["노새벽", "M", "성도"], ["하늘빛", "F", "성도"],
  ["서새길", "M", "성도"], ["유다함", "F", "성도"],
];

// [거래처, 적요, 지출 항목]
const PAYEES: ReadonlyArray<readonly [string, string, string]> = [
  ["한국전력공사", "예배당 전기요금", "공과금"],
  ["○○도시가스", "난방비", "공과금"],
  ["○○문구", "주일학교 교재", "교육부서 사역비"],
  ["행복마트", "친교실 다과", "예배·행사비"],
  ["꽃집 은혜", "강단 꽃꽂이", "예배·행사비"],
  ["정수기렌탈", "정수기 월 사용료", "시설 유지보수"],
  ["○○설비", "화장실 수리", "시설 유지보수"],
  ["○○자동차정비", "교회 차량 정비", "차량 유지비"],
  ["도서출판 은혜", "성경공부 교재", "교육부서 사역비"],
  ["쿠팡", "예배실 소모품", "사무·비품비"],
  ["필리핀 선교지", "선교사 후원", "선교비"],
];

const VISITS = [
  ["VISIT", "가정 심방. 자녀 진학 문제로 기도 부탁하심. 가정 예배를 다시 시작하기로 함.", "자녀의 진로가 잘 열리도록"],
  ["HOSPITAL", "무릎 수술 후 회복 중. 다음 주 퇴원 예정.", "빠른 회복"],
  ["CALL", "최근 이직으로 주일 출석이 어려우시다고 함. 온라인 예배 안내.", null],
  ["COUNSEL", "새가족 교육 일정 상담. 4주 과정 등록.", null],
  ["VISIT", "새가족 첫 심방. 교회 소개와 구역 안내.", "교회에 잘 정착하도록"],
] as const;

const HISTORY = [
  ["1995-03-12", "교회 창립 예배", "FOUNDING", "작은 상가 2층에서 15명의 성도가 모여 첫 예배를 드렸습니다."],
  ["2003-09-07", "예배당 입당 예배", "BUILDING", "8년간의 기도 끝에 첫 예배당을 마련했습니다."],
  ["2010-05-23", "장로 임직식", "ORDINATION", "두 분이 장로로 임직하였습니다."],
  ["2016-11-13", "선교사 파송", "MISSION", "첫 해외 선교사를 파송했습니다."],
  ["2020-03-08", "담임목사 취임", "PASTOR", "제2대 담임목사가 취임하였습니다."],
  ["2025-03-09", "창립 30주년 감사예배", "EVENT", "지난 30년의 은혜를 돌아보며 감사예배를 드렸습니다."],
] as const;

/**
 * 삭제 시험용 계정 (앱스토어 심사 영상 · 계정 삭제 확인용).
 * 체험용 교회(demo)는 삭제가 막혀 있으므로, 이 계정은 진짜 교회처럼 삭제할 수 있다.
 * 로그인할 때마다 없으면 새로 만든다. 그래서 지워도 다음에 다시 로그인하면 되살아난다.
 */
export const TRIAL = { loginId: "trial", password: "trial1234", churchName: "시험교회", name: "시험 관리자" } as const;

export async function ensureTrial() {
  const existing = await prisma.user.findUnique({ where: { loginId: TRIAL.loginId } });
  if (existing) return;
  const password = await hashPassword(TRIAL.password);
  await prisma.$transaction(async (tx) => {
    const church = await tx.church.create({
      data: {
        name: TRIAL.churchName,
        joinOpen: false,
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
        members: {
          create: ["김은혜", "박성실", "이믿음"].map((name, i) => ({
            code: String(i + 1).padStart(4, "0"),
            name,
            status: "ACTIVE",
          })),
        },
      },
    });
    await tx.user.create({
      data: {
        loginId: TRIAL.loginId,
        name: TRIAL.name,
        password,
        role: "ADMIN",
        status: "ACTIVE",
        churchId: church.id,
        approvedAt: new Date(),
      },
    });
  });
}
