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
  hasFinishedImage?: boolean;
  hasDetailImage?: boolean;
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

type SocialPlatform = "instagram" | "youtube" | "tiktok";

const SOCIAL_PLATFORMS: { id: SocialPlatform; label: string }[] = [
  { id: "instagram", label: "📸 인스타그램" },
  { id: "youtube",   label: "▶️ 유튜브" },
  { id: "tiktok",    label: "🎵 틱톡" },
];

const THUMBNAIL_STYLES = [
  { id: 1, name: "무드 에디토리얼" },
  { id: 2, name: "볼드 컬러 포스터" },
  { id: 3, name: "드라마틱 클로즈업" },
  { id: 4, name: "레시피 인포그래픽" },
  { id: 5, name: "내추럴 오가닉" },
  { id: 6, name: "TV 요리쇼" },
] as const;

// ── Grid map layout: 3 columns × 2 rows, each cell a full 9:16 frame ──────────
type CellKey = "food" | "problem" | "point1" | "point2" | "point3" | "ingredients";

const CELL_W = 1080, CELL_H = 1920;
const GRID_COLS = 3, GRID_ROWS = 2;
const GRID_W = CELL_W * GRID_COLS; // 3240
const GRID_H = CELL_H * GRID_ROWS; // 3840

// cell → [column, row]. Bottom row is reversed so the camera snakes
// (boustrophedon): top L→R, then bottom R→L with no diagonal jump.
//   [ food(0,0)   problem(1,0)   point1(2,0) ]
//   [ ingred(0,1) point3(1,1)    point2(2,1) ]
const CELL_GRID: Record<CellKey, [number, number]> = {
  food:        [0, 0],
  problem:     [1, 0],
  point1:      [2, 0],
  point2:      [2, 1],
  point3:      [1, 1],
  ingredients: [0, 1],
};

const CELL_ORDER: CellKey[] = ["food", "problem", "point1", "point2", "point3", "ingredients"];

const CELL_ACCENT: Record<CellKey, string> = {
  food:        "#0D1B2A",
  problem:     "#7A1F1F",
  point1:      "#1E3A8A",
  point2:      "#5B21B6",
  point3:      "#0F766E",
  ingredients: "#92400E",
};

const CELL_CHIP: Record<CellKey, string> = {
  food:        "🍽 완성",
  problem:     "❗ 이런 실수",
  point1:      "① 포인트",
  point2:      "② 포인트",
  point3:      "③ 포인트",
  ingredients: "📌 저장 재료",
};

const CELL_EMOJI: Record<CellKey, string> = {
  food: "🍽️", problem: "😵", point1: "1️⃣", point2: "2️⃣", point3: "3️⃣", ingredients: "🧺",
};

function cellOrigin(key: CellKey) {
  const [c, r] = CELL_GRID[key];
  return { x: c * CELL_W, y: r * CELL_H };
}

// Camera source rectangles over the composed grid. All 9:16 to avoid distortion;
// "full" letterboxes the whole grid for the CTA zoom-out.
const FULL_SH = (GRID_W * CELL_H) / CELL_W; // 5760
function camRect(key: CellKey) {
  const o = cellOrigin(key);
  return { sx: o.x, sy: o.y, sw: CELL_W, sh: CELL_H };
}
const CAMERA_RECTS: Record<string, { sx: number; sy: number; sw: number; sh: number }> = {
  cell_food:        camRect("food"),
  cell_problem:     camRect("problem"),
  cell_point1:      camRect("point1"),
  cell_point2:      camRect("point2"),
  cell_point3:      camRect("point3"),
  cell_ingredients: camRect("ingredients"),
  full:             { sx: 0, sy: (GRID_H - FULL_SH) / 2, sw: GRID_W, sh: FULL_SH },
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

// http(s) 이미지 URL을 data URL로 변환한다. 이미 data URL이면 그대로 반환.
// Supabase 전환 후 레시피 레코드의 이미지(heroImage/finishedImage)가
// 공개 HTTP URL로 내려오므로, base64 를 기대하는 API 호출 전에 변환이 필요하다.
async function imageSrcToDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`이미지를 불러오지 못했습니다 (HTTP ${res.status})`);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("이미지 변환에 실패했습니다."));
    reader.readAsDataURL(blob);
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

