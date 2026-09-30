#!/usr/bin/env node
/**
 * Vercel 이 배포할 때 실행하는 빌드 명령 (vercel.json 의 buildCommand).
 *
 * 1) 데이터베이스 표를 최신 모양으로 맞추고 (prisma migrate deploy)
 * 2) 앱을 빌드한다 (next build)
 *
 * 새 기능에 필요한 표가 생길 때마다 사람이 따로 명령을 칠 필요가 없게 하려는 것이다.
 * 표를 맞추지 못하면 빌드를 멈춘다. 표 없이 새 코드가 올라가면 화면이 깨지기 때문에,
 * 차라리 이전 배포가 그대로 서비스되도록 두는 편이 안전하다.
 */
import { spawnSync } from "node:child_process";

function run(cmd, args, env = process.env) {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  return r.status ?? 1;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Vercel 에는 트랜잭션 풀러 주소(6543)가 들어 있다. 이 주소로는 마이그레이션이
 * 멈출 수 있어서, 같은 호스트의 세션 풀러(5432)로 바꿔서 쓴다.
 * MIGRATE_DATABASE_URL 을 따로 넣어 두면 그 값을 우선한다.
 */
function migrationUrl() {
  if (process.env.MIGRATE_DATABASE_URL) return process.env.MIGRATE_DATABASE_URL;
  const raw = process.env.DATABASE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543") {
      url.port = "5432";
      url.searchParams.delete("pgbouncer");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

const url = migrationUrl();
if (!url) {
  console.log("▶ DATABASE_URL 이 없어 데이터베이스 업데이트를 건너뜁니다.");
} else {
  console.log("▶ 데이터베이스 표를 최신으로 맞춥니다 (prisma migrate deploy)");
  let status = 1;
  for (let attempt = 1; attempt <= 3 && status !== 0; attempt++) {
    status = run("npx", ["prisma", "migrate", "deploy"], { ...process.env, DATABASE_URL: url });
    if (status !== 0 && attempt < 3) {
      console.log(`  다시 시도합니다 (${attempt}/3)…`);
      await sleep(5000);
    }
  }
  if (status !== 0) {
    console.error(
      "\n✖ 데이터베이스에 연결하지 못해 표를 업데이트하지 못했습니다.\n" +
        "  Supabase 대시보드에서 프로젝트가 일시정지(Paused) 상태인지 확인하고,\n" +
        "  Resume project 를 누른 뒤 Vercel 에서 Redeploy 해 주세요.\n",
    );
    process.exit(1);
  }
}

console.log("▶ 앱을 빌드합니다 (next build)");
process.exit(run("npx", ["next", "build"]));
