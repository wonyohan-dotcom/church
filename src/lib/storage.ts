import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 사진 저장소.
 *
 * Supabase Storage 설정이 있으면 그쪽에, 없으면 서버 디스크에 저장한다.
 * 덕분에 노트북에서는 아무 설정 없이 개발하고, 배포할 때만 Supabase 를 붙일 수 있다.
 * Vercel 처럼 디스크에 쓸 수 없는 곳에 올릴 때는 Supabase 설정이 반드시 있어야 한다.
 */

export const STORAGE_BUCKET = process.env.SUPABASE_BUCKET ?? "church-uploads";

export function supabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

let client: SupabaseClient | null = null;

/**
 * 서버 전용 Supabase 클라이언트.
 * service_role 키는 모든 권한을 가지므로 절대 브라우저로 넘기지 않는다.
 * (이 파일은 서버에서만 import 된다)
 */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return client;
}

/** 업로드한 파일을 얼마 동안 볼 수 있게 할지 (초). 짧게 두고 매번 새로 만든다. */
export const SIGNED_URL_TTL = 60 * 10;
