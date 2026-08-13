# Supabase로 배포하기

이미 Supabase를 쓰고 계시다면 이 방법이 가장 간단합니다.
**서버 비용이 들지 않고**, 디스크를 신경 쓸 필요도 없습니다.

---

## 먼저 알아두실 것

Supabase는 **데이터베이스와 파일 저장소**입니다. 앱 자체를 돌려주지는 않습니다.
그래서 역할을 이렇게 나눕니다.

| 하는 일 | 어디서 |
| --- | --- |
| 교인·회계 자료 저장 | **Supabase** (PostgreSQL) |
| 교인 사진·영수증 사진 보관 | **Supabase Storage** |
| 앱 화면을 띄우는 서버 | **Vercel** (무료) |

이 조합이면 앱이 디스크에 파일을 쓸 일이 없어서 Vercel 무료 요금제로 충분합니다.

---

## 1. Supabase 준비 (10분)

### 1-1. 데이터베이스 주소 가져오기

대시보드 → **Project Settings → Database → Connection string → URI**

두 가지 주소가 있습니다. **어떤 걸 쓰는지가 중요합니다.**

| 주소 | 포트 | 언제 쓰나 |
| --- | --- | --- |
| Direct connection | 5432 | 노트북에서 마이그레이션 돌릴 때 |
| **Transaction pooler** | **6543** | **Vercel에 올릴 때 (필수)** |

Vercel은 요청마다 서버가 새로 뜨기 때문에, 직접 연결을 쓰면 연결 수가 금방 바닥납니다.
반드시 **6543 포트의 pooler 주소**를 쓰세요.

### 1-2. 사진 보관함 만들기

대시보드 → **Storage → New bucket**

- 이름: `church-uploads`
- **Public bucket 을 끄세요.** 반드시 비공개여야 합니다.

교인 사진과 영수증에는 개인정보가 들어갑니다. 앱이 로그인 여부를 확인한 뒤
10분짜리 임시 주소를 만들어 보여주므로, 버킷을 공개로 두면 그 보호가 무의미해집니다.

### 1-3. 키 가져오기

대시보드 → **Project Settings → API**

- `Project URL` → `SUPABASE_URL`
- `service_role` 키 → `SUPABASE_SERVICE_ROLE_KEY`

> **주의** `service_role` 키는 모든 권한을 가진 열쇠입니다.
> 서버에서만 쓰이며 브라우저로 절대 나가지 않지만, 채팅이나 메일로 공유하지 마세요.
> (`anon` 키가 아니라 `service_role` 키입니다)

---

## 2. 데이터베이스 표 만들기 (노트북에서 한 번)

```bash
git clone https://github.com/wonyohan-dotcom/church.git
cd church
git checkout claude/church-management-app-shdx1d
npm install

cp .env.example .env
```

`.env`를 열어 두 값을 채웁니다.

```bash
# 여기는 5432 포트(Direct connection) 주소를 씁니다
DATABASE_URL="postgresql://postgres:비밀번호@db.xxxx.supabase.co:5432/postgres"

# openssl rand -hex 32 로 만든 값
APP_SECRET="..."
```

그리고 표를 만듭니다.

```bash
npm run db:migrate
```

Supabase 대시보드 → Table Editor 에 표들이 생겼으면 성공입니다.

---

## 3. Vercel에 올리기 (5분)

1. [vercel.com](https://vercel.com) 가입 → **Add New → Project** → 이 저장소 선택
2. **Environment Variables** 에 아래를 넣습니다.

   | 이름 | 값 |
   | --- | --- |
   | `DATABASE_URL` | **6543 포트** pooler 주소 |
   | `APP_SECRET` | 위에서 만든 값 (노트북 `.env`와 **같은 값**) |
   | `SUPABASE_URL` | `https://xxxx.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role 키 |
   | `SUPABASE_BUCKET` | `church-uploads` |
   | `TZ` | `Asia/Seoul` |

3. **Deploy**

`https://우리교회.vercel.app` 같은 주소가 나오고 HTTPS가 자동으로 붙습니다.

> **`APP_SECRET`은 노트북과 서버가 같은 값이어야 합니다.**
> 다르면 한쪽에서 저장한 주민등록번호를 다른 쪽에서 읽지 못합니다.

---

## 4. 첫 접속

주소를 열면 **교회 등록** 화면이 나옵니다. 교회 이름과 관리자 계정을 만들면 끝입니다.

폰에서는 사파리(아이폰) 또는 크롬(안드로이드)으로 열고
**공유 → 홈 화면에 추가**를 누르면 앱 아이콘이 생깁니다.

---

## 백업

Supabase가 알아서 해주지만, 중요한 자료이니 확인해 두세요.

- **데이터베이스**: 대시보드 → Database → Backups (유료 요금제는 자동 일일 백업)
  무료 요금제라면 가끔 `pg_dump`로 직접 받아 두세요.
- **사진**: Storage 버킷을 주기적으로 내려받아 보관하세요.
- **`APP_SECRET`**: 이건 백업이 아니라 **분실 방지**입니다. 잃어버리면
  저장된 주민등록번호를 영영 읽을 수 없습니다.

---

## 문제가 생기면

| 증상 | 원인과 해결 |
| --- | --- |
| `too many connections` | 5432 직접 연결 주소를 쓰고 있습니다. 6543 pooler 주소로 바꾸세요. |
| 사진이 안 보임 | `SUPABASE_*` 세 값이 비어 있거나 버킷 이름이 다릅니다. |
| 사진 업로드 실패 | 버킷이 없거나 `service_role` 키가 아닌 `anon` 키를 넣었습니다. |
| 로그인이 자꾸 풀림 | 노트북과 서버의 `APP_SECRET`이 다릅니다. |
| 표가 없다고 나옴 | 2단계 `npm run db:migrate`를 아직 안 했습니다. |

---

## Supabase를 쓰지 않으려면

Docker로 직접 띄울 수도 있습니다. `docker compose up -d` 한 줄이면
PostgreSQL까지 함께 뜨고, 사진은 서버 디스크에 저장됩니다.
자세한 내용은 [핸드폰에서-사용하기.md](핸드폰에서-사용하기.md)를 보세요.
