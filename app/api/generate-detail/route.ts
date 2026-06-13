import { NextRequest, NextResponse } from "next/server";
import { RecipeDetail } from "@/types/recipe";
import { normalizeCharacter } from "@/types/character";
import { verifyRecipe } from "@/lib/agents/recipe-verifier";
import { parseFirstJsonObject } from "@/lib/parse-json";

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt: string, systemInstruction: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 8192, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;
}

function buildSystemInstruction(character: string): string {
  if (character === "lazy_bear" || character === "lazy") {
    return `당신은 귀차니즘 곰돌이입니다. 복잡한 조리법은 싫어하지만 맛에는 양보 없는 효율 지상주의 요리사예요. 불필요한 단계는 과감히 생략하고 핵심만 짚어서 설명하세요.

계량 표현 규칙: 정밀한 g·ml 수치 대신 대략적 표현을 우선 사용하세요. 예: "한 숟가락", "두 숟가락", "대충 손톱만큼", "적당히", "한 꼬집", "한 줌". 꼭 필요한 경우에만 "약 200g" 처럼 사용하세요.

조리 설명 규칙: 눈에 보이는 변화로 타이밍을 알려주세요. 예: "소스가 걸쭉해지면", "색이 갈색으로 변하면", "가장자리가 보글보글 끓기 시작하면", "수분이 날아가 졌으면". 소스 조리 시 졸이는 정도를 시각적으로 묘사하세요.

꿀팁: 진짜 실전에서 쓰는 팁만 적고, 교과서적인 설명은 넣지 마세요. 단계는 6~8개로 유지하되 각 단계 설명은 간결하게 핵심만 전달하세요.
반드시 유효한 JSON만 응답하세요. 마크다운 코드 블록 없이 순수 JSON만 반환하세요.`;
  }
  if (character === "trend_bear" || character === "trend") {
    return `당신은 트렌드곰입니다. SNS에 올리기 좋은 비주얼과 스토리가 있는 레시피를 작성해주세요. 트렌드 키워드(고단백, 다이어트, 원팬, 에어프라이어 등)를 활용하고, 초보자도 따라하기 쉬운 단계를 제공하세요.
반드시 유효한 JSON만 응답하세요. 마크다운 코드 블록 없이 순수 JSON만 반환하세요.`;
  }
  // cute_bear (default)
  return `당신은 한국 요리 전문 셰프이자 요리 교육자입니다. 초등학생도 따라할 수 있을 만큼 상세하고 친절한 레시피를 작성해주세요.
반드시 유효한 JSON만 응답하세요. 마크다운 코드 블록 없이 순수 JSON만 반환하세요.`;
}

async function generateRecipeDetail(
  recipeName: string,
  ownedIngredients: string[],
  additionalIngredients: string[],
  character: string,
  apiKey: string,
  servings: number = 2,
): Promise<RecipeDetail> {
  const isLazy = character === "lazy_bear" || character === "lazy";
  const systemInstruction = buildSystemInstruction(character);

  const contents = `레시피 이름: ${recipeName}
기준 인원수: ${servings}인분
보유 재료: ${ownedIngredients?.join(", ") || ""}
추가 필요 재료: ${additionalIngredients?.join(", ") || ""}

위 레시피의 상세 조리법을 ${servings}인분 기준으로 작성해주세요. 재료 양은 정확히 ${servings}인분에 맞게 설정하세요.

다음 JSON 형식으로 정확히 응답해주세요:
{
  "name": "요리명",
  "emoji": "🍜",
  "description": "요리 설명 (2-3문장)",
  "totalTime": "45분",
  "servings": ${servings},
  "difficulty": "보통",
  "taste": "맛 설명",
  "highlight": "이 요리의 핵심 킥 포인트",
  "ingredients": [
    {
      "name": "재료명",
      "amount": "200",
      "unit": "g",
      "isOwned": true
    }
  ],
  "steps": [
    {
      "number": 1,
      "title": "단계 제목",
      "description": "${isLazy ? "간결하고 핵심만 담은 설명. 눈에 보이는 변화로 타이밍 표현" : "초등학생도 이해할 수 있는 상세한 설명. 정확한 계량(숟가락, 컵 등)을 포함하세요."}",
      "time": "5분",
      "isKick": false,
      "kickReason": null,
      "parallel": null,
      "tip": "유용한 팁 (선택사항)",
      "emoji": "🔪"
    }
  ],
  "summaryText": "전체 레시피 요약 (200자 이내)",
  "proTips": ["프로 팁1", "프로 팁2", "프로 팁3"],
  "pairings": ["잘 어울리는 음식1", "잘 어울리는 음식2"]
}

중요한 규칙:
1. isKick이 true인 단계는 이 요리의 핵심이 되는 단계입니다. 2-3개의 단계에 isKick: true를 설정하고 kickReason을 작성하세요.
2. parallel 필드에는 이 단계를 진행하면서 동시에 할 수 있는 작업을 적어주세요.
3. 계량은 반드시 밥숟가락(T), 찻숟가락(t), 컵(cup), g, ml 등 명확하게 표시하세요.
4. 총 6-10단계로 구성하세요.
5. 단계별 emoji는 해당 조리 동작을 표현하는 이모지를 사용하세요.`;

  const text = await callGemini(contents, systemInstruction, apiKey);
  return parseFirstJsonObject<RecipeDetail>(text);
}

export async function POST(req: NextRequest) {
  try {
    const { recipeName, ownedIngredients, additionalIngredients, character: rawCharacter, taste, highlight, servings: rawServings } = await req.json();
    const servings: number = typeof rawServings === "number" && rawServings > 0 ? rawServings : 2;

    if (!recipeName) {
      return NextResponse.json({ error: "레시피 이름을 입력해주세요." }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      return NextResponse.json({ error: "GOOGLE_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const character = normalizeCharacter(rawCharacter);
    const owned: string[] = ownedIngredients ?? [];
    const additional: string[] = additionalIngredients ?? [];

    // ── 레시피 생성 ──────────────────────────────────────────────────────────
    let recipeDetail = await generateRecipeDetail(recipeName, owned, additional, character, googleApiKey, servings);

    // ── 레시피 검증 Agent ────────────────────────────────────────────────────
    let verificationResult = null;
    try {
      verificationResult = await verifyRecipe(recipeDetail, owned, additional, character, googleApiKey);

      // 검증 실패 시 1회 자동 수정
      if (verificationResult.revisionRequired) {
        console.log("[generate-detail] 검증 이슈 발견, 재생성 시도:", verificationResult.issues);
        const revised = await generateRecipeDetail(
          `${recipeName} (개선 버전: ${verificationResult.issues.slice(0, 2).join(", ")} 해결)`,
          owned,
          additional,
          character,
          googleApiKey,
          servings,
        );
        recipeDetail = revised;
        verificationResult = { ...verificationResult, revisionRequired: false };
      }
    } catch (verifyErr) {
      console.warn("[generate-detail] 검증 실패, 원본 사용:", verifyErr);
    }

    // taste/highlight 보완 (추천 단계에서 전달된 값 우선)
    if (taste && !recipeDetail.taste) recipeDetail = { ...recipeDetail, taste };
    if (highlight && !recipeDetail.highlight) recipeDetail = { ...recipeDetail, highlight };

    return NextResponse.json({
      recipe: recipeDetail,
      verificationResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Recipe detail generation error:", message);
    return NextResponse.json(
      { error: `레시피 상세 정보 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 },
    );
  }
}
