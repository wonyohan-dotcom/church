# 아이폰 앱 (TestFlight) 올리는 방법

이 폴더는 **심플한교회관리 웹 앱을 아이폰 앱으로 감싼 것**입니다.
앱을 열면 `https://church-three-opal.vercel.app` 화면이 그대로 뜹니다.
그래서 웹을 고치면(깃허브에 올리면) 앱은 **다시 올리지 않아도** 바로 바뀝니다.
앱을 다시 올려야 하는 때는 아이콘·앱 이름을 바꿀 때뿐입니다.

- 앱 이름: 심플한교회관리
- 번들 ID: `com.wonyohan.simplechurch`

앱을 올리는 방법은 두 가지입니다. **A(자동)** 을 권합니다. 맥이 없어도 됩니다.

---

# A. 자동으로 올리기 (추천) — 처음 한 번만 설정

GitHub 의 맥 서버가 앱을 만들어 TestFlight 에 올립니다.
아래 값들은 **채팅이나 메일로 보내지 말고** GitHub 설정 화면에만 넣으세요.

### A-1. 팀 ID 확인
https://developer.apple.com/account → **멤버십 세부사항(Membership details)** → **팀 ID** (영문·숫자 10자리) 를 적어 둡니다.

### A-2. 앱 ID(번들 ID) 등록
1. https://developer.apple.com/account/resources/identifiers/list → 파란 **+**
2. **App IDs** → Continue → **App** → Continue
3. Description: `SimpleChurch` / Bundle ID: **Explicit** → `com.wonyohan.simplechurch`
4. Continue → **Register**

### A-3. App Store Connect 에 앱 만들기
1. https://appstoreconnect.apple.com/apps → **+** → **신규 앱**
2. 플랫폼 iOS / 이름 `심플한교회관리` (이미 쓰는 이름이라고 나오면 뒤에 교회 이름을 붙이세요)
3. 기본 언어 한국어 / 번들 ID `com.wonyohan.simplechurch` / SKU `simplechurch` / 사용자 액세스 전체 → **생성**

### A-4. 업로드용 API 키 만들기
1. https://appstoreconnect.apple.com/access/integrations/api
   (처음이면 **액세스 요청** 을 눌러 약관에 동의)
2. **+** (API 키 생성) → 이름 `github` / 액세스 **관리자(Admin)** → 생성
3. 화면 위쪽 **Issuer ID** 와 표의 **키 ID** 를 적어 두고, **API 키 다운로드** 로 `AuthKey_XXXX.p8` 파일을 받습니다.
   (이 파일은 **한 번만** 받을 수 있습니다)

### A-5. GitHub 에 값 넣기
https://github.com/wonyohan-dotcom/church/settings/secrets/actions → **New repository secret** 을 4번 눌러 아래를 넣습니다.

| Name | Secret (값) |
|---|---|
| `APPLE_TEAM_ID` | A-1 의 팀 ID |
| `ASC_KEY_ID` | A-4 의 키 ID |
| `ASC_ISSUER_ID` | A-4 의 Issuer ID |
| `ASC_KEY_P8` | `.p8` 파일을 **텍스트편집기**로 열어 전체 선택(⌘A) → 복사(⌘C) → 붙여넣기 |

### A-6. 올리기
- https://github.com/wonyohan-dotcom/church/actions → 왼쪽 **아이폰 앱 올리기 (TestFlight)** → **Run workflow**
- 15~25분 뒤 초록 체크가 뜨면, 다시 10~30분 뒤 App Store Connect 의 **TestFlight** 탭에 빌드가 나타납니다.
- 이후에는 `mobile/` 폴더가 바뀔 때마다 자동으로 올라갑니다.

### A-7. 내 아이폰에 설치
1. App Store Connect → 앱 → **TestFlight** → 내부 테스트 옆 **+** → 그룹 만들기 → 본인 Apple ID 추가
2. 아이폰에 **TestFlight** 앱 설치(App Store) → 초대 메일 또는 TestFlight 앱에서 **설치**

---

# B. 맥에서 직접 올리기 (자동이 안 될 때)

