import { NextRequest, NextResponse } from "next/server";
import { RecipeSuggestion } from "@/types/recipe";
import { normalizeCharacter } from "@/types/character";
import { decideSearch } from "@/lib/agents/search-decision";
import { multiSearchTavily } from "@/lib/services/tavily";
import { extractTrendPatterns, TrendExtractResult } from "@/lib/agents/trend-pattern-extractor";
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
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }
  const data = await res.json();
  const text = (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;
  if (!text) {
    const finishReason = data?.candidates?.[0]?.finishReason ?? "unknown";
    throw new Error(`Gemini returned empty text (finishReason: ${finishReason})`);
  }
  return text;
}

function buildSystemInstruction(character: string): string {
  if (character === "lazy_bear" || character === "lazy") {
    return `당신은 귀차니즘 곰돌이입니다. 요리는 좋아하지만 복잡한 건 딱 질색인 현실파 요리 도우미예요. '어차피 먹을 거 맛있으면 됐지'를 신조로, 조리 시간이 짧고 단계가 적고 특별한 기술이 필요 없는 레시피를 우선 추천합니다. 하지만 본인만의 킥요소는 반드시 존재해야 합니다.
보유한 재료를 최대한 활용하세요. 기본적인 소스 재료를 제외한 추가 재료 구입은 최소화하고, 가능하면 additionalIngredients는 2개 이하로 줄이세요. 소스는 집에서 쉽게 만들 수 있는 간단한 것만 사용하고 모든 사람이 맛있게 느껴야합니다.
반드시 유효한 JSON만 응답하세요. 마크다운 코드 블록 없이 순수 JSON만 반환하세요.`;
  }
  if (character === "trend_bear" || character === "trend") {
    return `당신은 트렌드곰입니다. 유튜브, SNS, 숏츠에서 요즘 화제인 레시피 조합을 기반으로 추천하는 트렌드 레시피 전문가입니다.
다이어트, 고단백, 원팬, 에어프라이어, 편의점 조합 등 최신 트렌드 키워드를 반영하고, SNS에 올리기 좋은 비주얼과 스토리가 있는 레시피를 추천하세요.
반드시 유효한 JSON만 응답하세요. 마크다운 코드 블록 없이 순수 JSON만 반환하세요.`;
  }
  // cute_bear (default)
  return `당신은 한국 요리 전문 셰프입니다. 사용자가 가진 재료를 바탕으로 만들 수 있는 레시피를 추천해주세요.
반드시 유효한 JSON만 응답하세요. 마크다운 코드 블록 없이 순수 JSON만 반환하세요.`;
}

function buildTrendContext(trendData: TrendExtractResult | null): string {
  if (!trendData || trendData.trendPatterns.length === 0) return "";
  const patterns = trendData.trendPatterns
    .map((p) => `- ${p.patternName}: ${p.trendReason}${p.recommendedCookingMethod ? ` (${p.recommendedCookingMethod})` : ""}`)
    .join("\n");
  const keywords = trendData.trendKeywords.join(", ");
  return `\n\n최근 웹 검색 트렌드 분석 결과 (참고용, 복사 금지):
트렌드 패턴:
${patterns}
트렌드 키워드: ${keywords}
요약: ${trendData.summary}

위 트렌드 패턴을 참고하되, 특정 블로그나 유튜버의 레시피를 그대로 복사하지 마세요. 패턴과 조합의 아이디어만 활용하세요.`;
}

export async function POST(req: NextRequest) {
  try {
    const { ingredients, preferences, character: rawCharacter, servings: rawServings } = await req.json();
    const servings: number = typeof rawServings === "number" && rawServings > 0 ? rawServings : 2;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json({ error: "재료를 입력해주세요." }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) {
      return NextResponse.json({ error: "GOOGLE_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const character = normalizeCharacter(rawCharacter);
    const ingredientList = ingredients.join(", ");

    const prefLines = [
      preferences?.style   && `- 원하는 스타일: ${preferences.style}`,
      preferences?.pairing && `- 페어링할 음식: ${preferences.pairing}`,
      preferences?.type    && `- 요리 종류: ${preferences.type}`,
    ].filter(Boolean).join("\n");

    const preferenceSection = prefLines
      ? `\n\n선택 옵션 (반드시 반영해주세요):\n${prefLines}`
      : "";

    const servingsSection = `\n\n기준 인원수: ${servings}인분 (모든 레시피의 재료 양과 servings 필드를 ${servings}인분 기준으로 설정하세요)`;

    // ── 조건부 웹서칭 (트렌드곰) ──────────────────────────────────────────────
    let trendData: TrendExtractResult | null = null;
    let searchUsed = false;

    const searchDecision = decideSearch(character, ingredients);
    if (searchDecision.needSearch) {
      const tavilyKey = process.env.TAVILY_API_KEY;
      if (tavilyKey) {
        try {
          const searchResults = await multiSearchTavily(searchDecision.queries, tavilyKey);
          if (searchResults.length > 0) {
            trendData = await extractTrendPatterns(searchResults, ingredients, googleApiKey);
            searchUsed = true;
          }
        } catch (searchErr) {
          console.warn("[generate-recipes] 웹서칭 실패, 일반 추천으로 fallback:", searchErr);
        }
      }
    }

    const trendContext = buildTrendContext(trendData);
    const systemInstruction = buildSystemInstruction(character);

    const isTrend = character === "trend_bear";
    const trendReason = isTrend
      ? `,\n      "searchUsed": ${searchUsed},\n      "trendReason": "이 레시피가 트렌드인 이유 한 줄"`
      : `,\n      "searchUsed": false,\n      "trendReason": null`;

    const result = await callGemini(
      `집에 있는 재료: ${ingredientList}${preferenceSection}${servingsSection}${trendContext}

이 재료들로 만들 수 있는 3가지 레시피를 추천해주세요.

다음 JSON 형식으로 정확히 응답해주세요:
{
  "recipes": [
    {
      "id": "recipe-1",
      "name": "요리명(유니크해서 호기심이 가야함)",
      "emoji": "🍜",
      "description": "요리에 대한 간단한 설명 (1-2문장)",
      "additionalIngredients": ["추가로 필요한 재료1", "추가로 필요한 재료2"],
      "ownedIngredients": ["보유한 재료1", "보유한 재료2"],
      "cookingTime": "30분",
      "difficulty": "쉬움",
      "taste": "매콤하고 짭조름한 맛",
      "pairings": ["잘 어울리는 음식1", "잘 어울리는 음식2"],
      "servings": 2,
      "highlight": "이 요리의 핵심 매력 포인트 (1문장)"${trendReason}
    }
  ]
}

difficulty는 반드시 "쉬움", "보통", "어려움" 중 하나여야 합니다.
additionalIngredients는 최대 4개로 제한해주세요.
pairings는 2-3개로 제한해주세요.`,
      systemInstruction,
      googleApiKey,
    );

    const parsed = parseFirstJsonObject<{ recipes: RecipeSuggestion[] }>(result);
    const recipes: RecipeSuggestion[] = parsed.recipes;

    return NextResponse.json({
      recipes,
      meta: {
        character,
        searchUsed,
        searchSummary: trendData?.summary ?? null,
      },
    });
  } catch (error) {
    console.error("Recipe generation error:", error);
    return NextResponse.json(
      { error: "레시피 생성 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
