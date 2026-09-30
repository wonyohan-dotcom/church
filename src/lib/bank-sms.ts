/**
 * 은행 입출금 문자(SMS)·알림 글을 읽어 거래 내용을 뽑는다.
 *
 * 은행마다 문자 모양이 조금씩 다르지만 대체로 다음 조각들을 담고 있다.
 *   [Web발신]
 *   신한 06/12 14:23
 *   110-***-123456
 *   입금     50,000
 *   잔액  1,234,567
 *    홍길동
 * 줄바꿈 위치나 순서가 은행마다 달라서, 줄 단위가 아니라 "입금/출금 다음에 오는 금액",
 * "잔액 다음에 오는 금액" 처럼 조각 단위로 찾는다.
 *
 * 이 파일은 서버·브라우저 어디서나 쓸 수 있도록 순수 함수만 둔다.
 */

export type ParsedBankMessage = {
  direction: "IN" | "OUT";
  amount: number;
  balance: number | null;
  counterparty: string | null;
  bankName: string | null;
  /** 문자에 날짜·시각이 없으면 null (받은 시각을 쓴다) */
  occurredAt: Date | null;
};

// 이 교회는 기업은행·농협 통장을 쓴다. 두 은행을 먼저 보고, 나머지는 혹시 몰라 남겨 둔다.
// 기업은행 문자는 은행 이름이 맨 끝 줄에 "기업" 한 단어로만 나온다.
const BANKS: Array<[RegExp, string]> = [
  [/NH농협|농협|\bNH\b/, "농협"],
  [/IBK|기업은행|(?:^|\s)기업(?:\s|$)/, "IBK기업"],
  [/KB국민|국민은행|\[KB\]|\bKB\b/, "KB국민"],
  [/신한/, "신한"],
  [/우리은행|^우리\s/m, "우리"],
  [/하나은행|^하나[\s,]/m, "하나"],
  [/카카오뱅크/, "카카오뱅크"],
  [/토스뱅크/, "토스뱅크"],
  [/새마을금고/, "새마을금고"],
  [/신협/, "신협"],
  [/우체국/, "우체국"],
];

// 거래 상대 이름으로 볼 수 없는 은행 이름 조각
const BANK_WORDS = new Set([
  "농협", "NH", "NH농협", "농협은행", "IBK", "기업", "기업은행", "KB", "KB국민", "국민",
  "신한", "우리", "하나", "카카오뱅크", "토스뱅크", "새마을금고", "신협", "우체국",
]);

const IN_WORDS = ["입금", "이체입금", "받았어요", "들어왔어요"];
// 출금 쪽 표현. "이체" 는 대개 보낸 쪽에서 쓴다.
const OUT_WORDS = ["출금", "지급", "인출", "이체", "송금", "결제", "보냈어요"];

// 이 말이 들어 있으면 거래 상대 이름이 아니다.
const STOP_CONTAINS = [
  "입금", "출금", "지급", "인출", "이체", "송금", "결제", "잔액", "누적", "승인", "취소",
  "Web발신", "발신", "보냈어요", "받았어요", "들어왔어요", "님이", "님께",
];
// 이 말과 똑같으면 거래 상대 이름이 아니다. ("현대카드" 는 이름이지만 "카드" 는 아니다)
const STOP_EXACT = new Set([
  "원", "카드", "체크카드", "자동", "타행", "당행", "스마트", "인터넷", "모바일", "폰뱅킹",
  "펌뱅킹", "CMS", "ATM", "창구", "대체", "알림", "거래", "계좌", "통장", "오픈뱅킹",
]);

const MAX_AMOUNT = 2_000_000_000; // Int 범위 안쪽. 이보다 큰 숫자는 잘못 읽은 것으로 본다.

export function parseBankMessage(text: string, now: Date = new Date()): ParsedBankMessage | null {
  if (!text) return null;
  const raw = text.replace(/\r\n?/g, "\n").slice(0, 2000);
  const bankName = findBank(raw);

  // [Web발신], [KB] 처럼 괄호로 둘러싼 머리말은 이름 후보를 헷갈리게 하므로 지운다.
  const cleaned = raw.replace(/\[[^\]\n]{0,20}\]/g, " ");

  const deal = findDeal(cleaned);
  if (!deal) return null;

  const balanceMatch = /잔액\s*[:：]?\s*(-?[\d,]+)/.exec(cleaned);
  const balance = balanceMatch ? toInt(balanceMatch[1]) : null;

  return {
    direction: deal.direction,
    amount: deal.amount,
    balance: balance !== null && Math.abs(balance) <= MAX_AMOUNT ? balance : null,
    counterparty: findCounterparty(cleaned, deal.start, deal.end),
    bankName,
    occurredAt: findDate(cleaned, now),
  };
}

