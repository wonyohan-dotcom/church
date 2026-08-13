#!/usr/bin/env node
/**
 * 심플한교회관리 — 설치 도우미
 *
 * 사람이 직접 해야 하는 일은 Supabase 대시보드에서 값 두 개를 복사해 오는 것뿐이다.
 * 나머지(비밀키 생성, 주소 3종 계산, .env 작성, 버킷 생성, 표 생성, 검증,
 * Vercel 에 붙여넣을 값 정리)는 전부 이 스크립트가 한다.
 *
 *   npm run setup
 */
import { createInterface } from "node:readline/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync, copyFileSync } from "node:fs";
import { stdin, stdout } from "node:process";
import { createRequire } from "node:module";
import path from "node:path";

// web-push 는 CommonJS 라 require 가 필요하다.
const require = createRequire(import.meta.url);

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const VERCEL_ENV_PATH = path.join(ROOT, ".env.vercel");
const BUCKET = "church-uploads";

const c = {
  b: (s) => `[1m${s}[0m`,
  dim: (s) => `[2m${s}[0m`,
  green: (s) => `[32m${s}[0m`,
  red: (s) => `[31m${s}[0m`,
  yellow: (s) => `[33m${s}[0m`,
  cyan: (s) => `[36m${s}[0m`,
};

const line = () => console.log(c.dim("─".repeat(60)));
const ok = (s) => console.log(`  ${c.green("✔")} ${s}`);
const fail = (s) => console.log(`  ${c.red("✘")} ${s}`);
const info = (s) => console.log(`    ${c.dim(s)}`);

/** 사람이 읽을 수 있는 이유를 남기고 멈춘다. 스택 트레이스는 도움이 안 된다. */
class SetupError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

// 대화형으로 실행할 때만 만든다. 이 파일의 순수 함수들은 테스트에서 그냥 import 한다.
//
// rl.question() 대신 줄 단위 이터레이터를 쓴다. question() 은 stdin 이 파이프로
// 들어와 EOF 를 만나면 영영 응답하지 않고, 스크립트가 아무 말 없이 종료해 버린다.
let rl;
let lines;

async function readLine() {
  const { value, done } = await lines.next();
  if (done) {
    throw new SetupError(
      "입력이 중간에 끊겼습니다.",
      "터미널에서 npm run setup 을 직접 실행해 주세요.",
    );
  }
  return value;
}

async function ask(question, { optional = false } = {}) {
  for (;;) {
    stdout.write(question);
    const answer = (await readLine()).trim();
    if (answer || optional) return answer;
    console.log(c.yellow("    값을 입력해 주세요."));
  }
}

async function confirm(question) {
  stdout.write(`${question} (y/N) `);
  const answer = (await readLine()).trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

/**
 * Supabase 연결 주소는 세 가지 모양으로 복사되어 온다. 어떤 걸 붙여넣어도
 * 나머지를 계산해 낸다. 사용자가 포트를 헷갈리는 것이 이 설치의 가장 흔한 실패였다.
 *
 *   Session pooler      aws-0-ap-northeast-2.pooler.supabase.com:5432  (마이그레이션용)
 *   Transaction pooler  aws-0-ap-northeast-2.pooler.supabase.com:6543  (Vercel 용)
 *   Direct              db.<ref>.supabase.co:5432                      (IPv6 전용이라 집에서는 막히기도 함)
 */
export function parseConnectionString(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new SetupError(
      "연결 주소 모양이 아닙니다.",
      "postgresql:// 로 시작하는 주소를 통째로 붙여넣어 주세요.",
    );
  }
  if (!/^postgres(ql)?:$/.test(url.protocol)) {
    throw new SetupError(
      "연결 주소 모양이 아닙니다.",
      "postgresql:// 로 시작하는 주소를 통째로 붙여넣어 주세요.",
    );
  }

  const host = url.hostname;
  const user = decodeURIComponent(url.username);
  const isPooler = host.endsWith(".pooler.supabase.com");
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host);

  // 프로젝트 ref 는 pooler 라면 사용자명(postgres.<ref>)에, 직접 연결이라면 호스트에 있다.
  let ref = null;
  if (isPooler && user.includes(".")) ref = user.slice(user.indexOf(".") + 1);
  else if (direct) ref = direct[1];

  if (!ref) {
    throw new SetupError(
      "Supabase 주소가 아닌 것 같습니다.",
      "Project Settings → Database → Connection string 에서 복사한 주소를 넣어 주세요.",
    );
  }

  return { url, host, user, ref, isPooler };
}

