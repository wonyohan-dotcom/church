#!/usr/bin/env node
/**
 * 로고(src/components/logo.tsx 의 LOGO_PATHS)로 아이콘 파일을 모두 만든다.
 *   node scripts/render-icons.mjs
 *
 * 만드는 것
 *   src/app/icon.svg                      브라우저 탭 아이콘
 *   src/app/apple-icon.png                아이폰 홈 화면(사파리 "홈 화면에 추가")
 *   public/icons/icon-192.png, -512.png   안드로이드·PWA
 *   public/icons/maskable-512.png         안드로이드 둥근 아이콘용(여백 포함)
 *   mobile/ios/.../AppIcon-512@2x.png     아이폰 앱 아이콘 1024px (투명 없음)
 *   mobile/ios/.../splash-2732x2732*.png  아이폰 앱 시작 화면
 *
 * 그림을 그리는 데 Playwright(크로미움)를 쓴다. 없으면 PLAYWRIGHT_MODULE 로 경로를 알려 준다.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync("src/components/logo.tsx", "utf8");
// LOGO_COLORS 와 LOGO_PATHS 에 같은 이름(cross)이 있으므로 덩어리별로 읽는다.
const block = (name) => new RegExp(`${name}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`).exec(src)[1];
const grab = (text, key) => new RegExp(`${key}:\\s*"([^"]+)"`).exec(text)[1];
const paths = block("LOGO_PATHS");
const colors = block("LOGO_COLORS");
const P = { letters: grab(paths, "letters"), cross: grab(paths, "cross") };
const C = { bg: grab(colors, "bg"), gold: grab(colors, "gold"), cross: grab(colors, "cross") };

/** scale: 도형 크기 비율(1 = 원래 크기), radius: 배경 모서리 */
function svg({ size, scale = 1, radius = 0, bg = C.bg }) {
  const t = (100 - 100 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">
  <rect width="100" height="100" rx="${radius}" fill="${bg}"/>
  <g transform="translate(${t} ${t}) scale(${scale})">
    <path d="${P.letters}" fill="${C.gold}"/>
    <path d="${P.cross}" stroke="${C.cross}" stroke-width="3.6" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;
}

writeFileSync("src/app/icon.svg", svg({ size: 64, radius: 26 }) + "\n");

let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright"));
} catch {
  console.error("Playwright 가 필요합니다: PLAYWRIGHT_MODULE=/경로/playwright/index.mjs 로 알려 주세요.");
  process.exit(1);
}
const browser = await chromium.launch();

async function png(html, w, h, out) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.setContent(`<html><body style="margin:0">${html}</body></html>`);
  await page.screenshot({ path: out, omitBackground: false });
  await page.close();
  console.log("✓", out);
}

mkdirSync("public/icons", { recursive: true });
await png(svg({ size: 180 }), 180, 180, "src/app/apple-icon.png");
await png(svg({ size: 192 }), 192, 192, "public/icons/icon-192.png");
await png(svg({ size: 512 }), 512, 512, "public/icons/icon-512.png");
// maskable 은 가운데 80% 만 보장되므로 도형을 줄인다.
await png(svg({ size: 512, scale: 0.8 }), 512, 512, "public/icons/maskable-512.png");

const ios = "mobile/ios/App/App/Assets.xcassets";
await png(svg({ size: 1024 }), 1024, 1024, `${ios}/AppIcon.appiconset/AppIcon-512@2x.png`);
const splash = `<div style="width:2732px;height:2732px;background:#f7f4ee;display:flex;align-items:center;justify-content:center">
  ${svg({ size: 400, radius: 26 })}</div>`;
for (const n of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await png(splash, 2732, 2732, `${ios}/Splash.imageset/${n}`);
}
await browser.close();
