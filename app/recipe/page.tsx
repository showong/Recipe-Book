"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RecipeDetail, RecipeStep } from "@/types/recipe";
import { Suspense } from "react";
import Image from "next/image";

// ── 여러 음성 URL을 디코드해 하나의 WAV 파일로 이어붙인다 ─────────────────────
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const dataSize = samples.length * 2;
  const ab = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);   // PCM
  view.setUint16(22, 1, true);   // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([ab], { type: "audio/wav" });
}

// 단계별 음성(mp3 data URL 또는 다운로드 URL)을 순서대로 디코드해, 사이에 무음
// 간격(gapSec)을 두고 하나의 모노 WAV 로 합친다. 브라우저에서 바로 재생 가능.
async function mergeAudioUrlsToWav(urls: string[], gapSec = 0.5): Promise<Blob> {
  const ctx = new AudioContext();
  try {
    const buffers: AudioBuffer[] = [];
    for (const url of urls) {
      const arr = await (await fetch(url)).arrayBuffer();
      buffers.push(await ctx.decodeAudioData(arr));
    }
    const sampleRate = ctx.sampleRate;
    const gap = Math.round(gapSec * sampleRate);
    const total = buffers.reduce(
      (sum, b, i) => sum + b.length + (i < buffers.length - 1 ? gap : 0),
      0,
    );
    const out = ctx.createBuffer(1, Math.max(1, total), sampleRate);
    const data = out.getChannelData(0);
    let offset = 0;
    for (let i = 0; i < buffers.length; i++) {
      const b = buffers[i];
      const ch0 = b.getChannelData(0);
      if (b.numberOfChannels > 1) {
        const ch1 = b.getChannelData(1);
        for (let s = 0; s < b.length; s++) data[offset + s] = (ch0[s] + ch1[s]) / 2;
      } else {
        data.set(ch0, offset);
      }
      offset += b.length + (i < buffers.length - 1 ? gap : 0);
    }
    return audioBufferToWav(out);
  } finally {
    await ctx.close();
  }
}

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
  // 인스타 게시글 텍스트 (한국어 / 영어)
  const [instagramPost, setInstagramPost] = useState<string | null>(null);
  const [instagramPostLoading, setInstagramPostLoading] = useState(false);
  const [postCopied, setPostCopied] = useState(false);
  const [instagramPostEn, setInstagramPostEn] = useState<string | null>(null);
  const [instagramPostEnLoading, setInstagramPostEnLoading] = useState(false);
  const [postEnCopied, setPostEnCopied] = useState(false);
  // 릴스 썸네일
  const [reelUploadedImage, setReelUploadedImage] = useState<string | null>(null);
  const [reelIsVideo, setReelIsVideo] = useState(false);
  const [reelThumbnail, setReelThumbnail] = useState<string | null>(null);
  const [reelThumbnailLoading, setReelThumbnailLoading] = useState(false);
  const [reelVideoThumbnailUrl, setReelVideoThumbnailUrl] = useState<string | null>(null);
  const [reelVideoConverting, setReelVideoConverting] = useState(false);
  const [reelStyleName, setReelStyleName] = useState<string | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<number | null>(null);
  // 훅 멘트 TTS
  const [hookMentLoading, setHookMentLoading] = useState(false);
  const [hookMentAudioUrl, setHookMentAudioUrl] = useState<string | null>(null);
  const [hookMentError, setHookMentError] = useState<string | null>(null);
  // 상세 레시피 가이드 이미지 (gpt-image-2)
  const [recipeGuideImage, setRecipeGuideImage] = useState<string | null>(null);
  const [recipeGuideLoading, setRecipeGuideLoading] = useState(false);
  const [recipeGuideError, setRecipeGuideError] = useState<string | null>(null);
  // 실제 완성 요리 사진 — 업로드되어야 이미지 저장/영상 생성이 활성화된다
  const [finishedDishImage, setFinishedDishImage] = useState<string | null>(null);
  const [finishedUploadStatus, setFinishedUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [finishedUploadError, setFinishedUploadError] = useState<string | null>(null);
  // 저장된 레시피 ID — app/recipes/page.tsx 가 POST /api/recipes 저장 후 전달
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);
  // 가이드 이미지 + TTS 음성 게시물 영상 (정지 이미지, 릴스 아님)
  const [guidePostUrl, setGuidePostUrl] = useState<string | null>(null);
  const [guidePostBlob, setGuidePostBlob] = useState<Blob | null>(null);
  const [guidePostExt, setGuidePostExt] = useState<"mp4" | "webm">("mp4");
  const [guidePostLoading, setGuidePostLoading] = useState(false);
  const [guidePostProgress, setGuidePostProgress] = useState(0);
  const [guidePostError, setGuidePostError] = useState<string | null>(null);
  // 훅 멘트 영상 클립 (영상 편집용)
  const [hookMentVideoUrl, setHookMentVideoUrl] = useState<string | null>(null);
  // 릴스 최종 편집 영상
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [finalVideoExt, setFinalVideoExt] = useState<"mp4" | "webm">("mp4");
  const [finalVideoBlob, setFinalVideoBlob] = useState<Blob | null>(null);
  const [finalVideoLoading, setFinalVideoLoading] = useState(false);
  const [finalVideoProgress, setFinalVideoProgress] = useState(0);
  // Telegram 전송 상태
  const [telegramStatus, setTelegramStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [telegramError, setTelegramError] = useState<string | null>(null);
  // TTS (스텝별) — 자동 생성 후 하나의 음성으로 병합한다. 단계별 URL 은
  // 게시물/릴스 영상 합성에서 계속 사용하므로 유지한다.
  const [ttsAudioUrls, setTtsAudioUrls] = useState<Record<number, string>>({});
  const [ttsTexts, setTtsTexts] = useState<Record<number, string>>({});
  const [ttsErrors, setTtsErrors] = useState<Record<number, string>>({});
  // 자동 음성 생성 파이프라인 상태
  const [stepTtsPhase, setStepTtsPhase] = useState<"idle" | "generating" | "merging" | "done" | "error">("idle");
  const [stepTtsProgress, setStepTtsProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [stepTtsError, setStepTtsError] = useState<string | null>(null);
  const [mergedAudioUrl, setMergedAudioUrl] = useState<string | null>(null);
  const stepTtsStartedRef = useRef(false);
  // 조리 단계 뷰어 — 한 번에 한 단계씩 집중해서 보여준다
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  // 게시글 커버 이미지 (1:1)
  const [postCoverImage, setPostCoverImage] = useState<string | null>(null);
  const [postCoverLoading, setPostCoverLoading] = useState(false);
  const [postCoverError, setPostCoverError] = useState<string | null>(null);
  const [postCoverStyleName, setPostCoverStyleName] = useState<string | null>(null);
  // 영문 게시글 커버 이미지 (1:1)
  const [postCoverEnImage, setPostCoverEnImage] = useState<string | null>(null);
  const [postCoverEnLoading, setPostCoverEnLoading] = useState(false);
  const [postCoverEnError, setPostCoverEnError] = useState<string | null>(null);
  const [postCoverEnStyleName, setPostCoverEnStyleName] = useState<string | null>(null);
  // 캐릭터 버전
  const [characterVersion, setCharacterVersion] = useState<string>("cute_bear");
  // 구매 필요 재료 — 네이버 쇼핑 인라인 상품 카드
  type NaverProduct = { title: string; link: string; image: string; price: number; mallName: string };
  const [productResults, setProductResults] = useState<Record<string, NaverProduct[] | "loading" | "none">>({});
  const [expandedIngredient, setExpandedIngredient] = useState<string | null>(null);

  // 페이로드는 sessionStorage에서 한 번만 소비한다. effect가 재실행되면
  // (Strict Mode 이중 호출 등) 이미 제거된 키를 읽어 홈으로 튕기므로 가드한다.
  const payloadConsumed = useRef(false);

  useEffect(() => {
    if (payloadConsumed.current) return;
    payloadConsumed.current = true;

    // 큰 페이로드는 sessionStorage(key)로, 작은 경우만 URL(data)로 전달된다.
    const payloadKey = searchParams.get("key");
    const data = payloadKey
      ? sessionStorage.getItem(payloadKey)
      : searchParams.get("data");
    if (!data) {
      router.push("/");
      return;
    }
    if (payloadKey) sessionStorage.removeItem(payloadKey);
    try {
      const parsed = JSON.parse(
        payloadKey ? data : decodeURIComponent(data),
      );
      setRecipe(parsed.recipe);
      setIngredients(parsed.ingredients || []);
      setCharacterVersion(parsed.character ?? "cute_bear");
      if (parsed.savedRecipeId) setSavedRecipeId(parsed.savedRecipeId);
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
      setStepImages((prev) => { const n = { ...prev }; delete n[step.number]; return n; });
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
          character: characterVersion,
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

  const generateInstagramPost = async (lang: "ko" | "en" = "ko") => {
    if (!recipe) return;
    if (lang === "en") {
      setInstagramPostEn(null);
      setInstagramPostEnLoading(true);
    } else {
      setInstagramPost(null);
      setInstagramPostLoading(true);
    }
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe, language: lang, character: characterVersion }),
      });
      const data = await res.json();
      if (data.post) {
        if (lang === "en") setInstagramPostEn(data.post);
        else setInstagramPost(data.post);
      }
    } catch {
      // silently fail
    } finally {
      if (lang === "en") setInstagramPostEnLoading(false);
      else setInstagramPostLoading(false);
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

  const cropImageToRatio = (dataUrl: string, targetW: number, targetH: number): Promise<string> =>
    new Promise((resolve) => {
      const img = document.createElement("img");
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const targetRatio = targetW / targetH;
        const imgRatio = img.naturalWidth / img.naturalHeight;
        let sx = 0, sy = 0;
        let sw = img.naturalWidth, sh = img.naturalHeight;
        if (imgRatio > targetRatio) {
          sw = Math.round(img.naturalHeight * targetRatio);
          sx = Math.round((img.naturalWidth - sw) / 2);
        } else if (imgRatio < targetRatio) {
          sh = Math.round(img.naturalWidth / targetRatio);
          sy = Math.round((img.naturalHeight - sh) / 2);
        }
        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        resolve(canvas.toDataURL("image/png", 0.95));
      };
      img.src = dataUrl;
    });

  // 동영상에서 대표 프레임 추출 (JPEG base64)
  const extractVideoFrame = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.muted = true;
      video.preload = "metadata";
      video.onloadeddata = () => { video.currentTime = Math.min(video.duration * 0.1, 1); };
      video.onseeked = () => {
        const MAX = 1024;
        const scale = Math.min(1, MAX / Math.max(video.videoWidth, video.videoHeight));
        const w = Math.round(video.videoWidth * scale);
        const h = Math.round(video.videoHeight * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { URL.revokeObjectURL(url); reject(new Error("canvas unavailable")); return; }
        ctx.drawImage(video, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("동영상 로드 실패")); };
      video.src = url;
    });

  // AI 썸네일 이미지로 켄번스 애니메이션 WebM 생성
  const createAnimatedThumbnail = (imageDataUrl: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const W = 540, H = 960, DURATION = 5;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }

      const img = document.createElement("img");
      img.onload = () => {
        const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
          .find((m) => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
        const stream = canvas.captureStream(24);
        const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_500_000 });
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () =>
          resolve(URL.createObjectURL(new Blob(chunks, { type: mime.split(";")[0] })));
        recorder.onerror = () => reject(new Error("MediaRecorder 오류"));

        recorder.start(200);
        const t0 = performance.now();
        const frame = () => {
          const elapsed = (performance.now() - t0) / 1000;
          if (elapsed >= DURATION) { recorder.stop(); return; }
          const p = elapsed / DURATION;
          const scale = 1 + p * 0.06; // 켄번스: 서서히 줌인
          ctx.save();
          ctx.translate(W / 2, H / 2);
          ctx.scale(scale, scale);
          ctx.drawImage(img, -W / 2, -H / 2, W, H);
          ctx.restore();
          requestAnimationFrame(frame);
        };
        frame();
      };
      img.onerror = () => reject(new Error("이미지 로드 실패"));
      img.src = imageDataUrl;
    });

  const generateHookMent = async () => {
    if (!recipe) return;
    setHookMentLoading(true);
    setHookMentAudioUrl(null);
    setHookMentError(null);
    try {
      const kickPoints = recipe.steps
        .filter((s) => s.isKick && s.kickReason)
        .map((s) => s.kickReason)
        .join(" / ");
      const res = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "hook",
          recipeName: recipe.name,
          highlight: recipe.highlight,
          taste: recipe.taste,
          kickPoints,
          pairings: (recipe.pairings ?? []).slice(0, 2).join(", "),
          character: characterVersion,
        }),
      });
      const data = await res.json();
      if (data.error) setHookMentError(data.error);
      else if (data.audioUrl) setHookMentAudioUrl(data.audioUrl);
    } catch (err) {
      setHookMentError(err instanceof Error ? err.message : "훅 멘트 생성 실패");
    } finally {
      setHookMentLoading(false);
    }
  };

  // 모든 단계 음성을 생성한 뒤, 첨부 예시와 같은 일러스트 상세 레시피 이미지를 생성한다.
  const generateRecipeGuide = async () => {
    if (!recipe) return;
    setRecipeGuideLoading(true);
    setRecipeGuideError(null);
    setRecipeGuideImage(null);
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipe.name,
          type: "recipe-guide",
          steps: recipe.steps.map((s) => ({ number: s.number, title: s.title, description: s.description })),
          proTips: recipe.proTips,
          highlight: recipe.highlight,
          servings: recipe.servings,
          cookingTime: recipe.totalTime,
          character: characterVersion,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setRecipeGuideError(data.error);
      } else if (data.imageUrl) {
        setRecipeGuideImage(data.imageUrl);
        // 생성된 상세 레시피 이미지를 관리자 영상 합성용으로 자동 저장
        if (savedRecipeId) {
          try {
            await fetch(`/api/recipes?id=${encodeURIComponent(savedRecipeId)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ detailImage: data.imageUrl }),
            });
          } catch {
            // 저장 실패는 UI에 표시하지 않음 (이미지 자체는 이미 생성됨)
          }
        }
      } else {
        setRecipeGuideError("이미지를 생성하지 못했습니다.");
      }
    } catch (err) {
      setRecipeGuideError(err instanceof Error ? err.message : "이미지 생성 실패");
    } finally {
      setRecipeGuideLoading(false);
    }
  };

  // 가이드 이미지를 정지 화면으로 노출하면서 모든 TTS 음성을 이어 재생하는
  // 게시물(피드)용 영상을 만든다. 릴스와 달리 화면 전환·자막이 없다.
  const createGuidePostVideo = async () => {
    if (!recipe || !recipeGuideImage || !finishedDishImage) return;
    setGuidePostLoading(true);
    setGuidePostProgress(0);
    setGuidePostError(null);
    if (guidePostUrl) URL.revokeObjectURL(guidePostUrl);
    setGuidePostUrl(null);
    setGuidePostBlob(null);

    // 4:5 세로 (인스타 피드 최대 세로비). 가이드 이미지(3:4)는 잘림 없이 contain.
    const CANVAS_W = 1080, CANVAS_H = 1350;
    const BG = "#E8F0DD"; // 가이드 배경(세이지 그린)과 어울리는 레터박스 색
    const GAP = 0.35;     // 음성 사이 간격(초)

    try {
      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const el = new window.Image();
          el.onload = () => res(el);
          el.onerror = rej;
          el.src = src;
        });
      const decodeAudio = async (url: string, ctx: AudioContext): Promise<AudioBuffer> => {
        const buf = await (await fetch(url)).arrayBuffer();
        return ctx.decodeAudioData(buf);
      };

      const guideImg = await loadImg(recipeGuideImage);

      // 재생 순서: 훅 멘트(있으면) → 단계별 음성(번호순)
      const audioUrls: string[] = [];
      if (hookMentAudioUrl) audioUrls.push(hookMentAudioUrl);
      [...recipe.steps]
        .sort((a, b) => a.number - b.number)
        .forEach((s) => { if (ttsAudioUrls[s.number]) audioUrls.push(ttsAudioUrls[s.number]); });
      if (audioUrls.length === 0) throw new Error("재생할 음성이 없습니다. 단계 음성을 먼저 생성해주세요.");

      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();

      const scheduled: { buf: AudioBuffer; start: number }[] = [];
      let cursor = 0;
      for (const url of audioUrls) {
        const buf = await decodeAudio(url, audioCtx);
        scheduled.push({ buf, start: cursor });
        cursor += buf.duration + GAP;
      }
      const totalDur = cursor + 0.4; // 마지막 음성 뒤 여운

      // 캔버스: 가이드 이미지를 contain 배치 (전체가 보이도록)
      const canvas = document.createElement("canvas");
      canvas.width = CANVAS_W; canvas.height = CANVAS_H;
      const ctx2d = canvas.getContext("2d")!;
      ctx2d.imageSmoothingEnabled = true;
      ctx2d.imageSmoothingQuality = "high";

      const iw = guideImg.naturalWidth, ih = guideImg.naturalHeight;
      const scale = Math.min(CANVAS_W / iw, CANVAS_H / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = (CANVAS_W - dw) / 2, dy = (CANVAS_H - dh) / 2;
      const drawFrame = () => {
        ctx2d.fillStyle = BG;
        ctx2d.fillRect(0, 0, CANVAS_W, CANVAS_H);
        ctx2d.drawImage(guideImg, dx, dy, dw, dh);
      };
      drawFrame();

      // 외부 플레이어 호환을 위해 명시적 AAC 코덱(mp4a) 우선 → webm 폴백
      const candidateConfigs = [
        { mimeType: "video/mp4;codecs=avc1.640029,mp4a.40.2", videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
        { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
        { mimeType: "video/mp4;codecs=avc1,mp4a",             videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
        { mimeType: "video/webm;codecs=vp9,opus",             videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
        { mimeType: "video/webm;codecs=vp8,opus",             videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 128_000 },
        { mimeType: "video/webm",                             videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 128_000 },
      ].filter((c) => MediaRecorder.isTypeSupported(c.mimeType));
      if (candidateConfigs.length === 0) candidateConfigs.push({ mimeType: "video/webm", videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 128_000 });
      const chosenConfig = candidateConfigs[0];
      const ext: "mp4" | "webm" = chosenConfig.mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      setGuidePostExt(ext);

      const combined = new MediaStream([
        ...canvas.captureStream(30).getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      const recorder = new MediaRecorder(combined, chosenConfig);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      const stopPromise = new Promise<void>((res, rej) => {
        recorder.onstop = () => res();
        recorder.onerror = (e) => rej(new Error(`MediaRecorder 오류: ${(e as { error?: { message?: string } }).error?.message ?? "Unknown"}`));
      });

      await audioCtx.resume();
      const START_DELAY = 0.2;
      const t0 = audioCtx.currentTime + START_DELAY;
      for (const s of scheduled) {
        const src = audioCtx.createBufferSource();
        src.buffer = s.buf;
        src.connect(dest);
        src.start(t0 + s.start);
      }

      recorder.start(100);
      await new Promise<void>((resolve) => {
        const wallStart = performance.now();
        const safetyTimer = setTimeout(resolve, (START_DELAY + totalDur + 5) * 1000);
        const animate = () => {
          const elapsed = (performance.now() - wallStart) / 1000 - START_DELAY;
          if (elapsed >= totalDur + 0.3) { clearTimeout(safetyTimer); resolve(); return; }
          setGuidePostProgress(Math.round(Math.max(0, Math.min(99, (Math.max(0, elapsed) / totalDur) * 100))));
          drawFrame(); // 정지 이미지 — 매 프레임 동일하게 그려 캡처 스트림 유지
          requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      });

      recorder.stop();
      await stopPromise;
      const blob = new Blob(chunks, { type: chosenConfig.mimeType });
      setGuidePostUrl(URL.createObjectURL(blob));
      setGuidePostBlob(blob);
      setGuidePostProgress(100);
      await audioCtx.close();
    } catch (err) {
      setGuidePostError(err instanceof Error ? err.message : "게시물 영상 생성 실패");
    } finally {
      setGuidePostLoading(false);
    }
  };

  const generateReelThumbnail = async () => {
    if (!recipe || !reelUploadedImage) return;
    setReelThumbnailLoading(true);
    setReelThumbnail(null);
    setReelVideoThumbnailUrl(null);
    setReelStyleName(null);
    try {
      const matches = reelUploadedImage.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) return;
      const mimeType = matches[1];
      const base64Data = matches[2];
      const kickPoints = recipe.steps
        .filter((s) => s.isKick && s.kickReason)
        .map((s) => s.kickReason)
        .join(" / ");
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipe.name,
          type: "reel-thumbnail",
          uploadedImageBase64: base64Data,
          uploadedImageMimeType: mimeType,
          highlight: recipe.highlight,
          cookingTime: recipe.totalTime,
          servings: recipe.servings,
          taste: recipe.taste,
          pairings: recipe.pairings,
          kickPoints,
          character: characterVersion,
          styleId: selectedStyleId,
        }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        const cropped = await cropImageToRatio(data.imageUrl, 1080, 1920);
        setReelThumbnail(cropped);
        if (data.styleName) setReelStyleName(data.styleName);
        // 동영상 업로드 시: AI 이미지로 애니메이션 WebM 생성 (백그라운드)
        if (reelIsVideo) {
          setReelVideoConverting(true);
          createAnimatedThumbnail(cropped)
            .then(setReelVideoThumbnailUrl)
            .catch(console.error)
            .finally(() => setReelVideoConverting(false));
        }
      }
    } catch {
      // silently fail
    } finally {
      setReelThumbnailLoading(false);
    }
  };

  const generatePostCover = async () => {
    if (!recipe || !reelUploadedImage) return;
    setPostCoverLoading(true);
    setPostCoverImage(null);
    setPostCoverError(null);
    setPostCoverStyleName(null);
    try {
      const matches = reelUploadedImage.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) { setPostCoverError("이미지 형식 오류입니다."); return; }
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipe.name,
          type: "post-cover",
          uploadedImageBase64: matches[2],
          uploadedImageMimeType: matches[1],
          highlight: recipe.highlight,
          taste: recipe.taste,
          pairings: recipe.pairings,
          character: characterVersion,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setPostCoverError(data.error);
      } else if (data.imageUrl) {
        const cropped = await cropImageToRatio(data.imageUrl, 1080, 1080);
        setPostCoverImage(cropped);
        if (data.styleName) setPostCoverStyleName(data.styleName);
      }
    } catch (err) {
      setPostCoverError(err instanceof Error ? err.message : "이미지 생성에 실패했습니다.");
    } finally {
      setPostCoverLoading(false);
    }
  };

  const generatePostCoverEn = async () => {
    if (!recipe || !reelUploadedImage) return;
    setPostCoverEnLoading(true);
    setPostCoverEnImage(null);
    setPostCoverEnError(null);
    setPostCoverEnStyleName(null);
    try {
      const matches = reelUploadedImage.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) { setPostCoverEnError("이미지 형식 오류입니다."); return; }
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipe.name,
          type: "post-cover-en",
          uploadedImageBase64: matches[2],
          uploadedImageMimeType: matches[1],
          highlight: recipe.highlight,
          taste: recipe.taste,
          pairings: recipe.pairings,
          character: characterVersion,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setPostCoverEnError(data.error);
      } else if (data.imageUrl) {
        const cropped = await cropImageToRatio(data.imageUrl, 1080, 1080);
        setPostCoverEnImage(cropped);
        if (data.styleName) setPostCoverEnStyleName(data.styleName);
      }
    } catch (err) {
      setPostCoverEnError(err instanceof Error ? err.message : "이미지 생성에 실패했습니다.");
    } finally {
      setPostCoverEnLoading(false);
    }
  };

  const downloadPackage = (lang: "ko" | "en") => {
    if (!recipe) return;
    const name = recipe.name;
    const isEn = lang === "en";
    const items: { url: string; filename: string }[] = [];

    if (isEn) {
      if (ingredientsImageEn) items.push({ url: ingredientsImageEn, filename: `${name}-ingredients-en.png` });
      Object.entries(stepImagesEn).forEach(([num, url]) =>
        items.push({ url: url as string, filename: `${name}-step${num}-en.png` })
      );
      if (kickInstagramImageEn) items.push({ url: kickInstagramImageEn, filename: `${name}-kick-en.png` });
    } else {
      if (ingredientsImage) items.push({ url: ingredientsImage, filename: `${name}-ingredients-ko.png` });
      Object.entries(stepImages).forEach(([num, url]) =>
        items.push({ url: url as string, filename: `${name}-step${num}-ko.png` })
      );
      if (kickInstagramImage) items.push({ url: kickInstagramImage, filename: `${name}-kick-ko.png` });
    }
    if (summaryImage) items.push({ url: summaryImage, filename: `${name}-summary.png` });

    items.forEach(({ url, filename }, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
      }, i * 300);
    });

    const post = isEn ? instagramPostEn : instagramPost;
    if (post) {
      setTimeout(() => {
        const blob = new Blob([post], { type: "text/plain;charset=utf-8" });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = `${name}-instagram-post-${lang}.txt`;
        a.click();
        URL.revokeObjectURL(blobUrl);
      }, items.length * 300);
    }
  };

  const generateStepTts = async (step: RecipeStep): Promise<string | null> => {
    const num = step.number;
    setTtsErrors((p) => ({ ...p, [num]: "" }));
    try {
      // 순수 조리 설명만 구어체 변환 — 팁·포인트 등 부수 내용 제외
      const text = step.description;
      const res = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, character: characterVersion }),
      });
      const data = await res.json();
      if (data.error) {
        setTtsErrors((p) => ({ ...p, [num]: data.error }));
        return null;
      }
      setTtsAudioUrls((p) => ({ ...p, [num]: data.audioUrl }));
      if (data.speechText) setTtsTexts((p) => ({ ...p, [num]: data.speechText }));
      return (data.audioUrl as string) ?? null;
    } catch (err) {
      setTtsErrors((p) => ({ ...p, [num]: err instanceof Error ? err.message : "음성 생성 실패" }));
      return null;
    }
  };

  // 조리법 화면 진입 시 모든 단계 음성을 자동으로(1초 간격) 생성한 뒤,
  // 하나의 음성 파일로 병합한다. 버튼 없이 백그라운드에서 진행된다.
  const runStepTtsPipeline = async () => {
    if (!recipe) return;
    const steps = [...recipe.steps].sort((a, b) => a.number - b.number);
    if (steps.length === 0) return;

    setStepTtsError(null);
    setMergedAudioUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    setStepTtsPhase("generating");
    setStepTtsProgress({ current: 0, total: steps.length });

    const collected: { number: number; url: string }[] = [];
    for (let i = 0; i < steps.length; i++) {
      setStepTtsProgress({ current: i + 1, total: steps.length });
      const url = await generateStepTts(steps[i]);
      if (url) collected.push({ number: steps[i].number, url });
      // 각 음성 사이 1초 간격 (마지막 단계 제외)
      if (i < steps.length - 1) await new Promise((r) => setTimeout(r, 1000));
    }

    if (collected.length === 0) {
      setStepTtsError("음성 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setStepTtsPhase("error");
      stepTtsStartedRef.current = false; // 재시도 허용
      return;
    }

    try {
      setStepTtsPhase("merging");
      const ordered = collected.sort((a, b) => a.number - b.number).map((c) => c.url);
      const blob = await mergeAudioUrlsToWav(ordered, 0.5);
      setMergedAudioUrl(URL.createObjectURL(blob));
      setStepTtsPhase("done");
    } catch (err) {
      setStepTtsError(err instanceof Error ? err.message : "음성 병합에 실패했습니다.");
      setStepTtsPhase("error");
      stepTtsStartedRef.current = false; // 재시도 허용
    }
  };

  const retryStepTts = () => {
    stepTtsStartedRef.current = true;
    void runStepTtsPipeline();
  };

  // 조리법 탭을 처음 열면 음성 자동 생성을 1회 시작한다.
  useEffect(() => {
    if (activeSection !== "steps" || !recipe) return;
    if (stepTtsStartedRef.current) return;
    stepTtsStartedRef.current = true;
    void runStepTtsPipeline();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, recipe]);

  // hover 시 해당 재료 상품을 lazy fetch한다.
  const fetchProductsForIngredient = (ingName: string) => {
    if (productResults[ingName]) return; // 이미 검색됨
    setProductResults((prev) => ({ ...prev, [ingName]: "loading" }));
    fetch(`/api/search-products?query=${encodeURIComponent(ingName)}`)
      .then((r) => r.json())
      .then((data: { products?: NaverProduct[] }) => {
        const products = data.products ?? [];
        setProductResults((prev) => ({
          ...prev,
          [ingName]: products.length > 0 ? products : "none",
        }));
      })
      .catch(() => {
        setProductResults((prev) => ({ ...prev, [ingName]: "none" }));
      });
  };

  const handleReelImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReelThumbnail(null);
    setReelVideoThumbnailUrl(null);
    setPostCoverImage(null);
    setPostCoverError(null);
    setPostCoverEnImage(null);
    setPostCoverEnError(null);

    const isVideo = file.type.startsWith("video/");
    setReelIsVideo(isVideo);

    if (isVideo) {
      // 동영상: 대표 프레임 추출해서 미리보기로 사용
      extractVideoFrame(file)
        .then(setReelUploadedImage)
        .catch(() => setReelUploadedImage(null));
      return;
    }

    // 이미지: 기존 압축 로직
    const objectUrl = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      setReelUploadedImage(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => URL.revokeObjectURL(objectUrl);
    img.src = objectUrl;
  };

  // ── 실제 완성 요리 사진 업로드 ────────────────────────────────────────────────
  // 가이드 이미지 저장과 게시물 영상 생성은 이 사진이 업로드된 뒤에만 활성화된다.
  // 사진이 준비되면 서버(PATCH /api/recipes)에도 저장해 관리자 쇼츠 썸네일로 활용한다.
  const patchFinishedImage = async (dataUrl: string) => {
    if (!savedRecipeId) return; // 저장된 레시피 ID가 없으면 서버 저장 생략
    setFinishedUploadStatus("uploading");
    setFinishedUploadError(null);
    try {
      const res = await fetch(`/api/recipes?id=${encodeURIComponent(savedRecipeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finishedImage: dataUrl }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "서버 저장 실패");
      setFinishedUploadStatus("done");
    } catch (err) {
      setFinishedUploadStatus("error");
      setFinishedUploadError(err instanceof Error ? err.message : "서버 저장 실패");
    }
  };

  const handleFinishedDishUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setFinishedUploadStatus("idle");
    setFinishedUploadError(null);
    const objectUrl = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 1280;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setFinishedDishImage(dataUrl);
      void patchFinishedImage(dataUrl);
    };
    img.onerror = () => URL.revokeObjectURL(objectUrl);
    img.src = objectUrl;
  };

  // ── 훅 멘트 영상 업로드 ───────────────────────────────────────────────────────
  const handleHookMentVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("video/")) return;
    if (hookMentVideoUrl) URL.revokeObjectURL(hookMentVideoUrl);
    setHookMentVideoUrl(URL.createObjectURL(file));
  };

  // ── Telegram 전송 ─────────────────────────────────────────────────────────────
  const sendToTelegram = async (blob: Blob, ext: string) => {
    setTelegramStatus("sending");
    setTelegramError(null);
    try {
      const fd = new FormData();
      fd.append("video", blob, `${recipe?.name ?? "reels"}.${ext}`);
      if (instagramPost)   fd.append("postText", instagramPost);
      else if (instagramPostEn) fd.append("postText", instagramPostEn);

      const res  = await fetch("/api/send-telegram", { method: "POST", body: fd });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setTelegramStatus("error");
        setTelegramError(data.error ?? "전송 실패");
      } else {
        setTelegramStatus("done");
      }
    } catch (e) {
      setTelegramStatus("error");
      setTelegramError(e instanceof Error ? e.message : "네트워크 오류");
    }
  };

  // ── 릴스 최종 영상 편집 ───────────────────────────────────────────────────────
  const createFinalVideo = async () => {
    if (!recipe) return;
    setFinalVideoLoading(true);
    setFinalVideoProgress(0);
    setTelegramStatus("idle");
    setTelegramError(null);
    if (finalVideoUrl) URL.revokeObjectURL(finalVideoUrl);
    setFinalVideoUrl(null);
    setFinalVideoBlob(null);

    const CANVAS_W  = 1080;
    const CANVAS_H  = 1920;
    const IMG_SIZE  = 1080;                          // 1:1 이미지 (가로 꽉 채움)
    const SCALE     = CANVAS_W / 540;                // 기준(540p) 대비 배율 = 2
    const BLACK_ALL = CANVAS_H - IMG_SIZE;          // 총 검은 공간 840px
    const TOP_BLACK = Math.round(BLACK_ALL * 0.3);  // 상단 30% = 252px
    const IMG_Y     = TOP_BLACK;                    // 이미지 시작 Y
    const SUB_TOP   = IMG_Y + IMG_SIZE + Math.round(20 * SCALE); // 자막 시작 Y
    const GAP_DUR   = 0.3;                          // 단계 사이 무음 간격(초)

    try {
      // ── helpers ────────────────────────────────────────────────────────────
      const loadImg = (src: string): Promise<HTMLImageElement> =>
        new Promise((res, rej) => {
          const el = new window.Image();
          el.onload = () => res(el);
          el.onerror = rej;
          el.src = src;
        });

      const decodeAudio = async (url: string, ctx: AudioContext): Promise<AudioBuffer> => {
        const buf = await (await fetch(url)).arrayBuffer();
        return ctx.decodeAudioData(buf);
      };

      // 9:16 전체 채우기 (훅멘트 / 엔딩 슬라이드용)
      const fillCover = (c: CanvasRenderingContext2D, src: HTMLImageElement | HTMLVideoElement) => {
        const sw = src instanceof HTMLVideoElement ? src.videoWidth  : src.naturalWidth;
        const sh = src instanceof HTMLVideoElement ? src.videoHeight : src.naturalHeight;
        if (!sw || !sh) return;
        const scale = Math.max(CANVAS_W / sw, CANVAS_H / sh);
        c.drawImage(src,
          (CANVAS_W - sw * scale) / 2,
          (CANVAS_H - sh * scale) / 2,
          sw * scale, sh * scale);
      };

      // 가로 꽉 채움 + 상단 30% / 하단 70% 검은 공간 + 자막 (1:1 조리 단계 이미지용)
      const drawStepFrame = (
        c: CanvasRenderingContext2D,
        img: HTMLImageElement,
        subtitle: string,
      ) => {
        c.fillStyle = "#000";
        c.fillRect(0, 0, CANVAS_W, CANVAS_H);
        // 이미지: 상단 126px 검은 공간 이후 배치 (가로 꽉 채움)
        c.drawImage(img, 0, IMG_Y, CANVAS_W, IMG_SIZE);

        // 자막 영역: IMG_SIZE 아래 검은 공간
        if (!subtitle) return;
        const FONT_SIZE = Math.round(26 * SCALE);
        const LINE_H    = FONT_SIZE + Math.round(10 * SCALE);
        const PAD       = Math.round(28 * SCALE);
        const MAX_W     = CANVAS_W - PAD * 2;
        c.font = `bold ${FONT_SIZE}px 'Noto Sans KR', sans-serif`;
        c.fillStyle = "#ffffff";
        c.textAlign  = "center";
        c.textBaseline = "top";

        // 한 글자씩 너비 계산하며 줄 나눔
        const lines: string[] = [];
        let line = "";
        for (const ch of subtitle) {
          if (c.measureText(line + ch).width > MAX_W && line) {
            lines.push(line);
            line = ch;
          } else {
            line += ch;
          }
        }
        if (line) lines.push(line);

        const totalH = lines.length * LINE_H;
        const startY = SUB_TOP + Math.max(0, (CANVAS_H - SUB_TOP - totalH) / 2 - Math.round(20 * SCALE));
        lines.forEach((l, i) => c.fillText(l, CANVAS_W / 2, startY + i * LINE_H));
      };

      // 엔딩 이미지 슬라이드 (정사각형 → 상단 84px 여백 후 배치)
      const drawEndingFrame = (c: CanvasRenderingContext2D, img: HTMLImageElement) => {
        c.fillStyle = "#000";
        c.fillRect(0, 0, CANVAS_W, CANVAS_H);
        c.drawImage(img, 0, IMG_Y, CANVAS_W, IMG_SIZE);
      };

      // ── AudioContext ───────────────────────────────────────────────────────
      const audioCtx = new AudioContext();
      const dest     = audioCtx.createMediaStreamDestination();

      type DrawFn = (c: CanvasRenderingContext2D) => void;
      interface Seg { start: number; dur: number; draw: DrawFn; audioBuf?: AudioBuffer; }
      const segs: Seg[] = [];
      let cursor = 0;

      // ── 1. 오프닝: 썸네일(1초) → 재료(남은 2초) + 훅 멘트 음성 ───────────
      if (hookMentAudioUrl) {
        const audioBuf = await decodeAudio(hookMentAudioUrl, audioCtx);
        const hookDur  = audioBuf.duration;
        const thumbDur = Math.min(1, hookDur);
        const ingDur   = hookDur - thumbDur; // 훅 음성 나머지 구간 = 재료 노출 (약 2초)
        const thumbImg = reelThumbnail ? await loadImg(reelThumbnail) : null;
        const ingImg   = ingredientsImage ? await loadImg(ingredientsImage) : null;

        // 썸네일 1초 (오디오 트랙을 여기에 붙이면 전체 hookDur 동안 이어서 재생됨)
        segs.push({
          start: cursor, dur: thumbDur, audioBuf,
          draw: (c) => {
            c.fillStyle = "#000"; c.fillRect(0, 0, CANVAS_W, CANVAS_H);
            if (thumbImg) fillCover(c, thumbImg);
          },
        });
        cursor += thumbDur;

        // 재료 이미지 2초 (훅 음성은 위 세그먼트에서 이미 스케줄됨 → 계속 재생)
        if (ingDur > 0) {
          segs.push({
            start: cursor, dur: ingDur,
            draw: (c) => {
              if (ingImg) drawEndingFrame(c, ingImg);
              else if (thumbImg) {
                c.fillStyle = "#000"; c.fillRect(0, 0, CANVAS_W, CANVAS_H);
                fillCover(c, thumbImg);
              } else {
                c.fillStyle = "#000"; c.fillRect(0, 0, CANVAS_W, CANVAS_H);
              }
            },
          });
          cursor += ingDur;
        }
      }

      // ── 2. 단계별 조리 섹션 (간격 + 자막 + letterbox) ─────────────────────
      const steps = [...recipe.steps]
        .filter(s => stepImages[s.number] && ttsAudioUrls[s.number])
        .sort((a, b) => a.number - b.number);

      for (let i = 0; i < steps.length; i++) {
        const step     = steps[i];
        const audioBuf = await decodeAudio(ttsAudioUrls[step.number], audioCtx);
        const img      = await loadImg(stepImages[step.number]);
        // TTS 생성 시 압축된 구어체 텍스트 우선, 없으면 원본 설명 fallback
        const subtitle = ttsTexts[step.number] ?? step.description ?? "";

        // 조리 단계 세그먼트 (마지막 아닌 경우 GAP_DUR 연장 — 이미지 유지, 오디오만 무음)
        const isLast = i === steps.length - 1;
        const segDur = audioBuf.duration + (isLast ? 0 : GAP_DUR);
        segs.push({
          start: cursor, dur: segDur, audioBuf,
          draw: (c) => drawStepFrame(c, img, subtitle),
        });
        cursor += segDur;
      }

      // ── 3. 엔딩: 꿀팁(성공포인트) 이미지 2초 ──────────────────────────────
      if (kickInstagramImage) {
        const kickImg = await loadImg(kickInstagramImage);
        segs.push({
          start: cursor, dur: 2,
          draw: (c) => drawEndingFrame(c, kickImg),
        });
        cursor += 2;
      }

      const totalDur = cursor;
      if (totalDur === 0) throw new Error("편집할 콘텐츠가 없습니다. 음성 파일을 먼저 생성해주세요.");

      // ── 캔버스 + 레코더 ────────────────────────────────────────────────────
      const canvas = document.createElement("canvas");
      canvas.width  = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx2d   = canvas.getContext("2d")!;
      ctx2d.fillStyle = "#000";
      ctx2d.fillRect(0, 0, CANVAS_W, CANVAS_H);

      const canvasStream = canvas.captureStream(30);
      const combined = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      // ── 인코더 호환성 프로브: isTypeSupported()만으로는 실제 인코딩 실패를 잡지 못함 ──
      // 동일 해상도의 별도 캔버스로 200ms 짧게 녹화 시도 → 동작하는 첫 번째 설정 사용
      const candidateConfigs = [
        { mimeType: "video/mp4",                  videoBitsPerSecond: 2_000_000 },
        { mimeType: "video/webm;codecs=vp9,opus", videoBitsPerSecond: 2_000_000 },
        { mimeType: "video/webm;codecs=vp8,opus", videoBitsPerSecond: 1_500_000 },
        { mimeType: "video/webm",                 videoBitsPerSecond: 1_000_000 },
      ].filter(c => MediaRecorder.isTypeSupported(c.mimeType));
      if (candidateConfigs.length === 0) candidateConfigs.push({ mimeType: "video/webm", videoBitsPerSecond: 1_000_000 });

      const probeCanvas = document.createElement("canvas");
      probeCanvas.width  = CANVAS_W;
      probeCanvas.height = CANVAS_H;
      const probeStream  = probeCanvas.captureStream(30);
      let chosenConfig   = candidateConfigs[candidateConfigs.length - 1];
      for (const cfg of candidateConfigs) {
        const ok = await new Promise<boolean>((resolve) => {
          try {
            const probe = new MediaRecorder(probeStream, cfg);
            probe.ondataavailable = () => {};
            probe.onerror = () => resolve(false);
            setTimeout(() => {
              try { if (probe.state === "recording") probe.stop(); } catch {}
              resolve(true);
            }, 250);
            probe.start(100);
          } catch { resolve(false); }
        });
        if (ok) { chosenConfig = cfg; break; }
      }
      probeStream.getTracks().forEach(t => t.stop());

      const { mimeType, videoBitsPerSecond } = chosenConfig;
      const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      setFinalVideoExt(ext);
      const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      // onstop/onerror 핸들러는 stop() 호출 전에 등록 (race condition 방지)
      const stopPromise = new Promise<void>((res, rej) => {
        recorder.onstop  = () => res();
        recorder.onerror = (e) => rej(new Error(`MediaRecorder 오류: ${(e as { error?: { message?: string } }).error?.message || 'Unknown Error'}`));
      });

      // ── 오디오 스케줄 ─────────────────────────────────────────────────────
      await audioCtx.resume();
      const START_DELAY = 0.2;
      const t0 = audioCtx.currentTime + START_DELAY;

      for (const seg of segs) {
        if (seg.audioBuf) {
          const src = audioCtx.createBufferSource();
          src.buffer = seg.audioBuf;
          src.connect(dest);
          src.start(t0 + seg.start);
        }
      }

      // ── 애니메이션 + 녹화 ─────────────────────────────────────────────────
      recorder.start(100);

      await new Promise<void>((resolve) => {
        const wallStart   = performance.now();
        // 안전 타임아웃: rAF가 백그라운드 탭에서 스로틀되거나 AudioContext 시간이 멈춰도 강제 종료
        const safetyTimer = setTimeout(resolve, (START_DELAY + totalDur + 5.0) * 1000);

        const animate = () => {
          // AudioContext 시간 대신 performance.now() 사용 → AudioContext 정지에 영향받지 않음
          const elapsed = (performance.now() - wallStart) / 1000 - START_DELAY;
          if (elapsed >= totalDur + 0.3) { clearTimeout(safetyTimer); resolve(); return; }

          setFinalVideoProgress(Math.round(Math.max(0, Math.min(99, (elapsed / totalDur) * 100))));

          ctx2d.fillStyle = "#000";
          ctx2d.fillRect(0, 0, CANVAS_W, CANVAS_H);
          if (elapsed >= 0) {
            const seg = [...segs].reverse().find(s => elapsed >= s.start);
            if (seg) seg.draw(ctx2d);
          }
          requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
      });

      recorder.stop();
      await stopPromise;

      const blob = new Blob(chunks, { type: mimeType });
      setFinalVideoUrl(URL.createObjectURL(blob));
      setFinalVideoBlob(blob);
      setFinalVideoProgress(100);
      await audioCtx.close();

      // ── Telegram 자동 전송 ───────────────────────────────────────────────
      void sendToTelegram(blob, ext);

    } catch (err) {
      console.error("[Video edit]", err instanceof Error ? err.message : String(err));
    } finally {
      setFinalVideoLoading(false);
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
          <div className="flex justify-center mb-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
              style={{
              background: characterVersion === "lazy_bear" || characterVersion === "lazy"
                ? "rgba(79,70,229,0.85)"
                : characterVersion === "trend_bear" || characterVersion === "trend"
                ? "rgba(124,58,237,0.85)"
                : "rgba(234,88,12,0.85)",
              backdropFilter: "blur(4px)"
            }}>
              {characterVersion === "lazy_bear" || characterVersion === "lazy"
                ? "🐨 귀차니즘 곰돌이"
                : characterVersion === "trend_bear" || characterVersion === "trend"
                ? "🐼 트렌드곰"
                : "🐻 귀여운 곰돌이"}
            </span>
          </div>
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
            {/* 재료 사진 카드 (한국어) */}
            <div className="bg-white rounded-3xl shadow-md overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ background: "linear-gradient(135deg, #f8fafc, #e2e8f0)" }}>
                <span className="text-sm font-bold text-gray-600">🥕 재료 사진</span>
                {ingredientsImageLoading && (
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
                {ingredientsImage ? (
                  <Image src={ingredientsImage} alt="재료" fill className="object-cover" unoptimized />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    {ingredientsImageLoading ? (
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
                {ingredientsImage && (
                  <button
                    onClick={() => { const a = document.createElement("a"); a.href = ingredientsImage; a.download = `${recipe.name}-ingredients.png`; a.click(); }}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
                    ⬇️ 저장
                  </button>
                )}
                <button
                  onClick={() => generateIngredientsImage(recipe.name, recipe.ingredients)}
                  disabled={ingredientsImageLoading}
                  className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold border-2 transition-all hover:bg-gray-100 disabled:opacity-40"
                  style={{ borderColor: "#94a3b8", color: "#64748b" }}>
                  {ingredientsImageLoading ? <svg className="spinner w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : "🔄"} {ingredientsImage ? "재생성" : "생성"}
                </button>
              </div>
            </div>

            {/* 전체 재료 목록 — 보유 / 구매 필요 구분 */}
            <div className="bg-white rounded-3xl shadow-md overflow-hidden">
              <div className="px-6 py-4 flex items-center justify-between"
                style={{ background: "linear-gradient(135deg, #f8fafc, #e2e8f0)" }}>
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <span>📋</span> 전체 재료 ({recipe.ingredients.length}가지)
                </h3>
                <div className="flex items-center gap-3 text-xs font-bold">
                  <span className="flex items-center gap-1" style={{ color: "#16a34a" }}>
                    <span>✅</span> 보유 {ownedIngredients.length}
                  </span>
                  {neededIngredients.length > 0 && (
                    <span className="flex items-center gap-1" style={{ color: "#ea580c" }}>
                      <span>🛒</span> 구매 {neededIngredients.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-4 space-y-2">
                {recipe.ingredients.map((ing) => (
                  <div
                    key={ing.name}
                    className="flex items-center justify-between px-4 py-3 rounded-2xl"
                    style={ing.isOwned
                      ? { background: "#f0fdf4", border: "1px solid #bbf7d0" }
                      : { background: "#fff7ed", border: "1px solid #fed7aa" }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base flex-shrink-0">{ing.isOwned ? "✅" : "🛒"}</span>
                      <span className={`font-semibold text-sm truncate ${ing.isOwned ? "text-gray-700" : "text-orange-700"}`}>
                        {ing.name}
                      </span>
                    </div>
                    <span className="text-sm font-bold flex-shrink-0 ml-3"
                      style={{ color: ing.isOwned ? "#16a34a" : "#ea580c" }}>
                      {ing.amount}{ing.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 구매 필요 재료 — 쇼핑 상품 카드 */}
            {neededIngredients.length > 0 && (
              <div className="bg-white rounded-3xl shadow-md overflow-hidden">
                <div className="px-6 py-4 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #fff7ed, #fed7aa)" }}>
                  <span className="text-xl">🛒</span>
                  <div>
                    <h3 className="font-bold text-orange-700">구매 필요 재료 ({neededIngredients.length}가지)</h3>
                    <p className="text-xs text-orange-500 mt-0.5">재료에 마우스를 올리면 추천 상품이 나타나요</p>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  {neededIngredients.map((ing) => {
                    const result = productResults[ing.name];
                    const fallbackQuery = encodeURIComponent(ing.name);
                    const naverFallback = `https://search.shopping.naver.com/search/all?query=${fallbackQuery}`;
                    const isExpanded = expandedIngredient === ing.name;
                    return (
                      <div
                        key={ing.name}
                        className="rounded-2xl overflow-hidden cursor-pointer select-none"
                        style={{ border: `1px solid ${isExpanded ? "#fb923c" : "#fed7aa"}`, transition: "border-color 0.2s" }}
                        onMouseEnter={() => {
                          setExpandedIngredient(ing.name);
                          fetchProductsForIngredient(ing.name);
                        }}
                        onMouseLeave={() => setExpandedIngredient(null)}
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedIngredient(null);
                          } else {
                            setExpandedIngredient(ing.name);
                            fetchProductsForIngredient(ing.name);
                          }
                        }}>
                        {/* 재료명 헤더 */}
                        <div className="flex items-center justify-between px-4 py-2.5"
                          style={{ background: isExpanded ? "#ffedd5" : "#fff7ed", transition: "background 0.2s" }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base flex-shrink-0">🛒</span>
                            <span className="font-bold text-sm text-orange-800 truncate">{ing.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <span className="text-xs font-bold text-orange-600">{ing.amount}{ing.unit}</span>
                            <span className="text-orange-400 text-xs" style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
                          </div>
                        </div>

                        {/* 상품 패널 — hover/클릭 시 슬라이드 다운 */}
                        <div style={{
                          maxHeight: isExpanded ? "600px" : "0",
                          overflow: "hidden",
                          transition: "max-height 0.3s ease",
                          background: "#fffbf5",
                        }}>
                          <div className="px-3 py-3">
                            {result === "loading" && (
                              <div className="flex items-center gap-2 py-3 text-xs text-orange-400">
                                <span className="animate-spin inline-block w-3 h-3 border-2 border-orange-300 border-t-orange-500 rounded-full" />
                                상품 검색 중...
                              </div>
                            )}

                            {Array.isArray(result) && result.length > 0 && (
                              <div className="space-y-2">
                                {result.map((product, idx) => (
                                  <a
                                    key={idx}
                                    href={product.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-3 p-2 rounded-xl transition-all hover:opacity-80 active:scale-95"
                                    style={{ background: "#fff", border: "1px solid #fde68a" }}>
                                    {product.image && (
                                      <img
                                        src={product.image}
                                        alt={product.title}
                                        width={52}
                                        height={52}
                                        className="rounded-lg object-cover flex-shrink-0"
                                        style={{ width: 52, height: 52 }}
                                      />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-tight">
                                        {product.title}
                                      </p>
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-gray-400">{product.mallName}</span>
                                        {product.price > 0 && (
                                          <span className="text-sm font-bold text-orange-600">
                                            {product.price.toLocaleString()}원
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </a>
                                ))}
                                <a
                                  href={naverFallback}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="block text-center text-xs text-orange-400 py-1 hover:text-orange-600">
                                  더 많은 상품 검색 →
                                </a>
                              </div>
                            )}

                            {(result === "none") && (
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <a
                                  href={`https://www.coupang.com/np/search?q=${fallbackQuery}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
                                  style={{ background: "linear-gradient(135deg, #e8391e, #ff6640)" }}>
                                  🛍 쿠팡 검색
                                </a>
                                <a
                                  href={naverFallback}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-95"
                                  style={{ background: "linear-gradient(135deg, #03c75a, #00a849)" }}>
                                  🟢 네이버 검색
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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

              </div>
            )}

            {/* 조리 음성 — 자동 생성 후 하나로 병합 (버튼 없음) */}
            <div className="mb-6 rounded-3xl shadow-md overflow-hidden bg-white">
              <div className="px-5 py-4 flex items-center gap-3"
                style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                <span className="text-2xl">🎙️</span>
                <div className="flex-1">
                  <p className="text-white font-extrabold text-sm">조리 음성 (자동 생성)</p>
                  <p className="text-white/80 text-xs">모든 단계 음성을 자동으로 만들어 하나로 이어드려요</p>
                </div>
              </div>
              <div className="p-5">
                {(stepTtsPhase === "generating" || stepTtsPhase === "merging") && (
                  <div className="flex flex-col items-center gap-3 py-6">
                    <svg className="spinner w-8 h-8 text-sky-500" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <p className="text-sm font-bold text-gray-600">
                      {stepTtsPhase === "merging"
                        ? "음성을 하나로 합치는 중..."
                        : `음성 생성 중... (${stepTtsProgress.current}/${stepTtsProgress.total})`}
                    </p>
                    <div className="w-full max-w-xs h-2 rounded-full overflow-hidden bg-gray-100">
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${stepTtsPhase === "merging"
                            ? 100
                            : Math.round((stepTtsProgress.current / Math.max(1, stepTtsProgress.total)) * 100)}%`,
                          background: "linear-gradient(90deg,#0ea5e9,#6366f1)",
                        }} />
                    </div>
                    <p className="text-xs text-gray-400">각 단계 음성을 1초 간격으로 생성하고 있어요</p>
                  </div>
                )}

                {stepTtsPhase === "done" && mergedAudioUrl && (
                  <div className="space-y-3">
                    <p className="flex items-center gap-2 text-sm font-bold text-green-600">
                      <span>✅</span> 전체 조리 음성이 준비됐어요 ({recipe.steps.length}단계)
                    </p>
                    <audio controls src={mergedAudioUrl} className="w-full h-11" />
                    <a
                      href={mergedAudioUrl}
                      download={`${recipe.name}-조리음성.wav`}
                      className="block w-full text-center py-3 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                      ⬇️ 음성 다운로드
                    </a>
                  </div>
                )}

                {stepTtsPhase === "error" && (
                  <div className="flex flex-col items-center gap-3 py-4">
                    <p className="text-sm text-red-500 text-center">⚠️ {stepTtsError ?? "음성 생성에 실패했습니다."}</p>
                    <button
                      onClick={retryStepTts}
                      className="px-5 py-2.5 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90"
                      style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                      🔄 다시 시도
                    </button>
                  </div>
                )}

                {stepTtsPhase === "idle" && (
                  <p className="text-sm text-gray-400 text-center py-4">조리법을 열면 음성이 자동으로 생성됩니다.</p>
                )}
              </div>
            </div>

            {/* 단계 진행 표시 — 번호 칩 (현재 단계 강조 · 완료 단계 체크) */}
            <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
              {recipe.steps.map((s, i) => {
                const active = i === currentStepIndex;
                const done = i < currentStepIndex;
                return (
                  <button
                    key={s.number}
                    onClick={() => setCurrentStepIndex(i)}
                    aria-label={`단계 ${s.number}`}
                    className="flex-shrink-0 flex items-center justify-center rounded-full font-bold transition-all"
                    style={{
                      width: active ? 44 : 36,
                      height: active ? 44 : 36,
                      fontSize: active ? 18 : 14,
                      background: active
                        ? "linear-gradient(135deg, #ff6b35, #ffc857)"
                        : s.isKick ? "rgba(255,107,53,0.15)" : "#f3f4f6",
                      color: active ? "#fff" : s.isKick ? "#ea580c" : "#9ca3af",
                      boxShadow: active ? "0 4px 12px rgba(255,107,53,0.4)" : "none",
                    }}>
                    {done ? "✓" : s.number}
                  </button>
                );
              })}
            </div>

            {/* 현재 단계 — 한 번에 한 단계씩 집중해서 크게 표시 */}
            {(() => {
              const step = recipe.steps[currentStepIndex];
              if (!step) return null;
              const isFirst = currentStepIndex === 0;
              const isLast = currentStepIndex === recipe.steps.length - 1;
              return (
                <div
                  className={`step-card bg-white rounded-3xl shadow-lg overflow-hidden ${step.isKick ? "is-kick" : ""}`}
                  style={step.isKick ? {} : { border: "1px solid #f3f4f6" }}>
                  {/* 헤더: 큰 번호 배지 + 진행 표시 */}
                  <div className="px-6 pt-6 pb-4 flex items-center justify-between"
                    style={{ background: step.isKick
                      ? "linear-gradient(135deg,#fff7ed,#ffedd5)"
                      : "linear-gradient(135deg,#f8fafc,#f1f5f9)" }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                        style={{ background: step.isKick ? "#fed7aa" : "#fff" }}>
                        {step.emoji}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold uppercase tracking-wider"
                            style={{ color: step.isKick ? "#ea580c" : "#94a3b8" }}>
                            STEP {step.number}
                          </span>
                          {step.isKick && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full text-white"
                              style={{ background: "linear-gradient(135deg,#ff6b35,#ffc857)" }}>
                              ⭐ 성공 포인트
                            </span>
                          )}
                        </div>
                        <h4 className={`font-extrabold text-lg leading-snug ${step.isKick ? "text-orange-700" : "text-gray-800"}`}>
                          {step.title}
                        </h4>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-gray-400 flex-shrink-0 ml-2">
                      {currentStepIndex + 1}/{recipe.steps.length}
                    </span>
                  </div>

                  {/* 본문 */}
                  <div className="p-6 pt-5">
                    {step.time && (
                      <span className="inline-flex items-center text-xs px-2.5 py-1 rounded-full mb-3"
                        style={{ background: "#f3f4f6", color: "#6b7280" }}>
                        ⏱ {step.time}
                      </span>
                    )}
                    <p className="text-base text-gray-700 leading-relaxed">{step.description}</p>

                    {step.isKick && step.kickReason && (
                      <div className="mt-4 p-4 rounded-2xl text-sm font-medium"
                        style={{ background: "rgba(255, 107, 53, 0.08)", color: "#c2410c" }}>
                        💡 <span className="font-bold">포인트:</span> {step.kickReason}
                      </div>
                    )}

                    {step.parallel && (
                      <div className="mt-3 p-3 rounded-2xl text-sm flex items-start gap-2"
                        style={{ background: "#f0fdf4", color: "#16a34a" }}>
                        <span className="text-base">⚡</span>
                        <div><span className="font-bold">시간 절약:</span> {step.parallel}</div>
                      </div>
                    )}

                    {step.tip && (
                      <div className="mt-3 p-3 rounded-2xl text-sm flex items-start gap-2"
                        style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                        <span className="text-base">💡</span>
                        <div><span className="font-bold">팁:</span> {step.tip}</div>
                      </div>
                    )}
                  </div>

                  {/* 이전 / 다음 네비게이션 */}
                  <div className="px-6 pb-6 flex items-center gap-3">
                    <button
                      onClick={() => setCurrentStepIndex((i) => Math.max(0, i - 1))}
                      disabled={isFirst}
                      className="flex-1 py-3 rounded-2xl font-bold text-sm border-2 transition-all disabled:opacity-30"
                      style={{ borderColor: "#e5e7eb", color: "#6b7280" }}>
                      ← 이전
                    </button>
                    <button
                      onClick={() => setCurrentStepIndex((i) => Math.min(recipe.steps.length - 1, i + 1))}
                      disabled={isLast}
                      className="flex-1 py-3 rounded-2xl font-bold text-sm text-white transition-all disabled:opacity-30"
                      style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>
                      다음 →
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 상세 레시피 한장 이미지 (gpt-image-2) — 모든 단계 음성 생성 후 활성화 */}
            {(() => {
              const allStepTtsReady =
                recipe.steps.length > 0 && recipe.steps.every((s) => ttsAudioUrls[s.number]);
              return (
                <div className="mt-6 bg-white rounded-3xl shadow-md p-6">
                  <h3 className="font-bold text-gray-700 mb-1 flex items-center gap-2">
                    <span>🖼️</span> 상세 레시피 한장 이미지
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    모든 단계의 음성을 생성하면 일러스트 스타일 상세 조리법 이미지를 만들 수 있어요. (gpt-image-2)
                  </p>
                  <button
                    onClick={generateRecipeGuide}
                    disabled={!allStepTtsReady || recipeGuideLoading}
                    className="w-full py-3.5 rounded-2xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #16a34a, #84cc16)" }}>
                    {recipeGuideLoading
                      ? "🎨 생성 중... (약 20~40초)"
                      : !allStepTtsReady
                        ? "🔒 모든 단계 음성을 먼저 생성해주세요"
                        : recipeGuideImage
                          ? "🔄 이미지 재생성"
                          : "🖼️ 상세 레시피 이미지 생성"}
                  </button>
                  {recipeGuideError && <p className="text-xs text-red-500 mt-2">⚠️ {recipeGuideError}</p>}
                  {recipeGuideImage && (
                    <div className="mt-4 space-y-3">
                      <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: "3 / 4" }}>
                        <Image
                          src={recipeGuideImage}
                          alt={`${recipe.name} 상세 조리법`}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>

                      {/* 실제 완성 요리 사진 업로드 — 저장/영상 생성 활성화 전제 조건 */}
                      <div className="rounded-2xl p-4"
                        style={{ background: finishedDishImage ? "#f0fdf4" : "#fff7ed", border: `1px solid ${finishedDishImage ? "#bbf7d0" : "#fed7aa"}` }}>
                        <p className="text-sm font-bold flex items-center gap-2 flex-wrap"
                          style={{ color: finishedDishImage ? "#16a34a" : "#ea580c" }}>
                          <span>📸</span> 실제 완성 요리 사진 업로드
                          {finishedUploadStatus === "uploading" && (
                            <span className="text-xs text-blue-500 flex items-center gap-1">
                              <svg className="spinner w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              서버에 저장 중...
                            </span>
                          )}
                          {finishedUploadStatus === "done" && <span className="text-xs text-green-600">✅ 저장 완료 (관리자 썸네일 연동됨)</span>}
                          {finishedUploadStatus === "error" && <span className="text-xs text-red-500">⚠️ 서버 저장 실패 (로컬에서만 사용)</span>}
                          {finishedUploadStatus === "idle" && finishedDishImage && <span className="text-xs">✅ 업로드 완료</span>}
                        </p>
                        <p className="text-xs text-gray-500 mt-1 mb-3">
                          직접 만든 완성 요리 사진을 올려야 게시물 영상을 만들 수 있어요. (이미지 다운로드는 사진 없이도 가능)
                          {savedRecipeId && " 사진은 관리자 쇼츠 썸네일로도 자동 연동됩니다."}
                        </p>
                        {finishedUploadError && (
                          <p className="text-xs text-red-400 mb-2">⚠️ {finishedUploadError}</p>
                        )}
                        <label className="block">
                          <span className="sr-only">완성 요리 사진 선택</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFinishedDishUpload}
                            className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:text-white file:cursor-pointer file:bg-gradient-to-r file:from-orange-400 file:to-amber-400"
                          />
                        </label>
                        {finishedDishImage && (
                          <div className="mt-3 flex items-center gap-3">
                            <div className="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0">
                              <Image src={finishedDishImage} alt="완성 요리" fill className="object-cover" unoptimized />
                            </div>
                            <button
                              onClick={() => { setFinishedDishImage(null); }}
                              className="text-xs font-bold text-red-500 hover:text-red-600">
                              🗑️ 사진 삭제
                            </button>
                          </div>
                        )}
                      </div>

                      <a
                        href={recipeGuideImage}
                        download={`${recipe.name}-상세조리법.png`}
                        className="block w-full text-center py-3 rounded-2xl text-white font-bold transition-all hover:opacity-90 cursor-pointer"
                        style={{ background: "linear-gradient(135deg, #16a34a, #84cc16)" }}>
                        ⬇️ 이미지 다운로드
                      </a>

                      {/* 게시물(피드)용 영상 — 정지 이미지 + TTS 음성 연속 재생 */}
                      <div className="pt-3 mt-1 border-t" style={{ borderColor: "#f3f4f6" }}>
                        <p className="text-xs text-gray-500 mb-3">
                          이미지를 그대로 띄운 채 모든 단계 음성이 이어서 재생되는 게시물용 영상을 만들어요. (릴스 ✕ · 피드 4:5)
                        </p>
                        <button
                          onClick={createGuidePostVideo}
                          disabled={guidePostLoading || !finishedDishImage}
                          className="w-full py-3 rounded-2xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                          style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                          {guidePostLoading
                            ? `🎬 만드는 중... ${guidePostProgress}%`
                            : !finishedDishImage
                              ? "🔒 완성 요리 사진을 먼저 올려주세요"
                              : guidePostUrl
                                ? "🔄 게시물 영상 다시 만들기"
                                : "🔊 음성 게시물 영상 만들기"}
                        </button>
                        {guidePostLoading && (
                          <div className="w-full h-2 mt-2 rounded-full overflow-hidden bg-gray-100">
                            <div className="h-full rounded-full transition-all" style={{ width: `${guidePostProgress}%`, background: "linear-gradient(90deg,#0ea5e9,#6366f1)" }} />
                          </div>
                        )}
                        {guidePostError && <p className="text-xs text-red-500 mt-2">⚠️ {guidePostError}</p>}
                        {guidePostUrl && (
                          <div className="mt-3 space-y-2">
                            <video controls src={guidePostUrl} className="w-full rounded-2xl" style={{ maxHeight: "420px", background: "#000" }} />
                            <div className="flex gap-2">
                              <a
                                href={guidePostUrl}
                                download={`${recipe.name}-게시물.${guidePostExt}`}
                                className="flex-1 text-center py-3 rounded-2xl text-white font-bold transition-all hover:opacity-90"
                                style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                                ⬇️ 영상 다운로드
                              </a>
                              <button
                                onClick={() => guidePostBlob && sendToTelegram(guidePostBlob, guidePostExt)}
                                className="flex-1 py-3 rounded-2xl text-white font-bold transition-all hover:opacity-90"
                                style={{ background: "linear-gradient(135deg, #229ED9, #2AABEE)" }}>
                                ✈️ 텔레그램 전송
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

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
              className="w-full mt-3 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90"
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
  lang,
  recipeName,
  post,
  loading,
  copied,
  onGenerate,
  onCopy,
}: {
  lang: "ko" | "en";
  recipeName: string;
  post: string | null;
  loading: boolean;
  copied: boolean;
  onGenerate: () => void;
  onCopy: () => void;
}) {
  const isEn = lang === "en";
  const gradient = isEn
    ? "linear-gradient(135deg, #0ea5e9, #6366f1)"
    : "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)";
  const title = isEn ? "🌎 English Instagram Post" : "🇰🇷 인스타 게시글 생성";
  const subtitle = isEn
    ? "Full recipe in English · Copy & paste ready"
    : "전체 레시피 포함 · 바로 복사해서 사용";
  const btnLabel = isEn ? "✨ Generate English Post" : "✨ 인스타 게시글 생성하기";
  const loadingText = isEn ? "Writing post..." : "게시글 작성 중...";
  const loadingSub = isEn ? "Adapting recipe for international readers" : "레시피를 분석하고 있어요";
  const copyLabel = isEn ? "📋 Copy All" : "📋 전체 복사";
  const copiedLabel = isEn ? "✅ Copied!" : "✅ 복사됨!";
  const regenLabel = isEn ? "🔄 Regenerate" : "🔄 재생성";
  const footerNote = isEn
    ? `Paste directly into Instagram · ${recipeName}`
    : `복사 후 인스타그램 앱에 바로 붙여넣기 하세요 · ${recipeName}`;

  return (
    <div className="mt-6 rounded-3xl overflow-hidden shadow-xl"
      style={{ background: gradient }}>
      <div className="p-px rounded-3xl">
        <div className="bg-white rounded-3xl overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3"
            style={{ background: gradient }}>
            <span className="text-2xl">✍️</span>
            <div>
              <p className="text-white font-extrabold text-sm">{title}</p>
              <p className="text-white/80 text-xs">{subtitle}</p>
            </div>
          </div>

          <div className="p-5">
            {!post && !loading && (
              <button
                onClick={onGenerate}
                className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-95"
                style={{ background: gradient }}>
                {btnLabel}
              </button>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-3 py-10">
                <svg className="spinner w-8 h-8 text-pink-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm font-medium text-gray-500">{loadingText}</p>
                <p className="text-xs text-gray-400">{loadingSub}</p>
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
                    style={{ background: copied ? "linear-gradient(135deg,#16a34a,#15803d)" : gradient }}>
                    {copied ? copiedLabel : copyLabel}
                  </button>
                  <button
                    onClick={onGenerate}
                    className="px-5 py-3 rounded-2xl font-bold text-sm border-2 transition-all hover:bg-gray-50"
                    style={{ borderColor: isEn ? "#6366f1" : "#fd1d1d", color: isEn ? "#6366f1" : "#fd1d1d" }}>
                    {regenLabel}
                  </button>
                </div>
                <p className="text-xs text-center text-gray-400">{footerNote}</p>
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
