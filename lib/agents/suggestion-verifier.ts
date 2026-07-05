import { RecipeSuggestion } from "@/types/recipe";
import { parseFirstJsonObject } from "@/lib/parse-json";

/**
 * 레시피 추천(3종 세트) 검증 에이전트.
 *
 * generate-recipes 가 만든 3개 추천을 세트 단위로 채점하고,
 * 기준점(PASS_SCORE) 미만이면 issues 를 피드백으로 넣어 1회 재생성하도록 한다.
 * (개별 상세 레시피 검증은 lib/agents/recipe-verifier.ts 가 담당 — 역할 분리)
 */
export interface SuggestionVerification {
  qualityScore: number; // 0~10
  issues: string[];
  passed: boolean;
}

/** 이 점수 미만이면 재생성을 트리거한다. */
export const PASS_SCORE = 7;

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;
}

export async function verifySuggestions(
  recipes: RecipeSuggestion[],
  ingredients: string[],
  character: string,
  googleApiKey: string,
): Promise<SuggestionVerification> {
  const isLazy = character === "lazy_bear";
  const isTrend = character === "trend_bear";

  const characterCriteria = isLazy
    ? "귀차니즘 곰돌이: 조리가 간단하면서도 '맛 폭탄 킥'(강력한 감칠맛 요소)이 각 레시피에 있는가. 추가 재료가 2개 이하인가."
    : isTrend
      ? "트렌드곰: 최신 유행 조합·반전 포인트·SNS 비주얼 요소가 느껴지는가."
      : "집밥 셰프: 재료 활용이 알뜰하고 누구나 실패 없이 만들 수 있는 구성인가.";

  const summary = recipes
    .map(
      (r, i) =>
        `${i + 1}. ${r.name} | 맛: ${r.taste} | 난이도: ${r.difficulty} | 추가재료: ${r.additionalIngredients?.join(",") || "없음"} | 매력: ${r.highlight}`,
    )
    .join("\n");

  const prompt = `다음은 보유 재료 "${ingredients.join(", ")}" 로 생성된 3가지 레시피 추천입니다. 세트 전체의 품질을 채점하세요.

${summary}

채점 기준 (각 항목을 종합해 0~10점):
1. 다양성 — 3개의 조리 방식(볶음/국물/무침 등)과 맛 프로파일(매콤/담백/새콤 등)이 서로 뚜렷이 다른가
2. 재료 적합성 — 보유 재료를 실제로 활용하며, 추가 재료 요구가 과하지 않은가
3. 맛 설계 — 감칠맛·단짠 균형·향 베이스 같은 맛의 원리가 느껴지는 구성인가
4. 실현 가능성 — 명시된 난이도·시간이 현실적인가
5. 캐릭터 부합 — ${characterCriteria}

반드시 유효한 JSON만 반환하세요:
{
  "qualityScore": 8.5,
  "issues": ["구체적인 문제점 (없으면 빈 배열)"]
}

qualityScore 는 0~10 사이 숫자. 문제가 있으면 issues 에 재생성 시 반영할 수 있는 구체적 지시문 형태로 적으세요. (예: "2번과 3번이 모두 볶음 요리라 조리 방식이 겹침 — 하나를 국물 요리로 교체")`;

  try {
    const text = await callGemini(prompt, googleApiKey);
    const parsed = parseFirstJsonObject<{ qualityScore: number; issues: string[] }>(text);
    const qualityScore = typeof parsed.qualityScore === "number" ? parsed.qualityScore : PASS_SCORE;
    return {
      qualityScore,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      passed: qualityScore >= PASS_SCORE,
    };
  } catch {
    // 검증 자체가 실패해도 사용자 흐름을 막지 않는다 — 통과 처리
    return { qualityScore: PASS_SCORE, issues: [], passed: true };
  }
}
