# 🚀 App Store 제출 준비 가이드

레시피북(일반 유저용)을 Apple App Store에 제출하기 위한 체크리스트입니다.

---

## 0. 사전 요건 (블로커)

| 항목 | 필요 | 비고 |
|------|------|------|
| **Apple Developer Program** | $99/년 | 제출 필수. [등록](https://developer.apple.com/programs/) |
| macOS + Xcode | ✅ | Mac mini 보유 |
| 앱 아이콘 | ✅ 완료 | `assets/icon.png` |
| **개인정보 처리방침 URL** | ✅ 추가됨 | `https://<배포주소>/privacy` |

> ⚠️ Apple Developer Program 가입(승인까지 최대 1~2일)이 안 되어 있으면 제출 자체가 불가합니다. 먼저 가입하세요.

---

## 1. 코드/설정 준비 (대부분 완료)

### 1-1. 네이티브 플러그인 (4.2 반려 완화)
순수 WebView 앱은 App Store 가이드라인 **4.2(최소 기능)**로 반려될 수 있습니다.
스플래시·상태바 등 네이티브 요소를 추가해 완화했습니다.

Mac에서 적용:
```bash
git pull origin claude/supabase-db-integration
npm install                 # 새 플러그인 설치
npx cap sync
```

### 1-2. Info.plist 권한 설명문 (필수 — 누락 시 크래시/반려)
앱이 **사진 업로드**(완성 요리 사진)를 사용하므로, Xcode에서 권한 설명을 추가해야 합니다.

`npx cap open ios` → 왼쪽 **App → Info** 탭 → 아래 키 추가 (또는 `ios/App/App/Info.plist` 직접 편집):

| Key | 값(예시) |
|-----|---------|
| `Privacy - Photo Library Usage Description`<br>(`NSPhotoLibraryUsageDescription`) | 완성한 요리 사진을 업로드하기 위해 사진 보관함 접근이 필요합니다. |
| `Privacy - Camera Usage Description`<br>(`NSCameraUsageDescription`) | 완성한 요리 사진을 촬영하기 위해 카메라 접근이 필요합니다. |

### 1-3. Bundle ID / 버전
- `capacitor.config.ts`의 `appId`를 **본인 고유값**으로 (예: `com.siyong.recipe`).
  스토어 등록 후 변경 불가.
- Xcode **General** 탭에서 Version(1.0.0), Build(1) 확인.

---

## 2. App Store Connect 준비

[App Store Connect](https://appstoreconnect.apple.com) → **나의 앱 → ＋ → 새로운 앱**

### 2-1. 앱 기본 정보
- **이름**: 레시피북 (스토어 표시명, 중복 불가)
- **기본 언어**: 한국어
- **Bundle ID**: 위에서 정한 값 선택
- **SKU**: 임의 고유 문자열 (예: `recipebook-001`)

### 2-2. 입력해야 할 메타데이터
| 항목 | 내용 |
|------|------|
| 프로모션 텍스트 | 짧은 홍보 문구 |
| 설명 | 앱 기능 소개 (재료 입력 → AI 레시피 추천 등) |
| 키워드 | 레시피, 요리, 냉장고, 식단 등 |
| 지원 URL | 배포주소 또는 문의 페이지 |
| **개인정보 처리방침 URL** | `https://<배포주소>/privacy` ← 추가됨 |
| 카테고리 | 음식 및 음료 (Food & Drink) |
| 연령 등급 | 설문 응답 (대부분 4+) |

### 2-3. 스크린샷 (필수)
- **6.7형**(iPhone 15 Pro Max 등) 스크린샷 최소 1~3장 필요
- 시뮬레이터에서 `⌘ + S`로 캡처 가능
- 추천: 메인(재료 입력), 레시피 결과, 조리 단계 화면

### 2-4. App Privacy (개인정보 라벨)
설문으로 작성. 이 앱 기준 예시:
- 수집 데이터: **사용자 콘텐츠(사진)**, **사용 데이터** 정도
- 회원/신원 정보 수집 없음 → 대부분 "연결 안 됨"으로 응답

---

## 3. 빌드 업로드 & 제출

```bash
npx cap open ios
```

Xcode에서:
1. 상단 기기 → **Any iOS Device (arm64)** 선택
2. 메뉴 **Product → Archive** (빌드 시작)
3. 완료되면 **Organizer** 창 → **Distribute App**
4. **App Store Connect → Upload** 선택 → 업로드
5. App Store Connect 웹에서 빌드가 처리되면(수 분~수십 분), 해당 빌드를 버전에 연결
6. 메타데이터·스크린샷 모두 채운 뒤 **심사 제출**

심사는 보통 **1~3일** 소요.

---

## 4. 반려 대비 (4.2 Minimum Functionality)

순수 웹뷰 래핑은 가장 흔한 반려 사유입니다. 대비책:
- ✅ 네이티브 스플래시/상태바 추가됨
- 심사 노트에 **"AI 기반 레시피 생성·음성 안내 등 고유 기능 제공"**임을 설명
- 반려 시: 네이티브 기능(푸시 알림, 공유 등) 추가 후 재제출 검토

> 참고: **Android(Google Play)**는 이 기준이 훨씬 관대해, 먼저 Play에 출시해 검증하는 전략도 좋습니다.

---

## 체크리스트 요약
- [ ] Apple Developer Program 가입 ($99)
- [ ] `npm install && npx cap sync` (새 플러그인 반영)
- [ ] Info.plist 사진/카메라 권한 설명문 추가
- [ ] `appId` 고유값으로 변경
- [ ] 배포 사이트에 `/privacy` 접속 확인
- [ ] App Store Connect 앱 생성 + 메타데이터
- [ ] 스크린샷 6.7형 캡처
- [ ] App Privacy 설문 작성
- [ ] Archive → Upload → 심사 제출
