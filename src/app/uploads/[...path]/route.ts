import { readFile, stat } from "fs/promises";
import path from "path";
import { getSession } from "@/lib/auth";
import { resolveUploadPath } from "@/lib/upload";

/**
 * 업로드된 이미지(교인 사진 · 영수증 · 연혁 사진 · 직인)를 내보낸다.
 *
 * public/ 폴더는 빌드 시점에 내용이 고정되기 때문에 운영 중 올라온 파일을 서빙하지 못한다.
 * 그래서 파일은 public/ 밖에 저장하고 이 경로로 읽어 보낸다.
 * 교인 사진과 영수증은 민감한 자료이므로 로그인한 사람에게만 내보낸다.
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
  const filePath = resolveUploadPath(`/uploads/${segments.join("/")}`);
  if (!filePath) {
    return new Response("잘못된 경로입니다.", { status: 400 });
  }

  const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) {
    return new Response("지원하지 않는 형식입니다.", { status: 400 });
  }

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
