import { NextRequest, NextResponse } from "next/server";
import { RecipeDetail } from "@/types/recipe";
import { NarrationSegment } from "@/types/shorts";
import { extractShortsKeypoints } from "@/lib/agents/shorts-keypoint-extractor";
import { parseFirstJsonObject } from "@/lib/parse-json";

export type { NarrationSegment };

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Fixed camera timing per spec §11.7
const SEGMENT_DEFS = [
  { id: "hook",        label: "후킹",    start: 0,  end: 3,  camera: "top" },
  { id: "problem",     label: "문제제기", start: 3,  end: 6,  camera: "problem" },
  { id: "point1",      label: "포인트 1", start: 6,  end: 10, camera: "point1" },
  { id: "point2",      label: "포인트 2", start: 10, end: 14, camera: "point2" },
  { id: "point3",      label: "포인트 3", start: 14, end: 18, camera: "point3" },
  { id: "ingredients", label: "재료",    start: 18, end: 25, camera: "bottom" },
  { id: "cta",         label: "CTA",    start: 25, end: 30, camera: "full" },
] as const;

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;
}

async function generateNarrationAndMeta(
  kp: Awaited<ReturnType<typeof extractShortsKeypoints>>,
  recipeName: string,
  character: string,
  googleApiKey: string,
): Promise<{ narration: Record<string, string>; caption: string; hashtags: string[] }> {
  const tone =
    character === "lazy_bear" || character === "lazy"
      ? "귀차니즘 곰돌이 — 간결, 직접적, '이것만 하면 됩니다' 느낌."
      : character === "trend_bear" || character === "trend"
      ? "트렌드곰 — FOMO 자극, '요즘 이거 모르면 손해' 느낌."
      : "귀여운 곰돌이 — 친근, 따뜻, 초보자 친화적.";

  const prompt = `당신은 한국 SNS 쇼츠 나레이터입니다. ${tone}

레시피: ${recipeName}
훅: ${kp.hook}
문제: ${kp.problem}
포인트1: ${kp.keyPoints[0]?.title} — ${kp.keyPoints[0]?.description}
포인트2: ${kp.keyPoints[1]?.title} — ${kp.keyPoints[1]?.description}
포인트3: ${kp.keyPoints[2]?.title} — ${kp.keyPoints[2]?.description}
재료: ${kp.saveCard.ingredients.join(", ")}

TTS 속도 1.3배 기준 구간별 최대 글자수:
- hook(3초): 15자 이내 — 충격적 질문/선언
- problem(3초): 18자 이내 — "이 N가지를 놓쳤다면" 패턴
- point1~3(각 4초): 22자 이내
- ingredients(7초): 38자 이내
- cta(5초): 20자 이내 — 저장 유도

반드시 아래 JSON만 반환하세요:
{
  "narration": {
    "hook": "",
    "problem": "",
    "point1": "",
    "point2": "",
    "point3": "",
    "ingredients": "",
    "cta": ""
  },
  "caption": "인스타그램 캡션 150자 이내",
  "hashtags": ["#태그1", "#태그2", "#태그3", "#태그4", "#태그5", "#태그6"]
}`;

  try {
    const text = await callGemini(prompt, googleApiKey);
    return parseFirstJsonObject(text);
  } catch {
    return {
      narration: {
        hook: kp.hook,
        problem: kp.problem,
        point1: `${kp.keyPoints[0]?.title}. ${kp.keyPoints[0]?.description}`,
        point2: `${kp.keyPoints[1]?.title}. ${kp.keyPoints[1]?.description}`,
        point3: `${kp.keyPoints[2]?.title}. ${kp.keyPoints[2]?.description}`,
        ingredients: kp.saveCard.ingredients.slice(0, 5).join(", "),
        cta: "레시피 저장하고 오늘 저녁 도전해보세요!",
      },
      caption: `${recipeName} 만들기 | ${kp.hook}`,
      hashtags: ["#한식", "#레시피", "#요리", "#집밥", "#쇼츠", "#먹방"],
    };
  }
}

function buildSrt(segments: NarrationSegment[]): string {
  const fmt = (sec: number) => {
    const h = String(Math.floor(sec / 3600)).padStart(2, "0");
    const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
    const s = String(Math.floor(sec % 60)).padStart(2, "0");
    return `${h}:${m}:${s},000`;
  };
  return segments
    .filter((s) => s.text)
    .map((s, i) => `${i + 1}\n${fmt(s.estimatedStartSec)} --> ${fmt(s.estimatedEndSec)}\n${s.text}`)
    .join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const { recipe, character } = await req.json() as { recipe: RecipeDetail; character: string };
    if (!recipe?.name) return NextResponse.json({ error: "레시피 정보가 필요합니다." }, { status: 400 });

    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) return NextResponse.json({ error: "GOOGLE_API_KEY 미설정" }, { status: 500 });

    const keypoints = await extractShortsKeypoints(recipe, character, googleApiKey);
    const { narration, caption, hashtags } = await generateNarrationAndMeta(
      keypoints, recipe.name, character, googleApiKey,
    );

    const narrationSegments: NarrationSegment[] = SEGMENT_DEFS.map((s) => ({
      id: s.id as NarrationSegment["id"],
      label: s.label,
      text: (narration as Record<string, string>)[s.id] ?? "",
      estimatedStartSec: s.start,
      estimatedEndSec: s.end,
      cameraSection: s.camera as NarrationSegment["cameraSection"],
    }));

    return NextResponse.json({
      keypoints,
      narrationSegments,
      srtContent: buildSrt(narrationSegments),
      caption,
      hashtags,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate-shorts]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
