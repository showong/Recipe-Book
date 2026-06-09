import { TavilyResult } from "@/lib/services/tavily";

export interface TrendPattern {
  patternName: string;
  matchedIngredients: string[];
  trendReason: string;
  recommendedCookingMethod?: string;
}

export interface TrendExtractResult {
  trendPatterns: TrendPattern[];
  trendKeywords: string[];
  summary: string;
}

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;
}

export async function extractTrendPatterns(
  searchResults: TavilyResult[],
  ingredients: string[],
  googleApiKey: string,
): Promise<TrendExtractResult> {
  if (searchResults.length === 0) {
    return { trendPatterns: [], trendKeywords: [], summary: "" };
  }

  const searchSummary = searchResults
    .slice(0, 8)
    .map((r) => `- ${r.title}: ${r.content.slice(0, 200)}`)
    .join("\n");

  const prompt = `다음은 "${ingredients.join(", ")}" 재료와 관련된 최근 레시피 검색 결과입니다.

검색 결과:
${searchSummary}

위 검색 결과를 분석하여 트렌드 패턴을 추출해주세요.

규칙:
1. 특정 블로그나 유튜버의 레시피를 그대로 복사하지 마세요
2. 여러 결과에서 공통적으로 나타나는 조합 패턴만 추출하세요
3. 트렌드 키워드(예: 고단백, 다이어트, 원팬, 에어프라이어)를 추출하세요
4. 최대 3개의 패턴만 추출하세요

반드시 유효한 JSON만 반환하세요:
{
  "trendPatterns": [
    {
      "patternName": "패턴명",
      "matchedIngredients": ["재료1", "재료2"],
      "trendReason": "트렌드 이유 (20자 이내)",
      "recommendedCookingMethod": "추천 조리 방식"
    }
  ],
  "trendKeywords": ["키워드1", "키워드2", "키워드3"],
  "summary": "전체 트렌드 요약 (50자 이내)"
}`;

  try {
    let text = await callGemini(prompt, googleApiKey);
    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(text) as TrendExtractResult;
  } catch {
    return { trendPatterns: [], trendKeywords: [], summary: "" };
  }
}
