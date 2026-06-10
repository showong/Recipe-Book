"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Image from "next/image";

// generate-image API와 동일한 6가지 썸네일 스타일
const THUMBNAIL_STYLES = [
  { id: 1, name: "무드 에디토리얼" },
  { id: 2, name: "볼드 컬러 포스터" },
  { id: 3, name: "드라마틱 클로즈업" },
  { id: 4, name: "레시피 인포그래픽" },
  { id: 5, name: "내추럴 오가닉" },
  { id: 6, name: "TV 요리쇼" },
] as const;

const CHARACTERS = [
  { id: "cute", label: "🐻 귀여운 곰돌이" },
  { id: "lazy", label: "🐨 귀차니즘 곰돌이" },
  { id: "trend", label: "🐼 트렌드곰" },
] as const;

// 업로드 이미지를 최대 1024px로 압축한 JPEG base64로 변환
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
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
      if (!ctx) { reject(new Error("canvas unavailable")); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("이미지 로드 실패")); };
    img.src = objectUrl;
  });
}

// 결과 이미지를 9:16(1080x1920)으로 센터 크롭
function cropImageToRatio(dataUrl: string, targetW: number, targetH: number): Promise<string> {
  return new Promise((resolve) => {
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
}

export default function AdminShortsPage() {
  const router = useRouter();

  // 레시피 정보
  const [recipeName, setRecipeName] = useState("");
  const [highlight, setHighlight] = useState("");
  const [taste, setTaste] = useState("");
  const [cookingTime, setCookingTime] = useState("");
  const [servings, setServings] = useState("");
  const [pairings, setPairings] = useState("");
  const [kickPoints, setKickPoints] = useState("");
  const [character, setCharacter] = useState<string>("cute");
  const [styleId, setStyleId] = useState<number | null>(null); // null = 랜덤

  // 업로드 이미지
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // 생성 결과
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [styleName, setStyleName] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setThumbnail(null);
    setError(null);
    try {
      setUploadedImage(await compressImage(file));
    } catch {
      setError("이미지를 불러오지 못했습니다.");
    }
  };

  const generate = async () => {
    if (!recipeName.trim()) { setError("레시피 이름을 입력해주세요."); return; }
    if (!uploadedImage) { setError("음식 사진을 업로드해주세요."); return; }

    setLoading(true);
    setError(null);
    setThumbnail(null);
    setStyleName(null);

    try {
      const matches = uploadedImage.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) { setError("이미지 형식 오류입니다."); return; }

      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipeName: recipeName.trim(),
          type: "reel-thumbnail",
          uploadedImageBase64: matches[2],
          uploadedImageMimeType: matches[1],
          highlight: highlight.trim(),
          cookingTime: cookingTime.trim(),
          servings: servings.trim(),
          taste: taste.trim(),
          pairings: pairings.split(",").map((p) => p.trim()).filter(Boolean),
          kickPoints: kickPoints.trim(),
          character,
          styleId,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.imageUrl) {
        const cropped = await cropImageToRatio(data.imageUrl, 1080, 1920);
        setThumbnail(cropped);
        setStyleName(data.styleName ?? null);
      } else {
        setError("이미지를 생성하지 못했습니다.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "썸네일 생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!thumbnail) return;
    const a = document.createElement("a");
    a.href = thumbnail;
    a.download = `${recipeName || "reel"}-thumbnail.png`;
    a.click();
  };

  const inputStyle = {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)" }}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-white text-center mb-10">
          <div className="text-5xl mb-4">🎬</div>
          <h1 className="text-3xl font-extrabold mb-2">쇼츠 썸네일 생성기</h1>
          <p className="text-white/50 text-sm">음식 사진과 레시피 정보로 9:16 릴스 썸네일을 제작합니다</p>
        </div>

        <div className="space-y-5">
          {/* 1. 음식 사진 업로드 */}
          <div className="p-5 rounded-2xl" style={inputStyle}>
            <label className="block text-white font-bold mb-3 text-sm">① 음식 사진 *</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleUpload}
              className="block w-full text-sm text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-orange-500/80 file:text-white hover:file:bg-orange-500 cursor-pointer"
            />
            {uploadedImage && (
              <div className="mt-4 relative w-32 h-32 rounded-xl overflow-hidden">
                <Image src={uploadedImage} alt="업로드 미리보기" fill className="object-cover" unoptimized />
              </div>
            )}
          </div>

          {/* 2. 레시피 정보 */}
          <div className="p-5 rounded-2xl space-y-3" style={inputStyle}>
            <label className="block text-white font-bold mb-1 text-sm">② 레시피 정보</label>
            <input
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
              placeholder="레시피 이름 * (예: 마라샹궈)"
              className="w-full px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none"
              style={inputStyle}
            />
            <input
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="핵심 포인트 (예: 집에서 만드는 중독성 마라맛)"
              className="w-full px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none"
              style={inputStyle}
            />
            <input
              value={taste}
              onChange={(e) => setTaste(e.target.value)}
              placeholder="맛 표현 (예: 얼얼하고 매콤한 맛)"
              className="w-full px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none"
              style={inputStyle}
            />
            <div className="flex gap-3">
              <input
                value={cookingTime}
                onChange={(e) => setCookingTime(e.target.value)}
                placeholder="조리 시간 (예: 20분)"
                className="flex-1 px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none"
                style={inputStyle}
              />
              <input
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                placeholder="분량 (예: 2인분)"
                className="flex-1 px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none"
                style={inputStyle}
              />
            </div>
            <input
              value={pairings}
              onChange={(e) => setPairings(e.target.value)}
              placeholder="페어링 (쉼표로 구분, 예: 맥주, 밥)"
              className="w-full px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none"
              style={inputStyle}
            />
            <input
              value={kickPoints}
              onChange={(e) => setKickPoints(e.target.value)}
              placeholder="성공 포인트 (예: 마라 향신료는 기름에 먼저 볶기)"
              className="w-full px-4 py-2.5 rounded-xl text-white placeholder-white/30 text-sm outline-none"
              style={inputStyle}
            />
          </div>

          {/* 3. 캐릭터 */}
          <div className="p-5 rounded-2xl" style={inputStyle}>
            <label className="block text-white font-bold mb-3 text-sm">③ 캐릭터 톤</label>
            <div className="flex gap-2">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCharacter(c.id)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={character === c.id
                    ? { background: "linear-gradient(135deg, #ff6b35, #ffc857)", color: "white" }
                    : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4. 썸네일 스타일 */}
          <div className="p-5 rounded-2xl" style={inputStyle}>
            <label className="block text-white font-bold mb-3 text-sm">④ 썸네일 스타일</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setStyleId(null)}
                className="py-2.5 rounded-xl text-xs font-bold transition-all"
                style={styleId === null
                  ? { background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "white" }
                  : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}>
                🎲 랜덤
              </button>
              {THUMBNAIL_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyleId(s.id)}
                  className="py-2.5 rounded-xl text-xs font-bold transition-all"
                  style={styleId === s.id
                    ? { background: "linear-gradient(135deg, #7c3aed, #a855f7)", color: "white" }
                    : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* 생성 버튼 */}
          <button
            onClick={generate}
            disabled={loading}
            className="w-full py-4 rounded-2xl text-white font-bold text-lg transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #ff6b35, #ffc857)" }}>
            {loading ? "생성 중... (약 10~20초)" : "🎬 썸네일 생성"}
          </button>

          {error && (
            <div className="p-4 rounded-2xl text-sm text-red-200"
              style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
              ⚠️ {error}
            </div>
          )}

          {/* 결과 */}
          {thumbnail && (
            <div className="p-5 rounded-2xl" style={inputStyle}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-white font-bold text-sm">완성 썸네일</span>
                {styleName && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(124,58,237,0.25)", color: "#c4b5fd" }}>
                    {styleName}
                  </span>
                )}
              </div>
              <div className="relative w-full mx-auto rounded-xl overflow-hidden"
                style={{ aspectRatio: "9 / 16", maxWidth: "300px" }}>
                <Image src={thumbnail} alt="생성된 썸네일" fill className="object-cover" unoptimized />
              </div>
              <button
                onClick={download}
                className="w-full mt-4 py-3 rounded-xl text-white text-sm font-bold transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045)" }}>
                ⬇️ 썸네일 저장
              </button>
            </div>
          )}
        </div>

        {/* 뒤로 */}
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
