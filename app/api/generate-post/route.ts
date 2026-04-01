import { NextRequest, NextResponse } from "next/server";

const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;

export async function POST(req: NextRequest) {
  try {
    const { recipe, language } = await req.json();
    const isEn = language === "en";

    if (!recipe?.name) {
      return NextResponse.json({ error: "레시피 정보가 필요합니다." }, { status: 400 });
    }

    const ingLines = (recipe.ingredients ?? [])
      .map((i: { name: string; amount: string; unit: string; isOwned: boolean }) =>
        `  • ${i.name} ${i.amount}${i.unit}`)
      .join("\n");

    const stepLines = (recipe.steps ?? [])
      .map((s: { number: number; title: string; description: string; isKick: boolean; kickReason?: string; time?: string }) =>
        `  ${s.number}. ${s.title}${s.time ? ` (${s.time})` : ""}\n     ${s.description}${s.isKick && s.kickReason ? `\n     💡 포인트: ${s.kickReason}` : ""}`)
      .join("\n");

    const proTipLines = (recipe.proTips ?? [])
      .map((t: string, i: number) => `  ${i + 1}. ${t}`)
      .join("\n");

    const prompt = isEn
      ? `You are an expert Instagram food content writer for an international audience.
Write an engaging Instagram post in English based on the recipe below. Make it feel warm, approachable, and exciting for home cooks worldwide — not a literal translation, but naturally written English content.

Recipe info:
- Dish: ${recipe.name}
- Description: ${recipe.description}
- Total time: ${recipe.totalTime}
- Servings: ${recipe.servings}
- Difficulty: ${recipe.difficulty}
- Taste: ${recipe.taste}
- Key highlight: ${recipe.highlight}

Ingredients:
${ingLines}

Steps:
${stepLines}

${proTipLines ? `Pro tips:\n${proTipLines}\n` : ""}
Goes well with: ${(recipe.pairings ?? []).join(", ")}

Writing rules:
1. First line: catchy opening with emoji (e.g. "✨ Tonight, I'm the chef 🍳")
2. One short sentence introducing the dish (flavor/vibe).
3. Ingredients: "📋 Ingredients (serves ${recipe.servings})" then • bullet list. Metric + US units (e.g. 200g/7oz).
4. Steps: "👨‍🍳 Steps" then numbered list, ONE short sentence each. Mark key steps with ⭐.
5. "💡 ${recipe.highlight}" — one sentence tip.
6. Hashtags: 6–8 English tags only (last line).

STRICT LIMIT: Total post must be under 500 characters. Cut mercilessly — no closings, no filler.

Output the post only. No explanation or commentary.`
      : `당신은 인스타그램 음식 콘텐츠 전문 작가입니다.
아래 레시피 정보를 바탕으로 인스타그램 게시글을 작성해주세요.

레시피 정보:
- 요리명: ${recipe.name}
- 설명: ${recipe.description}
- 소요시간: ${recipe.totalTime}
- 분량: ${recipe.servings}인분
- 난이도: ${recipe.difficulty}
- 맛: ${recipe.taste}
- 핵심 포인트: ${recipe.highlight}

재료:
${ingLines}

조리 순서:
${stepLines}

${proTipLines ? `프로 팁:\n${proTipLines}\n` : ""}
어울리는 음식: ${(recipe.pairings ?? []).join(", ")}

작성 규칙:
1. 첫 줄: 이모지와 함께 감성적인 한 줄 카피로 시작 (예: "✨ 오늘 저녁은 내가 셰프 🍳")
2. 두 번째 단락: 요리 소개 2–3줄 (맛, 특징, 어울리는 상황)
3. 재료 섹션: "📋 재료 (${recipe.servings}인분)" 헤더 후 전체 재료 목록 (• 기호 사용)
4. 조리 순서 섹션: "👨‍🍳 만드는 법" 헤더 후 번호 순서 (성공 포인트 단계에 ⭐ 표시)
5. 핵심 비법 섹션: "💡 성공 비법" 헤더 후 핵심 포인트 요약
6. 마무리: 따뜻한 한 줄 마무리 멘트
7. 해시태그: 관련 해시태그 15–20개 (한국어 + 영어 혼합, 마지막 줄)

게시글만 출력하세요. 설명이나 부연은 불필요합니다.`;

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${process.env.GOOGLE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["TEXT"] },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const textPart = parts.find((p: { text?: string }) => p.text);

    if (!textPart) {
      throw new Error("게시글 생성에 실패했습니다.");
    }

    return NextResponse.json({ post: textPart.text });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Post generation error:", message);
    return NextResponse.json(
      { error: `게시글 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
