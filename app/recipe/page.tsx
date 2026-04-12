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
  const [activeSection, setActiveSection] = useState<"ingredients" | "steps" | "summary" | "reel">("ingredients");
  const summaryRef = useRef<HTMLDivElement>(null);
  const reelRef = useRef<HTMLDivElement>(null);

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
  // 훅 멘트 TTS
  const [hookMentLoading, setHookMentLoading] = useState(false);
  const [hookMentAudioUrl, setHookMentAudioUrl] = useState<string | null>(null);
  const [hookMentError, setHookMentError] = useState<string | null>(null);
  // 훅 멘트 영상 클립 (영상 편집용)
  const [hookMentVideoUrl, setHookMentVideoUrl] = useState<string | null>(null);
  // 릴스 최종 편집 영상
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [finalVideoExt, setFinalVideoExt] = useState<"mp4" | "webm">("mp4");
  const [finalVideoLoading, setFinalVideoLoading] = useState(false);
  const [finalVideoProgress, setFinalVideoProgress] = useState(0);
  // TTS (스텝별)
  const [ttsLoading, setTtsLoading] = useState<Record<number, boolean>>({});
  const [ttsAudioUrls, setTtsAudioUrls] = useState<Record<number, string>>({});
  const [ttsTexts, setTtsTexts] = useState<Record<number, string>>({});
  const [ttsErrors, setTtsErrors] = useState<Record<number, string>>({});
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
        body: JSON.stringify({ recipe, language: lang }),
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

  const generateStepTts = async (step: RecipeStep) => {
    const num = step.number;
    setTtsLoading((p) => ({ ...p, [num]: true }));
    setTtsErrors((p) => ({ ...p, [num]: "" }));
    try {
      // 순수 조리 설명만 구어체 변환 — 팁·포인트 등 부수 내용 제외
      const text = step.description;
      const res = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.error) {
        setTtsErrors((p) => ({ ...p, [num]: data.error }));
      } else {
        setTtsAudioUrls((p) => ({ ...p, [num]: data.audioUrl }));
        if (data.speechText) setTtsTexts((p) => ({ ...p, [num]: data.speechText }));
      }
    } catch (err) {
      setTtsErrors((p) => ({ ...p, [num]: err instanceof Error ? err.message : "음성 생성 실패" }));
    } finally {
      setTtsLoading((p) => ({ ...p, [num]: false }));
    }
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

  // ── 훅 멘트 영상 업로드 ───────────────────────────────────────────────────────
  const handleHookMentVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("video/")) return;
    if (hookMentVideoUrl) URL.revokeObjectURL(hookMentVideoUrl);
    setHookMentVideoUrl(URL.createObjectURL(file));
  };

  // ── 릴스 최종 영상 편집 ───────────────────────────────────────────────────────
  const createFinalVideo = async () => {
    if (!recipe) return;
    setFinalVideoLoading(true);
    setFinalVideoProgress(0);
    if (finalVideoUrl) URL.revokeObjectURL(finalVideoUrl);
    setFinalVideoUrl(null);

    const CANVAS_W  = 540;
    const CANVAS_H  = 960;
    const IMG_SIZE  = 540;                          // 1:1 이미지 (가로 꽉 채움)
    const BLACK_ALL = CANVAS_H - IMG_SIZE;          // 총 검은 공간 420px
    const TOP_BLACK = Math.round(BLACK_ALL * 0.3);  // 상단 30% = 126px
    const IMG_Y     = TOP_BLACK;                    // 이미지 시작 Y = 84
    const SUB_TOP   = IMG_Y + IMG_SIZE + 20;        // 자막 시작 Y = 644
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
        const FONT_SIZE = 26;
        const LINE_H    = FONT_SIZE + 10;
        const PAD       = 28;
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
        const startY = SUB_TOP + Math.max(0, (CANVAS_H - SUB_TOP - totalH) / 2 - 20);
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

      // ── 훅 멘트 영상 준비 ──────────────────────────────────────────────────
      let hookVidEl: HTMLVideoElement | null = null;
      if (hookMentVideoUrl) {
        hookVidEl = document.createElement("video");
        hookVidEl.src = hookMentVideoUrl;
        hookVidEl.muted = true;
        hookVidEl.playsInline = true;
        await new Promise<void>((r, j) => {
          hookVidEl!.onloadeddata = () => r();
          hookVidEl!.onerror = () => j(new Error("훅 멘트 영상 로드 실패"));
          hookVidEl!.load();
        });
      }

      // ── 1. 훅 멘트 섹션 ───────────────────────────────────────────────────
      if (hookMentAudioUrl) {
        const audioBuf = await decodeAudio(hookMentAudioUrl, audioCtx);
        const hookDur  = audioBuf.duration;
        const thumbDur = Math.min(1, hookDur);
        const vidDur   = hookDur - thumbDur;
        const thumbImg = reelThumbnail ? await loadImg(reelThumbnail) : null;

        segs.push({
          start: cursor, dur: thumbDur, audioBuf,
          draw: (c) => {
            c.fillStyle = "#000"; c.fillRect(0, 0, CANVAS_W, CANVAS_H);
            if (thumbImg) fillCover(c, thumbImg);
          },
        });
        cursor += thumbDur;

        if (vidDur > 0) {
          segs.push({
            start: cursor, dur: vidDur,
            draw: (c) => {
              c.fillStyle = "#000"; c.fillRect(0, 0, CANVAS_W, CANVAS_H);
              if (hookVidEl && hookVidEl.readyState >= 2) fillCover(c, hookVidEl);
              else if (thumbImg) fillCover(c, thumbImg);
            },
          });
          cursor += vidDur;
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

      // ── 3. 엔딩: 재료 이미지 1초 + 성공포인트 이미지 1초 ──────────────────
      const endingSlides: HTMLImageElement[] = [];
      if (ingredientsImage) endingSlides.push(await loadImg(ingredientsImage));
      if (kickInstagramImage) endingSlides.push(await loadImg(kickInstagramImage));

      for (const slide of endingSlides) {
        segs.push({
          start: cursor, dur: 1,
          draw: (c) => drawEndingFrame(c, slide),
        });
        cursor += 1;
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
      const mimeType =
        ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4;codecs=avc1", "video/mp4",
         "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
          .find(m => MediaRecorder.isTypeSupported(m)) ?? "video/webm";
      const ext = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
      setFinalVideoExt(ext);
      const recorder = new MediaRecorder(combined, { mimeType, videoBitsPerSecond: 2_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

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

      // 훅 영상: 썸네일 1초 후 재생 시작
      if (hookVidEl) {
        const thumbDur = segs[0]?.dur ?? 1;
        setTimeout(() => hookVidEl!.play().catch(() => {}), (START_DELAY + thumbDur) * 1000);
      }

      // ── 애니메이션 + 녹화 ─────────────────────────────────────────────────
      recorder.start(100);

      await new Promise<void>((resolve) => {
        const animate = () => {
          const elapsed = audioCtx.currentTime - t0;
          if (elapsed >= totalDur + 0.15) { resolve(); return; }

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
      await new Promise<void>((r) => { recorder.onstop = () => r(); });

      const blob = new Blob(chunks, { type: mimeType });
      setFinalVideoUrl(URL.createObjectURL(blob));
      setFinalVideoProgress(100);
      await audioCtx.close();

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
          {(["ingredients", "steps", "summary", "reel"] as const).map((section) => {
            const labels: Record<string, string> = {
              ingredients: "🛒 재료",
              steps: "👨‍🍳 조리법",
              summary: "📋 요약",
              reel: "🎬 릴스",
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

                  {/* 단계 TTS 음성 */}
                  <div className="px-4 py-3 border-t flex flex-col gap-2"
                    style={{ borderColor: step.isKick ? "rgba(255,107,53,0.15)" : "#f3f4f6",
                             background: "linear-gradient(to right, #f0f9ff, #fafafa)" }}>
                    <button
                      onClick={() => generateStepTts(step)}
                      disabled={!!ttsLoading[step.number]}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-white text-xs font-bold transition-all hover:opacity-90 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                      {ttsLoading[step.number] ? (
                        <>
                          <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          음성 생성 중...
                        </>
                      ) : ttsAudioUrls[step.number] ? "🔄 음성 재생성" : "🎙️ 이 단계 음성 생성"}
                    </button>

                    {ttsErrors[step.number] && (
                      <p className="text-xs text-red-500 px-1">⚠️ {ttsErrors[step.number]}</p>
                    )}

                    {ttsAudioUrls[step.number] && !ttsLoading[step.number] && (
                      <div className="flex items-center gap-2">
                        <audio controls src={ttsAudioUrls[step.number]} className="flex-1 h-9" />
                        <a
                          href={ttsAudioUrls[step.number]}
                          download={`${recipe.name}-step${step.number}-voice.mp3`}
                          className="flex-shrink-0 px-3 py-2 rounded-xl text-white text-xs font-bold"
                          style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                          ⬇️
                        </a>
                      </div>
                    )}
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

            {/* 한국어 게시글 */}
            <InstagramPostCard
              lang="ko"
              recipeName={recipe.name}
              post={instagramPost}
              loading={instagramPostLoading}
              copied={postCopied}
              onGenerate={() => generateInstagramPost("ko")}
              onCopy={async () => {
                if (!instagramPost) return;
                await navigator.clipboard.writeText(instagramPost);
                setPostCopied(true);
                setTimeout(() => setPostCopied(false), 2000);
              }}
            />

            {/* 영어 게시글 */}
            <InstagramPostCard
              lang="en"
              recipeName={recipe.name}
              post={instagramPostEn}
              loading={instagramPostEnLoading}
              copied={postEnCopied}
              onGenerate={() => generateInstagramPost("en")}
              onCopy={async () => {
                if (!instagramPostEn) return;
                await navigator.clipboard.writeText(instagramPostEn);
                setPostEnCopied(true);
                setTimeout(() => setPostEnCopied(false), 2000);
              }}
            />

            <button
              onClick={() => {
                setActiveSection("reel");
                setTimeout(() => reelRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
              }}
              className="w-full mt-6 py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
              🎬 릴스 썸네일 만들기 →
            </button>

            <div className="mt-3 flex gap-3">
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
        {/* =========== REEL SECTION =========== */}
        {activeSection === "reel" && (
          <div className="fade-in-up space-y-5" ref={reelRef}>
            {/* Header */}
            <div className="rounded-3xl overflow-hidden shadow-xl"
              style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
              <div className="p-6 text-white text-center">
                <div className="text-4xl mb-2">🎬</div>
                <h2 className="text-xl font-extrabold mb-1">릴스 썸네일 생성</h2>
                <p className="text-sm opacity-80">완성된 요리 사진을 업로드하면<br/>AI가 릴스용 썸네일을 만들어드려요</p>
              </div>
            </div>

            {/* Upload area */}
            <div className="bg-white rounded-3xl shadow-md overflow-hidden">
              <div className="px-5 py-4"
                style={{ background: "linear-gradient(135deg, #faf5ff, #fdf2f8)" }}>
                <p className="text-sm font-bold text-purple-700">📸 완성된 요리 사진 / 동영상 업로드</p>
                <p className="text-xs text-gray-500 mt-0.5">사진(JPG·PNG·WEBP) 또는 동영상(MP4·MOV) — 동영상은 애니메이션 썸네일로 변환돼요</p>
              </div>
              <div className="p-5">
                <label
                  htmlFor="reel-upload"
                  className="flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:bg-purple-50"
                  style={{ borderColor: reelUploadedImage ? "#7c3aed" : "#d1d5db", minHeight: "160px" }}>
                  {reelUploadedImage ? (
                    <div className="relative w-full" style={{ aspectRatio: "4/3" }}>
                      <Image
                        src={reelUploadedImage}
                        alt="업로드된 요리 사진"
                        fill
                        className="object-cover rounded-2xl"
                        unoptimized
                      />
                      {reelIsVideo && (
                        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                          🎬 동영상
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-bold bg-black/50 px-3 py-1.5 rounded-full">📷 변경</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
                      <span className="text-5xl">📤</span>
                      <p className="text-sm font-bold text-gray-600">여기를 눌러 사진/동영상 업로드</p>
                      <p className="text-xs text-gray-400">완성된 {recipe.name} 사진 또는 동영상 파일</p>
                    </div>
                  )}
                </label>
                <input
                  id="reel-upload"
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={handleReelImageUpload}
                />
                {/* 버튼 행 */}
                <div className="mt-4 flex gap-2">
                  {reelUploadedImage && (
                    <button
                      onClick={generateReelThumbnail}
                      disabled={reelThumbnailLoading}
                      className="flex-1 py-4 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50 active:scale-95"
                      style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
                      {reelThumbnailLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          생성 중...
                        </span>
                      ) : reelThumbnail ? "🔄 재생성" : "✨ 썸네일 생성"}
                    </button>
                  )}
                  <button
                    onClick={generateHookMent}
                    disabled={hookMentLoading}
                    className={`${reelUploadedImage ? "" : "flex-1"} py-4 px-5 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap`}
                    style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                    {hookMentLoading ? (
                      <>
                        <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        생성 중...
                      </>
                    ) : (
                      <>{hookMentAudioUrl ? "🔄" : "🎙️"} 3초 훅 멘트</>
                    )}
                  </button>
                </div>

                {/* 훅 멘트 오디오 플레이어 */}
                {hookMentError && (
                  <p className="mt-2 text-xs text-red-500 px-1">⚠️ {hookMentError}</p>
                )}
                {hookMentAudioUrl && !hookMentLoading && (
                  <div className="mt-3 flex items-center gap-2 px-1">
                    <audio controls src={hookMentAudioUrl} className="flex-1 h-9" />
                    <a
                      href={hookMentAudioUrl}
                      download={`${recipe?.name ?? "recipe"}-hook-ment.mp3`}
                      className="flex-shrink-0 px-3 py-2 rounded-xl text-white text-xs font-bold"
                      style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                      ⬇️
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* 훅 멘트 영상 클립 업로드 */}
            <div className="bg-white rounded-3xl shadow-md overflow-hidden">
              <div className="px-5 py-4"
                style={{ background: "linear-gradient(135deg, #fef3c7, #fde68a)" }}>
                <p className="text-sm font-bold text-amber-700">🎬 훅 멘트용 영상 클립 업로드</p>
                <p className="text-xs text-gray-500 mt-0.5">3초 훅 멘트 중 썸네일(1초) 이후 재생될 영상 클립 — 없으면 썸네일 이미지로 대체됩니다</p>
              </div>
              <div className="p-5">
                <label
                  htmlFor="hook-video-upload"
                  className="flex flex-col items-center justify-center w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all hover:bg-amber-50"
                  style={{ borderColor: hookMentVideoUrl ? "#d97706" : "#d1d5db", minHeight: "120px" }}>
                  {hookMentVideoUrl ? (
                    <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
                      <video
                        src={hookMentVideoUrl}
                        className="w-full h-full object-cover rounded-2xl"
                        muted
                        playsInline
                        onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                        onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-2xl opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-bold bg-black/50 px-3 py-1.5 rounded-full">🎬 변경</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-center px-4">
                      <span className="text-4xl">🎬</span>
                      <p className="text-sm font-bold text-gray-600">훅 멘트용 영상 클립 업로드</p>
                      <p className="text-xs text-gray-400">MP4, MOV 등 — 약 2초 분량 권장</p>
                    </div>
                  )}
                </label>
                <input
                  id="hook-video-upload"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleHookMentVideoUpload}
                />
                {hookMentVideoUrl && (
                  <button
                    onClick={() => { URL.revokeObjectURL(hookMentVideoUrl); setHookMentVideoUrl(null); }}
                    className="mt-3 w-full py-2 rounded-xl text-xs font-bold text-amber-700 border border-amber-300 hover:bg-amber-50 transition-all">
                    ✕ 영상 제거
                  </button>
                )}
              </div>
            </div>

            {/* Generated thumbnail */}
            {reelThumbnailLoading && (
              <div className="bg-white rounded-3xl shadow-md p-10 flex flex-col items-center gap-4">
                <svg className="spinner w-10 h-10 text-purple-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm font-semibold text-gray-500">AI가 릴스 썸네일을 만들고 있어요...</p>
                <p className="text-xs text-gray-400">사진과 레시피 정보를 분석 중</p>
              </div>
            )}

            {reelThumbnail && !reelThumbnailLoading && (
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
                  <span className="text-white text-lg">🎬</span>
                  <p className="text-white font-extrabold text-sm">완성된 릴스 썸네일</p>
                  {reelStyleName && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
                      ✨ {reelStyleName}
                    </span>
                  )}
                  <span className="ml-auto text-white/70 text-xs">
                    {reelIsVideo && reelVideoThumbnailUrl ? "9:16 · 동영상" : "9:16 세로형"}
                  </span>
                </div>
                <div className="relative w-full mx-auto bg-gray-900"
                  style={{ aspectRatio: "9 / 16", maxWidth: "360px" }}>
                  {reelIsVideo && reelVideoThumbnailUrl ? (
                    <video
                      src={reelVideoThumbnailUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <Image
                      src={reelThumbnail}
                      alt="릴스 썸네일"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                  {/* 동영상 변환 진행 중 배지 */}
                  {reelVideoConverting && (
                    <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      <svg className="spinner w-3 h-3" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      동영상 변환 중...
                    </div>
                  )}
                </div>
                <div className="px-5 py-4 flex gap-3"
                  style={{ background: "linear-gradient(135deg, #faf5ff, #fdf2f8)" }}>
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      const useVideo = reelIsVideo && !!reelVideoThumbnailUrl;
                      a.href = useVideo ? reelVideoThumbnailUrl! : reelThumbnail;
                      a.download = useVideo
                        ? `${recipe.name}-reel-thumbnail.webm`
                        : `${recipe.name}-reel-thumbnail.png`;
                      a.click();
                    }}
                    className="flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #7c3aed, #ec4899)" }}>
                    ⬇️ 썸네일 저장
                  </button>
                  <button
                    onClick={generateReelThumbnail}
                    className="px-5 py-3 rounded-2xl font-bold text-sm border-2 transition-all hover:bg-purple-50"
                    style={{ borderColor: "#7c3aed", color: "#7c3aed" }}>
                    🔄 재생성
                  </button>
                </div>
              </div>
            )}

            {/* ── 게시글 커버 이미지 (1:1) ── */}
            <div className="bg-white rounded-3xl shadow-md overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, #fff7ed, #fef3c7)" }}>
                <span className="text-xl">🖼️</span>
                <div>
                  <p className="text-sm font-bold text-orange-700">게시글 커버 이미지 생성</p>
                  <p className="text-xs text-gray-500">1:1 정사각형 · 피드 첫 장 · 호기심 유도</p>
                </div>
              </div>
              <div className="p-5">
                {!reelUploadedImage ? (
                  <p className="text-sm text-center text-gray-400 py-4">
                    위에서 요리 사진을 먼저 업로드해주세요
                  </p>
                ) : (
                  <button
                    onClick={generatePostCover}
                    disabled={postCoverLoading}
                    className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 disabled:opacity-50 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                    {postCoverLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="spinner w-5 h-5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        커버 이미지 생성 중...
                      </span>
                    ) : postCoverImage ? "🔄 커버 이미지 재생성" : "✨ 게시글 커버 이미지 생성하기"}
                  </button>
                )}
              </div>
            </div>

            {postCoverLoading && (
              <div className="bg-white rounded-3xl shadow-md p-10 flex flex-col items-center gap-4">
                <svg className="spinner w-10 h-10 text-orange-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm font-semibold text-gray-500">AI가 게시글 커버를 만들고 있어요...</p>
                <p className="text-xs text-gray-400">호기심을 자극하는 첫 장 이미지 생성 중</p>
              </div>
            )}

            {postCoverError && !postCoverLoading && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
                <p className="text-sm font-bold text-red-600 mb-1">⚠️ 이미지 생성 실패</p>
                <p className="text-xs text-red-500">{postCoverError}</p>
              </div>
            )}

            {postCoverImage && !postCoverLoading && (
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                  <span className="text-white text-lg">🖼️</span>
                  <p className="text-white font-extrabold text-sm">완성된 게시글 커버</p>
                  {postCoverStyleName && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
                      ✨ {postCoverStyleName}
                    </span>
                  )}
                  <span className="ml-auto text-white/70 text-xs">1:1 정사각형</span>
                </div>
                <div className="relative w-full mx-auto bg-gray-900"
                  style={{ aspectRatio: "1 / 1", maxWidth: "360px" }}>
                  <Image
                    src={postCoverImage}
                    alt="게시글 커버 이미지"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="px-5 py-4 flex gap-3"
                  style={{ background: "linear-gradient(135deg, #fff7ed, #fef3c7)" }}>
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = postCoverImage;
                      a.download = `${recipe.name}-post-cover.png`;
                      a.click();
                    }}
                    className="flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #f59e0b, #ef4444)" }}>
                    ⬇️ 커버 저장
                  </button>
                  <button
                    onClick={generatePostCover}
                    className="px-5 py-3 rounded-2xl font-bold text-sm border-2 transition-all hover:bg-orange-50"
                    style={{ borderColor: "#f59e0b", color: "#d97706" }}>
                    🔄 재생성
                  </button>
                </div>
              </div>
            )}

            {/* ── 영문 게시글 커버 이미지 (1:1) ── */}
            <div className="bg-white rounded-3xl shadow-md overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2"
                style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)" }}>
                <span className="text-xl">🌏</span>
                <div>
                  <p className="text-sm font-bold text-blue-700">English Post Cover</p>
                  <p className="text-xs text-gray-500">1:1 square · Feed first image · English</p>
                </div>
              </div>
              <div className="p-5">
                {!reelUploadedImage ? (
                  <p className="text-sm text-center text-gray-400 py-4">
                    위에서 요리 사진을 먼저 업로드해주세요
                  </p>
                ) : (
                  <button
                    onClick={generatePostCoverEn}
                    disabled={postCoverEnLoading}
                    className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 disabled:opacity-50 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                    {postCoverEnLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="spinner w-5 h-5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        Generating English cover...
                      </span>
                    ) : postCoverEnImage ? "🔄 Regenerate" : "✨ Generate English Post Cover"}
                  </button>
                )}
              </div>
            </div>

            {postCoverEnLoading && (
              <div className="bg-white rounded-3xl shadow-md p-10 flex flex-col items-center gap-4">
                <svg className="spinner w-10 h-10 text-blue-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-sm font-semibold text-gray-500">AI is generating English cover...</p>
                <p className="text-xs text-gray-400">Creating an English feed post cover image</p>
              </div>
            )}

            {postCoverEnError && !postCoverEnLoading && (
              <div className="bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
                <p className="text-sm font-bold text-red-600 mb-1">⚠️ Generation failed</p>
                <p className="text-xs text-red-500">{postCoverEnError}</p>
              </div>
            )}

            {postCoverEnImage && !postCoverEnLoading && (
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                  <span className="text-white text-lg">🌏</span>
                  <p className="text-white font-extrabold text-sm">English Post Cover</p>
                  {postCoverEnStyleName && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-white/20 text-white">
                      ✨ {postCoverEnStyleName}
                    </span>
                  )}
                  <span className="ml-auto text-white/70 text-xs">1:1 square</span>
                </div>
                <div className="relative w-full mx-auto bg-gray-900"
                  style={{ aspectRatio: "1 / 1", maxWidth: "360px" }}>
                  <Image
                    src={postCoverEnImage}
                    alt="English post cover"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="px-5 py-4 flex gap-3"
                  style={{ background: "linear-gradient(135deg, #eff6ff, #dbeafe)" }}>
                  <button
                    onClick={() => {
                      const a = document.createElement("a");
                      a.href = postCoverEnImage;
                      a.download = `${recipe.name}-post-cover-en.png`;
                      a.click();
                    }}
                    className="flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90"
                    style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)" }}>
                    ⬇️ Save Cover
                  </button>
                  <button
                    onClick={generatePostCoverEn}
                    className="px-5 py-3 rounded-2xl font-bold text-sm border-2 transition-all hover:bg-blue-50"
                    style={{ borderColor: "#3b82f6", color: "#2563eb" }}>
                    🔄 Regenerate
                  </button>
                </div>
              </div>
            )}

            {/* ── 음성 파일 일괄 다운로드 ── */}
            {(Object.keys(ttsAudioUrls).length > 0 || !!hookMentAudioUrl) && (
              <div className="bg-white rounded-3xl shadow-md overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #f0f9ff, #e0f2fe)" }}>
                  <span className="text-xl">🎙️</span>
                  <div>
                    <p className="text-sm font-bold text-sky-700">음성 파일 일괄 다운로드</p>
                    <p className="text-xs text-gray-500">
                      단계별 MP3{hookMentAudioUrl ? " + 3초 훅 멘트" : ""}를 한 번에 저장하세요
                    </p>
                  </div>
                  <span className="ml-auto text-xs font-semibold text-sky-600 bg-sky-100 px-2.5 py-1 rounded-full">
                    {Object.keys(ttsAudioUrls).length + (hookMentAudioUrl ? 1 : 0)}개
                  </span>
                </div>
                <div className="p-5">
                  <button
                    onClick={() => {
                      const files: { url: string; name: string }[] = [];
                      if (hookMentAudioUrl) {
                        files.push({ url: hookMentAudioUrl, name: `${recipe.name}-00-hook-ment.mp3` });
                      }
                      (Object.entries(ttsAudioUrls) as [string, string][])
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .forEach(([num, url]) => {
                          files.push({ url, name: `${recipe.name}-step${num}-voice.mp3` });
                        });
                      files.forEach(({ url, name }, idx) => {
                        setTimeout(() => {
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = name;
                          a.click();
                        }, idx * 400);
                      });
                    }}
                    className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                    ⬇️ 음성 파일 전체 다운로드 ({Object.keys(ttsAudioUrls).length + (hookMentAudioUrl ? 1 : 0)}개)
                  </button>
                </div>
              </div>
            )}

            {/* ── 릴스 영상 편집 ── */}
            {(hookMentAudioUrl || Object.keys(ttsAudioUrls).length > 0) && (
              <div className="bg-white rounded-3xl shadow-xl overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #1e1b4b, #4c1d95)" }}>
                  <span className="text-white text-xl">🎞️</span>
                  <div>
                    <p className="text-sm font-extrabold text-white">릴스 영상 자동 편집</p>
                    <p className="text-xs text-white/70">생성된 이미지와 음성을 하나의 영상으로 조합</p>
                  </div>
                </div>
                <div className="px-5 py-4 space-y-2 bg-indigo-50/50">
                  <p className="text-xs font-bold text-indigo-700">편집 순서</p>
                  {hookMentAudioUrl && (
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-[10px]">1</span>
                      <span>
                        <strong>훅 멘트</strong> — 썸네일 1초 + {hookMentVideoUrl ? "업로드 영상" : "썸네일"} {hookMentAudioUrl ? "~2초" : "—"}
                        {!hookMentVideoUrl && <span className="text-amber-500 ml-1">(위에 영상 업로드 시 적용)</span>}
                      </span>
                    </div>
                  )}
                  {Object.keys(ttsAudioUrls).length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-[10px]">{hookMentAudioUrl ? 2 : 1}</span>
                      <span>
                        <strong>조리 단계</strong> — 이미지+음성 생성된 {Object.keys(ttsAudioUrls).filter(n => stepImages[Number(n)]).length}개 단계 (단계 사이 0.3초 간격 · 하단 자막 포함)
                        {Object.keys(ttsAudioUrls).filter(n => !stepImages[Number(n)]).length > 0 && (
                          <span className="text-gray-400 ml-1">(카드 이미지 없는 단계는 제외)</span>
                        )}
                      </span>
                    </div>
                  )}
                  {(ingredientsImage || kickInstagramImage) && (
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center flex-shrink-0 font-bold text-[10px]">{(hookMentAudioUrl ? 1 : 0) + (Object.keys(ttsAudioUrls).length > 0 ? 1 : 0) + 1}</span>
                      <span>
                        <strong>마무리</strong> —{ingredientsImage ? " 재료 이미지 1초" : ""}{ingredientsImage && kickInstagramImage ? " +" : ""}{kickInstagramImage ? " 성공포인트 1초" : ""}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <button
                    onClick={createFinalVideo}
                    disabled={finalVideoLoading}
                    className="w-full py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 disabled:opacity-60 active:scale-95"
                    style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                    {finalVideoLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="spinner w-5 h-5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        편집 중... {finalVideoProgress}%
                      </span>
                    ) : "🎞️ 영상 편집하기"}
                  </button>
                  {finalVideoLoading && (
                    <div className="mt-3">
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${finalVideoProgress}%`, background: "linear-gradient(90deg, #4f46e5, #7c3aed)" }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                {finalVideoUrl && !finalVideoLoading && (
                  <div>
                    <div className="relative w-full mx-auto bg-black" style={{ aspectRatio: "9/16", maxWidth: "320px" }}>
                      <video
                        src={finalVideoUrl}
                        controls
                        playsInline
                        className="absolute inset-0 w-full h-full object-contain"
                      />
                    </div>
                    <div className="px-5 py-4 flex gap-3"
                      style={{ background: "linear-gradient(135deg, #ede9fe, #ddd6fe)" }}>
                      <button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = finalVideoUrl;
                          a.download = `${recipe.name}-reels.${finalVideoExt}`;
                          a.click();
                        }}
                        className="flex-1 py-3 rounded-2xl text-white font-bold text-sm transition-all hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, #4f46e5, #7c3aed)" }}>
                        ⬇️ 영상 다운로드
                      </button>
                      <button
                        onClick={createFinalVideo}
                        className="px-5 py-3 rounded-2xl font-bold text-sm border-2 transition-all hover:bg-indigo-50"
                        style={{ borderColor: "#4f46e5", color: "#4f46e5" }}>
                        🔄 재편집
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── 콘텐츠 패키지 일괄 다운로드 ── */}
            <div className="bg-white rounded-3xl shadow-md overflow-hidden">
              <div className="px-5 py-4"
                style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
                <p className="text-sm font-bold text-green-700">📦 콘텐츠 패키지 다운로드</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  생성된 이미지 + 인스타 게시글을 언어별로 한 번에 받아보세요
                </p>
              </div>
              <div className="p-5 space-y-3">
                {/* 한국어 패키지 */}
                {(() => {
                  const koImages = [
                    ingredientsImage, ...Object.values(stepImages), kickInstagramImage, summaryImage
                  ].filter(Boolean);
                  const koCount = koImages.length + (instagramPost ? 1 : 0);
                  return (
                    <button
                      onClick={() => downloadPackage("ko")}
                      disabled={koCount === 0}
                      className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
                      <span className="flex items-center gap-2 text-sm">
                        🇰🇷 한국어 패키지 다운로드
                      </span>
                      <span className="text-xs font-semibold opacity-80 bg-white/20 px-2 py-0.5 rounded-full">
                        이미지 {koImages.length}장{instagramPost ? " + 게시글" : ""}
                      </span>
                    </button>
                  );
                })()}

                {/* 영어 패키지 */}
                {(() => {
                  const enImages = [
                    ingredientsImageEn, ...Object.values(stepImagesEn), kickInstagramImageEn, summaryImage
                  ].filter(Boolean);
                  const enCount = enImages.length + (instagramPostEn ? 1 : 0);
                  return (
                    <button
                      onClick={() => downloadPackage("en")}
                      disabled={enCount === 0}
                      className="w-full flex items-center justify-between px-5 py-4 rounded-2xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "linear-gradient(135deg, #0ea5e9, #6366f1)" }}>
                      <span className="flex items-center gap-2 text-sm">
                        🌎 English Package Download
                      </span>
                      <span className="text-xs font-semibold opacity-80 bg-white/20 px-2 py-0.5 rounded-full">
                        {enImages.length} images{instagramPostEn ? " + post" : ""}
                      </span>
                    </button>
                  );
                })()}

                <p className="text-xs text-center text-gray-400">
                  아직 생성되지 않은 이미지는 포함되지 않아요 · 먼저 각 섹션에서 생성해주세요
                </p>
              </div>
            </div>

            <div className="mt-2 flex gap-3">
              <button
                onClick={() => {
                  setActiveSection("summary");
                  setTimeout(() => summaryRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
                }}
                className="flex-1 py-4 rounded-2xl font-bold text-base transition-all border-2"
                style={{ borderColor: "#7c3aed", color: "#7c3aed" }}>
                ← 요약으로 돌아가기
              </button>
              <button
                onClick={() => router.push("/")}
                className="flex-1 py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>
                🏠 새 레시피
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
