"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { RecipeDetail } from "@/types/recipe";
import { NarrationSegment } from "@/types/shorts";
import { ShortsKeypointResult } from "@/lib/agents/shorts-keypoint-extractor";

// ── Types ─────────────────────────────────────────────────────────────────────
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

// ── Constants ────────────────────────────────────────────────────────────────
const CHARACTER_TO_TONE: Record<string, string> = {
  cute_bear: "cute",
  lazy_bear: "lazy",
  trend_bear: "trend",
};

const CHARACTERS = [
  { id: "cute",  label: "🐻 귀여운 곰돌이" },
  { id: "lazy",  label: "🐨 귀차니즘 곰돌이" },
  { id: "trend", label: "🐼 트렌드곰" },
] as const;

const THUMBNAIL_STYLES = [
  { id: 1, name: "무드 에디토리얼" },
  { id: 2, name: "볼드 컬러 포스터" },
  { id: 3, name: "드라마틱 클로즈업" },
  { id: 4, name: "레시피 인포그래픽" },
  { id: 5, name: "내추럴 오가닉" },
  { id: 6, name: "TV 요리쇼" },
] as const;

// Camera zoompan positions for the recipe map (1080×1920 source)
const CAMERA_POS: Record<string, { cx: number; cy: number; zoom: number }> = {
  top:         { cx: 540, cy: 190,  zoom: 1.5 },
  problem:     { cx: 540, cy: 420,  zoom: 1.3 },
  point1:      { cx: 540, cy: 860,  zoom: 1.9 },
  point2:      { cx: 540, cy: 1060, zoom: 1.9 },
  point3:      { cx: 540, cy: 1260, zoom: 1.9 },
  bottom:      { cx: 540, cy: 1650, zoom: 1.5 },
  full:        { cx: 540, cy: 960,  zoom: 1.0 },
};

// ── Canvas helpers ────────────────────────────────────────────────────────────
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
  align: CanvasTextAlign = "center",
) {
  ctx.textAlign = align;
  const chars = Array.from(text);
  let line = "";
  let drawn = 0;
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      if (drawn >= maxLines - 1) { ctx.fillText(line + "…", x, y + drawn * lineHeight); return; }
      ctx.fillText(line, x, y + drawn * lineHeight);
      line = ch;
      drawn++;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y + drawn * lineHeight);
}

// Client-side canvas recipe map generation (instant, no API cost)
async function drawRecipeMapCanvas(
  recipe: RecipeDetail,
  kp: ShortsKeypointResult,
  foodImage: string | null,
  character: string,
): Promise<string> {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#0D1B2A";
  ctx.fillRect(0, 0, W, H);

  // TOP SECTION: food photo or emoji (0-620px)
  if (foodImage) {
    try {
      const img = await loadImg(foodImage);
      const srcRatio = img.naturalWidth / img.naturalHeight;
      const dstRatio = W / 620;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (srcRatio > dstRatio) { sw = Math.round(sh * dstRatio); sx = Math.round((img.naturalWidth - sw) / 2); }
      else { sh = Math.round(sw / dstRatio); sy = Math.round((img.naturalHeight - sh) / 2); }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, 620);
    } catch { /* skip, show emoji */ }
  }
  if (!foodImage) {
    ctx.font = "160px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(recipe.emoji ?? "🍽️", W / 2, 310);
  }

  // Dark gradient over food area
  const grad = ctx.createLinearGradient(0, 300, 0, 620);
  grad.addColorStop(0, "rgba(13,27,42,0)");
  grad.addColorStop(1, "rgba(13,27,42,0.93)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, 620);

  // Hook text
  ctx.font = "bold 52px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "top";
  wrapText(ctx, kp.hook, W / 2, 490, W - 80, 64, 2);

  // MIDDLE: Problem text
  ctx.font = "bold 32px sans-serif";
  ctx.fillStyle = "#FF9A56";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  wrapText(ctx, kp.problem, W / 2, 648, W - 80, 40, 2);

  // 3 Keypoint cards (y: 760-1440)
  const CARD_H = 210, CARD_GAP = 18;
  kp.keyPoints.slice(0, 3).forEach((pt, i) => {
    const y = 760 + i * (CARD_H + CARD_GAP);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 36, y, W - 72, CARD_H, 24);
    ctx.fill();
    ctx.fillStyle = "#FF6B35";
    roundRect(ctx, 36, y, 8, CARD_H, 4);
    ctx.fill();
    // Number circle
    ctx.beginPath();
    ctx.arc(102, y + CARD_H / 2, 34, 0, Math.PI * 2);
    ctx.fillStyle = "#FF6B35";
    ctx.fill();
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "#FFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), 102, y + CARD_H / 2);
    // Title
    ctx.font = "bold 36px sans-serif";
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(pt.title.slice(0, 16), 155, y + 38);
    // Description
    ctx.font = "26px sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    wrapText(ctx, pt.description, 155, y + 98, W - 210, 34, 2, "left");
  });

  // BOTTOM: Ingredient save card (1462-1880px)
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 1462, W, 418);

  ctx.font = "22px sans-serif";
  ctx.fillStyle = "#FF6B35";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("📌 저장용 재료카드", 48, 1478);

  ctx.font = "bold 36px sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(kp.saveCard.title.slice(0, 22), 48, 1516);

  ctx.font = "26px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  const ingList = kp.saveCard.ingredients.slice(0, 8);
  ingList.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    ctx.fillText(`• ${item}`, col === 0 ? 48 : W / 2 + 20, 1570 + row * 44);
  });

  // Character image
  const charFile = character === "lazy" ? "chef-bear-reference-1.png"
                 : character === "trend" ? "chef-bear-reference-2.png"
                 : "chef-bear-reference.png";
  try {
    const charImg = await loadImg(`/${charFile}`);
    const charH = 280;
    const charW = Math.round(charImg.naturalWidth * charH / charImg.naturalHeight);
    ctx.drawImage(charImg, W - charW - 16, 1600, charW, charH);
  } catch { /* skip */ }

  // Brand handle
  ctx.font = "22px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("@oh_showong", W / 2, 1890);

  return canvas.toDataURL("image/jpeg", 0.92);
}

