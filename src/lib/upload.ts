import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { STORAGE_BUCKET, supabase, supabaseConfigured } from "./storage";

/**
 * 업로드 파일은 public/ 밖에 둔다.
 * Next.js 는 public/ 의 내용을 빌드 시점에 고정하기 때문에, 운영 중에 올라온 파일을
 * public/ 에 쓰면 서버가 404 를 돌려준다.
 *
 * Supabase Storage 설정이 있으면 그쪽에 올리고, 없으면 이 폴더에 저장한다.
 * 어느 쪽이든 src/app/uploads/[...path]/route.ts 가 로그인 여부를 확인한 뒤 내보낸다.
 */
export const UPLOAD_ROOT =
  process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
  ["image/heif", "heif"],
]);

export type UploadFolder = "members" | "receipts" | "history" | "church";

/**
 * 폼에서 넘어온 이미지를 저장하고 웹 경로(`/uploads/…`)를 돌려준다.
 * 파일이 비어 있으면 null.
 */
export async function saveImage(
  file: FormDataEntryValue | null,
  folder: UploadFolder,
): Promise<string | null> {
  if (!file || typeof file === "string") return null;
  if (file.size === 0) return null;

  if (file.size > MAX_BYTES) {
    throw new Error("이미지 용량은 8MB를 넘을 수 없습니다.");
  }

  const ext = ALLOWED.get(file.type);
  if (!ext) {
    throw new Error("JPG, PNG, WEBP, GIF, HEIC 형식의 이미지만 올릴 수 있습니다.");
  }

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const key = `${folder}/${name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  if (supabaseConfigured()) {
    const { error } = await supabase()
      .storage.from(STORAGE_BUCKET)
      .upload(key, buffer, { contentType: file.type, upsert: false });
    if (error) {
      throw new Error(`사진을 저장하지 못했습니다: ${error.message}`);
    }
  } else {
    // turbopackIgnore: 여기서 다루는 경로는 빌드 산출물이 아니라 운영 중에 쌓이는
    // 데이터 폴더다. 표시하지 않으면 번들러가 프로젝트 전체를 추적해 담으려 한다.
    const dir = path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, folder);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(/* turbopackIgnore: true */ dir, name), buffer);
  }

  return `/uploads/${key}`;
}

/**
 * `/uploads/...` 형태의 웹 경로에서 저장소 키(`members/abc.png`)를 뽑는다.
 * 업로드 폴더를 벗어나는 경로(../ 등)는 null 을 돌려준다.
 */
export function uploadKeyFrom(webPath: string): string | null {
  if (!webPath.startsWith("/uploads/")) return null;

  const decoded = decodeURIComponent(webPath.slice("/uploads/".length));
  if (!decoded || decoded.includes("\0")) return null;

  // 로컬 저장일 때를 기준으로 경로 탈출을 검사한다. 통과하면 Supabase 키로도 안전하다.
  const resolved = path.resolve(UPLOAD_ROOT, decoded);
  if (resolved !== UPLOAD_ROOT && !resolved.startsWith(UPLOAD_ROOT + path.sep)) {
    return null;
  }
  return decoded;
}

/** 로컬 저장소에서의 실제 파일 경로 */
export function resolveUploadPath(webPath: string): string | null {
  const key = uploadKeyFrom(webPath);
  if (!key) return null;
  return path.join(/* turbopackIgnore: true */ UPLOAD_ROOT, key);
}

/** 저장소에서 파일을 지운다. 실패해도 조용히 넘어간다. */
export async function deleteImage(url: string | null | undefined) {
  if (!url) return;
  const key = uploadKeyFrom(url);
  if (!key) return;

  if (supabaseConfigured()) {
    try {
      await supabase().storage.from(STORAGE_BUCKET).remove([key]);
    } catch {
      // 이미 지워졌거나 접근할 수 없는 경우는 무시
    }
    return;
  }

  const target = resolveUploadPath(url);
  if (!target) return;
  try {
    await unlink(target);
  } catch {
    // 이미 지워졌거나 접근할 수 없는 경우는 무시
  }
}
