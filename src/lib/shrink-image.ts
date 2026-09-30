/**
 * 브라우저에서 사진을 올리기 전에 줄인다.
 *
 * 요즘 휴대폰 사진은 한 장에 4~10MB 라서 서버 한도(4MB)를 쉽게 넘는다.
 * 긴 변을 2000px 로 줄이고 JPEG 로 다시 저장하면 대부분 1MB 안쪽이 되고,
 * 화면이나 인쇄에서 보기에는 차이가 없다.
 *
 * 줄이지 못하는 경우(브라우저가 형식을 못 읽는 등)에는 원본을 그대로 돌려주고,
 * 크기 판단은 서버가 한다.
 */

const SHRINK_ABOVE = 1.5 * 1024 * 1024;
const MAX_SIDE = 2000;
const JPEG_QUALITY = 0.82;

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // upload.ts 의 MAX_BYTES 와 같은 값

export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  // 움직이는 GIF 는 캔버스를 거치면 멈춘 그림이 된다.
  if (file.type === "image/gif") return file;
  const heic = /image\/hei[cf]/.test(file.type);
  if (file.size <= SHRINK_ABOVE && !heic) return file;

  try {
    const bitmap = await decode(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    // 도장처럼 배경이 투명한 PNG 는 투명도를 살려 PNG 로 둔다.
    const keepPng = file.type === "image/png";
    if (!keepPng) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    if ("close" in bitmap) bitmap.close();

    const type = keepPng ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, keepPng ? undefined : JPEG_QUALITY),
    );
    if (!blob) return file;
    // 이미 작았던 파일이 오히려 커졌다면 원본을 쓴다(HEIC 는 서버가 못 보여주므로 변환본을 쓴다).
    if (!heic && blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.${keepPng ? "png" : "jpg"}`, {
      type,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // 휴대폰 사진의 회전 정보(EXIF)를 반영해서 읽는다.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // 일부 브라우저는 옵션을 모르거나 형식을 못 읽는다. 아래 방법으로 한 번 더 시도.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
