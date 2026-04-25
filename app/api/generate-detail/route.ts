import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";
import { RecipeDetail } from "@/types/recipe";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { recipeName, ownedIngredients, additionalIngredients, character } = await req.json();

    if (!recipeName) {
      return NextResponse.json({ error: "레시피 이름을 입력해주세요." }, { status: 400 });
    }

    const systemInstruction = character === "lazy"
      ? `당신은 귀차니즘 곰돌이입니다. 복잡한 조리법은 싫어하지만 맛에는 양보 없는 효율 지상주의 요리사예요. 불필요한 단계는 과감히 생략하고 핵심만 짚어서 설명하세요.\n\n계량 표현 규칙: 정밀한 g·ml 수치 대신 대략적 표현을 우선 사용하세요. 예: "한 숟가락", "두 숟가락", "대충 손톱만큼", "적당히", "한 꼬집", "한 줌". 꼭 필요한 경우에만 "약 200g" 처럼 사용하세요.\n\n조리 설명 규칙: 눈에 보이는 변화로 타이밍을 알려주세요. 예: "소스가 걸쭉해지면", "색이 갈색으로 변하면", "가장자리가 보글보글 끓기 시작하면", "수분이 날아가 졌으면". 소스 조리 시 졸이는 정도를 시각적으로 묘사하세요.\n\n꿀팁: 진짜 실전에서 쓰는 팁만 적고, 교과서적인 설명은 넣지 마세요. 단계는 6~8개로 유지하되 각 단계 설명은 간결하게 핵심만 전달하세요.\n반드시 유효한 JSON만 응답하세요. 마크다운 코드 블록 없이 순수 JSON만 반환하세요.`
      : `당신은 한국 요리 전문 셰프이자 요리 교육자입니다. 초등학생도 따라할 수 있을 만큼 상세하고 친절한 레시피를 작성해주세요.\n반드시 유효한 JSON만 응답하세요. 마크다운 코드 블록 없이 순수 JSON만 반환하세요.`;

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction,
      },
      contents: `레시피 이름: ${recipeName}
보유 재료: ${ownedIngredients?.join(", ") || ""}
추가 필요 재료: ${additionalIngredients?.join(", ") || ""}

위 레시피의 상세 조리법을 작성해주세요.

다음 JSON 형식으로 정확히 응답해주세요:
{
  "name": "요리명",
  "emoji": "🍜",
  "description": "요리 설명 (2-3문장)",
  "totalTime": "45분",
  "servings": 2,
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
      "description": "초등학생도 이해할 수 있는 상세한 설명. 정확한 계량(숟가락, 컵 등)을 포함하세요.",
      "time": "5분",
      "isKick": false,
      "kickReason": null,
      "parallel": null,
      "tip": "유용한 팁 (선택사항)",
      "emoji": "🔪"
    }
  ],
  "summaryText": "초등학생도 따라할 수 있는 전체 레시피 요약 (200자 이내)",
  "proTips": ["프로 팁1", "프로 팁2", "프로 팁3"],
  "pairings": ["잘 어울리는 음식1", "잘 어울리는 음식2"]
}

중요한 규칙:
1. isKick이 true인 단계는 이 요리의 핵심이 되는 단계입니다. 2-3개의 단계에 isKick: true를 설정하고 kickReason을 작성하세요.
2. parallel 필드에는 이 단계를 진행하면서 동시에 할 수 있는 작업을 적어주세요 (예: "이 시간에 국물 끓이기 시작하세요").
3. 계량은 반드시 밥숟가락(T), 찻숟가락(t), 컵(cup), g, ml 등 명확하게 표시하세요.
4. 총 6-10단계로 구성하세요.
5. 단계별 emoji는 해당 조리 동작을 표현하는 이모지를 사용하세요.`,
    });

    let textContent = result.text ?? "";
    textContent = textContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    const recipeDetail: RecipeDetail = JSON.parse(textContent);

    return NextResponse.json({ recipe: recipeDetail });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Recipe detail generation error:", message);
    return NextResponse.json(
      { error: `레시피 상세 정보 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
