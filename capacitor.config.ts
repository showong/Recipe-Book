import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor 설정 — 일반 유저용 모바일 앱.
 *
 * 이 앱은 Vercel에 배포된 Next.js 사이트를 네이티브 WebView로 로드한다.
 * (풀스택 Next.js라 API Route를 앱에 포함할 수 없어, 백엔드는 원격을 사용)
 *
 * ⚙️ 배포 전 설정:
 *  - CAP_SERVER_URL 환경변수에 실제 배포 URL을 넣고 빌드한다.
 *    예) CAP_SERVER_URL=https://recipe-app.vercel.app npx cap sync
 *  - appId 는 본인 도메인 역순으로 변경 (스토어 등록 시 고정값).
 *
 * 🔒 관리자 분리:
 *  - appendUserAgent 로 앱 요청에 'RecipeAppNative' 표식을 남긴다.
 *  - 서버 middleware.ts 가 이 표식을 보고 /admin 접근을 차단 → 관리자는 웹 전용.
 */
// 배포된 Vercel 주소. 환경변수로 덮어쓸 수 있지만, 없으면 이 기본값을 쓴다.
// (env 누락으로 흰 화면이 뜨는 문제를 방지하기 위해 기본값을 박아둠)
const SERVER_URL =
  process.env.CAP_SERVER_URL || "https://recipe-book-olive-data.vercel.app";

const config: CapacitorConfig = {
  appId: "com.recipeapp.user",
  appName: "레시피북",
  webDir: "public", // server.url 사용 시 실질적으로 미사용 (필수 필드라 지정)
  appendUserAgent: "RecipeAppNative",
  server: {
    url: SERVER_URL,
    cleartext: false,
  },
  ios: {
    contentInset: "always",
  },
};

export default config;