export function buildUrls(parsed, password) {
  const { url, host, user, ref, isPooler } = parsed;
  const pw = encodeURIComponent(password);
  const db = url.pathname && url.pathname !== "/" ? url.pathname : "/postgres";

  if (isPooler) {
    // 같은 호스트에서 포트만 다르다. 5432=세션 모드, 6543=트랜잭션 모드.
    const base = `postgresql://${encodeURIComponent(user)}:${pw}@${host}`;
    return {
      ref,
      migrate: `${base}:5432${db}`,
      runtime: `${base}:6543${db}`,
      poolerKnown: true,
    };
  }

  // 직접 연결만 받은 경우. 마이그레이션은 이것으로 되지만 Vercel 용 주소는 지역을
  // 알 수 없어 계산할 수 없다. 뒤에서 따로 물어본다.
  return {
    ref,
    migrate: `postgresql://${encodeURIComponent(user)}:${pw}@${host}:5432${db}`,
    runtime: null,
    poolerKnown: false,
  };
}

function generateVapid() {
  try {
    // web-push 는 이미 의존성에 있다. 없으면 알림 기능만 건너뛴다.
    const webpush = require("web-push");
    return webpush.generateVAPIDKeys();
  } catch {
    return null;
  }
}

function run(cmd, args, env) {
  return spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
}