/** 문자 여러 통을 한 번에 붙여넣은 경우 한 통씩 나눈다. */
export function splitMessages(text: string): string[] {
  const parts = text
    .replace(/\r\n?/g, "\n")
    .split(/(?=\[Web발신\])|\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function findBank(text: string): string | null {
  for (const [re, name] of BANKS) if (re.test(text)) return name;
  return null;
}

function findDeal(
  text: string,
): { direction: "IN" | "OUT"; amount: number; start: number; end: number } | null {
  // 1) "입금 50,000원", "출금\n50,000" 처럼 거래 종류 바로 뒤에 금액이 오는 경우
  const words = [...IN_WORDS, ...OUT_WORDS].sort((a, b) => b.length - a.length);
  const after = new RegExp(`(${words.join("|")})\\s*[:：]?\\s*([\\d,]{1,15})\\s*원?`, "g");
  for (const m of text.matchAll(after)) {
    const amount = toInt(m[2]);
    if (amount && amount > 0 && amount <= MAX_AMOUNT) {
      return {
        direction: IN_WORDS.includes(m[1]) ? "IN" : "OUT",
        amount,
        start: m.index!,
        end: m.index! + m[0].length,
      };
    }
  }

  // 2) "50,000원 입금", "50,000원을 보냈어요" 처럼 금액이 앞에 오는 경우
  const before = new RegExp(`([\\d,]{1,15})\\s*원\\S{0,2}\\s*(${words.join("|")})`, "g");
  for (const m of text.matchAll(before)) {
    if (/잔액\s*[:：]?\s*$/.test(text.slice(Math.max(0, m.index! - 6), m.index!))) continue;
    const amount = toInt(m[1]);
    if (amount && amount > 0 && amount <= MAX_AMOUNT) {
      // "홍길동님이 …원을 보냈어요" 는 우리 통장으로 들어온 돈이다. ("님께" 는 우리가 보낸 것)
      const sentToUs = m[2] === "보냈어요" && /님(?:이|께서)/.test(text);
      return {
        direction: IN_WORDS.includes(m[2]) || sentToUs ? "IN" : "OUT",
        amount,
        start: m.index!,
        end: m.index! + m[0].length,
      };
    }
  }
  return null;
}

function findCounterparty(text: string, dealStart: number, dealEnd: number): string | null {
  // "보내는분: 홍길동", "받는분 홍길동" 처럼 이름표가 붙어 있으면 그대로 쓴다.
  const labeled = /(?:보낸\s*분|보내는\s*분|받는\s*분|입금자|예금주)\s*[:：]?\s*([가-힣A-Za-z][가-힣A-Za-z0-9()&.\- ]{0,19})/.exec(
    text,
  );
  if (labeled) {
    const name = tidyName(labeled[1]);
    if (name) return name;
  }

  // "홍길동님이 50,000원을 보냈어요", "홍길동님께 50,000원을 보냈어요"
  const sentence = /([가-힣A-Za-z][가-힣A-Za-z0-9()]{0,19})님(?:이|께서|께|에게)/.exec(text);
  if (sentence) return tidyName(sentence[1]);

  // 그 밖에는 이름처럼 생긴 조각을 찾는다. 금액 뒤쪽을 먼저 보고, 없으면 앞쪽 마지막 것.
  const tokens = [...text.matchAll(/[^\s,]+/g)].map((m) => ({
    value: m[0],
    at: m.index!,
  }));
  const candidates = tokens.filter((t) => isNameLike(t.value));
  const afterDeal = candidates.find((t) => t.at >= dealEnd);
  if (afterDeal) return tidyName(afterDeal.value);
  const beforeDeal = candidates.filter((t) => t.at < dealStart).pop();
  return beforeDeal ? tidyName(beforeDeal.value) : null;
}

function isNameLike(token: string): boolean {
  const t = token.trim();
  if (t.length < 2 || t.length > 20) return false;
  if (/[\d*:/]/.test(t)) return false; // 금액·계좌번호·시각·가려진 이름(홍*동)
  if (!/^[가-힣A-Za-z(][가-힣A-Za-z()&.\- ]*$/.test(t)) return false;
  if (STOP_CONTAINS.some((w) => t.includes(w))) return false;
  if (STOP_EXACT.has(t) || BANK_WORDS.has(t)) return false;
  return true;
}

function tidyName(v: string): string | null {
  const t = v.replace(/\s+/g, " ").trim().slice(0, 30);
  return t || null;
}

function findDate(text: string, now: Date): Date | null {
  const full = /(20\d{2})[./-](\d{1,2})[./-](\d{1,2})(?:[^\d]{1,3}(\d{1,2}):(\d{2}))?/.exec(text);
  if (full) {
    return makeDate(+full[1], +full[2], +full[3], full[4], full[5]);
  }

  // 계좌번호 조각(351-1234)을 날짜로 읽지 않도록 앞뒤에 숫자가 붙은 것은 뺀다.
  const short = /(?<![\d-])(\d{1,2})(?:[/.]|월\s?)(\d{1,2})(?!\d)일?[\s,]*(?:(\d{1,2}):(\d{2}))?/.exec(text);
  if (short) {
    const month = +short[1];
    const day = +short[2];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    let date = makeDate(now.getFullYear(), month, day, short[3], short[4]);
    // 1월 초에 받은 12월 31일 문자처럼, 날짜가 미래로 나오면 작년 것이다.
    if (date && date.getTime() - now.getTime() > 2 * 24 * 3600 * 1000) {
      date = makeDate(now.getFullYear() - 1, month, day, short[3], short[4]);
    }
    return date;
  }
  return null;
}

function makeDate(y: number, m: number, d: number, hh?: string, mm?: string): Date | null {
  const date = new Date(y, m - 1, d, hh ? +hh : 0, mm ? +mm : 0);
  if (Number.isNaN(date.getTime()) || date.getMonth() !== m - 1) return null;
  return date;
}

function toInt(v: string): number | null {
  const n = Number(v.replace(/,/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}
