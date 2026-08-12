import crypto from "crypto";

// 주민등록번호처럼 되돌려 읽어야 하지만 평문으로 두면 안 되는 값 전용.
// APP_SECRET에서 파생한 키로 AES-256-GCM 암호화한다.

const ALGO = "aes-256-gcm";

function key() {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "APP_SECRET 환경변수가 설정되지 않았습니다. .env 파일에 32자 이상의 임의 문자열을 넣어주세요.",
    );
  }
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptSensitive(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSensitive(payload: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(".");
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/** 주민등록번호를 앞 6자리만 남기고 가린다: 901231-1****** */
export function maskRegNo(regNo: string): string {
  const digits = regNo.replace(/\D/g, "");
  if (digits.length < 7) return "-";
  return `${digits.slice(0, 6)}-${digits.slice(6, 7)}******`;
}

export function normalizeRegNo(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length !== 13) return null;
  return digits;
}
