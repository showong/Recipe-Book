"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RecipeDetail, RecipeStep } from "@/types/recipe";
import { Suspense } from "react";
import Image from "next/image";

function RecipeDetailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState<"ingredients" | "steps" | "summary">("ingredients");
  const summaryRef = useRef<HTMLDivElement>(null);

  // Images from Imagen
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [ingredientsImage, setIngredientsImage] = useState<string | null>(null);
  const [ingredientsImageEn, setIngredientsImageEn] = useState<string | null>(null);
  const [summaryImage, setSummaryImage] = useState<string | null>(null);
  const [ingredientsImageLoading, setIngredientsImageLoading] = useState(false);
  const [ingredientsImageEnLoading, setIngredientsImageEnLoading] = useState(false);
  const [summaryImageLoading, setSummaryImageLoading] = useState(false);
  const [stepImages, setStepImages] = useState<Record<number, string>>({});
  const [stepImagesLoading, setStepImagesLoading] = useState<Record<number, boolean>>({});
  const [stepImagesEn, setStepImagesEn] = useState<Record<number, string>>({});
  const [stepImagesEnLoading, setStepImagesEnLoading] = useState<Record<number, boolean>>({});
  const [kickInstagramImage, setKickInstagramImage] = useState<string | null>(null);
  const [kickInstagramImageLoading, setKickInstagramImageLoading] = useState(false);
  const [kickInstagramImageEn, setKickInstagramImageEn] = useState<string | null>(null);
  const [kickInstagramImageEnLoading, setKickInstagramImageEnLoading] = useState(false);
  // 인스타 게시글 텍스트
  const [instagramPost, setInstagramPost] = useState<string | null>(null);
  const [instagramPostLoading, setInstagramPostLoading] = useState(false);
  const [postCopied, setPostCopied] = useState(false);

  useEffect(() => {
    const data = searchParams.get("data");
    if (!data) {
      router.push("/");
      return;
    }
    try {
      const parsed = JSON.parse(decodeURIComponent(data));
      setRecipe(parsed.recipe);
      setIngredients(parsed.ingredients || []);
      // Hero image stored in sessionStorage to avoid oversized URL
      if (parsed.heroImageKey) {
        const stored = sessionStorage.getItem(parsed.heroImageKey);
        if (stored) {
          setHeroImage(stored);
          sessionStorage.removeItem(parsed.heroImageKey);
        }
      }

      // Start generating ingredient layout image and summary image
      if (parsed.recipe?.name) {
        generateIngredientsImage(parsed.recipe.name, parsed.recipe.ingredients ?? []);
        generateImage(parsed.recipe.name, "summary", setSummaryImage, setSummaryImageLoading);
      }
    } catch {
      router.push("/");
    }
  }, [searchParams, router]);

  const generateImage = async (
    recipeName: string,
    type: string,
    setter: (url: string) => void,
    loadingSetter: (v: boolean) => void,
    stepTitle?: string,
  ) => {
    loadingSetter(true);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeName, type, stepTitle }),
      });
      const data = await res.json();
      if (data.imageUrl) setter(data.imageUrl);
    } catch {
      // silently fail
    } finally {
      loadingSetter(false);
    }
  };

  const generateIngredientsImage = async (
    recipeName: string,
    ingredientList: { name: string; amount: string; unit: string }[],
    lang: "ko" | "en" = "ko",
  ) => {
    if (lang === "en") {
      setIngredientsImageEn(null);
      setIngredientsImageEnLoading(true);
    } else {
      setIngredientsImage(null);
      setIngredientsImageLoading(true);
    }
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipeName, type: "ingredients", language: lang, ingredients: ingredientList }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        if (lang === "en") setIngredientsImageEn(data.imageUrl);
        else setIngredientsImage(data.imageUrl);
      }
    } catch {
      // silently fail
    } finally {
      if (lang === "en") setIngredientsImageEnLoading(false);
      else setIngredientsImageLoading(false);
    }
  };

  const generateStepInstagramImage = async (step: RecipeStep, lang: "ko" | "en" = "ko") => {
    if (!recipe) return;
    if (lang === "en") {
      setStepImagesEn((prev) => { const n = { ...prev }; delete n[step.number]; return n; });
      setStepImagesEnLoading((prev) => ({ ...prev, [step.number]: true }));
    } else {
      setStepImagesLoading((prev) => ({ ...prev, [step.number]: true }));
    }
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipe.name,
          type: "step-instagram",
          language: lang,
          stepNumber: step.number,
          stepTitle: step.title,
          stepDescription: step.description,
          stepTime: step.time,
          totalSteps: recipe.steps.length,
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        if (lang === "en") setStepImagesEn((prev) => ({ ...prev, [step.number]: data.imageUrl }));
        else setStepImages((prev) => ({ ...prev, [step.number]: data.imageUrl }));
      }
    } catch {
      // silently fail
    } finally {
      if (lang === "en") setStepImagesEnLoading((prev) => ({ ...prev, [step.number]: false }));
      else setStepImagesLoading((prev) => ({ ...prev, [step.number]: false }));
    }
  };

  const generateInstagramPost = async () => {
    if (!recipe) return;
    setInstagramPost(null);
    setInstagramPostLoading(true);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe }),
      });
      const data = await res.json();
      if (data.post) setInstagramPost(data.post);
    } catch {
      // silently fail
    } finally {
      setInstagramPostLoading(false);
    }
  };

  const generateKickInstagramImage = async (lang: "ko" | "en" = "ko") => {
    if (!recipe) return;
    if (lang === "en") {
      setKickInstagramImageEn(null);
      setKickInstagramImageEnLoading(true);
    } else {
      setKickInstagramImage(null);
      setKickInstagramImageLoading(true);
    }
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipe.name,
          type: "kick-instagram",
          language: lang,
          kickSteps: recipe.steps
            .filter((s) => s.isKick)
            .map((s) => ({ number: s.number, title: s.title, kickReason: s.kickReason })),
          highlight: recipe.highlight,
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        if (lang === "en") setKickInstagramImageEn(data.imageUrl);
        else setKickInstagramImage(data.imageUrl);
      }
    } catch {
      // silently fail
    } finally {
      if (lang === "en") setKickInstagramImageEnLoading(false);
      else setKickInstagramImageLoading(false);
    }
  };

  if (!recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🍳</div>
          <p className="text-lg font-medium text-gray-600">레시피를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  const kickSteps = recipe.steps.filter((s) => s.isKick);
  const ownedIngredients = recipe.ingredients.filter((i) => i.isOwned);
  const neededIngredients = recipe.ingredients.filter((i) => !i.isOwned);

  return (
    <div className="min-h-screen pb-20">
      {/* Header with Imagen hero photo */}
      <div className="relative overflow-hidden" style={{ minHeight: "280px" }}>
        {heroImage ? (
          <div className="absolute inset-0">
            <Image src={heroImage} alt={recipe.name} fill className="object-cover" unoptimized />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)" }} />
          </div>
        ) : (
          <div className="absolute inset-0 hero-gradient" />
        )}
        <div className="relative z-10 py-10 px-4 text-white text-center">
          <button
            onClick={() => router.back()}
            className="absolute left-4 top-6 text-white opacity-80 hover:opacity-100 transition-opacity flex items-center gap-1 text-sm font-medium"
          >
            ← 뒤로
          </button>
          {!heroImage && <div className="text-5xl mb-3">{recipe.emoji}</div>}
          <h1 className="text-3xl font-extrabold mb-2 drop-shadow">{recipe.name}</h1>
          <p className="text-sm opacity-90 max-w-md mx-auto drop-shadow">{recipe.description}</p>
          <div className="flex justify-center gap-6 mt-4">
            <div className="text-center">
              <div className="text-xl font-bold">⏱ {recipe.totalTime}</div>
              <div className="text-xs opacity-75">총 시간</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">👤 {recipe.servings}인분</div>
              <div className="text-xs opacity-75">분량</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold">📊 {recipe.difficulty}</div>
              <div className="text-xs opacity-75">난이도</div>
            </div>
          </div>
        </div>
      </div>

      {/* Highlight / Kick Banner */}
      <div className="max-w-3xl mx-auto px-4 -mt-4 mb-6 relative z-20">
        <div className="kick-pulse rounded-2xl p-4 text-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)", color: "white" }}>
          <div className="text-sm font-bold opacity-90 mb-1">⭐ 이 요리의 핵심 포인트</div>
          <div className="text-lg font-extrabold">{recipe.highlight}</div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4">
        {/* Section Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-2xl p-1.5 shadow-sm">
          {(["ingredients", "steps", "summary"] as const).map((section) => {
            const labels: Record<string, string> = {
              ingredients: "🛒 재료",
              steps: "👨‍🍳 조리법",
              summary: "📋 요약",
            };
            return (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  activeSection === section ? "text-white shadow-md" : "text-gray-500 hover:text-gray-700"
                }`}
                style={activeSection === section ? { background: "linear-gradient(135deg, #ff6b35, #ffc857)" } : {}}
              >
                {labels[section]}
              </button>
            );
          })}
        </div>

        {/* =========== INGREDIENTS SECTION =========== */}
        {activeSection === "ingredients" && (
          <div className="fade-in-up space-y-4">
            {/* 재료 사진 카드 — 한국어 / 영어 */}
            {(["ko", "en"] as const).map((lang) => {
              const img = lang === "ko" ? ingredientsImage : ingredientsImageEn;
              const loading = lang === "ko" ? ingredientsImageLoading : ingredientsImageEnLoading;
              const label = lang === "ko" ? "🇰🇷 재료 사진 (한국어)" : "🌎 Ingredients Photo (English)";
              return (
                <div key={lang} className="bg-white rounded-3xl shadow-md overflow-hidden">
                  <div className="px-5 py-3 flex items-center justify-between"
                    style={{ background: "linear-gradient(135deg, #f8fafc, #e2e8f0)" }}>
                    <span className="text-sm font-bold text-gray-600">{label}</span>
                    {loading && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <svg className="spinner w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        생성 중...
                      </span>
                    )}
                  </div>
                  <div className="relative w-full mx-auto bg-gray-50"
                    style={{ aspectRatio: "1 / 1", maxWidth: "400px" }}>
                    {img ? (
                      <Image src={img} alt="재료" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {loading ? (
                          <div className="text-center">
                            <div className="text-4xl mb-2">🥕</div>
                            <p className="text-sm text-gray-400">생성 중...</p>
                          </div>
                        ) : (
                          <span className="text-5xl opacity-20">📷</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 flex gap-2"
                    style={{ background: "linear-gradient(135deg, #f8fafc, #e2e8f0)" }}>
                    {img && (
                      <button
                        onClick={() => { const a = document.createElement("a"); a.href = img; a.download = `${recipe.name}-ingredients-${lang}.png`; a.click(); }}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
                        ⬇️ 저장
                      </button>
                    )}
                    <button
                      onClick={() => generateIngredientsImage(recipe.name, recipe.ingredients, lang)}
                      disabled={loading}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold border-2 transition-all hover:bg-gray-100 disabled:opacity-40"
                      style={{ borderColor: "#94a3b8", color: "#64748b" }}>
                      {loading ? <svg className="spinner w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : "🔄"} {img ? "재생성" : "생성"}
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Owned ingredients card */}
            <div className="bg-white rounded-3xl shadow-md overflow-hidden">
              <div className="px-6 py-4 flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
                <span className="text-xl">✅</span>
                <h3 className="font-bold text-green-700">보유 재료 ({ownedIngredients.length}가지)</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3">
                  {ownedIngredients.map((ing) => (
                    <div key={ing.name} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                      <span className="font-semibold text-sm text-gray-700">{ing.name}</span>
                      <span className="text-sm font-bold" style={{ color: "#16a34a" }}>
                        {ing.amount}{ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {neededIngredients.length > 0 && (
              <div className="bg-white rounded-3xl shadow-md overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #fff7ed, #fed7aa)" }}>
                  <span className="text-xl">🛍️</span>
                  <h3 className="font-bold text-orange-700">추가 구매 필요 ({neededIngredients.length}가지)</h3>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-2 gap-3">
                    {neededIngredients.map((ing) => (
                      <div key={ing.name} className="flex items-center justify-between p-3 rounded-xl"
                        style={{ background: "#fff7ed", border: "1px solid #fed7aa" }}>
                        <span className="font-semibold text-sm text-gray-700">{ing.name}</span>
                        <span className="text-sm font-bold" style={{ color: "#ea580c" }}>
                          {ing.amount}{ing.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Full list */}
            <div className="bg-white rounded-3xl shadow-md p-6">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                <span>📋</span> 전체 재료 목록
              </h3>
              <div className="space-y-2">
                {recipe.ingredients.map((ing) => (
                  <div key={ing.name}
                    className="flex items-center justify-between py-2 border-b last:border-b-0"
                    style={{ borderColor: "#f3f4f6" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{ing.isOwned ? "✅" : "🔲"}</span>
                      <span className={`font-medium text-sm ${ing.isOwned ? "text-gray-700" : "text-orange-600"}`}>
                        {ing.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-600">
                      {ing.amount} {ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setActiveSection("steps")}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>
              조리법 보기 →
            </button>
          </div>
        )}

        {/* =========== STEPS SECTION =========== */}
        {activeSection === "steps" && (
          <div className="fade-in-up">
            {/* Kick steps preview */}
            {kickSteps.length > 0 && (
              <div className="mb-6 rounded-2xl overflow-hidden"
                style={{ border: "2px solid #fed7aa" }}>
                <div className="p-4" style={{ background: "#fff7ed" }}>
                  <p className="text-sm font-bold text-orange-600 mb-2">
                    ⭐ 성공 포인트 ({kickSteps.length}개)
                  </p>
                  <div className="space-y-1">
                    {kickSteps.map((step) => (
                      <p key={step.number} className="text-sm text-gray-700">
                        <span className="font-bold text-orange-500">단계 {step.number}.</span>{" "}
                        {step.kickReason}
                      </p>
                    ))}
                  </div>
                </div>

                {/* 성공 포인트 인스타 이미지 — 한국어 / 영어 */}
                {(["ko", "en"] as const).map((lang) => {
                  const img = lang === "ko" ? kickInstagramImage : kickInstagramImageEn;
                  const loading = lang === "ko" ? kickInstagramImageLoading : kickInstagramImageEnLoading;
                  const btnLabel = lang === "ko" ? "🇰🇷 성공 포인트 이미지 생성" : "🌎 English Version";
                  const dlName = `${recipe.name}-kick-${lang}.png`;
                  return (
                    <div key={lang}>
                      {img && (
                        <div>
                          <div className="relative w-full mx-auto overflow-hidden"
                            style={{ aspectRatio: "1 / 1", maxWidth: "400px", margin: "0 auto" }}>
                            <Image src={img} alt="성공 포인트 이미지" fill className="object-cover" unoptimized />
                          </div>
                          <div className="px-4 py-2 flex gap-2" style={{ background: "#fff7ed" }}>
                            <button onClick={() => { const a = document.createElement("a"); a.href = img; a.download = dlName; a.click(); }}
                              className="flex-1 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90"
                              style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>⬇️ 저장</button>
                            <button onClick={() => generateKickInstagramImage(lang)}
                              className="px-4 py-2 rounded-xl text-xs font-bold border-2 hover:bg-orange-50"
                              style={{ borderColor: "#ff6b35", color: "#ff6b35" }}>🔄 재생성</button>
                          </div>
                        </div>
                      )}
                      {!img && (
                        <div className="px-4 py-2 flex justify-end" style={{ background: "#fff7ed" }}>
                          {loading ? (
                            <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
                              <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              생성 중...
                            </div>
                          ) : (
                            <button onClick={() => generateKickInstagramImage(lang)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white hover:opacity-80"
                              style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>
                              📸 {btnLabel}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-4">
              {recipe.steps.map((step) => (
                <div
                  key={step.number}
                  className={`step-card bg-white rounded-3xl shadow-md overflow-hidden
                    ${step.isKick ? "is-kick" : ""}`}
                  style={step.isKick ? {} : { border: "1px solid #f3f4f6" }}
                >
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl
                          ${step.isKick ? "bg-orange-100" : "bg-gray-100"}`}>
                          {step.emoji}
                        </div>
                        <div className="text-center mt-1">
                          <span className={`text-xs font-bold ${step.isKick ? "text-orange-500" : "text-gray-400"}`}>
                            {step.number}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h4 className={`font-extrabold text-base ${step.isKick ? "text-orange-700" : "text-gray-800"}`}>
                            {step.title}
                          </h4>
                          {step.time && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "#f3f4f6", color: "#6b7280" }}>
                              ⏱ {step.time}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>

                        {step.isKick && step.kickReason && (
                          <div className="mt-3 p-3 rounded-xl text-sm font-medium"
                            style={{ background: "rgba(255, 107, 53, 0.08)", color: "#c2410c" }}>
                            💡 <span className="font-bold">포인트:</span> {step.kickReason}
                          </div>
                        )}

                        {step.parallel && (
                          <div className="mt-2 p-2.5 rounded-xl text-xs flex items-start gap-2"
                            style={{ background: "#f0fdf4", color: "#16a34a" }}>
                            <span className="text-base">⚡</span>
                            <div><span className="font-bold">시간 절약:</span> {step.parallel}</div>
                          </div>
                        )}

                        {step.tip && (
                          <div className="mt-2 p-2.5 rounded-xl text-xs flex items-start gap-2"
                            style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                            <span className="text-base">💡</span>
                            <div><span className="font-bold">팁:</span> {step.tip}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 단계 이미지 — 한국어 / 영어 */}
                  <div className="border-t" style={{ borderColor: step.isKick ? "rgba(255,107,53,0.15)" : "#f3f4f6" }}>
                    {(["ko", "en"] as const).map((lang) => {
                      const img = lang === "ko" ? stepImages[step.number] : stepImagesEn[step.number];
                      const loading = lang === "ko" ? stepImagesLoading[step.number] : stepImagesEnLoading[step.number];
                      const gradientKo = step.isKick ? "linear-gradient(135deg,#ff6b35,#ffc857)" : "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)";
                      const gradientEn = "linear-gradient(135deg,#0ea5e9,#6366f1)";
                      const gradient = lang === "ko" ? gradientKo : gradientEn;
                      const btnText = lang === "ko" ? "🇰🇷 한국어 이미지" : "🌎 English Image";
                      return (
                        <div key={lang} className={lang === "en" ? "border-t border-dashed" : ""} style={{ borderColor: "#e5e7eb" }}>
                          {img && (
                            <div>
                              <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
                                <Image src={img} alt={`${step.title} ${lang}`} fill className="object-cover" unoptimized />
                              </div>
                              <div className="px-4 py-2 flex gap-2">
                                <button onClick={() => { const a = document.createElement("a"); a.href = img; a.download = `${recipe.name}-step${step.number}-${lang}.png`; a.click(); }}
                                  className="flex-1 py-2 rounded-xl text-white text-xs font-bold hover:opacity-90"
                                  style={{ background: gradient }}>⬇️ 저장</button>
                                <button onClick={() => generateStepInstagramImage(step, lang)}
                                  className="px-4 py-2 rounded-xl text-xs font-bold border-2 hover:bg-gray-50"
                                  style={{ borderColor: lang === "ko" ? "#fd1d1d" : "#6366f1", color: lang === "ko" ? "#fd1d1d" : "#6366f1" }}>🔄</button>
                              </div>
                            </div>
                          )}
                          {!img && (
                            <div className="px-4 py-2 flex justify-end">
                              {loading ? (
                                <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
                                  <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                  생성 중...
                                </div>
                              ) : (
                                <button onClick={() => generateStepInstagramImage(step, lang)}
                                  className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-white hover:opacity-80"
                                  style={{ background: gradient }}>
                                  📸 {btnText}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Pro Tips */}
            {recipe.proTips.length > 0 && (
              <div className="mt-6 bg-white rounded-3xl shadow-md p-6">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                  <span>👨‍🍳</span> 셰프의 프로 팁
                </h3>
                <div className="space-y-3">
                  {recipe.proTips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-orange-400 font-bold">{i + 1}.</span>
                      <span className="text-gray-600">{tip}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setActiveSection("summary");
                setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
              }}
              className="w-full mt-6 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>
              최종 요약 보기 →
            </button>
          </div>
        )}

        {/* =========== SUMMARY SECTION =========== */}
        {activeSection === "summary" && (
          <div className="fade-in-up" ref={summaryRef}>
            <SummaryCard
              recipe={recipe}
              summaryImage={summaryImage}
              summaryImageLoading={summaryImageLoading}
            />

            {/* Instagram Post Text Card */}
            <InstagramPostCard
              recipeName={recipe.name}
              post={instagramPost}
              loading={instagramPostLoading}
              copied={postCopied}
              onGenerate={generateInstagramPost}
              onCopy={async () => {
                if (!instagramPost) return;
                await navigator.clipboard.writeText(instagramPost);
                setPostCopied(true);
                setTimeout(() => setPostCopied(false), 2000);
              }}
            />

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => router.push("/")}
                className="flex-1 py-4 rounded-2xl font-bold text-base transition-all
                  border-2 border-orange-300 text-orange-600 hover:bg-orange-50">
                🏠 새 레시피 찾기
              </button>
              <button
                onClick={() => router.back()}
                className="flex-1 py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>
                ← 다른 레시피
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  recipe,
  summaryImage,
  summaryImageLoading,
}: {
  recipe: RecipeDetail;
  summaryImage: string | null;
  summaryImageLoading: boolean;
}) {
  return (
    <div className="rounded-3xl overflow-hidden shadow-2xl"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)" }}>
      {/* Imagen summary image */}
      <div className="relative w-full h-56 bg-gray-800">
        {summaryImage ? (
          <Image src={summaryImage} alt={recipe.name} fill className="object-cover" unoptimized />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <div className="text-5xl opacity-50">{recipe.emoji}</div>
            {summaryImageLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Imagen으로 완성 사진 생성 중...
              </div>
            )}
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(26,26,46,1) 100%)" }} />
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-2xl font-extrabold text-white drop-shadow">{recipe.name}</h2>
          <div className="flex gap-3 mt-1 text-sm text-white/70">
            <span>⏱ {recipe.totalTime}</span>
            <span>👤 {recipe.servings}인분</span>
            <span>📊 {recipe.difficulty}</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Summary text */}
        <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.07)" }}>
          <p className="text-sm leading-relaxed text-white/90">{recipe.summaryText}</p>
        </div>

        {/* Key ingredients */}
        <div>
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">주요 재료</h3>
          <div className="flex flex-wrap gap-2">
            {recipe.ingredients.slice(0, 8).map((ing) => (
              <span key={ing.name}
                className="px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{
                  background: ing.isOwned ? "rgba(74, 222, 128, 0.2)" : "rgba(251, 146, 60, 0.2)",
                  color: ing.isOwned ? "#4ade80" : "#fb923c",
                  border: `1px solid ${ing.isOwned ? "rgba(74,222,128,0.3)" : "rgba(251,146,60,0.3)"}`,
                }}>
                {ing.name} {ing.amount}{ing.unit}
              </span>
            ))}
          </div>
        </div>

        {/* Step-by-step condensed */}
        <div>
          <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">조리 순서</h3>
          <div className="space-y-2">
            {recipe.steps.map((step) => (
              <div key={step.number} className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${step.isKick ? "bg-orange-500 text-white" : "bg-white/10 text-white/60"}`}>
                  {step.number}
                </div>
                <div className="flex-1">
                  <span className={`text-sm font-semibold ${step.isKick ? "text-orange-400" : "text-white/80"}`}>
                    {step.title}
                  </span>
                  {step.isKick && <span className="ml-2 text-xs font-bold text-orange-400">⭐</span>}
                  {step.time && <span className="ml-1 text-xs text-white/40">({step.time})</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highlight */}
        <div className="p-4 rounded-2xl"
          style={{
            background: "linear-gradient(135deg, rgba(255,107,53,0.2), rgba(255,200,87,0.2))",
            border: "1px solid rgba(255,107,53,0.3)",
          }}>
          <p className="text-xs font-bold text-orange-400 mb-1">⭐ 핵심 포인트</p>
          <p className="text-sm text-white/90 font-medium">{recipe.highlight}</p>
        </div>

        {/* Pairings */}
        {recipe.pairings.length > 0 && (
          <div>
            <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-2">🤝 어울리는 음식</h3>
            <p className="text-sm text-white/70">{recipe.pairings.join(" · ")}</p>
          </div>
        )}

        <div className="text-center pt-2 pb-1">
          <span className="text-2xl">😋</span>
          <p className="text-sm text-white/60 mt-1">{recipe.taste}</p>
        </div>
      </div>
    </div>
  );
}

function InstagramPostCard({
  recipeName,
  post,
  loading,
  copied,
  onGenerate,
  onCopy,
}: {
  recipeName: string;
  post: string | null;
  loading: boolean;
  copied: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="mt-6 rounded-3xl overflow-hidden shadow-xl"
      style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
      <div className="p-px rounded-3xl">
        <div className="bg-white rounded-3xl overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3"
            style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
            <span className="text-2xl">✍️</span>
            <div>
              <p className="text-white font-extrabold text-sm">인스타 게시글 생성</p>
              <p className="text-white/80 text-xs">전체 레시피 포함 · 바로 복사해서 사용</p>
            </div>
          </div>

          <div className="p-5">
            {!post && !loading && (
              <button
                onClick={onGenerate}
                className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-95"
                style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
                ✨ 인스타 게시글 생성하기
              </button>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-3 py-10">
                <svg className="spinner w-8 h-8 text-pink-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm font-medium text-gray-500">게시글 작성 중...</p>
                <p className="text-xs text-gray-400">레시피를 분석하고 있어요</p>
              </div>
            )}

            {post && (
              <div className="space-y-3">
                <textarea
                  readOnly
                  value={post}
                  rows={18}
                  className="w-full text-sm text-gray-700 leading-relaxed p-4 rounded-2xl border resize-none focus:outline-none"
                  style={{ borderColor: "#e5e7eb", background: "#fafafa", fontFamily: "inherit" }}
                />
                <div className="flex gap-3">
                  <button
                    onClick={onCopy}
                    className="flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                    style={{ background: copied ? "linear-gradient(135deg,#16a34a,#15803d)" : "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
                    {copied ? "✅ 복사됨!" : "📋 전체 복사"}
                  </button>
                  <button
                    onClick={onGenerate}
                    className="px-5 py-3 rounded-2xl font-bold text-sm border-2 transition-all hover:bg-gray-50"
                    style={{ borderColor: "#fd1d1d", color: "#fd1d1d" }}>
                    🔄 재생성
                  </button>
                </div>
                <p className="text-xs text-center text-gray-400">
                  복사 후 인스타그램 앱에 바로 붙여넣기 하세요 · {recipeName}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RecipePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🍳</div>
          <p className="text-lg font-medium text-gray-600">로딩 중...</p>
        </div>
      </div>
    }>
      <RecipeDetailContent />
    </Suspense>
  );
}
