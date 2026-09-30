// App Store 에 앱 정보를 채우고 (원하면) 심사에 제출한다.
//
//   node mobile/store/submit.mjs            정보·스크린샷만 채운다
//   SUBMIT=1 node mobile/store/submit.mjs   채운 뒤 심사에 제출한다
//
// 필요한 환경변수 (GitHub Actions 비밀값)
//   ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8   App Store Connect API 키 (관리자)
//   APP_REVIEW_PHONE                        심사팀이 연락할 전화번호 (애플에만 전달, 공개되지 않음)
//
// 설명·키워드·스크린샷은 같은 폴더의 listing.json 과 screenshots/ 에 있다.
// '앱 개인정보(App Privacy)' 답변은 애플이 API 로 열어 두지 않아 App Store Connect 웹에서 한 번 해야 한다.
import crypto from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const L = JSON.parse(readFileSync(join(here, "listing.json"), "utf8"));
const API = "https://api.appstoreconnect.apple.com";
const SUBMIT = process.env.SUBMIT === "1" || process.env.SUBMIT === "true";
const notes = [];
const say = (...a) => console.log("•", ...a);
const note = (s) => { notes.push(s); console.log("  ↳", s); };

// ── 인증 (ES256 JWT) ─────────────────────────────
function token() {
  let key = process.env.ASC_KEY_P8 ?? "";
  if (!key.includes("BEGIN PRIVATE KEY")) key = Buffer.from(key, "base64").toString("utf8");
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid: process.env.ASC_KEY_ID, typ: "JWT" });
  const body = b64({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 15 * 60, aud: "appstoreconnect-v1" });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${sig.toString("base64url")}`;
}
let jwt = token();
setInterval(() => (jwt = token()), 10 * 60 * 1000).unref();

class ApiError extends Error {
  constructor(status, errors, where) {
    super(`${where} → ${status}${(errors ?? []).length > 6 ? ` (오류 ${errors.length}개 중 6개만 표시)` : ""}\n${(errors ?? []).slice(0, 6).map((e) => `   - ${e.code}: ${e.title} — ${e.detail ?? ""}${e.source?.pointer ? ` (${e.source.pointer})` : ""}`).join("\n")}`);
    this.status = status;
    this.errors = errors ?? [];
  }
}

async function api(method, path, body) {
  const res = await fetch(path.startsWith("http") ? path : API + path, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, json?.errors, `${method} ${path}`);
  return json;
}
const get = (p) => api("GET", p);
const post = (p, b) => api("POST", p, b);
const patch = (p, b) => api("PATCH", p, b);
const del = (p) => api("DELETE", p);
const rel = (type, id) => ({ data: { type, id } });

// ── 1. 앱 찾기 ──────────────────────────────────
function check() {
  const limits = { subtitle: 30, keywords: 100, promotionalText: 170, description: 4000 };
  for (const [k, max] of Object.entries(limits)) {
    if ([...L[k]].length > max) throw new Error(`listing.json 의 ${k} 가 ${max}자를 넘습니다 (${[...L[k]].length}자).`);
  }
}
check();

const apps = await get(`/v1/apps?filter[bundleId]=${L.bundleId}`);
const app = apps.data[0];
if (!app) throw new Error(`App Store Connect 에 ${L.bundleId} 앱이 없습니다.`);
say(`앱: ${app.attributes.name} (${app.id})`);

await patch(`/v1/apps/${app.id}`, {
  data: { type: "apps", id: app.id, attributes: { contentRightsDeclaration: "DOES_NOT_USE_THIRD_PARTY_CONTENT" } },
}).then(() => say("콘텐츠 권리: 제3자 콘텐츠 없음")).catch((e) => note(`콘텐츠 권리 설정 실패: ${e.message}`));

// ── 2. 앱 정보 (카테고리 · 부제 · 개인정보처리방침 · 연령 등급) ──
const infos = await get(`/v1/apps/${app.id}/appInfos`);
const info =
  infos.data.find((i) => !["READY_FOR_DISTRIBUTION", "REPLACED_WITH_NEW_INFO"].includes(i.attributes.state ?? i.attributes.appStoreState)) ??
  infos.data[0];
await patch(`/v1/appInfos/${info.id}`, {
  data: {
    type: "appInfos",
    id: info.id,
    relationships: {
      primaryCategory: rel("appCategories", L.primaryCategory),
      secondaryCategory: rel("appCategories", L.secondaryCategory),
    },
  },
});
say(`카테고리: ${L.primaryCategory} / ${L.secondaryCategory}`);

const infoLocs = await get(`/v1/appInfos/${info.id}/appInfoLocalizations`);
const infoLoc = infoLocs.data.find((l) => l.attributes.locale.startsWith(L.locale));
const infoAttrs = { subtitle: L.subtitle, privacyPolicyUrl: L.privacyPolicyUrl };
if (infoLoc) {
  await patch(`/v1/appInfoLocalizations/${infoLoc.id}`, { data: { type: "appInfoLocalizations", id: infoLoc.id, attributes: infoAttrs } });
} else {
  await post(`/v1/appInfoLocalizations`, {
    data: { type: "appInfoLocalizations", attributes: { locale: L.locale, name: app.attributes.name, ...infoAttrs }, relationships: { appInfo: rel("appInfos", info.id) } },
  });
}
say(`부제·개인정보처리방침 주소 (${infoLoc?.attributes.locale ?? L.locale})`);

// 연령 등급: 모든 항목 '없음'. 애플이 항목을 바꿔도 되도록, 받지 않는 항목은 빼고 다시 보낸다.
{
  const decl = await get(`/v1/appInfos/${info.id}/ageRatingDeclaration`);
  const current = decl.data.attributes;
  const answer = {};
  for (const [k, v] of Object.entries(current)) {
    if (k === "kidsAgeBand") continue;
    if (/Override/i.test(k)) answer[k] = "NONE";
    else if (typeof v === "boolean") answer[k] = false;
    else if (typeof v === "string") answer[k] = "NONE";
  }
  const nullKeys = Object.keys(current).filter((k) => current[k] === null && k !== "kidsAgeBand" && !(k in answer));
  // 아직 답하지 않은 항목(null)은 이름으로 짐작한다: 등급 항목은 NONE, 예/아니오 항목은 false.
  const ENUM = /Themes|Humor|Violence|violence|Content|contents|contests|Contests|Gambling(Simulated)?$|Information|References|Nudity|Weapons|Override/;
  for (const k of nullKeys) answer[k] = ENUM.test(k) && k !== "gambling" && k !== "userGeneratedContent" ? "NONE" : false;
  for (let tries = 0; tries < 8; tries++) {
    try {
      await patch(`/v1/ageRatingDeclarations/${decl.data.id}`, { data: { type: "ageRatingDeclarations", id: decl.data.id, attributes: answer } });
      say("연령 등급: 모든 항목 없음 (4+)");
      break;
    } catch (e) {
      const bad = e.errors.map((x) => x.source?.pointer?.split("/").pop()).filter((k) => k && k in answer);
      if (!bad.length) { note(`연령 등급 설정 실패: ${e.message}`); break; }
      for (const k of bad) {
        // 형식이 틀렸으면 다른 형식으로, 그래도 안 되면 뺀다.
        if (answer[k] === false) answer[k] = "NONE";
        else if (answer[k] === "NONE" && !/Override/.test(k)) delete answer[k];
        else delete answer[k];
      }
    }
  }
}

// ── 3. 판매 가격 (무료) · 판매 국가 ─────────────────
try {
  const sched = await get(`/v1/apps/${app.id}/appPriceSchedule?include=manualPrices`).catch(() => null);
  if (sched?.data?.relationships?.manualPrices?.data?.length) {
    say("가격: 이미 정해져 있음");
  } else {
    const points = await get(`/v1/apps/${app.id}/appPricePoints?filter[territory]=KOR&limit=200`);
    const free = points.data.find((pt) => Number(pt.attributes.customerPrice) === 0);
    await post(`/v1/appPriceSchedules`, {
      data: {
        type: "appPriceSchedules",
        relationships: {
          app: rel("apps", app.id),
          baseTerritory: rel("territories", "KOR"),
          manualPrices: { data: [{ type: "appPrices", id: "${free}" }] },
        },
      },
      included: [{ type: "appPrices", id: "${free}", attributes: { startDate: null }, relationships: { appPricePoint: rel("appPricePoints", free.id) } }],
    });
    say("가격: 무료");
  }
} catch (e) {
  note(`가격 설정 실패: ${e.message}`);
}

try {
  const avail = await get(`/v1/apps/${app.id}/appAvailabilityV2`).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
  if (avail?.data) {
    say("판매 국가: 이미 정해져 있음");
  } else {
    // 모든 나라를 적고, 판매할 나라만 available 로 둔다.
    const all = [];
    for (let next = `/v1/territories?limit=200`; next; ) {
      const page = await get(next);
      all.push(...page.data.map((t) => t.id));
      next = page.links?.next;
    }
    await post(`/v2/appAvailabilities`, {
      data: {
        type: "appAvailabilities",
        attributes: { availableInNewTerritories: false },
        relationships: {
          app: rel("apps", app.id),
          territoryAvailabilities: { data: all.map((t) => ({ type: "territoryAvailabilities", id: `\${${t}}` })) },
        },
      },
      included: all.map((t) => ({
        type: "territoryAvailabilities",
        id: `\${${t}}`,
        attributes: { available: L.territories.includes(t) },
        relationships: { territory: rel("territories", t) },
      })),
    });
    say(`판매 국가: ${L.territories.join(", ")}`);
  }
} catch (e) {
  note(`판매 국가 설정 실패: ${e.message}`);
}

// ── 4. 버전 1.0 ────────────────────────────────
const EDITABLE = ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED", "INVALID_BINARY"];
const versions = await get(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=20`);
let version = versions.data.find((v) => EDITABLE.includes(v.attributes.appStoreState ?? v.attributes.appVersionState));
const inFlight = versions.data.find((v) => ["WAITING_FOR_REVIEW", "IN_REVIEW", "PENDING_DEVELOPER_RELEASE", "READY_FOR_SALE", "READY_FOR_DISTRIBUTION"].includes(v.attributes.appStoreState ?? v.attributes.appVersionState));
if (!version && inFlight) {
  say(`버전 ${inFlight.attributes.versionString} 은 이미 '${inFlight.attributes.appStoreState}' 상태입니다. 할 일이 없습니다.`);
  process.exit(0);
}
if (!version) {
  version = (await post(`/v1/appStoreVersions`, {
    data: { type: "appStoreVersions", attributes: { platform: "IOS", versionString: L.version }, relationships: { app: rel("apps", app.id) } },
  })).data;
}
await patch(`/v1/appStoreVersions/${version.id}`, {
  data: { type: "appStoreVersions", id: version.id, attributes: { copyright: L.copyright, releaseType: "AFTER_APPROVAL" } },
});
say(`버전 ${version.attributes.versionString} (${version.attributes.appStoreState ?? version.attributes.appVersionState}) · 승인되면 바로 출시`);

