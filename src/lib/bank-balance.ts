/**
 * 은행 문자의 '잔액'으로 빠진 거래를 찾는다.
 *
 * 은행 문자에는 거래 뒤 잔액이 찍혀 온다. 그래서
 *   앞 문자의 잔액 + (이번 입금 또는 − 이번 출금) = 이번 문자의 잔액
 * 이 맞아야 한다. 맞지 않으면 그 사이에 문자가 오지 않은 거래가 있다는 뜻이다.
 * (예: 출금 문자만 받도록 설정된 통장에 들어온 헌금)
 *
 * 이 파일은 서버·브라우저 어디서나 쓸 수 있도록 순수 함수만 둔다.
 */

export type BalanceItem = {
  id: string;
  direction: string; // IN | OUT
  amount: number;
  balance: number | null;
  occurredAt: Date;
  createdAt?: Date;
};

export type BalanceGap<T extends BalanceItem = BalanceItem> = {
  prev: T;
  next: T;
  /** 양수면 문자 없이 들어온 돈, 음수면 문자 없이 나간 돈 */
  gap: number;
  /** 다음 거래 직전에 있었어야 할 잔액 */
  expectedBefore: number;
};

/** 이 거래 바로 전의 잔액 */
export function balanceBefore(x: BalanceItem) {
  return (x.balance ?? 0) - (x.direction === "IN" ? x.amount : -x.amount);
}

/**
 * 문자에 찍힌 계좌번호 끝 네 자리. 같은 은행에 통장이 둘 이상이어도 섞이지 않게 쓴다.
 * 예: "469***03801011" → "1011", "301-****-2640-41" → "4041"
 */
export function accountTag(text: string): string | null {
  const m = /\d[\d-]*\*+[\d*-]*\d/.exec(text);
  if (!m) return null;
  const digits = m[0].replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/**
 * 거래를 시간 순서로 늘어놓는다.
 * 문자에는 분까지만 나와서 같은 시각의 거래가 여러 건일 수 있다.
 * 그럴 때는 잔액이 이어지는 순서를 찾아 늘어놓는다.
 */
export function orderByBalance<T extends BalanceItem>(items: T[]): T[] {
  const sorted = items
    .filter((x) => x.balance !== null)
    .sort(
      (a, b) =>
        a.occurredAt.getTime() - b.occurredAt.getTime() ||
        (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
    );

  const out: T[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j].occurredAt.getTime() === sorted[i].occurredAt.getTime()) j++;
    const group = sorted.slice(i, j);
    while (group.length > 0) {
      const last = out[out.length - 1];
      const pick =
        // 앞 거래의 잔액에서 바로 이어지는 거래
        group.find((x) => last && balanceBefore(x) === last.balance) ??
        // 같은 시각 다른 거래 뒤에 올 수 없는 거래 (묶음의 첫 거래)
        group.find((x) => !group.some((y) => y !== x && y.balance === balanceBefore(x))) ??
        group[0];
      out.push(pick);
      group.splice(group.indexOf(pick), 1);
    }
    i = j;
  }
  return out;
}

/** 잔액이 이어지지 않는 곳을 모두 찾는다. items 는 한 통장의 거래여야 한다. */
export function balanceGaps<T extends BalanceItem>(items: T[]): BalanceGap<T>[] {
  const chain = orderByBalance(items);
  const gaps: BalanceGap<T>[] = [];
  for (let i = 1; i < chain.length; i++) {
    const prev = chain[i - 1];
    const next = chain[i];
    const expectedBefore = balanceBefore(next);
    const gap = expectedBefore - (prev.balance ?? 0);
    if (gap !== 0) gaps.push({ prev, next, gap, expectedBefore });
  }
  return gaps;
}

/** 잔액 차이로 만든 알림의 dedupKey. 앞뒤 알림 id 로 만든다. */
export function gapKey(prevId: string, nextId: string) {
  return `gap-${prevId}-${nextId}`;
}

export function parseGapKey(key: string): [string, string] | null {
  const m = /^gap-([^-]+)-([^-]+)$/.exec(key);
  return m ? [m[1], m[2]] : null;
}
