import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { RecipeSuggestion } from "@/types/recipe";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { ingredients } = await req.json();

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json({ error: "재료를 입력해주세요." }, { status: 400 });
    }

    const ingredientList = ingredients.join(", ");

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      config: {
        systemInstruction: `당신은 한국 요리 전문 셰프입니다. 사용자가 가진 재료를 바탕으로 만들 수 있는 레시피를 추천해주세요.
반드시 유효한 JSON만 응답하세요. 마크다운 코드 블록 없이 순수 JSON만 반환하세요.`,
      },
      contents: `집에 있는 재료: ${ingredientList}

이 재료들로 만들 수 있는 3가지 레시피를 추천해주세요.

다음 JSON 형식으로 정확히 응답해주세요:
{
  "recipes": [
    {
      "id": "recipe-1",
      "name": "요리명",
      "emoji": "🍜",
      "description": "요리에 대한 간단한 설명 (1-2문장)",
      "additionalIngredients": ["추가로 필요한 재료1", "추가로 필요한 재료2"],
      "ownedIngredients": ["보유한 재료1", "보유한 재료2"],
      "cookingTime": "30분",
      "difficulty": "쉬움",
      "taste": "매콤하고 짭조름한 맛",
      "pairings": ["잘 어울리는 음식1", "잘 어울리는 음식2"],
      "servings": 2,
      "highlight": "이 요리의 핵심 매력 포인트 (1문장)"
    }
  ]
}

difficulty는 반드시 "쉬움", "보통", "어려움" 중 하나여야 합니다.
additionalIngredients는 최대 4개로 제한해주세요.
pairings는 2-3개로 제한해주세요.`,
    });

    let textContent = result.text ?? "";
    textContent = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const parsed = JSON.parse(textContent);
    const recipes: RecipeSuggestion[] = parsed.recipes;

    return NextResponse.json({ recipes });
  } catch (error) {
    console.error("Recipe generation error:", error);
    return NextResponse.json(
      { error: "레시피 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
