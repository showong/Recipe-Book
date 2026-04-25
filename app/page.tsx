"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE_INGREDIENTS = [
  "당근", "양파", "마늘", "달걀", "두부", "삼겹살",
  "닭가슴살", "감자", "시금치", "버섯", "대파", "김치",
];

const STYLE_OPTIONS = ["한식", "양식", "일식", "중식", "건강식", "간편식", "채식"];
const PAIRING_OPTIONS = ["밥", "면", "빵", "술", "국물", "샐러드"];
const TYPE_OPTIONS = ["찌개", "볶음", "파스타", "국", "구이", "튀김", "샐러드", "무침", "조림"];

export default function HomePage() {
  const router = useRouter();
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const [showOptions, setShowOptions] = useState(false);
  const [prefStyle, setPrefStyle] = useState("");
  const [prefPairing, setPrefPairing] = useState("");
  const [prefType, setPrefType] = useState("");
  const [characterVersion, setCharacterVersion] = useState<"cute" | "lazy">("cute");

  const addIngredient = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !ingredients.includes(trimmed)) {
      setIngredients((prev) => [...prev, trimmed]);
    }
    setInputValue("");
  };

  const removeIngredient = (item: string) => {
    setIngredients((prev) => prev.filter((i) => i !== item));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addIngredient(inputValue);
    } else if (e.key === "Backspace" && inputValue === "" && ingredients.length > 0) {
      setIngredients((prev) => prev.slice(0, -1));
    }
  };

  const toggleChip = (
    value: string,
    current: string,
    setter: (v: string) => void,
  ) => {
    setter(current === value ? "" : value);
  };

  const handleSubmit = async () => {
    if (ingredients.length === 0) {
      setError("재료를 하나 이상 입력해주세요!");
      return;
    }
    setIsLoading(true);
    setError("");

    const preferences = {
      style: prefStyle.trim() || undefined,
      pairing: prefPairing.trim() || undefined,
      type: prefType.trim() || undefined,
    };

    try {
      const response = await fetch("/api/generate-recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients, preferences, character: characterVersion }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "레시피 생성 실패");
      }

      const encoded = encodeURIComponent(JSON.stringify({
        recipes: data.recipes,
        ingredients,
        character: characterVersion,
      }));
      router.push(`/recipes?data=${encoded}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setIsLoading(false);
    }
  };

  const hasPreferences = prefStyle || prefPairing || prefType;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Header */}
      <div className="hero-gradient py-16 px-4 text-center text-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-6xl mb-4">🍳</div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 tracking-tight">
            냉장고 털기
          </h1>
          <p className="text-lg md:text-xl font-medium opacity-90">
            집에 있는 재료를 입력하면<br />AI가 맞춤 레시피를 추천해드려요
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        {/* Input Section */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 text-gray-700 flex items-center gap-2">
            <span>🛒</span> 보유 재료 입력
          </h2>

          {/* Tag Input */}
          <div
            className="tag-input-container cursor-text flex flex-wrap gap-2"
            onClick={() => inputRef.current?.focus()}
          >
            {ingredients.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
                style={{ background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa" }}
              >
                {item}
                <button
                  onClick={(e) => { e.stopPropagation(); removeIngredient(item); }}
                  className="ml-1 hover:text-red-600 transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={ingredients.length === 0 ? "재료 입력 후 Enter 또는 , 로 추가" : "재료 추가..."}
              className="flex-1 min-w-32 outline-none text-sm bg-transparent"
              style={{ minWidth: "120px" }}
            />
          </div>

          <p className="text-xs text-gray-400 mt-2">
            Enter 또는 쉼표(,)로 재료를 추가하세요 · Backspace로 마지막 재료 삭제
          </p>
        </div>

        {/* 캐릭터 선택 */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold mb-4 text-gray-700 flex items-center gap-2">
            <span>🐻</span> 캐릭터 선택
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {([
              {
                id: "cute" as const,
                emoji: "🐻",
                name: "귀여운 곰돌이",
                desc: "따뜻하고 친절한\n요리 가이드",
                accent: "#ea580c",
                bg: "#fff7ed",
                border: "#fed7aa",
              },
              {
                id: "lazy" as const,
                emoji: "🐨",
                name: "귀차니즘 곰돌이",
                desc: "노력 최소, 맛 최대\n효율 요리사",
                accent: "#4f46e5",
                bg: "#eef2ff",
                border: "#a5b4fc",
              },
            ] as const).map((ch) => (
              <button
                key={ch.id}
                onClick={() => setCharacterVersion(ch.id)}
                className="relative p-4 rounded-2xl border-2 text-left transition-all"
                style={{
                  borderColor: characterVersion === ch.id ? ch.accent : "#e5e7eb",
                  background: characterVersion === ch.id ? ch.bg : "white",
                }}
              >
                <div className="text-3xl mb-2">{ch.emoji}</div>
                <div className="font-bold text-sm" style={{ color: characterVersion === ch.id ? ch.accent : "#374151" }}>
                  {ch.name}
                </div>
                <div className="text-xs text-gray-400 mt-1 whitespace-pre-line">{ch.desc}</div>
                {characterVersion === ch.id && (
                  <span
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: ch.accent }}
                  >✓</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Quick Add Examples */}
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500 mb-3">빠른 추가</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_INGREDIENTS.map((item) => (
              <button
                key={item}
                onClick={() => {
                  if (!ingredients.includes(item)) {
                    setIngredients((prev) => [...prev, item]);
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all
                  ${ingredients.includes(item)
                    ? "bg-orange-100 text-orange-600 border border-orange-300"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-orange-300 hover:text-orange-600"
                  }`}
              >
                {ingredients.includes(item) ? "✓ " : ""}{item}
              </button>
            ))}
          </div>
        </div>

        {/* Optional Preferences */}
        <div className="mb-6">
          <button
            onClick={() => setShowOptions((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 rounded-2xl
              bg-white shadow-sm border transition-all hover:border-orange-200"
            style={{ borderColor: hasPreferences ? "#fed7aa" : "#f3f4f6" }}
          >
            <span className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: hasPreferences ? "#ea580c" : "#6b7280" }}>
              <span>⚙️</span>
              상세 옵션
              {hasPreferences && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa" }}>
                  {[prefStyle, prefPairing, prefType].filter(Boolean).length}개 선택됨
                </span>
              )}
            </span>
            <span className="text-gray-400 text-xs transition-transform"
              style={{ transform: showOptions ? "rotate(180deg)" : "rotate(0deg)" }}>
              ▼
            </span>
          </button>

          {showOptions && (
            <div className="mt-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
              {/* 스타일 */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  🍽️ 원하는 스타일
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {STYLE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => toggleChip(opt, prefStyle, setPrefStyle)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                      style={prefStyle === opt ? {
                        background: "linear-gradient(135deg, #ff6b35, #ffc857)",
                        color: "white",
                        border: "1px solid transparent",
                      } : {
                        background: "white",
                        color: "#6b7280",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={prefStyle}
                  onChange={(e) => setPrefStyle(e.target.value)}
                  placeholder="직접 입력 (예: 매콤한, 담백한, 퓨전...)"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all"
                  style={{ borderColor: prefStyle ? "#fed7aa" : "#e5e7eb" }}
                />
              </div>

              {/* 페어링 */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  🥂 페어링할 음식
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {PAIRING_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => toggleChip(opt, prefPairing, setPrefPairing)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                      style={prefPairing === opt ? {
                        background: "linear-gradient(135deg, #ff6b35, #ffc857)",
                        color: "white",
                        border: "1px solid transparent",
                      } : {
                        background: "white",
                        color: "#6b7280",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={prefPairing}
                  onChange={(e) => setPrefPairing(e.target.value)}
                  placeholder="직접 입력 (예: 맥주, 와인, 흰쌀밥...)"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all"
                  style={{ borderColor: prefPairing ? "#fed7aa" : "#e5e7eb" }}
                />
              </div>

              {/* 종류 */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  🍜 요리 종류
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => toggleChip(opt, prefType, setPrefType)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                      style={prefType === opt ? {
                        background: "linear-gradient(135deg, #ff6b35, #ffc857)",
                        color: "white",
                        border: "1px solid transparent",
                      } : {
                        background: "white",
                        color: "#6b7280",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={prefType}
                  onChange={(e) => setPrefType(e.target.value)}
                  placeholder="직접 입력 (예: 파스타, 찌개, 덮밥...)"
                  className="w-full px-4 py-2.5 rounded-xl text-sm border outline-none transition-all"
                  style={{ borderColor: prefType ? "#fed7aa" : "#e5e7eb" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm font-medium"
            style={{ background: "#fee2e2", color: "#dc2626" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || ingredients.length === 0}
          className="w-full py-4 rounded-2xl text-white text-lg font-bold transition-all
            disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: isLoading || ingredients.length === 0
              ? "#9ca3af"
              : "linear-gradient(135deg, #ff6b35, #ffc857)",
            boxShadow: ingredients.length > 0 && !isLoading
              ? "0 4px 20px rgba(255, 107, 53, 0.4)"
              : "none",
          }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-3">
              <svg className="spinner w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              AI가 레시피를 생성하는 중...
            </span>
          ) : (
            <span>🔍 레시피 {ingredients.length > 0 ? `${ingredients.length}가지 재료로 ` : ""}찾기</span>
          )}
        </button>

        {ingredients.length > 0 && (
          <p className="text-center text-sm text-gray-400 mt-3">
            {ingredients.length}가지 재료로 3가지 레시피를 추천받아요
          </p>
        )}

        {/* How it works */}
        <div className="mt-12 grid grid-cols-3 gap-4">
          {[
            { emoji: "🥕", title: "재료 입력", desc: "냉장고 속 재료를\n입력하세요" },
            { emoji: "🤖", title: "AI 분석", desc: "클로드 AI가\n레시피를 추천해요" },
            { emoji: "👨‍🍳", title: "요리 시작", desc: "단계별 가이드로\n쉽게 따라해요" },
          ].map((item, i) => (
            <div key={i} className="text-center p-4 bg-white rounded-2xl shadow-sm">
              <div className="text-3xl mb-2">{item.emoji}</div>
              <div className="font-bold text-sm text-gray-700">{item.title}</div>
              <div className="text-xs text-gray-400 mt-1 whitespace-pre-line">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
