import { readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { resolveUploadPath, uploadKeyFrom } from "@/lib/upload";
import {
  SIGNED_URL_TTL,
  STORAGE_BUCKET,
  supabase,
  supabaseConfigured,
} from "@/lib/storage";

/**
 * 업로드된 이미지(교인 사진 · 영수증 · 연혁 사진 · 직인)를 내보낸다.
 *
 * 교인 사진과 영수증은 민감한 자료이므로 로그인한 사람에게만 내보낸다.
 * Supabase Storage 를 쓸 때는 버킷을 비공개로 두고, 여기서 짧게 유효한
 * 서명 주소를 만들어 그쪽으로 넘긴다. 주소를 알아도 곧 만료된다.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const session = await getSession();
  if (!session) {
    return new Response("로그인이 필요합니다.", { status: 401 });
  }

  const { path: segments } = await params;
  const webPath = `/uploads/${segments.join("/")}`;
  const key = uploadKeyFrom(webPath);
  if (!key) {
    return new Response("잘못된 경로입니다.", { status: 400 });
  }

  const contentType = CONTENT_TYPES[path.extname(key).toLowerCase()];
  if (!contentType) {
    return new Response("지원하지 않는 형식입니다.", { status: 400 });
  }

  if (supabaseConfigured()) {
    const { data, error } = await supabase()
      .storage.from(STORAGE_BUCKET)
      .createSignedUrl(key, SIGNED_URL_TTL);

    if (error || !data?.signedUrl) {
      return new Response("찾을 수 없습니다.", { status: 404 });
    }
    return NextResponse.redirect(data.signedUrl, { status: 307 });
  }

  const filePath = resolveUploadPath(webPath);
  if (!filePath) return new Response("잘못된 경로입니다.", { status: 400 });

  try {
    const info = await stat(filePath);
    if (!info.isFile()) return new Response("찾을 수 없습니다.", { status: 404 });

    const file = await readFile(filePath);
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(info.size),
        // 파일 이름에 임의 문자열이 들어 있어 내용이 바뀌면 이름도 바뀐다.
        // 로그인한 사용자의 브라우저에만 캐시되도록 private로 둔다.
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("찾을 수 없습니다.", { status: 404 });
  }
}
