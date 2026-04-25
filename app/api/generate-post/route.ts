import { NextRequest, NextResponse } from "next/server";

const GEMINI_TEXT_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent`;

export async function POST(req: NextRequest) {
  try {
    const { recipe, language, character } = await req.json();
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

    const enPersona = character === "lazy"
      ? `You are writing as "Lazy Bear" — a practical home cook who hates fuss but never compromises on flavor. Your tone is dry, direct, and confident. Phrases like "honestly this is easy", "skip the fancy stuff", "minimal effort, maximum taste" fit your style.
Write an engaging Instagram post in English based on the recipe below. Make it feel warm, approachable, and exciting for home cooks worldwide — not a literal translation, but naturally written English content.`
      : `You are an expert Instagram food content writer for an international audience.
Write an engaging Instagram post in English based on the recipe below. Make it feel warm, approachable, and exciting for home cooks worldwide — not a literal translation, but naturally written English content.`;

    const koPersona = character === "lazy"
      ? `당신은 귀차니즘 곰돌이 캐릭터로 인스타그램 음식 콘텐츠를 쓰는 작가입니다.\n아래 레시피 정보를 바탕으로 인스타그램 게시글을 작성해주세요. 말투는 건조하고 솔직하며 "생각보다 별거 없는데 맛있음", "귀찮은 거 다 빼도 됨", "이 정도면 충분함" 뉘앙스로 작성하세요.`
      : `당신은 인스타그램 음식 콘텐츠 전문 작가입니다.\n아래 레시피 정보를 바탕으로 인스타그램 게시글을 작성해주세요.`;

    const koRule1 = character === "lazy"
      ? `1. 첫 줄: 귀찮음과 효율을 강조하는 한 줄 카피 (예: "😮‍💨 귀찮지만 맛있어서 함", "⚡ 5분이면 충분함")`
      : `1. 첫 줄: 이모지와 함께 감성적인 한 줄 카피로 시작 (예: "✨ 오늘 저녁은 내가 셰프 🍳")`;

    const koRule6 = character === "lazy"
      ? `6. 마무리: 건조하지만 자신감 있는 한 줄 마무리 (예: "이거 진짜 맛있음. 믿어봐.")`
      : `6. 마무리: 따뜻한 한 줄 마무리 멘트`;

    const prompt = isEn
      ? `${enPersona}

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
      : `${koPersona}

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
${koRule1}
2. 두 번째 단락: 요리 소개 2–3줄 (맛, 특징, 어울리는 상황)
3. 재료 섹션: "📋 재료 (${recipe.servings}인분)" 헤더 후 전체 재료 목록 (• 기호 사용)
4. 조리 순서 섹션: "👨‍🍳 만드는 법" 헤더 후 번호 순서 (성공 포인트 단계에 ⭐ 표시)
5. 핵심 비법 섹션: "💡 성공 비법" 헤더 후 핵심 포인트 요약
${koRule6}
7. 해시태그: 관련 해시태그 10개 이내 (한국어 + 영어 혼합, 마지막 줄)

엄격한 글자수 제한: 전체 게시글이 반드시 500자 이하여야 합니다. 초과 시 내용을 과감하게 줄이세요. 해시태그 포함 500자.

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

    const post = textPart.text as string;
    const trimmed = !isEn && post.length > 500 ? post.slice(0, 500) : post;
    return NextResponse.json({ post: trimmed });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Post generation error:", message);
    return NextResponse.json(
      { error: `게시글 생성 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
