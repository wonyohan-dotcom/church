#!/usr/bin/env node
/**
 * 심플한교회관리 — 한 줄 점검·복구
 *
 *   npm run doctor
 *
 * 노트북에서 앱이 안 뜰 때 쓰는 명령. 흔한 원인을 순서대로 확인하고,
 * 고칠 수 있는 것은 그냥 고친다. 사람은 결과만 읽으면 된다.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

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
const warn = (s) => console.log(`  ${c.yellow("!")} ${s}`);
const fail = (s) => console.log(`  ${c.red("✘")} ${s}`);
const info = (s) => console.log(`    ${c.dim(s)}`);

const run = (cmd, args, opts = {}) =>
  spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: opts.quiet ? "pipe" : "inherit",
    encoding: "utf8",
    shell: process.platform === "win32",
    ...opts,
  });

console.log();
line();
console.log(c.b("  심플한교회관리 — 점검"));
line();
console.log();

// 1. Node 버전. 낮으면 나머지를 해도 소용이 없다.
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  fail(`Node.js 가 너무 낮습니다. (지금 ${process.versions.node})`);
  console.log();
  console.log("  " + c.b("이것부터 하셔야 합니다:"));
  console.log("    1. " + c.cyan("https://nodejs.org") + " 접속");
  console.log("    2. 왼쪽 큰 버튼 " + c.b("LTS") + " 를 눌러 내려받고 설치");
  console.log("    3. " + c.b("터미널을 완전히 끄고 새로 연 뒤") + " 다시 실행:");
  console.log("       " + c.cyan("cd ~/Desktop/church && npm run doctor"));
  console.log();
  console.log(c.dim("  Node 가 낮으면 화면이 안 뜨고 엉뚱한 오류가 납니다."));
  console.log();
  process.exit(1);
}
ok(`Node.js ${process.versions.node}`);

// 2. 설정 파일
if (!existsSync(path.join(ROOT, ".env"))) {
  fail(".env 파일이 없습니다.");
  info("npm run setup 을 먼저 실행해 주세요.");
  console.log();
  process.exit(1);
}
ok(".env 있음");

// 3. 라이브러리를 깨끗하게 다시 설치한다.
//    버전이 어긋나 생기는 문제(Tailwind·React 오류)는 이걸로 대부분 사라진다.
console.log();
console.log(c.dim("  라이브러리를 새로 설치합니다. 3~4분 걸립니다…"));
console.log();
for (const dir of ["node_modules", ".next"]) {
  rmSync(path.join(ROOT, dir), { recursive: true, force: true });
}
const lockfile = existsSync(path.join(ROOT, "package-lock.json"));
const installed = run("npm", [lockfile ? "ci" : "install", "--no-audit", "--no-fund"]);
if (installed.status !== 0) {
  console.log();
  fail("설치에 실패했습니다. 위 메시지를 그대로 복사해 알려 주세요.");
  console.log();
  process.exit(1);
}
console.log();
ok("라이브러리 설치 완료");

// 4. 데이터베이스에 표가 있는지. 없으면 만든다.
const status = run("npx", ["prisma", "migrate", "status"], { quiet: true });
const statusText = `${status.stdout ?? ""}${status.stderr ?? ""}`;
if (/up to date/i.test(statusText)) {
  ok("데이터베이스 표 확인");
} else if (/have not yet been applied|not yet been applied/i.test(statusText)) {
  warn("표가 아직 없습니다. 지금 만듭니다…");
  const deployed = run("npx", ["prisma", "migrate", "deploy"]);
  if (deployed.status !== 0) {
    fail("표를 만들지 못했습니다.");
    info("비밀번호가 바뀌었을 수 있습니다. npm run setup 을 다시 실행해 주세요.");
    console.log();
    process.exit(1);
  }
  ok("데이터베이스 표 생성 완료");
} else {
  warn("데이터베이스에 연결하지 못했습니다.");
  info("인터넷 연결을 확인하거나, npm run setup 을 다시 실행해 주세요.");
  info(statusText.split("\n").find((l) => /Error|error/.test(l)) ?? "");
}

console.log();
line();
console.log(c.b(c.green("  점검 끝. 앱을 켭니다.")));
line();
console.log();
console.log("  브라우저에서 " + c.b(c.cyan("http://localhost:3000")) + " 을 여세요.");
console.log(c.dim("  끄실 때는 이 창에서 Ctrl + C 를 누르시면 됩니다."));
console.log();

run("npm", ["run", "dev"]);