function envFile(values) {
  const lines = [
    "# npm run setup 이 만든 파일입니다.",
    "# APP_SECRET 은 절대 바꾸지 마세요. 바꾸면 저장된 주민등록번호를 읽을 수 없습니다.",
    "",
  ];
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") continue;
    lines.push(`${key}="${value}"`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  rl = createInterface({ input: stdin, terminal: Boolean(stdin.isTTY) });
  lines = rl[Symbol.asyncIterator]();
  if (stdin.isTTY) console.clear();
  line();
  console.log(c.b("  심플한교회관리 — 설치 도우미"));
  line();
  console.log();
  console.log("  Supabase 대시보드에서 값 " + c.b("두 개") + "만 복사해 오시면");
  console.log("  나머지는 전부 자동으로 처리합니다.");
  console.log();
  console.log(c.dim("  대시보드: https://supabase.com/dashboard"));
  console.log();

  if (existsSync(ENV_PATH)) {
    console.log(c.yellow("  .env 파일이 이미 있습니다."));
    if (!(await confirm("  덮어쓸까요? (기존 파일은 .env.backup 으로 보관됩니다)"))) {
      console.log("\n  설치를 취소했습니다.");
      return;
    }
    copyFileSync(ENV_PATH, `${ENV_PATH}.backup`);
    console.log();
  }

  // ── 1. 데이터베이스 주소 ──────────────────────────────
  line();
  console.log(c.b("  1/2  데이터베이스 연결 주소"));
  line();
  console.log();
  console.log("  Supabase 대시보드에서:");
  console.log(c.cyan("    Project Settings → Database → Connection string → URI"));
  console.log();
  console.log("  " + c.b("Transaction pooler") + " 주소를 복사해 붙여넣으세요.");
  console.log(c.dim("  (5432 든 6543 이든 상관없습니다. 나머지 주소는 알아서 계산합니다)"));
  console.log();

  const rawConn = await ask("  주소 붙여넣기 > ");
  const parsed = parseConnectionString(rawConn);

  // 대시보드에서 복사하면 비밀번호 자리가 [YOUR-PASSWORD] 로 남아 있다.
  // 이걸 그대로 두고 넘어가는 실수가 가장 잦아서 따로 확인한다.
  let password = decodeURIComponent(parsed.url.password ?? "");
  const placeholder = !password || /^\[.*\]$/.test(password) || password === "YOUR-PASSWORD";
  if (placeholder) {
    console.log();
    console.log(c.yellow("  비밀번호 자리가 비어 있습니다.") + c.dim(" ([YOUR-PASSWORD] 부분)"));
    console.log(c.dim("  프로젝트를 만들 때 정한 Database Password 를 입력해 주세요."));
    console.log();
    password = await ask("  Database Password > ");
  }

  const urls = buildUrls(parsed, password);

  if (!urls.poolerKnown) {
    console.log();
    console.log(c.yellow("  직접 연결(Direct) 주소를 넣으셨습니다."));
    console.log("  Vercel 에서는 이 주소를 쓸 수 없어서 pooler 주소가 하나 더 필요합니다.");
    console.log(c.cyan("    같은 화면에서 Transaction pooler 를 골라 복사해 주세요."));
    console.log();
    const poolerRaw = await ask("  pooler 주소 붙여넣기 > ");
    const poolerParsed = parseConnectionString(poolerRaw);
    let poolerPw = decodeURIComponent(poolerParsed.url.password ?? "");
    if (!poolerPw || /^\[.*\]$/.test(poolerPw)) poolerPw = password;
    const poolerUrls = buildUrls(poolerParsed, poolerPw);
    if (!poolerUrls.poolerKnown) {
      throw new SetupError(
        "이것도 직접 연결 주소입니다.",
        "호스트에 pooler.supabase.com 이 들어간 주소를 골라 주세요.",
      );
    }
    urls.runtime = poolerUrls.runtime;
  }

  // 주소는 프로젝트 ref 에서 계산한다. 직접 띄운 Supabase 를 쓰는 드문 경우를 위해
  // 환경변수로 덮어쓸 수 있게 둔다.
  const supabaseUrl = process.env.SUPABASE_URL || `https://${urls.ref}.supabase.co`;
  console.log();
  ok(`프로젝트 확인: ${c.b(urls.ref)}`);
  info(`마이그레이션용 (5432)  ${urls.migrate.replace(/:[^:@]*@/, ":****@")}`);
  info(`Vercel 용      (6543)  ${urls.runtime.replace(/:[^:@]*@/, ":****@")}`);
  info(`Project URL            ${supabaseUrl}`);

  // ── 2. service_role 키 ────────────────────────────────
  console.log();
  line();
  console.log(c.b("  2/2  service_role 키"));
  line();
  console.log();
  console.log("  Supabase 대시보드에서:");
  console.log(c.cyan("    Project Settings → API → service_role → Reveal"));
  console.log();
  console.log("  " + c.yellow("anon 키가 아니라 service_role 키입니다."));
  console.log(c.dim("  이 키는 이 컴퓨터의 .env 파일에만 저장되며 밖으로 나가지 않습니다."));
  console.log();

  const serviceKey = await ask("  키 붙여넣기 > ");
  if (serviceKey.length < 40) {
    throw new SetupError("키가 너무 짧습니다.", "Reveal 을 눌러 전체를 복사했는지 확인해 주세요.");
  }

  // ── 자동 처리 ─────────────────────────────────────────
  console.log();
  line();
  console.log(c.b("  이제부터는 자동입니다."));
  line();
  console.log();

  // 비밀키
  const appSecret = randomBytes(32).toString("hex");
  ok("APP_SECRET 생성 (주민등록번호 암호화 + 로그인 서명)");

  // 푸시 알림 키
  const vapid = generateVapid();
  if (vapid) ok("푸시 알림 키 생성");
  else info("푸시 알림 키는 건너뜁니다 (없어도 나머지는 정상 동작)");

  // .env 저장
  writeFileSync(
    ENV_PATH,
    envFile({
      DATABASE_URL: urls.migrate,
      APP_SECRET: appSecret,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      SUPABASE_BUCKET: BUCKET,
      VAPID_PUBLIC_KEY: vapid?.publicKey,
      VAPID_PRIVATE_KEY: vapid?.privateKey,
      VAPID_SUBJECT: vapid ? "mailto:admin@example.com" : undefined,
    }),
    "utf8",
  );
  ok(".env 저장");

  // 사진 보관함 만들고 실제로 넣었다 빼 본다
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const created = await supabase.storage.createBucket(BUCKET, { public: false });
  if (created.error) {
    const message = String(created.error.message ?? "");
    if (/exist/i.test(message) || /Duplicate/i.test(message)) {
      ok(`사진 보관함 '${BUCKET}' 이미 있음`);
    } else if (/Invalid Compact JWS|JWT|Unauthorized|signature|403|401/i.test(message)) {
      throw new SetupError(
        `사진 보관함을 만들지 못했습니다: ${message}`,
        "service_role 키가 아니라 anon 키를 넣으셨을 수 있습니다.",
      );
    } else if (/fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(message)) {
      throw new SetupError(
        `Supabase 에 연결하지 못했습니다: ${supabaseUrl}`,
        "인터넷 연결을 확인하고, 연결 주소를 제대로 붙여넣었는지 다시 봐 주세요.",
      );
    } else {
      throw new SetupError(`사진 보관함을 만들지 못했습니다: ${message}`);
    }
  } else {
    ok(`사진 보관함 '${BUCKET}' 생성 (비공개)`);
  }

  // 공개로 열려 있으면 개인정보가 그대로 노출된다. 확인해서 되돌린다.
  const bucketInfo = await supabase.storage.getBucket(BUCKET);
  if (bucketInfo.data?.public) {
    await supabase.storage.updateBucket(BUCKET, { public: false });
    ok("사진 보관함이 공개로 되어 있어 비공개로 바꿨습니다");
  }

  const probe = `__setup-check-${Date.now()}.txt`;
  const uploaded = await supabase.storage
    .from(BUCKET)
    .upload(probe, new Blob(["ok"], { type: "text/plain" }));
  if (uploaded.error) {
    throw new SetupError(
      `사진 업로드 확인 실패: ${uploaded.error.message}`,
      "service_role 키인지 다시 확인해 주세요.",
    );
  }
  const signed = await supabase.storage.from(BUCKET).createSignedUrl(probe, 60);
  if (signed.error || !signed.data?.signedUrl) {
    throw new SetupError(`사진 열람 확인 실패: ${signed.error?.message ?? "임시 주소 생성 실패"}`);
  }
  const fetched = await fetch(signed.data.signedUrl);
  await supabase.storage.from(BUCKET).remove([probe]);
  if (!fetched.ok) {
    throw new SetupError(`사진 열람 확인 실패: HTTP ${fetched.status}`);
  }
  ok("사진 업로드 · 열람 확인 완료");

  // 표 만들기
  console.log();
  console.log(c.dim("  데이터베이스에 표를 만듭니다…"));
  const migrated = run("npx", ["prisma", "migrate", "deploy"], { DATABASE_URL: urls.migrate });
  if (migrated.status !== 0) {
    throw new SetupError(
      "표를 만들지 못했습니다.",
      "비밀번호가 틀렸거나 인터넷 연결이 막혔을 수 있습니다. 위 오류 메시지를 확인해 주세요.",
    );
  }
  ok("데이터베이스 표 생성 완료");

  // Vercel 에 붙여넣을 값
  writeFileSync(
    VERCEL_ENV_PATH,
    envFile({
      DATABASE_URL: urls.runtime,
      APP_SECRET: appSecret,
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      SUPABASE_BUCKET: BUCKET,
      TZ: "Asia/Seoul",
      VAPID_PUBLIC_KEY: vapid?.publicKey,
      VAPID_PRIVATE_KEY: vapid?.privateKey,
      VAPID_SUBJECT: vapid ? "mailto:admin@example.com" : undefined,
    }),
    "utf8",
  );
  ok(".env.vercel 저장 (Vercel 에 붙여넣을 값)");

  console.log();
  line();
  console.log(c.b(c.green("  준비 끝났습니다.")));
  line();
  console.log();
  console.log("  이제 " + c.b("두 가지") + "만 하시면 됩니다.");
  console.log();
  console.log(c.b("  1) 지금 바로 확인해 보기"));
  console.log(c.cyan("       npm run dev") + c.dim("   → http://localhost:3000"));
  console.log();
  console.log(c.b("  2) 인터넷에 올리기"));
  console.log("       " + c.cyan("https://vercel.com/new") + " 에서 church 저장소를 Import");
  console.log("       Environment Variables 칸에 " + c.b(".env.vercel") + " 파일 내용을");
  console.log("       " + c.b("통째로 복사해서 붙여넣고") + " Deploy 를 누르세요.");
  console.log(c.dim("       (Vercel 은 .env 통째 붙여넣기를 지원합니다. 한 줄씩 넣지 않아도 됩니다)"));
  console.log();
  console.log(c.dim("       파일 열기:  ") + c.cyan(`open ${path.relative(process.cwd(), VERCEL_ENV_PATH)}`));
  console.log();
  console.log(c.yellow("  ⚠ .env 와 .env.vercel 은 절대 남에게 보내지 마세요."));
  console.log(c.dim("    (git 에는 올라가지 않도록 이미 막아 두었습니다)"));
  console.log();
}

const executedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);

if (executedDirectly) {
  main()
    .then(() => rl?.close())
    .catch((error) => {
      console.log();
      line();
      fail(error instanceof SetupError ? error.message : `예상치 못한 오류: ${error.message}`);
      if (error.hint) info(error.hint);
      console.log();
      console.log(c.dim("  다시 하려면:  npm run setup"));
      console.log();
      rl?.close();
      process.exitCode = 1;
    });
}
