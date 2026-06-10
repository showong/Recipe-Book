"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SavedRecipeSummary {
  id: string;
  name: string;
  emoji: string;
  character: string;
  savedAt: string;
  totalTime: string;
  servings: number;
  difficulty: string;
  hasHeroImage: boolean;
}

const CHARACTER_LABEL: Record<string, string> = {
  cute_bear: "🐻 귀여운 곰돌이",
  lazy_bear: "🐨 귀차니즘 곰돌이",
  trend_bear: "🐼 트렌드곰",
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function AdminRecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<SavedRecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recipes");
      const data = await res.json();
      if (data.error) setError(data.error);
      else setRecipes(data.recipes ?? []);
    } catch {
      setError("레시피 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const remove = async (id: string) => {
    if (!confirm("이 레시피를 삭제할까요?")) return;
    try {
      await fetch(`/api/recipes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setRecipes((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError("삭제에 실패했습니다.");
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-white text-center mb-10">
          <div className="text-5xl mb-4">📋</div>
          <h1 className="text-3xl font-extrabold mb-2">레시피 목록</h1>
          <p className="text-white/50 text-sm">일반 유저가 생성한 레시피 ({recipes.length}개)</p>
        </div>

        {loading && (
          <div className="text-center text-white/50 py-12">불러오는 중...</div>
        )}

        {error && (
          <div className="p-4 rounded-2xl text-sm text-red-200 mb-4"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && recipes.length === 0 && (
          <div className="text-center text-white/40 py-16">
            <div className="text-4xl mb-3">🗒️</div>
            <p className="text-sm">아직 저장된 레시피가 없습니다.</p>
            <p className="text-xs mt-1">유저가 레시피를 생성하면 여기에 표시됩니다.</p>
          </div>
        )}

        <div className="space-y-3">
          {recipes.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-4 p-5 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div className="text-3xl flex-shrink-0">{r.emoji || "🍽️"}</div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-bold text-base truncate">{r.name}</div>
                <div className="text-white/50 text-xs mt-0.5">
                  {CHARACTER_LABEL[r.character] ?? r.character} · ⏱ {r.totalTime} · 👤 {r.servings}인분 · 📊 {r.difficulty}
                </div>
                <div className="text-white/30 text-xs mt-0.5">{formatDate(r.savedAt)}</div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => router.push(`/admin/shorts?recipeId=${encodeURIComponent(r.id)}`)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>
                  🎬 쇼츠
                </button>
                <button
                  onClick={() => remove(r.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-white/50 transition-all hover:text-red-300"
                  style={{ border: "1px solid rgba(255,255,255,0.12)" }}>
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => router.push("/admin")}
          className="w-full mt-8 py-3 rounded-2xl text-white/50 text-sm font-medium transition-all hover:text-white/80"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          ← 관리자 콘솔로 돌아가기
        </button>
      </div>
    </div>
  );
}
