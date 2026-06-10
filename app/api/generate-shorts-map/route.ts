import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateImageWithOpenAI } from "@/lib/services/openai-image";
import { ShortsKeypointResult } from "@/lib/agents/shorts-keypoint-extractor";

const GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
const GEMINI_IMAGE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`;

function buildPrompt(recipeName: string, kp: ShortsKeypointResult, character: string): string {
  const charDesc =
    character === "lazy" ? "귀차니즘 느낌의 팬더 곰 캐릭터"
    : character === "trend" ? "트렌디하고 세련된 팬더 곰 캐릭터"
    : "귀엽고 친근한 곰 캐릭터";

  return `한국 레시피 SNS 쇼츠용 인포그래픽 포스터. 9:16 세로 비율.

배경: 딥 다크 네이비 (#0D1B2A).

상단 영역 (상단 35%):
  "${recipeName}" 음식 클로즈업 사진. 먹음직스럽고 선명하게.
  하단에 훅 텍스트 오버레이: "${kp.hook}" — 크고 굵은 흰색 한국어.

중단 영역 (35~75%):
  어두운 배경 위 3개의 핵심 포인트 카드. 오렌지(#FF6B35) 번호 원형.
  카드1 (①): 제목 "${kp.keyPoints[0]?.title}" / 설명 "${kp.keyPoints[0]?.description}"
  카드2 (②): 제목 "${kp.keyPoints[1]?.title}" / 설명 "${kp.keyPoints[1]?.description}"
  카드3 (③): 제목 "${kp.keyPoints[2]?.title}" / 설명 "${kp.keyPoints[2]?.description}"

하단 영역 (75~100%):
  재료 저장 카드: 제목 "${kp.saveCard.title}", 재료 목록 ${kp.saveCard.ingredients.slice(0, 6).join(", ")}.
  오른쪽 하단: 작은 ${charDesc} 일러스트.
  맨 하단 중앙: "@oh_showong" (소형 코랄 텍스트).

색상: 딥 네이비 배경, 오렌지 포인트, 흰색 텍스트. 모던 한국 SNS 디자인.
수치, 좌표 등 기술적 텍스트는 이미지에 노출하지 마세요.`;
}

export async function POST(req: NextRequest) {
  try {
    const { recipeName, keypoints, character, heroImageBase64, heroImageMimeType } = await req.json() as {
      recipeName: string;
      keypoints: ShortsKeypointResult;
      character: string;
      heroImageBase64?: string;
      heroImageMimeType?: string;
    };

    if (!recipeName || !keypoints) {
      return NextResponse.json({ error: "레시피명과 핵심 포인트가 필요합니다." }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    const prompt = buildPrompt(recipeName, keypoints, character);

    // Gemini multimodal: food photo + character ref → composite recipe map
    if (heroImageBase64 && googleApiKey) {
      try {
        const charFile =
          character === "lazy" ? "chef-bear-reference-1.png"
          : character === "trend" ? "chef-bear-reference-2.png"
          : "chef-bear-reference.png";
        const charBase64 = fs
          .readFileSync(path.join(process.cwd(), "public", charFile))
          .toString("base64");

        const parts = [
          { inlineData: { mimeType: heroImageMimeType ?? "image/jpeg", data: heroImageBase64 } },
          { inlineData: { mimeType: "image/png", data: charBase64 } },
          {
            text: `입력 이미지:
- 이미지1: "${recipeName}" 음식 사진 → 상단 영역 메인 비주얼로 사용
- 이미지2: 곰 캐릭터 레퍼런스 → 하단 우측에 소형 삽화로 배치

${prompt}`,
          },
        ];

        const res = await fetch(`${GEMINI_IMAGE_URL}?key=${googleApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const imgPart = (data?.candidates?.[0]?.content?.parts ?? []).find(
            (p: { inlineData?: { mimeType?: string; data?: string } }) => p.inlineData?.data,
          );
          if (imgPart?.inlineData) {
            const { mimeType, data: b64 } = imgPart.inlineData;
            return NextResponse.json({ imageUrl: `data:${mimeType};base64,${b64}` });
          }
        }
      } catch (geminiErr) {
        console.warn("[generate-shorts-map] Gemini 실패, OpenAI fallback:", geminiErr);
      }
    }

    // OpenAI gpt-image-2 (text-to-image, 9:16 portrait)
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