## 1. 맥에서 최신 코드 받기 (터미널)

```bash
cd ~/Desktop/church
git pull
open mobile/ios/App/App.xcodeproj
```

Xcode 가 열리면서 처음 한 번은 필요한 부품(Capacitor)을 인터넷에서 받습니다.
왼쪽 아래 진행 표시가 끝날 때까지 1~2분 기다립니다.

> Xcode 가 없다면 App Store 에서 **Xcode** 를 설치하세요 (무료, 용량이 큽니다).

## 2. 서명 설정 (처음 한 번)

1. Xcode 왼쪽 목록 맨 위 파란 **App** 아이콘 클릭
2. 가운데 **TARGETS → App** 선택 → 위쪽 **Signing & Capabilities** 탭
3. **Automatically manage signing** 체크
4. **Team** 에서 본인 애플 개발자 계정(팀) 선택
   - 목록에 없으면: Xcode 메뉴 → Settings → Accounts → 왼쪽 아래 + → Apple ID 로 로그인
5. 빨간 오류가 없으면 성공입니다.

## 3. App Store Connect 에 앱 만들기 (처음 한 번, A-3 을 했다면 건너뛰기)

1. https://appstoreconnect.apple.com → **앱** → 왼쪽 위 **+** → **신규 앱**
2. 플랫폼: iOS / 이름: 심플한교회관리 (이미 있으면 뒤에 교회 이름을 붙이세요)
3. 기본 언어: 한국어 / 번들 ID: `com.wonyohan.simplechurch` 선택
   (목록에 없으면 2번 서명 설정을 먼저 마친 뒤 새로고침)
4. SKU: `simplechurch` (아무 영문이나 가능) → **생성**

## 4. 올리기 (앱을 새로 올릴 때마다)

1. Xcode 위쪽 기기 선택 칸에서 **Any iOS Device (arm64)** 선택
2. 메뉴 **Product → Archive** → 몇 분 기다리면 Organizer 창이 뜹니다
3. **Distribute App** → **App Store Connect** → **Upload** → 계속 **Next** → **Upload**
4. 10~30분 뒤 App Store Connect → 앱 → **TestFlight** 탭에 빌드가 나타납니다

> 두 번째부터는 올리기 전에 **TARGETS → App → General → Build** 숫자를 1씩 올려 주세요
> (같은 번호로는 다시 올릴 수 없습니다).

## 5. 내 아이폰에 설치

1. App Store Connect → TestFlight → **내부 테스트** → + 그룹 만들기 → 본인 Apple ID 추가
2. 아이폰에 **TestFlight** 앱 설치 (App Store)
3. 메일로 온 초대를 열거나 TestFlight 앱에서 **설치**

교회 다른 분들께도 나눠 드리려면:
- 내부 테스트(최대 100명): App Store Connect **사용자 및 액세스** 에 그분을 먼저 추가해야 합니다.
- 외부 테스트(최대 1만 명): 이메일이나 공개 링크로 초대할 수 있지만, 애플의 간단한 베타 심사를 한 번 거칩니다.
- TestFlight 빌드는 올린 날로부터 **90일** 동안 쓸 수 있습니다. 그 전에 새로 올려 주면 계속 쓸 수 있습니다.

---

## 알아 두실 점

- **App Store 정식 출시**는 애플 심사가 필요하고, 웹 화면만 감싼 앱은 "기능 부족(4.2)" 사유로
  거절될 수 있습니다. 교회 내부용이라면 TestFlight 로 충분합니다.
- 앱 안에서는 웹 푸시 알림이 오지 않습니다(애플 제한). 알림이 필요한 분은 사파리에서 사이트를 연 뒤
  **공유 → 홈 화면에 추가** 로 설치한 아이콘에서 알림을 켜 주세요.
- 인터넷이 끊겨 있으면 "인터넷에 연결되어 있지 않습니다" 화면이 나옵니다.

## 주소나 설정을 바꿨을 때 (개발자용)

`capacitor.config.json` 을 고쳤다면 이 폴더에서 아래를 실행한 뒤 다시 올립니다.

```bash
cd mobile
npm install
npx cap sync ios
```
