// 앱스토어 심사 상태만 조회한다 (바꾸는 것 없음).
import crypto from "node:crypto";
const API = "https://api.appstoreconnect.apple.com";
let key = process.env.ASC_KEY_P8 ?? "";
if (!key.includes("BEGIN PRIVATE KEY")) key = Buffer.from(key, "base64").toString("utf8");
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: "ES256", kid: process.env.ASC_KEY_ID, typ: "JWT" });
const body = b64({ iss: process.env.ASC_ISSUER_ID, iat: now, exp: now + 600, aud: "appstoreconnect-v1" });
const jwt = `${head}.${body}.${crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
const get = async (p) => { const r = await fetch(API + p, { headers: { Authorization: `Bearer ${jwt}` } }); return r.json(); };
const app = (await get("/v1/apps?filter[bundleId]=com.wonyohan.simplechurch")).data[0];
console.log("앱:", app.attributes.name);
for (const v of (await get(`/v1/apps/${app.id}/appStoreVersions?limit=5`)).data)
  console.log("버전", v.attributes.versionString, "상태:", v.attributes.appStoreState ?? v.attributes.appVersionState, "생성:", v.attributes.createdDate);
for (const s of (await get(`/v1/reviewSubmissions?filter[app]=${app.id}&limit=5`)).data)
  console.log("제출", s.id.slice(0, 8), "상태:", s.attributes.state, "제출일:", s.attributes.submittedDate);
const builds = (await get(`/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=3`)).data;
for (const x of builds) console.log("빌드", x.attributes.version, x.attributes.processingState, x.attributes.uploadedDate);
