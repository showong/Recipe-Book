import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateImageWithOpenAI } from "@/lib/services/openai-image";
import { ShortsKeypointResult } from "@/lib/agents/shorts-keypoint-extractor";

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

type CellKey = "food" | "problem" | "point1" | "point2" | "point3" | "ingredients";

function characterDesc(character: string): string {
  return character === "lazy" ? "귀차니즘 느낌의 팬더 곰 캐릭터"
    : character === "trend" ? "트렌디하고 세련된 팬더 곰 캐릭터"
    : "귀엽고 친근한 곰 셰프 캐릭터";
}

// Each cell is one full 9:16 frame of the 6-cell recipe grid.
function buildCellPrompt(cell: CellKey, recipeName: string, kp: ShortsKeypointResult, character: string): string {
  const base = "한국 요리 SNS 쇼츠용 세로 9:16 이미지. 사실적이고 선명한 비주얼, 영화 같은 조명, 딥 다크 톤 배경. 이미지 안에 글자/텍스트/자막/워터마크는 절대 넣지 마세요.";
  switch (cell) {
    case "food":
      return `"${recipeName}" 완성 요리의 먹음직스러운 클로즈업 음식 사진. 김이 모락모락, 식욕을 자극하는 플레이팅. ${base}`;
    case "problem":
      return `"${recipeName}"를 만들다 흔히 겪는 실패/고민 상황을 표현한 장면: "${kp.problem}". ${characterDesc(character)}가 곤란해하거나 걱정하는 표정으로 등장. ${base}`;
    case "point1":
      return `요리 핵심 포인트 "${kp.keyPoints[0]?.title}: ${kp.keyPoints[0]?.description}"를 보여주는 조리 과정 클로즈업 장면. ${base}`;
    case "point2":
      return `요리 핵심 포인트 "${kp.keyPoints[1]?.title}: ${kp.keyPoints[1]?.description}"를 보여주는 조리 과정 클로즈업 장면. ${base}`;
    case "point3":
      return `요리 핵심 포인트 "${kp.keyPoints[2]?.title}: ${kp.keyPoints[2]?.description}"를 보여주는 조리 과정 클로즈업 장면. ${base}`;
    case "ingredients":
      return `"${recipeName}"의 핵심 재료들을 가지런히 늘어놓은 플랫레이(flat lay overhead) 사진. 재료: ${kp.saveCard.ingredients.slice(0, 6).join(", ")}. ${base}`;
  }
}

async function generateWithGemini(
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
  apiKey: string,
): Promise<string | null> {
  const res = await fetch(`${GEMINI_IMAGE_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const imgPart = (data?.candidates?.[0]?.content?.parts ?? []).find(
    (p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.data,
  );
  if (!imgPart?.inlineData) return null;
  const { mimeType, data: b64 } = imgPart.inlineData;
  return `data:${mimeType};base64,${b64}`;
}

export async function POST(req: NextRequest) {
  try {
    const { cell, recipeName, keypoints, character } = await req.json() as {
      cell: CellKey;
      recipeName: string;
      keypoints: ShortsKeypointResult;
      character: string;
    };

    if (!cell || !recipeName || !keypoints) {
      return NextResponse.json({ error: "셀 종류, 레시피명, 핵심 포인트가 필요합니다." }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const prompt = buildCellPrompt(cell, recipeName, keypoints, character);

    // Gemini image model — for the problem cell, supply the bear character reference.
    if (googleApiKey) {
      try {
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
        if (cell === "problem") {
          const charFile =
            character === "lazy" ? "chef-bear-reference-1.png"
            : character === "trend" ? "chef-bear-reference-2.png"
            : "chef-bear-reference.png";
          const charBase64 = fs
            .readFileSync(path.join(process.cwd(), "public", charFile))
            .toString("base64");
          parts.push({ inlineData: { mimeType: "image/png", data: charBase64 } });
          parts.push({ text: `입력 이미지의 곰 캐릭터를 그대로 등장시키세요.\n\n${prompt}` });
        } else {
          parts.push({ text: prompt });
        }
        const imageUrl = await generateWithGemini(parts, googleApiKey);
        if (imageUrl) return NextResponse.json({ imageUrl });
      } catch (geminiErr) {
        console.warn(`[generate-shorts-map] Gemini 실패 (${cell}), OpenAI fallback:`, geminiErr);
      }
    }

    // OpenAI gpt-image-2 fallback (text-to-image, 9:16 portrait)
    if (openaiKey) {
      const result = await generateImageWithOpenAI(prompt, openaiKey, {
        model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
        size: "1024x1536",
        quality: process.env.OPENAI_IMAGE_QUALITY ?? "medium",
      });
      return NextResponse.json({ imageUrl: result.imageUrl });
    }

    return NextResponse.json({ error: "이미지 생성 API 키(GOOGLE_API_KEY 또는 OPENAI_API_KEY)가 필요합니다." }, { status: 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate-shorts-map]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