// Draw one grid cell (content anchored to its bottom) at (ox, oy).
// `bgImage` supplies optional background art; missing art falls back to an
// accent gradient + emoji so the cell is still legible.
async function drawCell(
  ctx: CanvasRenderingContext2D,
  ox: number, oy: number,
  key: CellKey,
  bgImage: string | null,
  recipe: RecipeDetail,
  kp: ShortsKeypointResult,
) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.beginPath();
  ctx.rect(0, 0, CELL_W, CELL_H);
  ctx.clip();

  // Background — cover-fit art, else accent gradient + emoji watermark
  let hasArt = false;
  if (bgImage) {
    try {
      const img = await loadImg(bgImage);
      const r = Math.max(CELL_W / img.naturalWidth, CELL_H / img.naturalHeight);
      const w = img.naturalWidth * r, h = img.naturalHeight * r;
      ctx.drawImage(img, (CELL_W - w) / 2, (CELL_H - h) / 2, w, h);
      hasArt = true;
    } catch { /* fall through to gradient */ }
  }
  if (!hasArt) {
    const g = ctx.createLinearGradient(0, 0, 0, CELL_H);
    g.addColorStop(0, CELL_ACCENT[key]);
    g.addColorStop(1, "#0A0F1A");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CELL_W, CELL_H);
    ctx.font = "320px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.9;
    ctx.fillText(key === "food" ? (recipe.emoji ?? "🍽️") : CELL_EMOJI[key], CELL_W / 2, CELL_H / 2 - 160);
    ctx.globalAlpha = 1;
  }

  // Bottom scrim for text legibility
  const scrim = ctx.createLinearGradient(0, CELL_H * 0.42, 0, CELL_H);
  scrim.addColorStop(0, "rgba(8,12,20,0)");
  scrim.addColorStop(1, "rgba(8,12,20,0.94)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, CELL_H * 0.42, CELL_W, CELL_H * 0.58);

  // Top chip
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const chipW = ctx.measureText(CELL_CHIP[key]).width + 52;
  ctx.fillStyle = CELL_ACCENT[key];
  roundRect(ctx, 44, 44, chipW, 68, 34);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(CELL_CHIP[key], 70, 80);

  // Per-cell foreground content
  const idx = key === "point1" ? 0 : key === "point2" ? 1 : key === "point3" ? 2 : -1;
  if (key === "food") {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 70px sans-serif";
    ctx.textBaseline = "alphabetic";
    wrapText(ctx, kp.hook, CELL_W / 2, CELL_H - 260, CELL_W - 120, 84, 2);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "40px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(recipe.name.slice(0, 18), CELL_W / 2, CELL_H - 110);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "28px sans-serif";
    ctx.fillText("@oh_showong", CELL_W / 2, CELL_H - 50);
  } else if (key === "problem") {
    ctx.fillStyle = "#FF9A56";
    ctx.font = "bold 62px sans-serif";
    ctx.textBaseline = "alphabetic";
    wrapText(ctx, kp.problem, 56, CELL_H - 330, CELL_W - 112, 76, 3, "left");
  } else if (idx >= 0) {
    const pt = kp.keyPoints[idx];
    ctx.beginPath();
    ctx.arc(96, CELL_H - 300, 56, 0, Math.PI * 2);
    ctx.fillStyle = CELL_ACCENT[key];
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 56px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(idx + 1), 96, CELL_H - 300);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 58px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText((pt?.title ?? "").slice(0, 14), 180, CELL_H - 282);
    ctx.fillStyle = "rgba(255,255,255,0.74)";
    ctx.font = "38px sans-serif";
    wrapText(ctx, pt?.description ?? "", 56, CELL_H - 200, CELL_W - 112, 50, 3, "left");
  } else if (key === "ingredients") {
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 50px sans-serif";
    ctx.textBaseline = "alphabetic";
    wrapText(ctx, kp.saveCard.title, 56, CELL_H - 470, CELL_W - 112, 60, 2, "left");
    ctx.font = "38px sans-serif";
    kp.saveCard.ingredients.slice(0, 8).forEach((it, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      ctx.textAlign = "left";
      ctx.fillText(`• ${it}`.slice(0, 20), col === 0 ? 56 : CELL_W / 2 + 10, CELL_H - 360 + row * 70);
    });
  }

  ctx.restore();
}

