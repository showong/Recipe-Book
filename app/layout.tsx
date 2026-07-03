import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "냉장고 털기 🍳 | 재료로 레시피 찾기",
  description: "집에 있는 재료를 입력하면 AI가 맞춤 레시피를 추천해드립니다",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "레시피북",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff6b35",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">
        {/*
          네이티브 앱(WebView) 여부를 UA로 감지해 <html>에 native-app 클래스를 붙인다.
          Capacitor appendUserAgent('RecipeAppNative') 로 앱 요청에만 표식이 있으므로,
          일반 웹 브라우저에는 이 클래스가 붙지 않아 기존 UI가 그대로 유지된다.
          페인트 전에 실행되도록 body 최상단 인라인 스크립트로 둔다.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(navigator.userAgent.indexOf('RecipeAppNative')>-1){document.documentElement.classList.add('native-app')}}catch(e){}",
          }}
        />
        {children}
      </body>
    </html>
  );
}
