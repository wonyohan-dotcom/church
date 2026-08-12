import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
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
 * 폼에서 넘어온 이미지를 public/uploads 아래에 저장하고 웹 경로를 돌려준다.
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

  const dir = path.join(UPLOAD_ROOT, folder);
  await mkdir(dir, { recursive: true });

  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, name), buffer);

  return `/uploads/${folder}/${name}`;
}

/** 업로드 폴더 안의 파일만 지운다. 실패해도 조용히 넘어간다. */
export async function deleteImage(url: string | null | undefined) {
  if (!url || !url.startsWith("/uploads/")) return;
  const target = path.join(process.cwd(), "public", url.replace(/^\//, ""));
  const normalized = path.normalize(target);
  if (!normalized.startsWith(UPLOAD_ROOT)) return;
  try {
    await unlink(normalized);
  } catch {
    // 이미 지워졌거나 접근할 수 없는 경우는 무시
  }
}