// Compose the full 6-cell recipe grid (3240×3840). `cellImages` supplies optional
// per-cell background art; cells without art render an accent gradient card.
async function composeGridCanvas(
  recipe: RecipeDetail,
  kp: ShortsKeypointResult,
  cellImages: Partial<Record<CellKey, string | null>>,
): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_W;
  canvas.height = GRID_H;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#0A0F1A";
  ctx.fillRect(0, 0, GRID_W, GRID_H);

  for (const key of CELL_ORDER) {
    const o = cellOrigin(key);
    await drawCell(ctx, o.x, o.y, key, cellImages[key] ?? null, recipe, kp);
  }

  // Cell divider lines
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 4;
  for (let c = 1; c < GRID_COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CELL_W, 0); ctx.lineTo(c * CELL_W, GRID_H); ctx.stroke();
  }
  for (let r = 1; r < GRID_ROWS; r++) {
    ctx.beginPath(); ctx.moveTo(0, r * CELL_H); ctx.lineTo(GRID_W, r * CELL_H); ctx.stroke();
  }

  return canvas.toDataURL("image/png");
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
  thumbnailDataUrl: string | null,
  detailImageDataUrl: string | null = null,
): Promise<{ blob: Blob; ext: "mp4" | "webm" }> {
  const CANVAS_W = 1080, CANVAS_H = 1920;
  const TRANSITION = 0.4;
  const THUMB_DUR = 1.0;   // thumbnail intro overlay (audio plays underneath from t=0)
  const OUTRO_DUR = 2.0;   // detail recipe image outro at the end

  const mapImg = await loadImg(recipeMapDataUrl);
  let thumbImg: HTMLImageElement | null = null;
  if (thumbnailDataUrl) {
    try { thumbImg = await loadImg(thumbnailDataUrl); } catch { /* no intro */ }
  }
  let detailImg: HTMLImageElement | null = null;
  if (detailImageDataUrl) {
    try { detailImg = await loadImg(detailImageDataUrl); } catch { /* no outro */ }
  }
  const audioCtx = new AudioContext();
  const dest = audioCtx.createMediaStreamDestination();

  // Camera rects are absolute coordinates over the 3240×3840 grid (mapImg).
  // "full" extends beyond the grid vertically so the zoom-out letterboxes it.
  function getCameraRect(camKey: string) {
    return CAMERA_RECTS[camKey] ?? CAMERA_RECTS.full;
  }

  // Decode audio per segment
  interface VSeg { start: number; dur: number; camera: string; audioBuf: AudioBuffer | null }
  const vsegs: VSeg[] = [];
  let cursor = 0;
  for (const seg of segments) {
    const url = ttsAudios[seg.id];
    let audioBuf: AudioBuffer | null = null;
    if (url) {
      try {
        audioBuf = await audioCtx.decodeAudioData(await (await fetch(url)).arrayBuffer());
      } catch (err) {
        console.warn(`[shorts] TTS 오디오 디코딩 실패 (${seg.id}):`, err);
      }
    }
    const dur = audioBuf ? audioBuf.duration : (seg.estimatedEndSec - seg.estimatedStartSec);
    vsegs.push({ start: cursor, dur, camera: seg.cameraSection, audioBuf });
    cursor += dur + 0.12;
  }
  const decodedCount = vsegs.filter((v) => v.audioBuf).length;
  const providedCount = segments.filter((s) => ttsAudios[s.id]).length;
  if (providedCount > 0 && decodedCount === 0) {
    console.warn("[shorts] 모든 TTS 오디오 디코딩 실패 — 무음으로 렌더링됩니다.");
  }
  const contentDur = cursor;
  const totalDur = contentDur + (detailImg ? OUTRO_DUR : 0);

  // Canvas + recorder
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W; canvas.height = CANVAS_H;
  const ctx2d = canvas.getContext("2d")!;
  ctx2d.imageSmoothingEnabled = true;
  ctx2d.imageSmoothingQuality = "high";

  // The recorded blob plays in-browser (which decodes webm/opus), but external
  // players often can't decode opus, so a downloaded .webm appears silent.
  // Prefer MP4 with an EXPLICIT AAC codec (mp4a) — naming the audio codec is
  // what makes Chrome actually mux audio into the mp4 (bare "video/mp4" can
  // produce a silent file). Fall back to webm/opus only when mp4 recording is
  // unavailable. Always set audioBitsPerSecond so an audio track is encoded.
  const candidateConfigs = [
    { mimeType: "video/mp4;codecs=avc1.640029,mp4a.40.2", videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
    { mimeType: "video/mp4;codecs=avc1.42E01E,mp4a.40.2", videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
    { mimeType: "video/mp4;codecs=avc1,mp4a",             videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
    { mimeType: "video/mp4;codecs=h264,aac",              videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
    { mimeType: "video/webm;codecs=vp9,opus",             videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
    { mimeType: "video/webm;codecs=vp8,opus",             videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 128_000 },
    { mimeType: "video/webm",                             videoBitsPerSecond: 2_000_000, audioBitsPerSecond: 128_000 },
    { mimeType: "video/mp4",                              videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 },
  ].filter((c) => MediaRecorder.isTypeSupported(c.mimeType));
  if (candidateConfigs.length === 0) candidateConfigs.push({ mimeType: "video/webm", videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 128_000 });

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
        if (detailImg && elapsed >= contentDur) {
          // ── Outro: 상세 레시피 한장 이미지 (2초) ────────────────────────────
          // Fade in over 0.3s from the last map frame.
          const outroElapsed = elapsed - contentDur;
          const fadeAlpha = Math.min(1, outroElapsed / 0.3);

          // Draw the last map frame as the under-layer for the fade.
          const lastSeg = vsegs[vsegs.length - 1];
          if (lastSeg) {
            const lR = getCameraRect(lastSeg.camera);
            ctx2d.drawImage(mapImg, lR.sx, lR.sy, lR.sw, lR.sh, 0, 0, CANVAS_W, CANVAS_H);
          }

          // Cover-fit the detail image (contain: show full image, letterbox if needed).
          const scale = Math.min(CANVAS_W / detailImg.naturalWidth, CANVAS_H / detailImg.naturalHeight);
          const dw = detailImg.naturalWidth * scale;
          const dh = detailImg.naturalHeight * scale;
          const dx = (CANVAS_W - dw) / 2;
          const dy = (CANVAS_H - dh) / 2;

          ctx2d.save();
          ctx2d.globalAlpha = fadeAlpha;
          ctx2d.fillStyle = "#000";
          ctx2d.fillRect(0, 0, CANVAS_W, CANVAS_H);
          ctx2d.drawImage(detailImg, dx, dy, dw, dh);
          ctx2d.restore();
        } else {
          // ── Main content: recipe map segments ───────────────────────────────
          const curIdx = vsegs.reduce((acc, s, i) => (elapsed >= s.start ? i : acc), 0);
          const cur = vsegs[curIdx];
          const next = vsegs[curIdx + 1];
          const curR = getCameraRect(cur.camera);

          if (next) {
            const progress = (elapsed - cur.start) / cur.dur;
            const tStart = Math.max(0, 1 - TRANSITION / cur.dur);
            if (progress >= tStart) {
              // Clamp the interpolation input to [0,1] BEFORE easing — past the
              // segment end (inter-segment gap, progress > 1) the easing curve
              // bends back down and would make the camera bounce. Clamping holds
              // it steady on the next cell instead.
              const localT = Math.min(1, Math.max(0, (progress - tStart) / (1 - tStart)));
              const t = ease(localT);
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

          // Thumbnail intro: cover the first second while audio already plays
          if (thumbImg && elapsed < THUMB_DUR) {
            const r = Math.max(CANVAS_W / thumbImg.naturalWidth, CANVAS_H / thumbImg.naturalHeight);
            const w = thumbImg.naturalWidth * r, h = thumbImg.naturalHeight * r;
            ctx2d.drawImage(thumbImg, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
          }
        }
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
  const [finishedImage, setFinishedImage] = useState<string | null>(null);
  const [detailImage, setDetailImage] = useState<string | null>(null);
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
  const [foodCellImage, setFoodCellImage] = useState<string | null>(null);

  const [ttsAudios, setTtsAudios] = useState<Record<string, string>>({});
  const [ttsLoading, setTtsLoading] = useState<Record<string, boolean>>({});
  const [ttsErrors, setTtsErrors] = useState<Record<string, string>>({});
  const [ttsAllLoading, setTtsAllLoading] = useState(false);

  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const finalVideoBlobRef = useRef<{ blob: Blob; ext: "mp4" | "webm" } | null>(null);
  const [renderLoading, setRenderLoading] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  // ── Social posts (Instagram / YouTube / TikTok) ──
  const [socialPosts, setSocialPosts] = useState<Record<SocialPlatform, string>>({ instagram: "", youtube: "", tiktok: "" });
  const [socialLoading, setSocialLoading] = useState<Record<SocialPlatform, boolean>>({ instagram: false, youtube: false, tiktok: false });
  const [socialErrors, setSocialErrors] = useState<Record<SocialPlatform, string>>({ instagram: "", youtube: "", tiktok: "" });
  const [copiedPlatform, setCopiedPlatform] = useState<SocialPlatform | null>(null);

  // ── Telegram delivery ──
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ ok: boolean; msg: string } | null>(null);

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
        finishedImage?: string | null;
        detailImage?: string | null;
        recipe: RecipeDetail;
      };
      const r = record.recipe;
      const tone = CHARACTER_TO_TONE[record.character] ?? "cute";

      setSelectedRecipeId(id);
      setLoadedRecipe(r);
      setHeroImage(record.heroImage ?? null);
      setFinishedImage(record.finishedImage ?? null);
      setDetailImage(record.detailImage ?? null);
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
      setFoodCellImage(null);
      setTtsAudios({});
      setTtsErrors({});
      setFinalVideoUrl(null);
      finalVideoBlobRef.current = null;
      setRenderError(null);
      setSocialPosts({ instagram: "", youtube: "", tiktok: "" });
      setSocialErrors({ instagram: "", youtube: "", tiktok: "" });
      setTelegramStatus(null);

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
      // 완성 요리 사진(finishedImage)이 있으면 썸네일 소스로 우선 적용,
      // 없으면 AI 생성 hero 이미지로 fallback
      const thumbSource = record.finishedImage ?? record.heroImage;
      if (thumbSource) setUploadedImage(thumbSource);
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

  // Clear TTS cache whenever the character changes so that audio is always
  // re-generated with the correct voice. Track the previous value so the
  // initial load (recipeCharacter set from the recipe) doesn't also clear.
  const prevCharacterRef = useRef<string | null>(null);
  useEffect(() => {
    if (prevCharacterRef.current !== null && prevCharacterRef.current !== recipeCharacter) {
      setTtsAudios({});
      setTtsErrors({});
    }
    prevCharacterRef.current = recipeCharacter;
  }, [recipeCharacter]);

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
  // Instant grid: food cell uses the hero photo, others render accent cards.
  const generateCanvasMap = async () => {
    if (!loadedRecipe || !keypoints) return;
    setRecipeMapLoading(true);
    setRecipeMapError(null);
    try {
      // 유저가 올린 실제 완성 요리 사진을 우선 사용, 없으면 AI hero 이미지로 fallback
      const foodPhoto = finishedImage ?? heroImage;
      const dataUrl = await composeGridCanvas(
        loadedRecipe, keypoints,
        foodPhoto ? { food: foodPhoto } : {},
      );
      setRecipeMapImage(dataUrl);
      setFoodCellImage(foodPhoto ?? null);
    } catch (e) { setRecipeMapError(e instanceof Error ? e.message : "생성 실패"); }
    finally { setRecipeMapLoading(false); }
  };

  // AI grid: generate per-cell art (problem/points/ingredients) and composite.
  // The food cell reuses the hero photo when available; failures fall back to a card.
  const generateAiMap = async () => {
    if (!loadedRecipe || !keypoints) return;
    setRecipeMapLoading(true);
    setRecipeMapError(null);
    try {
      const recipe = loadedRecipe;
      // 유저가 올린 실제 완성 요리 사진을 우선 사용, 없으면 AI hero 이미지로 fallback
      const foodPhoto = finishedImage ?? heroImage;
      const results = await Promise.all(
        CELL_ORDER.map(async (cell): Promise<readonly [CellKey, string | null]> => {
          if (cell === "food" && foodPhoto) return [cell, foodPhoto] as const;
          try {
            const res = await fetch("/api/generate-shorts-map", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                cell,
                recipeName: recipe.name,
                keypoints,
                character: recipeCharacter,
              }),
            });
            const data = await res.json();
            return [cell, data.imageUrl ?? null] as const;
          } catch { return [cell, null] as const; }
        }),
      );
      const cellImages = Object.fromEntries(results) as Partial<Record<CellKey, string | null>>;
      if (CELL_ORDER.every((c) => !cellImages[c])) {
        setRecipeMapError("이미지 생성에 실패했습니다. API 키 설정을 확인해주세요.");
        return;
      }
      const grid = await composeGridCanvas(recipe, keypoints, cellImages);
      setRecipeMapImage(grid);
      setFoodCellImage(cellImages.food ?? foodPhoto ?? null);
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
        thumbnail,
        detailImage,
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

  // ── Pipeline: Step 6 — platform-formatted recipe posts ───────────────────
  const generateSocialPost = async (platform: SocialPlatform) => {
    if (!loadedRecipe) return;
    setSocialLoading((p) => ({ ...p, [platform]: true }));
    setSocialErrors((p) => ({ ...p, [platform]: "" }));
    try {
      const res = await fetch("/api/generate-social-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe: loadedRecipe,
          platform,
          character: recipeCharacter,
          caption,
          hashtags,
        }),
      });
      const data = await res.json();
      if (data.error) { setSocialErrors((p) => ({ ...p, [platform]: data.error })); }
      else { setSocialPosts((p) => ({ ...p, [platform]: data.post ?? "" })); }
    } catch (e) {
      setSocialErrors((p) => ({ ...p, [platform]: e instanceof Error ? e.message : "게시글 생성 실패" }));
    } finally {
      setSocialLoading((p) => ({ ...p, [platform]: false }));
    }
  };

  const copySocialPost = async (platform: SocialPlatform) => {
    try {
      await navigator.clipboard.writeText(socialPosts[platform]);
      setCopiedPlatform(platform);
      setTimeout(() => setCopiedPlatform((cur) => (cur === platform ? null : cur)), 1500);
    } catch { /* clipboard unavailable */ }
  };

  // ── Pipeline: send the final video + platform posts to Telegram ───────────
  const sendToTelegram = async () => {
    const hasVideo = !!finalVideoBlobRef.current;
    const hasPosts = SOCIAL_PLATFORMS.some(({ id }) => socialPosts[id].trim());
    if (!hasVideo && !hasPosts) {
      setTelegramStatus({ ok: false, msg: "전송할 영상이나 게시글이 없습니다." });
      return;
    }
    setTelegramLoading(true);
    setTelegramStatus(null);
    try {
      const name = loadedRecipe?.name ?? "recipe";
      const fd = new FormData();

      if (finalVideoBlobRef.current) {
        const { blob, ext } = finalVideoBlobRef.current;
        const filename = `${name}-shorts.${ext}`;

        // Try presigned-URL path first so the video bypasses Vercel's 4.5 MB body limit.
        let uploadedViaPresign = false;
        try {
          const presignRes = await fetch("/api/upload-video-presign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename }),
          });
          if (presignRes.ok) {
            const { signedUrl, path, publicUrl } = await presignRes.json() as {
              signedUrl: string; token: string; path: string; publicUrl: string;
            };
            // Upload directly from browser to Supabase — does NOT go through Vercel.
            const uploadForm = new FormData();
            uploadForm.append("cacheControl", "3600");
            uploadForm.append("", blob, filename);
            const uploadRes = await fetch(signedUrl, { method: "POST", body: uploadForm });
            if (uploadRes.ok) {
              fd.append("videoUrl", publicUrl);
              fd.append("storagePath", path);
              fd.append("caption", `🎬 ${name} 쇼츠`);
              uploadedViaPresign = true;
            }
          }
        } catch {
          // Presign path unavailable (e.g. local dev without Supabase) — fall through.
        }

        if (!uploadedViaPresign) {
          // Fallback: send the blob directly (may fail with 413 on large files in prod).
          fd.append("video", blob, filename);
          fd.append("caption", `🎬 ${name} 쇼츠`);
        }
      }

      SOCIAL_PLATFORMS.forEach(({ id }) => {
        if (socialPosts[id].trim()) fd.append(id, socialPosts[id]);
      });

      const res = await fetch("/api/send-telegram", { method: "POST", body: fd });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setTelegramStatus({ ok: false, msg: data.error ?? "전송에 실패했습니다." });
      } else {
        setTelegramStatus({ ok: true, msg: "텔레그램으로 전송했습니다." });
      }
    } catch (e) {
      setTelegramStatus({ ok: false, msg: e instanceof Error ? e.message : "전송 실패" });
    } finally {
      setTelegramLoading(false);
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
    const sourceImage = uploadedImage ?? foodCellImage;
    if (!sourceImage) { setThumbError("음식 사진을 업로드하거나 레시피맵을 먼저 생성해주세요."); return; }
    setThumbLoading(true); setThumbError(null); setThumbnail(null); setStyleName(null);
    try {
      // Supabase 공개 URL 등 http(s) 이미지는 data URL로 변환 후 진행
      const sourceDataUrl = await imageSrcToDataUrl(sourceImage);
      const matches = sourceDataUrl.match(/^data:([^;]+);base64,(.+)$/);
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
                <span className="flex items-center gap-1.5">
                  <span className="block text-white text-sm font-bold truncate">{r.name}</span>
                  {r.hasFinishedImage && (
                    <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(34,197,94,0.22)", color: "#86efac" }}>
                      📸 완성본
                    </span>
                  )}
                  {r.hasDetailImage && (
                    <span className="flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: "rgba(99,102,241,0.22)", color: "#a5b4fc" }}>
                      🖼️ 레시피카드
                    </span>
                  )}
                </span>
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

              {/* Character selector — drives image map + TTS generation */}
              <div className="space-y-1.5">
                <label className="block text-white/60 text-xs font-bold">캐릭터 (이미지·TTS 공통)</label>
                <select
                  value={recipeCharacter}
                  onChange={(e) => setRecipeCharacter(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-white text-sm outline-none cursor-pointer"
                  style={inset}>
                  {CHARACTERS.map((c) => (
                    <option key={c.id} value={c.id} style={{ color: "#111" }}>{c.label}</option>
                  ))}
                </select>
                <p className="text-white/35 text-xs">캐릭터 변경 시 TTS 캐시가 초기화되어 올바른 목소리로 재생성됩니다.</p>
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
                  {recipeMapLoading ? "🔄 6셀 생성 중..." : "✨ AI 6셀 생성"}
                </button>
              </div>
              {recipeMapError && <p className="text-red-300 text-xs">⚠️ {recipeMapError}</p>}
              {recipeMapImage && (
                <>
                  <div className="relative w-52 mx-auto rounded-xl overflow-hidden" style={{ aspectRatio: "27/32", background: "#0A0F1A" }}>
                    <Image src={recipeMapImage} alt="레시피맵 그리드" fill className="object-contain" unoptimized />
                  </div>
                  <p className="text-white/40 text-xs text-center">6셀 그리드 · 구간별 셀 이동 + CTA 줌아웃</p>
                </>
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
              <div className="space-y-1">
                <p className="text-white/40 text-xs">
                  {thumbnail
                    ? "🖼️ 썸네일 탭 이미지가 인트로 1초로 삽입됩니다 (시작과 동시에 TTS 재생)."
                    : "🖼️ 썸네일 탭에서 썸네일을 만들면 인트로 1초로 자동 삽입됩니다."}
                </p>
                <p className="text-xs" style={{ color: detailImage ? "#a5b4fc" : "rgba(255,255,255,0.3)" }}>
                  {detailImage
                    ? "📋 상세 레시피 한장 이미지가 아웃트로 2초로 삽입됩니다."
                    : "📋 유저가 상세 레시피 이미지를 생성하면 아웃트로 2초로 자동 삽입됩니다."}
                </p>
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
                <>
                  <video controls src={finalVideoUrl} className="w-full rounded-xl mt-2" style={{ maxHeight: "320px" }} />
                  <p className="text-white/40 text-xs">
                    출력 포맷: <span className="text-white/70 font-bold uppercase">{finalVideoBlobRef.current?.ext ?? "—"}</span>
                    {finalVideoBlobRef.current?.ext === "webm" &&
                      " · 이 브라우저는 MP4 녹화를 지원하지 않아 webm으로 저장됩니다. 외부 플레이어에서 소리가 안 나면 MP4로 변환해 주세요."}
                  </p>
                </>
              )}
            </div>

            {/* STEP 5: Platform-formatted recipe posts */}
            <div className="p-5 rounded-2xl space-y-3" style={card}>
              <label className="block text-white font-bold text-sm">⑤ SNS 게시글 생성 (gemini-3.5-flash)</label>
              <p className="text-white/40 text-xs">플랫폼별 형식에 맞춰 자세한 레시피 게시글을 생성합니다.</p>
              {!loadedRecipe && <p className="text-white/40 text-sm">⓪ 레시피를 먼저 선택해주세요.</p>}
              {loadedRecipe && (
                <div className="space-y-3">
                  {SOCIAL_PLATFORMS.map(({ id, label }) => (
                    <div key={id} className="p-3 rounded-xl space-y-2" style={inset}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-white text-sm font-bold">{label}</span>
                        <div className="flex items-center gap-2">
                          {socialPosts[id] && (
                            <button
                              onClick={() => copySocialPost(id)}
                              className="text-xs px-3 py-1 rounded-lg text-white font-bold transition-all"
                              style={{ background: "rgba(255,255,255,0.12)" }}>
                              {copiedPlatform === id ? "✓ 복사됨" : "📋 복사"}
                            </button>
                          )}
                          <button
                            onClick={() => generateSocialPost(id)}
                            disabled={socialLoading[id]}
                            className="text-xs px-3 py-1 rounded-lg text-white font-bold transition-all disabled:opacity-40"
                            style={orangeGrad}>
                            {socialLoading[id] ? "🔄 생성 중..." : socialPosts[id] ? "🔁 재생성" : "✍️ 생성"}
                          </button>
                        </div>
                      </div>
                      {socialErrors[id] && <p className="text-red-300 text-xs">⚠️ {socialErrors[id]}</p>}
                      {socialPosts[id] && (
                        <textarea
                          readOnly
                          value={socialPosts[id]}
                          className="w-full h-44 px-3 py-2 rounded-lg text-white text-xs leading-relaxed outline-none resize-y whitespace-pre-wrap"
                          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.10)" }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STEP 6: Download package */}
            <div className="p-5 rounded-2xl space-y-3" style={card}>
              <label className="block text-white font-bold text-sm">⑥ 패키지 다운로드</label>
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

              {/* Telegram delivery */}
              <div className="pt-2 mt-1 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-white/40 text-xs">
                  합성 영상과 SNS 게시글(인스타·유튜브·틱톡)을 텔레그램으로 전송합니다.
                </p>
                <button
                  onClick={sendToTelegram}
                  disabled={telegramLoading || (!finalVideoUrl && !SOCIAL_PLATFORMS.some(({ id }) => socialPosts[id].trim()))}
                  className="w-full py-3 rounded-xl text-white font-bold transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #229ED9, #2AABEE)" }}>
                  {telegramLoading ? "📨 전송 중..." : "✈️ 텔레그램으로 전송"}
                </button>
                {telegramStatus && (
                  <p className={`text-xs ${telegramStatus.ok ? "text-green-300" : "text-red-300"}`}>
                    {telegramStatus.ok ? "✓ " : "⚠️ "}{telegramStatus.msg}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ────────── THUMBNAIL TAB ────────── */}
        {activeTab === "thumbnail" && (
          <div className="space-y-5">
            <RecipeSelector />

            {/* 1. 음식 사진 */}
            <div className="p-5 rounded-2xl" style={card}>
              <label className="block text-white font-bold mb-1 text-sm">① 음식 사진</label>
              <p className="text-white/40 text-xs mb-3">
                미업로드 시 파이프라인 탭에서 생성한 레시피맵의 첫 번째(음식) 이미지를 자동 사용합니다.
              </p>
              <input
                type="file" accept="image/*" onChange={handleUpload}
                className="block w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-orange-500/80 file:text-white hover:file:bg-orange-500 cursor-pointer"
              />
              {uploadedImage ? (
                <div className="mt-4 relative w-32 h-32 rounded-xl overflow-hidden">
                  <Image src={uploadedImage} alt="미리보기" fill className="object-cover" unoptimized />
                </div>
              ) : foodCellImage ? (
                <div className="mt-4 space-y-1">
                  <p className="text-white/40 text-xs">레시피맵 food 셀 자동 사용 중</p>
                  <div className="relative w-32 h-32 rounded-xl overflow-hidden">
                    <Image src={foodCellImage} alt="food 셀 미리보기" fill className="object-cover" unoptimized />
                  </div>
                </div>
              ) : null}
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
