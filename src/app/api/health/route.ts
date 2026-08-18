import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 배포 진단용. 값 자체는 절대 내보내지 않고, 각 환경변수가 실제로 이
 * 실행 중인 서버에 존재하는지(있음/없음)와 길이만 알려준다.
 *
 * 회원가입·로그인을 매번 시도해 보지 않아도, 이 주소만 열면 어떤 값이
 * 빠졌는지 바로 알 수 있다.
 */
export async function GET() {
  const check = (name: string) => {
    const value = process.env[name];
    return value ? `있음 (${value.length}자)` : "없음";
  };

  return NextResponse.json({
    확인시각: new Date().toISOString(),
    DATABASE_URL: check("DATABASE_URL"),
    APP_SECRET: check("APP_SECRET"),
    SUPABASE_URL: check("SUPABASE_URL"),
    SUPABASE_SERVICE_ROLE_KEY: check("SUPABASE_SERVICE_ROLE_KEY"),
    SUPABASE_BUCKET: check("SUPABASE_BUCKET"),
  });
}
