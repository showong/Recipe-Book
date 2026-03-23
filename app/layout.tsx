import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "냉장고 털기 🍳 | 재료로 레시피 찾기",
  description: "집에 있는 재료를 입력하면 AI가 맞춤 레시피를 추천해드립니다",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