// ── Image utilities ───────────────────────────────────────────────────────────
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = document.createElement("img");
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("이미지 로드 실패")); };
    img.src = url;
  });
}

function cropImageToRatio(dataUrl: string, targetW: number, targetH: number): Promise<string> {
  return new Promise((resolve) => {
    const img = document.createElement("img");
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      const targetRatio = targetW / targetH;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;
      if (imgRatio > targetRatio) { sw = Math.round(sh * targetRatio); sx = Math.round((img.naturalWidth - sw) / 2); }
      else if (imgRatio < targetRatio) { sh = Math.round(sw / targetRatio); sy = Math.round((img.naturalHeight - sh) / 2); }
      const canvas = document.createElement("canvas");
      canvas.width = targetW; canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
      resolve(canvas.toDataURL("image/png", 0.95));
    };
    img.src = dataUrl;
  });
}

// ── Shorts video renderer ─────────────────────────────────────────────────────
async function createShortsVideo(
  recipeMapDataUrl: string,
  segments: NarrationSegment[],
  ttsAudios: Record<string, string>,
  onProgress: (p: number) => void,
): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const CANVAS_W = 1080, CANVAS_H = 1920;
  const TRANSITION = 0.4;

  const mapImg = await loadImg(recipeMapDataUrl);
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();

  function getCameraRect(camKey: string) {
    const pos = CAMERA_POS[camKey] ?? CAMERA_POS.full;
    const sw = mapImg.naturalWidth / pos.zoom;
    const sh = mapImg.naturalHeight / pos.zoom;
    const sx = Math.max(0, Math.min(mapImg.naturalWidth - sw, pos.cx - sw / 2));
    const sy = Math.max(0, Math.min(mapImg.naturalHeight - sh, pos.cy - sh / 2));
    return { sx, sy, sw, sh };
  }

  // Decode audio per segment
  interface VSeg { start: number; dur: number; camera: string; text: string; audioBuf: AudioBuffer | null }
  const vsegs: VSeg[] = [];
  let cursor = 0;
  for (const seg of segments) {
    const url = ttsAudios[seg.id];
    let audioBuf: AudioBuffer | null = null;
    if (url) {
      try {
        audioBuf = await audioCtx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      } catch { /* skip */ }
    }
    const dur = audioBuf ? audioBuf.duration : (seg.estimatedEndSec - seg.estimatedStartSec);
    vsegs.push({ start: cursor, dur, camera: seg.cameraSection, text: seg.text, audioBuf });
    cursor += dur + 0.12;
  }
  const totalDur = cursor;

  // Canvas + recorder
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W; canvas.height = CANVAS_H;
  const ctx2d = canvas.getContext("2d")!;

  const candidateConfigs = [
    { mimeType: "video/mp4",                  videoBitsPerSecond: 2_500_000 },
    { mimeType: "video/webm;codecs=vp9,opus", videoBitsPerSecond: 2_000_000 },
    { mimeType: "video/webm;codecs=vp8,opus", videoBitsPerSecond: 1_500_000 },
    { mimeType: "video/webm",                 videoBitsPerSecond: 1_000_000 },
  ].filter((c) => MediaRecorder.isTypeSupported(c.mimeType));
  if (candidateConfigs.length === 0) candidateConfigs.push({ mimeType: "video/webm", videoBitsPerSecond: 1_000_000 });

  const chosenConfig = candidateConfigs[0];
  const ext: "mp4" | "webm" = chosenConfig.mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  const combined = new MediaStream([
    ...canvas.captureStream(30).getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);
  const recorder = new MediaRecorder(combined, chosenConfig);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  // Schedule audio
  await audioCtx.resume();
  const START_DELAY = 0.3;
  const t0 = audioCtx.currentTime + START_DELAY;
  for (const vseg of vsegs) {
    if (vseg.audioBuf) {
      const src = audioCtx.createBufferSource();
      src.buffer = vseg.audioBuf;
      src.connect(dest);
      src.start(t0 + vseg.start);
    }
  }

  const stopPromise = new Promise<void>((res, rej) => {
    recorder.onstop = () => res();
    recorder.onerror = (e) => rej(new Error(`MediaRecorder 오류: ${(e as { error?: { message?: string } }).error?.message ?? "Unknown"}`));
  });

  recorder.start(100);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
  const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  function drawSubtitle(text: string) {
    if (!text) return;
    const FS = 46, LINE_H = 60, PAD = 50, MAX_W = CANVAS_W - PAD * 2;
    ctx2d.font = `bold ${FS}px sans-serif`;
    ctx2d.textAlign = "center";
    ctx2d.textBaseline = "top";
    const lines: string[] = [];
    let line = "";
    for (const ch of Array.from(text)) {
      const test = line + ch;
      if (ctx2d.measureText(test).width > MAX_W && line.length > 0) {
        lines.push(line); line = ch;
        if (lines.length >= 2) break;
      } else { line = test; }
    }
    if (line && lines.length < 2) lines.push(line);
    const bgH = lines.length * LINE_H + 28;
    const bgY = CANVAS_H - bgH - 60;
    ctx2d.fillStyle = "rgba(0,0,0,0.65)";
    ctx2d.fillRect(0, bgY, CANVAS_W, bgH + 4);
    ctx2d.fillStyle = "#FFFFFF";
    ctx2d.shadowColor = "rgba(0,0,0,0.8)";
    ctx2d.shadowBlur = 3;
    lines.forEach((l, i) => ctx2d.fillText(l, CANVAS_W / 2, bgY + 14 + i * LINE_H));
    ctx2d.shadowBlur = 0;
  }

  await new Promise<void>((resolve) => {
    const wallStart = performance.now();
    const safetyTimer = setTimeout(resolve, (START_DELAY + totalDur + 5) * 1000);

    const animate = () => {
      const elapsed = (performance.now() - wallStart) / 1000 - START_DELAY;
      if (elapsed >= totalDur + 0.3) { clearTimeout(safetyTimer); resolve(); return; }

      onProgress(Math.round(Math.max(0, Math.min(99, (Math.max(0, elapsed) / totalDur) * 100))));

      ctx2d.fillStyle = "#000";
      ctx2d.fillRect(0, 0, CANVAS_W, CANVAS_H);

      if (elapsed >= 0) {
        const curIdx = vsegs.reduce((acc, s, i) => (elapsed >= s.start ? i : acc), 0);
        const cur = vsegs[curIdx];
        const next = vsegs[curIdx + 1];
        const curR = getCameraRect(cur.camera);

        if (next) {
          const progress = (elapsed - cur.start) / cur.dur;
          const tStart = Math.max(0, 1 - TRANSITION / cur.dur);
          if (progress >= tStart) {
            const t = ease((progress - tStart) / (1 - tStart));
            const nextR = getCameraRect(next.camera);
            ctx2d.drawImage(mapImg,
              lerp(curR.sx, nextR.sx, t), lerp(curR.sy, nextR.sy, t),
              lerp(curR.sw, nextR.sw, t), lerp(curR.sh, nextR.sh, t),
              0, 0, CANVAS_W, CANVAS_H);
          } else {
            ctx2d.drawImage(mapImg, curR.sx, curR.sy, curR.sw, curR.sh, 0, 0, CANVAS_W, CANVAS_H);
          }
        } else {
          ctx2d.drawImage(mapImg, curR.sx, curR.sy, curR.sw, curR.sh, 0, 0, CANVAS_W, CANVAS_H);
        }
        drawSubtitle(cur.text);
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  });

  recorder.stop();
  await stopPromise;
  await audioCtx.close();
  return { blob: new Blob(chunks, { type: chosenConfig.mimeType }), ext };
}

// ── Text / file helpers ───────────────────────────────────────────────────────
function downloadBlob(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function downloadText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadBlob(url, filename);
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────
function AdminShortsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<"pipeline" | "thumbnail">("pipeline");

  // ── Shared recipe selector ──
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipeSummary[]>([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [fillError, setFillError] = useState<string | null>(null);
  const [loadedRecipe, setLoadedRecipe] = useState<RecipeDetail | null>(null);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [recipeCharacter, setRecipeCharacter] = useState<string>("cute");

  // ── Pipeline tab ──
  const [keypoints, setKeypoints] = useState<ShortsKeypointResult | null>(null);
  const [narrationSegments, setNarrationSegments] = useState<NarrationSegment[]>([]);
  const [srtContent, setSrtContent] = useState<string>("");
  const [caption, setCaption] = useState<string>("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [shortsLoading, setShortsLoading] = useState(false);
  const [shortsError, setShortsError] = useState<string | null>(null);

  const [recipeMapImage, setRecipeMapImage] = useState<string | null>(null);
  const [recipeMapLoading, setRecipeMapLoading] = useState(false);
  const [recipeMapError, setRecipeMapError] = useState<string | null>(null);

  const [ttsAudios, setTtsAudios] = useState<Record<string, string>>({});
  const [ttsLoading, setTtsLoading] = useState<Record<string, boolean>>({});
  const [ttsErrors, setTtsErrors] = useState<Record<string, string>>({});
  const [ttsAllLoading, setTtsAllLoading] = useState(false);

  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const finalVideoBlobRef = useRef<{ blob: Blob; ext: "mp4" | "webm" } | null>(null);
  const [renderLoading, setRenderLoading] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  // ── Thumbnail tab (existing) ──
  const [recipeName, setRecipeName] = useState("");
  const [highlight, setHighlight] = useState("");
  const [taste, setTaste] = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [servings, setServings] = useState("");
  const [pairings, setPairings] = useState("");
  const [kickPoints, setKickPoints] = useState("");
  const [thumbCharacter, setThumbCharacter] = useState<string>("cute");
  const [styleId, setStyleId] = useState<number | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [styleName, setStyleName] = useState<string | null>(null);

  // ── Fill from saved recipe ────────────────────────────────────────────────
  const fillFromRecipe = useCallback(async (id: string) => {
    setFillError(null);
    try {
      const res = await fetch(`/api/recipes?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.error || !data.recipe) { setFillError(data.error ?? "레시피를 불러오지 못했습니다."); return; }

      const record = data.recipe as {
        character: string;
        heroImage?: string | null;
        recipe: RecipeDetail;
      };
      const r = record.recipe;
      const tone = CHARACTER_TO_TONE[record.character] ?? "cute";

      setSelectedRecipeId(id);
      setLoadedRecipe(r);
      setHeroImage(record.heroImage ?? null);
      setRecipeCharacter(tone);

      // Reset pipeline state
      setKeypoints(null);
      setNarrationSegments([]);
      setSrtContent("");
      setCaption("");
      setHashtags([]);
      setShortsError(null);
      setRecipeMapImage(null);
      setRecipeMapError(null);
      setTtsAudios({});
      setTtsErrors({});
      setFinalVideoUrl(null);
      finalVideoBlobRef.current = null;
      setRenderError(null);

      // Thumbnail tab fields
      setRecipeName(r.name ?? "");
      setHighlight(r.highlight ?? "");
      setTaste(r.taste ?? "");
      setCookingTime(r.totalTime ?? "");
      setServings(r.servings != null ? String(r.servings) : "");
      setPairings((r.pairings ?? []).join(", "));
      setKickPoints(
        (r.steps ?? [])
          .filter((s) => s.isKick && s.kickReason)
          .map((s) => s.kickReason)
          .join(" / "),
      );
      setThumbCharacter(tone);
      if (record.heroImage) setUploadedImage(record.heroImage);
      setThumbnail(null);
    } catch { setFillError("레시피를 불러오지 못했습니다."); }
  }, []);

  // ── Load saved recipes + handle ?recipeId= ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRecipesLoading(true);
      try {
        const res = await fetch("/api/recipes");
        const data = await res.json();
        if (!cancelled && !data.error) setSavedRecipes(data.recipes ?? []);
      } catch { /* 수동 입력으로 진행 가능 */ }
      finally { if (!cancelled) setRecipesLoading(false); }
      const preselect = searchParams.get("recipeId");
      if (preselect && !cancelled) void fillFromRecipe(preselect);
    })();
    return () => { cancelled = true; };
  }, [searchParams, fillFromRecipe]);

  // ── Pipeline: Step 1 — extract keypoints + narration ─────────────────────
  const extractKeypoints = async () => {
    if (!loadedRecipe) return;
    setShortsLoading(true);
    setShortsError(null);
    setKeypoints(null);
    setNarrationSegments([]);
    try {
      const res = await fetch("/api/generate-shorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe: loadedRecipe, character: recipeCharacter }),
      });
      const data = await res.json();
      if (data.error) { setShortsError(data.error); return; }
      setKeypoints(data.keypoints);
      setNarrationSegments(data.narrationSegments ?? []);
      setSrtContent(data.srtContent ?? "");
      setCaption(data.caption ?? "");
      setHashtags(data.hashtags ?? []);
    } catch (e) { setShortsError(e instanceof Error ? e.message : "추출 실패"); }
    finally { setShortsLoading(false); }
  };

  // ── Pipeline: Step 2 — generate recipe map ────────────────────────────────
  const generateCanvasMap = async () => {
    if (!loadedRecipe || !keypoints) return;
    setRecipeMapLoading(true);
    setRecipeMapError(null);
    try {
      const dataUrl = await drawRecipeMapCanvas(loadedRecipe, keypoints, heroImage, recipeCharacter);
      setRecipeMapImage(dataUrl);
    } catch (e) { setRecipeMapError(e instanceof Error ? e.message : "생성 실패"); }
    finally { setRecipeMapLoading(false); }
  };

  const generateAiMap = async () => {
    if (!loadedRecipe || !keypoints) return;
    setRecipeMapLoading(true);
    setRecipeMapError(null);
    try {
      let heroBase64: string | undefined;
      let heroMime: string | undefined;
      if (heroImage) {
        const match = heroImage.match(/^data:([^;]+);base64,(.+)$/);
        if (match) { heroMime = match[1]; heroBase64 = match[2]; }
      }
      const res = await fetch("/api/generate-shorts-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: loadedRecipe.name,
          keypoints,
          character: recipeCharacter,
          heroImageBase64: heroBase64,
          heroImageMimeType: heroMime,
        }),
      });
      const data = await res.json();
      if (data.error) { setRecipeMapError(data.error); return; }
      if (data.imageUrl) {
        const cropped = await cropImageToRatio(data.imageUrl, 1080, 1920);
        setRecipeMapImage(cropped);
      }
    } catch (e) { setRecipeMapError(e instanceof Error ? e.message : "AI 생성 실패"); }
    finally { setRecipeMapLoading(false); }
  };

  // ── Pipeline: Step 3 — TTS per segment ────────────────────────────────────
  const generateSegmentTts = async (segId: string, text: string) => {
    setTtsLoading((p) => ({ ...p, [segId]: true }));
    setTtsErrors((p) => ({ ...p, [segId]: "" }));
    try {
      const res = await fetch("/api/generate-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "direct", text, character: recipeCharacter }),
      });
      const data = await res.json();
      if (data.error) { setTtsErrors((p) => ({ ...p, [segId]: data.error })); }
      else if (data.audioUrl) { setTtsAudios((p) => ({ ...p, [segId]: data.audioUrl })); }
    } catch (e) { setTtsErrors((p) => ({ ...p, [segId]: e instanceof Error ? e.message : "TTS 실패" })); }
    finally { setTtsLoading((p) => ({ ...p, [segId]: false })); }
  };

  const generateAllTts = async () => {
    if (narrationSegments.length === 0) return;
    setTtsAllLoading(true);
    await Promise.all(
      narrationSegments
        .filter((s) => s.text && !ttsAudios[s.id])
        .map((s) => generateSegmentTts(s.id, s.text)),
    );
    setTtsAllLoading(false);
  };

  // ── Pipeline: Step 4 — render video ──────────────────────────────────────
  const renderVideo = async () => {
    if (!recipeMapImage) { setRenderError("레시피맵 이미지가 필요합니다."); return; }
    setRenderLoading(true);
    setRenderProgress(0);
    setRenderError(null);
    if (finalVideoUrl) URL.revokeObjectURL(finalVideoUrl);
    setFinalVideoUrl(null);
    finalVideoBlobRef.current = null;
    try {
      const { blob, ext } = await createShortsVideo(
        recipeMapImage,
        narrationSegments,
        ttsAudios,
        setRenderProgress,
      );
      finalVideoBlobRef.current = { blob, ext };
      setFinalVideoUrl(URL.createObjectURL(blob));
      setRenderProgress(100);
    } catch (e) { setRenderError(e instanceof Error ? e.message : "영상 합성 실패"); }
    finally { setRenderLoading(false); }
  };

  // ── Pipeline: Step 5 — download package ──────────────────────────────────
  const downloadPackage = () => {
    const name = loadedRecipe?.name ?? "recipe";

    if (finalVideoBlobRef.current) {
      const { blob, ext } = finalVideoBlobRef.current;
      const url = URL.createObjectURL(blob);
      setTimeout(() => { downloadBlob(url, `${name}-shorts.${ext}`); URL.revokeObjectURL(url); }, 0);
    }
    if (recipeMapImage) setTimeout(() => downloadBlob(recipeMapImage, `${name}-thumbnail.png`), 300);
    if (srtContent)     setTimeout(() => downloadText(srtContent, `${name}-subtitle.srt`), 600);
    if (caption)        setTimeout(() => downloadText(caption, `${name}-caption.txt`), 900);
    if (hashtags.length) {
      setTimeout(() => downloadText(hashtags.join("\n"), `${name}-hashtags.txt`), 1200);
    }
  };

  // ── Thumbnail tab handlers ────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setThumbnail(null); setThumbError(null);
    try { setUploadedImage(await compressImage(file)); } catch { setThumbError("이미지를 불러오지 못했습니다."); }
  };

  const generateThumbnail = async () => {
    if (!recipeName.trim()) { setThumbError("레시피 이름을 입력해주세요."); return; }
    if (!uploadedImage) { setThumbError("음식 사진을 업로드해주세요."); return; }
    setThumbLoading(true); setThumbError(null); setThumbnail(null); setStyleName(null);
    try {
      const matches = uploadedImage.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) { setThumbError("이미지 형식 오류입니다."); return; }
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipeName.trim(), type: "reel-thumbnail",
          uploadedImageBase64: matches[2], uploadedImageMimeType: matches[1],
          highlight: highlight.trim(), cookingTime: cookingTime.trim(), servings: servings.trim(),
          taste: taste.trim(), pairings: pairings.split(",").map((p) => p.trim()).filter(Boolean),
          kickPoints: kickPoints.trim(), character: thumbCharacter, styleId,
        }),
      });
      const data = await res.json();
      if (data.error) { setThumbError(data.error); }
      else if (data.imageUrl) {
        setThumbnail(await cropImageToRatio(data.imageUrl, 1080, 1920));
        setStyleName(data.styleName ?? null);
      } else { setThumbError("이미지를 생성하지 못했습니다."); }
    } catch (e) { setThumbError(e instanceof Error ? e.message : "썸네일 생성 실패"); }
    finally { setThumbLoading(false); }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" };
  const inset = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.10)" };
  const orangeGrad = { background: "linear-gradient(135deg, #ff6b35, #ffc857)" };
  const ttsReady = narrationSegments.every((s) => ttsAudios[s.id]);

  // ── Recipe selector (shared) ──────────────────────────────────────────────
  const RecipeSelector = () => (
    <div className="p-5 rounded-2xl" style={card}>
      <label className="block text-white font-bold mb-3 text-sm">⓪ 유저 레시피 선택</label>
      {recipesLoading ? (
        <p className="text-white/40 text-sm">불러오는 중...</p>
      ) : savedRecipes.length === 0 ? (
        <p className="text-white/40 text-sm">저장된 레시피가 없습니다.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {savedRecipes.map((r) => (
            <button
              key={r.id}
              onClick={() => fillFromRecipe(r.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
              style={selectedRecipeId === r.id
                ? { background: "rgba(255,107,53,0.18)", border: "1px solid rgba(255,107,53,0.5)" }
                : inset}>
              <span className="text-2xl flex-shrink-0">{r.emoji || "🍽️"}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-white text-sm font-bold truncate">{r.name}</span>
                <span className="block text-white/40 text-xs">⏱ {r.totalTime} · {r.servings}인분</span>
              </span>
              {selectedRecipeId === r.id && <span className="text-orange-300 text-sm">✓</span>}
            </button>
          ))}
        </div>
      )}
      {fillError && <p className="text-red-300 text-xs mt-2">⚠️ {fillError}</p>}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="text-white text-center mb-8">
          <div className="text-5xl mb-4">🎬</div>
          <h1 className="text-3xl font-extrabold mb-2">쇼츠 생성기</h1>
          <p className="text-white/50 text-sm">레시피 선택 → 핵심포인트 → 레시피맵 → TTS → 영상 합성</p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 p-1 rounded-2xl" style={card}>
          {([["pipeline", "🎥 쇼츠 생성"], ["thumbnail", "🖼️ 썸네일만"]] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={activeTab === tab ? orangeGrad : { color: "rgba(255,255,255,0.5)" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ────────── PIPELINE TAB ────────── */}
        {activeTab === "pipeline" && (
          <div className="space-y-5">
            <RecipeSelector />

            {/* STEP 1: Keypoint extraction */}
            <div className="p-5 rounded-2xl space-y-4" style={card}>
              <div className="flex items-center justify-between">
                <label className="text-white font-bold text-sm">① 핵심 포인트 & 나레이션 스크립트 생성</label>
                {keypoints && <span className="text-green-400 text-xs">✓ 완료</span>}
              </div>

              <button
                onClick={extractKeypoints}
                disabled={!loadedRecipe || shortsLoading}
                className="w-full py-3 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40"
                style={orangeGrad}>
                {shortsLoading ? "🔄 추출 중..." : "🔍 핵심 포인트 추출"}
              </button>
              {shortsError && <p className="text-red-300 text-xs">⚠️ {shortsError}</p>}

              {keypoints && (
                <div className="space-y-3">
                  {/* Hook + Problem preview */}
                  <div className="p-3 rounded-xl space-y-1" style={inset}>
                    <p className="text-orange-300 text-xs font-bold">훅</p>
                    <p className="text-white text-sm">{keypoints.hook}</p>
                  </div>
                  <div className="p-3 rounded-xl space-y-1" style={inset}>
                    <p className="text-orange-300 text-xs font-bold">문제제기</p>
                    <p className="text-white text-sm">{keypoints.problem}</p>
                  </div>
                  {/* 3 keypoints */}
                  {keypoints.keyPoints.map((kp, i) => (
                    <div key={i} className="p-3 rounded-xl flex gap-3" style={inset}>
                      <span className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                        style={{ background: "#FF6B35" }}>{i + 1}</span>
                      <div>
                        <p className="text-white text-sm font-bold">{kp.title}</p>
                        <p className="text-white/60 text-xs mt-0.5">{kp.description}</p>
                      </div>
                    </div>
                  ))}
                  {/* Narration segments */}
                  <p className="text-white/50 text-xs mt-2">나레이션 스크립트 ({narrationSegments.length}구간)</p>
                  {narrationSegments.map((seg) => (
                    <div key={seg.id} className="p-2.5 rounded-xl flex items-start gap-2" style={inset}>
                      <span className="text-orange-300 text-xs w-16 flex-shrink-0 font-bold">{seg.label}</span>
                      <span className="text-white/80 text-xs flex-1">{seg.text}</span>
                      <span className="text-white/30 text-xs">{seg.estimatedStartSec}~{seg.estimatedEndSec}s</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 2: Recipe map */}
            <div className="p-5 rounded-2xl space-y-3" style={card}>
              <div className="flex items-center justify-between">
                <label className="text-white font-bold text-sm">② 레시피맵 이미지 생성</label>
                {recipeMapImage && <span className="text-green-400 text-xs">✓ 완료</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={generateCanvasMap}
                  disabled={!keypoints || recipeMapLoading}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #2563eb, #7c3aed)" }}>
                  {recipeMapLoading ? "🔄 생성 중..." : "⚡ 즉시 생성 (캔버스)"}
                </button>
                <button
                  onClick={generateAiMap}
                  disabled={!keypoints || recipeMapLoading}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }}>
                  {recipeMapLoading ? "🔄 AI 생성 중..." : "✨ AI 이미지 생성"}
                </button>
              </div>
              {recipeMapError && <p className="text-red-300 text-xs">⚠️ {recipeMapError}</p>}
              {recipeMapImage && (
                <div className="relative w-40 mx-auto rounded-xl overflow-hidden" style={{ aspectRatio: "9/16" }}>
                  <Image src={recipeMapImage} alt="레시피맵" fill className="object-cover" unoptimized />
                </div>
              )}
            </div>

            {/* STEP 3: TTS narration */}
            <div className="p-5 rounded-2xl space-y-3" style={card}>
              <div className="flex items-center justify-between">
                <label className="text-white font-bold text-sm">③ TTS 나레이션 생성</label>
                {ttsReady && narrationSegments.length > 0 && <span className="text-green-400 text-xs">✓ 전체 완료</span>}
              </div>
              {narrationSegments.length === 0 ? (
                <p className="text-white/40 text-sm">① 단계를 먼저 완료해주세요.</p>
              ) : (
                <>
                  <button
                    onClick={generateAllTts}
                    disabled={ttsAllLoading || ttsReady}
                    className="w-full py-2.5 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-40"
                    style={orangeGrad}>
                    {ttsAllLoading ? "🔄 전체 생성 중..." : ttsReady ? "✅ 전체 생성 완료" : "🔊 전체 TTS 생성"}
                  </button>
                  <div className="space-y-2">
                    {narrationSegments.map((seg) => (
                      <div key={seg.id} className="p-3 rounded-xl" style={inset}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-orange-300 text-xs font-bold w-16">{seg.label}</span>
                            <span className="text-white/70 text-xs flex-1">{seg.text}</span>
                          </div>
                          {!ttsAudios[seg.id] && (
                            <button
                              onClick={() => generateSegmentTts(seg.id, seg.text)}
                              disabled={ttsLoading[seg.id]}
                              className="text-xs px-3 py-1 rounded-lg text-white font-bold transition-all disabled:opacity-40 flex-shrink-0 ml-2"
                              style={{ background: "rgba(255,107,53,0.4)" }}>
                              {ttsLoading[seg.id] ? "..." : "생성"}
                            </button>
                          )}
                          {ttsAudios[seg.id] && <span className="text-green-400 text-xs flex-shrink-0">✓</span>}
                        </div>
                        {ttsAudios[seg.id] && (
                          <audio controls src={ttsAudios[seg.id]} className="w-full h-7 mt-1" />
                        )}
                        {ttsErrors[seg.id] && (
                          <p className="text-red-300 text-xs mt-1">⚠️ {ttsErrors[seg.id]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* STEP 4: Video render */}
            <div className="p-5 rounded-2xl space-y-3" style={card}>
              <div className="flex items-center justify-between">
                <label className="text-white font-bold text-sm">④ 영상 합성 (zoompan)</label>
                {finalVideoUrl && <span className="text-green-400 text-xs">✓ 완료</span>}
              </div>
              {/* Requirements checklist */}
              <div className="flex gap-3 flex-wrap">
                {[
                  ["레시피맵", !!recipeMapImage],
                  ["핵심포인트", !!keypoints],
                  ["TTS 완료", ttsReady && narrationSegments.length > 0],
                ].map(([label, done]) => (
                  <span key={label as string} className="text-xs px-2 py-1 rounded-lg"
                    style={{ background: done ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.07)", color: done ? "#4ade80" : "rgba(255,255,255,0.4)" }}>
                    {done ? "✓" : "○"} {label}
                  </span>
                ))}
              </div>
              <button
                onClick={renderVideo}
                disabled={!recipeMapImage || renderLoading}
                className="w-full py-3 rounded-xl text-white font-bold transition-all disabled:opacity-40"
                style={orangeGrad}>
                {renderLoading ? `🎬 합성 중... ${renderProgress}%` : "🎬 영상 합성 시작"}
              </button>
              {renderLoading && (
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${renderProgress}%`, background: "linear-gradient(90deg,#ff6b35,#ffc857)" }} />
                </div>
              )}
              {renderError && <p className="text-red-300 text-xs">⚠️ {renderError}</p>}
              {finalVideoUrl && (
                <video controls src={finalVideoUrl} className="w-full rounded-xl mt-2" style={{ maxHeight: "320px" }} />
              )}
            </div>

            {/* STEP 5: Download package */}
            <div className="p-5 rounded-2xl space-y-3" style={card}>
              <label className="block text-white font-bold text-sm">⑤ 패키지 다운로드</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["🎬 final.mp4", !!finalVideoUrl],
                  ["🖼️ thumbnail.png", !!recipeMapImage],
                  ["📝 subtitle.srt", !!srtContent],
                  ["✍️ caption.txt", !!caption],
                  ["# hashtags.txt", hashtags.length > 0],
                ] as [string, boolean][]).map(([label, ready]) => (
                  <div key={label} className="flex items-center gap-2 p-2.5 rounded-xl text-xs"
                    style={{ background: ready ? "rgba(74,222,128,0.08)" : "rgba(255,255,255,0.04)", color: ready ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.3)" }}>
                    <span>{ready ? "✓" : "○"}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={downloadPackage}
                disabled={!finalVideoUrl && !recipeMapImage}
                className="w-full py-3 rounded-xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
                ⬇️ 전체 패키지 다운로드
              </button>
            </div>
          </div>
        )}

        {/* ────────── THUMBNAIL TAB ────────── */}
        {activeTab === "thumbnail" && (
          <div className="space-y-5">
            <RecipeSelector />

            {/* 1. 음식 사진 */}
            <div className="p-5 rounded-2xl" style={card}>
              <label className="block text-white font-bold mb-3 text-sm">① 음식 사진 *</label>
              <input
                type="file" accept="image/*" onChange={handleUpload}
                className="block w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-orange-500/80 file:text-white hover:file:bg-orange-500 cursor-pointer"
              />
              {uploadedImage && (
                <div className="mt-4 relative w-32 h-32 rounded-xl overflow-hidden">
                  <Image src={uploadedImage} alt="미리보기" fill className="object-cover" unoptimized />
                </div>
              )}
            </div>

            {/* 2. 레시피 정보 */}
            <div className="p-5 rounded-2xl space-y-3" style={card}>
              <label className="block text-white font-bold mb-1 text-sm">② 레시피 정보</label>
              {[
                [recipeName, setRecipeName, "레시피 이름 * (예: 마라샹궈)"],
                [highlight, setHighlight, "핵심 포인트 (예: 집에서 만드는 중독성 마라맛)"],
                [taste, setTaste, "맛 표현 (예: 얼얼하고 매콤한 맛)"],
              ].map(([val, setter, placeholder]) => (
                <input key={placeholder as string} value={val as string}
                  onChange={(e) => (setter as React.Dispatch<React.SetStateAction<string>>)(e.target.value)}
                  placeholder={placeholder as string}
                  className="w-full px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none"
                  style={inset} />
              ))}
              <div className="flex gap-3">
                <input value={cookingTime} onChange={(e) => setCookingTime(e.target.value)}
                  placeholder="조리 시간" className="flex-1 px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none" style={inset} />
                <input value={servings} onChange={(e) => setServings(e.target.value)}
                  placeholder="분량" className="flex-1 px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none" style={inset} />
              </div>
              <input value={pairings} onChange={(e) => setPairings(e.target.value)}
                placeholder="페어링 (쉼표로 구분)" className="w-full px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none" style={inset} />
              <input value={kickPoints} onChange={(e) => setKickPoints(e.target.value)}
                placeholder="성공 포인트" className="w-full px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none" style={inset} />
            </div>

            {/* 3. 캐릭터 */}
            <div className="p-5 rounded-2xl" style={card}>
              <label className="block text-white font-bold mb-3 text-sm">③ 캐릭터 톤</label>
              <div className="flex gap-2">
                {CHARACTERS.map((c) => (
                  <button key={c.id} onClick={() => setThumbCharacter(c.id)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                    style={thumbCharacter === c.id ? orangeGrad : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. 썸네일 스타일 */}
            <div className="p-5 rounded-2xl" style={card}>
              <label className="block text-white font-bold mb-3 text-sm">④ 썸네일 스타일</label>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setStyleId(null)} className="py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={styleId === null ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "white" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  🎲 랜덤
                </button>
                {THUMBNAIL_STYLES.map((s) => (
                  <button key={s.id} onClick={() => setStyleId(s.id)} className="py-2.5 rounded-xl text-xs font-bold transition-all"
                    style={styleId === s.id ? { background: "linear-gradient(135deg,#7c3aed,#a855f7)", color: "white" } : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={generateThumbnail} disabled={thumbLoading}
              className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90 disabled:opacity-50"
              style={orangeGrad}>
              {thumbLoading ? "생성 중... (약 10~20초)" : "🖼️ 썸네일 생성"}
            </button>
            {thumbError && (
              <div className="p-4 rounded-2xl text-sm text-red-200" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
                ⚠️ {thumbError}
              </div>
            )}
            {thumbnail && (
              <div className="p-5 rounded-2xl" style={card}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-white font-bold text-sm">완성 썸네일</span>
                  {styleName && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}>{styleName}</span>}
                </div>
                <div className="relative w-full mx-auto rounded-xl overflow-hidden" style={{ aspectRatio: "9/16", maxWidth: "300px" }}>
                  <Image src={thumbnail} alt="생성된 썸네일" fill className="object-cover" unoptimized />
                </div>
                <button onClick={() => downloadBlob(thumbnail, `${recipeName || "reel"}-thumbnail.png`)}
                  className="w-full mt-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90"
                  style={{ background: "linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045)" }}>
                  ⬇️ 썸네일 저장
                </button>
              </div>
            )}
          </div>
        )}

        <button onClick={() => router.push("/admin")}
          className="w-full mt-8 py-3 rounded-2xl text-white/50 text-sm font-medium transition-all hover:text-white/80"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
          ← 관리자 콘솔로 돌아가기
        </button>
      </div>
    </div>
  );
}

export default function AdminShortsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
        <p className="text-white/50">불러오는 중...</p>
      </div>
    }>
      <AdminShortsContent />
    </Suspense>
  );
}
