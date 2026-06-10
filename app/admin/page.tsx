"use client";

import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();

  const menuItems = [
    {
      icon: "🎬",
      title: "쇼츠 생성기",
      desc: "음식 사진 기반 릴스 썸네일 제작",
      path: "/admin/shorts",
      badge: null,
    },
    {
      icon: "📋",
      title: "레시피 목록",
      desc: "생성된 레시피 전체 조회",
      path: "/admin/recipes",
      badge: null,
    },
    {
      icon: "🖼️",
      title: "에셋 관리",
      desc: "캐릭터, 템플릿, 썸네일 스타일",
      path: "/admin/assets",
      badge: "준비중",
    },
    {
      icon: "📊",
      title: "작업 현황",
      desc: "생성 작업 상태 및 로그",
      path: "/admin/jobs",
      badge: "준비중",
    },
  ];

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-white text-center mb-10">
          <div className="text-5xl mb-4">⚙️</div>
          <h1 className="text-3xl font-extrabold mb-2">관리자 콘솔</h1>
          <p className="text-white/50 text-sm">Recipe Book Admin Dashboard</p>
        </div>

        {/* Menu */}
        <div className="space-y-3">
          {menuItems.map((item) => (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className="w-full flex items-center gap-4 p-5 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
              <div className="text-3xl flex-shrink-0">{item.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-base flex items-center gap-2">
                  {item.title}
                  {item.badge && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(255,107,53,0.25)", color: "#ffc857" }}>
                      {item.badge}
                    </span>
                  )}
                </div>
                <div className="text-white/50 text-sm mt-0.5">{item.desc}</div>
              </div>
              <div className="text-white/30 text-lg">→</div>
            </button>
          ))}
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full mt-8 py-3 rounded-2xl text-white/50 text-sm font-medium transition-all hover:text-white/80"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          ← 홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
