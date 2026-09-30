import { prisma } from "./prisma";
import { STORAGE_BUCKET, supabase, supabaseConfigured } from "./storage";

export type PingResult = { 데이터베이스: string; 사진저장소: string; ok: boolean };

/**
 * 데이터베이스와 사진 저장소에 실제로 한 번씩 요청을 보낸다.
 *
 * Supabase 무료 요금제는 며칠 동안 요청이 거의 없으면 프로젝트를 잠재운다(일시정지).
 * 잠들면 앱 전체가 멈추므로, Vercel 크론이 매일 이 함수를 불러 깨어 있게 한다.
 * 진단 화면(/api/health)도 같은 함수로 연결 상태를 보여준다.
 */
export async function pingBackends(): Promise<PingResult> {
  let db = "연결됨";
  let storage = supabaseConfigured() ? "연결됨" : "설정 없음(서버 디스크 사용)";
  let ok = true;

  try {
    await withTimeout(
      Promise.all([prisma.$queryRaw`SELECT 1`, prisma.church.count()]),
      8000,
    );
  } catch (e) {
    ok = false;
    db = `연결 실패 — ${reason(e)}`;
  }

  if (supabaseConfigured()) {
    try {
      const { error } = await withTimeout(
        supabase().storage.from(STORAGE_BUCKET).list("", { limit: 1 }),
        8000,
      );
      if (error) throw new Error(error.message);
    } catch (e) {
      ok = false;
      storage = `연결 실패 — ${reason(e)}`;
    }
  }

  return { 데이터베이스: db, 사진저장소: storage, ok };
}

function reason(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  if (/ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(message)) {
    return "주소를 찾을 수 없습니다. Supabase 프로젝트가 일시정지(Paused) 되었는지 확인하세요.";
  }
  if (/timeout|시간 초과/i.test(message)) return "응답이 없습니다(시간 초과).";
  if (/password authentication/i.test(message)) return "데이터베이스 비밀번호가 맞지 않습니다.";
  return message.split("\n").find((l) => l.trim())?.slice(0, 200) ?? "알 수 없는 오류";
}

function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("시간 초과")), ms);
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