const vLocs = await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`);
let vLoc = vLocs.data.find((l) => l.attributes.locale.startsWith(L.locale));
const vAttrs = {
  description: L.description,
  keywords: L.keywords,
  promotionalText: L.promotionalText,
  supportUrl: L.supportUrl,
  marketingUrl: L.marketingUrl,
};
if (vLoc) {
  await patch(`/v1/appStoreVersionLocalizations/${vLoc.id}`, { data: { type: "appStoreVersionLocalizations", id: vLoc.id, attributes: vAttrs } });
} else {
  vLoc = (await post(`/v1/appStoreVersionLocalizations`, {
    data: { type: "appStoreVersionLocalizations", attributes: { locale: L.locale, ...vAttrs }, relationships: { appStoreVersion: rel("appStoreVersions", version.id) } },
  })).data;
}
say(`설명·키워드 (${vLoc.attributes.locale})`);

// ── 5. 스크린샷 (6.7·6.9인치 아이폰) ─────────────────
{
  const TYPE = "APP_IPHONE_67";
  const sets = await get(`/v1/appStoreVersionLocalizations/${vLoc.id}/appScreenshotSets?include=appScreenshots`);
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === TYPE);
  const wanted = L.screenshots.map((f) => join(here, f));
  const md5 = (buf) => crypto.createHash("md5").update(buf).digest("hex");
  const existing = set
    ? (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data
    : [];
  const same =
    existing.length === wanted.length &&
    existing.every((s, i) => s.attributes.sourceFileChecksum === md5(readFileSync(wanted[i])) && s.attributes.assetDeliveryState?.state === "COMPLETE");
  if (same) {
    say(`스크린샷: 이미 올라가 있음 (${existing.length}장)`);
  } else {
    if (!set) {
      set = (await post(`/v1/appScreenshotSets`, {
        data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: TYPE }, relationships: { appStoreVersionLocalization: rel("appStoreVersionLocalizations", vLoc.id) } },
      })).data;
    }
    for (const s of existing) await del(`/v1/appScreenshots/${s.id}`);
    for (const file of wanted) {
      const buf = readFileSync(file);
      const shot = (await post(`/v1/appScreenshots`, {
        data: { type: "appScreenshots", attributes: { fileName: basename(file), fileSize: statSync(file).size }, relationships: { appScreenshotSet: rel("appScreenshotSets", set.id) } },
      })).data;
      for (const op of shot.attributes.uploadOperations) {
        const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
        const res = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
        if (!res.ok) throw new Error(`스크린샷 올리기 실패 ${basename(file)}: ${res.status}`);
      }
      await patch(`/v1/appScreenshots/${shot.id}`, {
        data: { type: "appScreenshots", id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5(buf) } },
      });
      say(`스크린샷 올림: ${basename(file)}`);
    }
    // 애플이 처리할 때까지 기다린다 (보통 몇십 초).
    for (let i = 0; i < 30; i++) {
      const list = (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data;
      const states = list.map((s) => s.attributes.assetDeliveryState?.state);
      if (states.every((s) => s === "COMPLETE")) { say("스크린샷 처리 완료"); break; }
      if (states.some((s) => s === "FAILED")) { note(`스크린샷 처리 실패: ${JSON.stringify(list.map((s) => s.attributes.assetDeliveryState))}`); break; }
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// ── 6. 빌드 연결 ───────────────────────────────
{
  const builds = await get(
    `/v1/builds?filter[app]=${app.id}&filter[preReleaseVersion.version]=${L.version}&filter[processingState]=VALID&filter[expired]=false&sort=-uploadedDate&limit=1`,
  );
  const build = builds.data[0];
  if (!build) {
    note("쓸 수 있는 빌드가 없습니다. TestFlight 업로드가 끝났는지 확인해 주세요.");
  } else {
    await patch(`/v1/appStoreVersions/${version.id}/relationships/build`, rel("builds", build.id));
    say(`빌드 연결: ${build.attributes.version} (${build.attributes.uploadedDate})`);
  }
}

// ── 7. 심사 정보 (연락처 · 체험 계정 · 메모) ───────────
{
  // 010-1234-5678 처럼 넣어도 애플 형식(+82 10 1234 5678)으로 바꾼다.
  const raw = process.env.APP_REVIEW_PHONE?.trim() ?? "";
  const digits = raw.replace(/[^\d+]/g, "");
  const phone = !digits
    ? ""
    : digits.startsWith("+")
      ? digits
      : digits.startsWith("0")
        ? `+82 ${digits.slice(1, 3)} ${digits.slice(3, -4)} ${digits.slice(-4)}`
        : `+${digits}`;
  const attrs = {
    contactFirstName: L.review.firstName,
    contactLastName: L.review.lastName,
    contactEmail: L.review.email,
    demoAccountName: L.review.demoUser,
    demoAccountPassword: L.review.demoPassword,
    demoAccountRequired: true,
    notes: L.review.notes,
    ...(phone ? { contactPhone: phone } : {}),
  };
  if (!phone) note("APP_REVIEW_PHONE 비밀값이 없어 심사 연락처 전화번호를 넣지 못했습니다.");
  try {
  const cur = await get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
  if (cur?.data) {
    await patch(`/v1/appStoreReviewDetails/${cur.data.id}`, { data: { type: "appStoreReviewDetails", id: cur.data.id, attributes: attrs } });
  } else {
    await post(`/v1/appStoreReviewDetails`, {
      data: { type: "appStoreReviewDetails", attributes: attrs, relationships: { appStoreVersion: rel("appStoreVersions", version.id) } },
    });
  }
  say("심사 정보: 연락처 · 체험 계정 · 메모");
  } catch (e) {
    note(`심사 정보 설정 실패: ${e.message}`);
  }
}

// ── 8. 심사 제출 ───────────────────────────────
if (!SUBMIT) {
  say("정보만 채웠습니다. 제출하려면 SUBMIT=1 로 다시 실행하세요.");
} else {
  try {
    const open = await get(`/v1/reviewSubmissions?filter[app]=${app.id}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,UNRESOLVED_ISSUES,WAITING_FOR_REVIEW,IN_REVIEW&include=items`);
    let sub = open.data.find((s) => ["READY_FOR_REVIEW", "UNRESOLVED_ISSUES"].includes(s.attributes.state));
    if (open.data.some((s) => ["WAITING_FOR_REVIEW", "IN_REVIEW"].includes(s.attributes.state))) {
      say("이미 심사 대기 중입니다.");
    } else {
      if (!sub) {
        sub = (await post(`/v1/reviewSubmissions`, {
          data: { type: "reviewSubmissions", attributes: { platform: "IOS" }, relationships: { app: rel("apps", app.id) } },
        })).data;
      }
      const items = await get(`/v1/reviewSubmissions/${sub.id}/items`);
      if (!items.data.length) {
        await post(`/v1/reviewSubmissionItems`, {
          data: { type: "reviewSubmissionItems", relationships: { reviewSubmission: rel("reviewSubmissions", sub.id), appStoreVersion: rel("appStoreVersions", version.id) } },
        });
      }
      await patch(`/v1/reviewSubmissions/${sub.id}`, { data: { type: "reviewSubmissions", id: sub.id, attributes: { submitted: true } } });
      say("✅ 심사에 제출했습니다. 보통 1~2일 안에 결과가 메일로 옵니다.");
    }
  } catch (e) {
    note(`심사 제출 실패: ${e.message}`);
  }
}

if (notes.length) {
  console.log("\n확인할 것:");
  for (const n of notes) console.log(" -", n);
  if (SUBMIT) process.exitCode = 1;
}
