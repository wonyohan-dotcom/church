// Edge 런타임(proxy)에서도 안전하게 쓰이는 세션 토큰 모듈.
// Node 전용 모듈(bcrypt, next/headers)을 절대 import 하지 않는다.
import { SignJWT, jwtVerify } from "jose";
import type { Role, UserStatus } from "./constants";

export const SESSION_COOKIE = "church_session";
/** 로그인 유지 기간. 쓰는 동안은 하루에 한 번씩 연장되어 사실상 풀리지 않는다. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90일
/** 이 시간이 지난 로그인은 요청 때 새로 연장한다. */
export const SESSION_RENEW_AFTER = 60 * 60 * 24; // 1일

export type SessionUser = {
  id: string;
  loginId: string;
  name: string;
  role: Role;
  status: UserStatus;
  /** 이 사람이 속한 교회. 모든 조회가 이 값으로 제한된다. */
  churchId: string;
  churchName: string;
  memberId: string | null;
};

function secret() {
  const s = process.env.APP_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "APP_SECRET 환경변수가 설정되지 않았습니다. .env 파일에 32자 이상의 임의 문자열을 넣어주세요.",
    );
  }
  return new TextEncoder().encode(s);
}

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  return (await readSessionToken(token))?.user ?? null;
}

/** 로그인 정보와 발급 시각(초)을 함께 읽는다. */
export async function readSessionToken(token: string): Promise<{ user: SessionUser; iat: number } | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.id || !payload.role || !payload.churchId) return null;
    return { iat: payload.iat ?? 0, user: {
      id: payload.id as string,
      loginId: payload.loginId as string,
      name: payload.name as string,
      role: payload.role as Role,
      status: (payload.status as UserStatus) ?? "ACTIVE",
      churchId: payload.churchId as string,
      churchName: (payload.churchName as string) ?? "",
      memberId: (payload.memberId as string | null) ?? null,
    } };
  } catch {
    return null;
  }
}
