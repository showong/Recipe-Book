"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RecipeDetail } from "@/types/recipe";
import { Suspense } from "react";

interface TtsClip {
  stepNo: number;
  text: string;
  audioUrl: string | null;
  loading: boolean;
  error: string | null;
}

function CookModeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  const [character, setCharacter] = useState<string>("cute_bear");
  const [currentStep, setCurrentStep] = useState(0);
  const [clips, setClips] = useState<TtsClip[]>([]);
  const [showTip, setShowTip] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const data = searchParams.get("data");
    if (!data) { router.push("/"); return; }
    try {
      const parsed = JSON.parse(decodeURIComponent(data));
      const r: RecipeDetail = parsed.recipe;
      setRecipe(r);
      setCharacter(parsed.character ?? "cute_bear");
      setClips(
        r.steps.map((s) => ({
          stepNo: s.number,
          text: s.description,
          audioUrl: null,
          loading: false,
          error: null,
        })),
      );
    } catch {
      router.push("/");
    }
  }, [searchParams, router]);

  const toLegacy = (char: string) => {
    if (char === "lazy_bear" || char === "lazy") return "lazy";
    return "cute";
  };

  const generateClip = async (stepIndex: number) => {
    if (!recipe) return;
    const step = recipe.steps[stepIndex];

    setClips((prev) =>
      prev.map((c, i) => (i === stepIndex ? { ...c, loading: true, error: null } : c)),
    );

    try {
      const res = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: step.description,
          character: toLegacy(character),
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setClips((prev) =>
        prev.map((c, i) =>
          i === stepIndex ? { ...c, audioUrl: data.audioUrl, loading: false } : c,
        ),
      );

      if (audioRef.current && data.audioUrl) {
        audioRef.current.src = data.audioUrl;
        audioRef.current.play().catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "음성 생성 실패";
      setClips((prev) =>
        prev.map((c, i) => (i === stepIndex ? { ...c, error: msg, loading: false } : c)),
      );
    }
  };

  const goToStep = (index: number) => {
    setCurrentStep(index);
    setShowTip(false);
    if (!clips[index]?.audioUrl && !clips[index]?.loading) {
      generateClip(index);
    }
  };

  const playAudio = () => {
    const clip = clips[currentStep];
    if (clip?.audioUrl && audioRef.current) {
      audioRef.current.src = clip.audioUrl;
      audioRef.current.play().catch(() => {});
    }
  };

  if (!recipe) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(180deg, #1a1a2e, #0f3460)" }}>
        <div className="text-5xl animate-bounce">🍳</div>
      </div>
    );
  }

  const step = recipe.steps[currentStep];
  const clip = clips[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === recipe.steps.length - 1;
  const progress = ((currentStep + 1) / recipe.steps.length) * 100;

  return (
    <div className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
      <audio ref={audioRef} />

      {/* Header */}
      <div className="px-4 pt-safe pt-6 pb-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-white/70 hover:text-white text-sm font-medium">
          ← 돌아가기
        </button>
        <div className="flex-1" />
        <span className="text-white/50 text-sm truncate max-w-[160px]">{recipe.name}</span>
      </div>

      {/* Progress */}
      <div className="px-4 mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-white/70 text-xs font-medium">
            단계 {currentStep + 1} / {recipe.steps.length}
          </span>
          <span className="text-white/50 text-xs">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #ff6b35, #ffc857)",
            }}
          />
        </div>
        <div className="flex gap-1">
          {recipe.steps.map((_, i) => (
            <button
              key={i}
              onClick={() => goToStep(i)}
              className="flex-1 h-1.5 rounded-full transition-all"
              style={{
                background:
                  i === currentStep
                    ? "#ff6b35"
                    : i < currentStep
                    ? "#ffc857"
                    : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Card */}
      <div className="flex-1 px-4 overflow-y-auto pb-2">
        <div className="bg-white rounded-3xl p-6 shadow-2xl">
          {/* Step header */}
          <div className="flex items-start gap-3 mb-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                step.isKick ? "bg-orange-100" : "bg-gray-100"
              }`}>
              {step.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  className={`font-extrabold text-lg leading-tight ${
                    step.isKick ? "text-orange-600" : "text-gray-800"
                  }`}>
                  {step.title}
                </h2>
                {step.isKick && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-bold"
                    style={{ background: "#fff7ed", color: "#ea580c" }}>
                    ⭐ 핵심
                  </span>
                )}
                {step.time && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "#f3f4f6", color: "#6b7280" }}>
                    ⏱ {step.time}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-gray-700 leading-relaxed text-base mb-4">{step.description}</p>

          {step.isKick && step.kickReason && (
            <div
              className="mb-4 p-3 rounded-xl text-sm"
              style={{ background: "rgba(255,107,53,0.08)", color: "#c2410c" }}>
              💡 <span className="font-bold">포인트:</span> {step.kickReason}
            </div>
          )}

          {step.parallel && (
            <div
              className="mb-3 p-2.5 rounded-xl text-xs flex items-start gap-2"
              style={{ background: "#f0fdf4", color: "#16a34a" }}>
              <span className="text-base">⚡</span>
              <div>
                <span className="font-bold">시간 절약:</span> {step.parallel}
              </div>
            </div>
          )}

          {step.tip && (
            <>
              <button
                onClick={() => setShowTip((v) => !v)}
                className="w-full mb-2 p-3 rounded-xl text-sm font-medium text-left flex items-center justify-between"
                style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                <span>💡 요리 팁 {showTip ? "숨기기" : "보기"}</span>
                <span>{showTip ? "▲" : "▼"}</span>
              </button>
              {showTip && (
                <div
                  className="mb-3 p-3 rounded-xl text-sm"
                  style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                  {step.tip}
                </div>
              )}
            </>
          )}

          {/* Audio */}
          <div className="space-y-3 mt-2">
            {clip?.loading ? (
              <div
                className="flex items-center justify-center gap-3 py-5 rounded-2xl"
                style={{ background: "#f0f9ff" }}>
                <svg className="spinner w-5 h-5 text-sky-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-sky-600 font-medium">음성 안내 생성 중...</span>
              </div>
            ) : clip?.audioUrl ? (
              <div className="space-y-2">
                <audio controls src={clip.audioUrl} className="w-full" style={{ height: "48px" }} />
                <div className="flex gap-2">
                  <button
                    onClick={playAudio}
                    className="flex-1 py-3 rounded-2xl text-white font-bold text-sm"
                    style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                    🔁 다시 듣기
                  </button>
                  <button
                    onClick={() => generateClip(currentStep)}
                    className="px-4 py-3 rounded-2xl text-sm font-bold border-2"
                    style={{ borderColor: "#6366f1", color: "#6366f1" }}>
                    🔄
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => generateClip(currentStep)}
                className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                🎙️ 음성 안내 생성
              </button>
            )}
            {clip?.error && (
              <p className="text-xs text-red-500 px-1">⚠️ {clip.error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="px-4 py-5 pb-safe flex gap-3">
        <button
          onClick={() => !isFirst && goToStep(currentStep - 1)}
          disabled={isFirst}
          className="flex-1 py-4 rounded-2xl font-bold text-base transition-all disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.1)", color: "white" }}>
          ← 이전
        </button>
        {isLast ? (
          <button
            onClick={() => router.push("/")}
            className="flex-1 py-4 rounded-2xl font-bold text-base"
            style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)", color: "white" }}>
            🎉 완료!
          </button>
        ) : (
          <button
            onClick={() => goToStep(currentStep + 1)}
            className="flex-1 py-4 rounded-2xl font-bold text-base"
            style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)", color: "white" }}>
            다음 →
          </button>
        )}
      </div>
    </div>
  );
}

export default function CookModePage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: "linear-gradient(180deg, #1a1a2e, #0f3460)" }}>
          <div className="text-5xl">🍳</div>
        </div>
      }>
      <CookModeContent />
    </Suspense>
  );
}
