"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RecipeSuggestion } from "@/types/recipe";
import { Suspense } from "react";

function RecipesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recipes, setRecipes] = useState<RecipeSuggestion[]>([]);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const data = searchParams.get("data");
    if (!data) {
      router.push("/");
      return;
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(data));
      setRecipes(parsed.recipes || []);
      setIngredients(parsed.ingredients || []);
    } catch {
      router.push("/");
    } finally {
      setIsLoading(false);
    }
  }, [searchParams, router]);

  const handleSelectRecipe = async (recipe: RecipeSuggestion) => {
    setSelectedId(recipe.id);
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/generate-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipe.name,
          ownedIngredients: recipe.ownedIngredients,
          additionalIngredients: recipe.additionalIngredients,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "상세 레시피 생성 실패");
      }

      const encoded = encodeURIComponent(JSON.stringify({
        recipe: data.recipe,
        ingredients,
      }));
      router.push(`/recipe?data=${encoded}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setSelectedId(null);
      setIsLoading(false);
    }
  };

  const difficultyColor = (d: string) => {
    if (d === "쉬움") return { bg: "#dcfce7", text: "#16a34a" };
    if (d === "어려움") return { bg: "#fee2e2", text: "#dc2626" };
    return { bg: "#fef3c7", text: "#d97706" };
  };

  if (isLoading && recipes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🍳</div>
          <p className="text-lg font-medium text-gray-600">레시피를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="hero-gradient py-10 px-4 text-white text-center">
        <button
          onClick={() => router.push("/")}
          className="absolute left-4 top-6 text-white opacity-80 hover:opacity-100 transition-opacity flex items-center gap-1 text-sm font-medium"
        >
          ← 재료 변경
        </button>
        <h1 className="text-2xl font-extrabold mb-2">추천 레시피</h1>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {ingredients.map((ing) => (
            <span key={ing} className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ background: "rgba(255,255,255,0.25)" }}>
              {ing}
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 relative">
        {/* Loading overlay when selecting */}
        {selectedId && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
            <div className="bg-white rounded-3xl p-8 text-center shadow-2xl mx-4">
              <div className="text-5xl mb-4">
                {recipes.find(r => r.id === selectedId)?.emoji || "🍳"}
              </div>
              <div className="flex items-center justify-center gap-3 mb-2">
                <svg className="spinner w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-lg font-bold text-gray-800">상세 레시피 생성 중...</p>
              </div>
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-orange-500">
                  {recipes.find(r => r.id === selectedId)?.name}
                </span> 레시피를 준비하고 있어요
              </p>
            </div>
          </div>
        )}

        <h2 className="text-xl font-bold text-gray-700 mb-6 text-center">
          3가지 레시피 중 하나를 선택하세요 👇
        </h2>

        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm font-medium"
            style={{ background: "#fee2e2", color: "#dc2626" }}>
            ⚠️ {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recipes.map((recipe, index) => {
            const diffStyle = difficultyColor(recipe.difficulty);
            return (
              <div
                key={recipe.id}
                className={`recipe-card bg-white rounded-3xl shadow-md overflow-hidden cursor-pointer
                  fade-in-up fade-in-up-delay-${index + 1}`}
                onClick={() => !selectedId && handleSelectRecipe(recipe)}
              >
                {/* Card Header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-5xl">{recipe.emoji}</div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: diffStyle.bg, color: diffStyle.text }}>
                        {recipe.difficulty}
                      </span>
                      <span className="text-xs text-gray-400">⏱ {recipe.cookingTime}</span>
                    </div>
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-800 mb-1">{recipe.name}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{recipe.description}</p>
                </div>

                {/* Taste */}
                <div className="px-6 pb-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
                    style={{ background: "#fff7ed", color: "#ea580c" }}>
                    <span>😋</span>
                    <span className="font-medium">{recipe.taste}</span>
                  </div>
                </div>

                {/* Highlight / Kick */}
                <div className="px-6 pb-4">
                  <div className="p-3 rounded-xl text-sm font-medium"
                    style={{ background: "#fffbeb", border: "1px solid #fde68a" }}>
                    <span className="text-yellow-600">✨ </span>
                    <span className="text-gray-700">{recipe.highlight}</span>
                  </div>
                </div>

                {/* Ingredients */}
                <div className="px-6 pb-4">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      보유 재료
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {recipe.ownedIngredients.slice(0, 5).map((ing) => (
                        <span key={ing} className="px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: "#dcfce7", color: "#16a34a" }}>
                          ✓ {ing}
                        </span>
                      ))}
                    </div>
                    {recipe.additionalIngredients.length > 0 && (
                      <>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">
                          추가 필요
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {recipe.additionalIngredients.map((ing) => (
                            <span key={ing} className="px-2.5 py-1 rounded-full text-xs font-medium"
                              style={{ background: "#fff7ed", color: "#ea580c" }}>
                              + {ing}
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Pairings */}
                {recipe.pairings.length > 0 && (
                  <div className="px-6 pb-4">
                    <p className="text-xs font-semibold text-gray-400 mb-1.5">🤝 어울리는 음식</p>
                    <p className="text-sm text-gray-600">{recipe.pairings.join(" · ")}</p>
                  </div>
                )}

                {/* CTA */}
                <div className="px-6 pb-6">
                  <button
                    className="w-full py-3 rounded-2xl text-white text-sm font-bold transition-all
                      hover:opacity-90 active:scale-95"
                    style={{
                      background: "linear-gradient(135deg, #ff6b35, #ffc857)",
                      boxShadow: "0 4px 15px rgba(255, 107, 53, 0.3)",
                    }}
                  >
                    이 레시피로 요리하기 →
                  </button>
                </div>

                {/* Servings badge */}
                <div className="absolute top-4 left-4 opacity-0"
                  style={{ position: "relative", opacity: 1 }}>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🍳</div>
          <p className="text-lg font-medium text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <RecipesContent />
    </Suspense>
  );
}
