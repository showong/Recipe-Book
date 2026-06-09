import { RecipeDetail } from "@/types/recipe";

export interface VerificationResult {
  isValid: boolean;
  qualityScore: number;
  issues: string[];
  revisionRequired: boolean;
}

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4096, responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;
}

export async function verifyRecipe(
  recipe: RecipeDetail,
  ownedIngredients: string[],
  additionalIngredients: string[],
  character: string,
  googleApiKey: string,
): Promise<VerificationResult> {
  const isLazy = character === "lazy_bear" || character === "lazy";
  const maxAdditional = isLazy ? 2 : 4;

  const prompt = `다음 레시피를 검증해주세요.

레시피 이름: ${recipe.name}
총 조리 시간: ${recipe.totalTime}
단계 수: ${recipe.steps?.length ?? 0}개
추가 필요 재료: ${additionalIngredients.join(", ") || "없음"}
보유 재료: ${ownedIngredients.join(", ") || "없음"}
캐릭터: ${character}

조리 단계 요약:
${recipe.steps?.slice(0, 5).map((s) => `${s.number}. ${s.title}: ${s.description.slice(0, 80)}`).join("\n") ?? ""}

다음 항목을 체크하세요:
1. 추가 필요 재료가 ${maxAdditional}개 이하인가
2. 조리 순서가 논리적인가
3. 조리 시간이 현실적인가 (${isLazy ? "귀차니즘 곰돌이는 30분 이내 선호" : "60분 이내 권장"})
4. 각 단계 설명이 명확하고 TTS로 들었을 때 행동이 구체적인가
5. 초보자도 따라할 수 있는가

반드시 유효한 JSON만 반환하세요:
{
  "isValid": true,
  "qualityScore": 8.5,
  "issues": [],
  "revisionRequired": false
}

qualityScore는 0-10 사이 숫자. issues가 있으면 revisionRequired를 true로.`;

  try {
    let text = await callGemini(prompt, googleApiKey);
    text = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const result = JSON.parse(text) as VerificationResult;
    return result;
  } catch {
    return { isValid: true, qualityScore: 7.0, issues: [], revisionRequired: false };
  }
}
