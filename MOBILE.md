# 📱 모바일 앱 출시 가이드 (Capacitor)

이 문서는 레시피북 웹앱을 **iOS / Android 네이티브 앱**으로 빌드·출시하는 절차입니다.

## 구조 요약

```
┌─────────────────────────┐        ┌──────────────────────┐
│  📱 모바일 앱 (스토어)    │        │  💻 관리자 (웹 전용)   │
│  - 레시피 생성/조회       │        │  - 노트북 브라우저      │
│  - 일반 유저용            │        │    /admin 에서 작업     │
│  - /admin 자동 차단       │        │  - 숏츠 영상 생성       │
└──────────┬──────────────┘        └───────────┬──────────┘
           │                                    │
           └──────────────┬─────────────────────┘
                          ▼
                 같은 Vercel 백엔드 / Supabase
```

- 앱은 Vercel에 배포된 사이트를 네이티브 WebView로 로드합니다.
  (풀스택 Next.js라 API Route를 앱에 포함할 수 없어 백엔드는 원격 사용)
- 앱 요청에는 User-Agent에 `RecipeAppNative` 표식이 붙고,
  `middleware.ts` 가 이를 보고 **앱에서의 `/admin` 접근을 전면 차단**합니다.
  → 관리자(숏츠 생성)는 노트북 웹에서만 접근 가능.

## 사전 준비

| 항목 | 필요 |
|------|------|
| Vercel 배포 | 완료된 배포 URL (예: `https://recipe-app.vercel.app`) |
| iOS 빌드 | macOS + Xcode + Apple Developer 계정 ($99/년) |
| Android 빌드 | Android Studio + Google Play Developer 계정 ($25 1회) |

> ⚠️ iOS 빌드는 반드시 **macOS** 에서만 가능합니다. Android 는 Win/Mac/Linux 모두 가능.

## 빌드 절차

### 1. 네이티브 프로젝트 생성 (최초 1회)

```bash
# 빌드 머신(개발자 PC)에서 실행
npm install

# 배포 URL 을 지정해 네이티브 프로젝트 생성
CAP_SERVER_URL=https://recipe-app.vercel.app npm run cap:add:ios
CAP_SERVER_URL=https://recipe-app.vercel.app npm run cap:add:android
```

생성된 `ios/`, `android/` 폴더는 `.gitignore` 처리되어 있습니다
(빌드 머신에서 관리, 필요 시 별도 커밋 전략 선택).

### 2. 설정 동기화 (URL/플러그인 변경 시마다)

```bash
CAP_SERVER_URL=https://recipe-app.vercel.app npm run cap:sync
```

### 3. IDE 에서 빌드·서명·업로드

```bash
npm run cap:open:ios       # Xcode 열림 → Archive → App Store Connect 업로드
npm run cap:open:android   # Android Studio 열림 → Build > Generate Signed Bundle
```

## 앱 식별 정보 (스토어 등록 전 변경)

`capacitor.config.ts`:
- `appId`: `com.recipeapp.user` → **본인 도메인 역순**으로 변경 (예: `com.yourname.recipe`).
  스토어 등록 후에는 변경 불가하니 처음에 신중히 설정.
- `appName`: 앱 표시 이름.

## 아이콘 / 스플래시

현재 `public/oh_showong_logo.png` 를 PWA 아이콘으로 사용 중입니다.
네이티브 아이콘/스플래시는 아래로 자동 생성 권장:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --iconBackgroundColor "#fff7ed" --splashBackgroundColor "#fff7ed"
```

(1024x1024 `assets/icon.png`, 2732x2732 `assets/splash.png` 준비 후 실행)

## 체크리스트

- [ ] Vercel 프로덕션 배포 + `ADMIN_SECRET` 환경변수 설정 (관리자 보호 활성화)
- [ ] `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` 설정 (쇼핑 기능)
- [ ] `capacitor.config.ts` 의 `appId` 변경
- [ ] 앱에서 `/admin` 접근 시 홈으로 리다이렉트되는지 확인
- [ ] 아이콘/스플래시 생성
- [ ] iOS: Apple Developer 계정 / Android: Play Developer 계정
- [ ] 스토어 심사 제출

## 참고: PWA 로 먼저 체험하기

스토어 등록 전, 브라우저에서 **"홈 화면에 추가"** 로 즉시 앱처럼 사용 가능합니다
(`manifest.json` 이미 적용됨). iOS Safari / Android Chrome 모두 지원.
