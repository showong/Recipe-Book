import { RecipeDetail } from "@/types/recipe";
import { parseFirstJsonObject } from "@/lib/parse-json";

/**
 * 쇼츠 핵심 3포인트 추출 Agent (작업지시서 §11.5)
 *
 * 레시피 상세 정보를 입력받아 쇼츠 영상 구성에 필요한
 *  - hook: 후킹 문구 (시청자 호기심 자극)
 *  - problem: 문제 제기 (3포인트를 놓치면 생기는 실패)
 *  - keyPoints: 핵심 3포인트 (제목 + 설명)
 *  - saveCard: 저장용 재료 카드
 * 를 추출한다.
 */
export interface ShortsKeyPoint {
  title: string;
  description: string;
}

export interface ShortsSaveCard {
  title: string;
  ingredients: string[];
}

export interface ShortsKeypointResult {
  hook: string;
  problem: string;
  keyPoints: ShortsKeyPoint[];
  saveCard: ShortsSaveCard;
}

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 4096,
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
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;
}

function buildCharacterTone(character: string): string {
  if (character === "lazy_bear" || character === "lazy") {
    return `톤: 귀차니즘 곰돌이 — 효율 지상주의. "최소 노력 최대 맛", "이것만 하면 됩니다" 느낌. 군더더기 없이 직접적.`;
  }
  if (character === "trend_bear" || character === "trend") {
    return `톤: 트렌드곰 — SNS 화제성. "요즘 이거 모르면 손해", "다들 이렇게 한대요" 느낌. 트렌디하고 FOMO 자극.`;
  }
  return `톤: 귀여운 곰돌이 — 친근하고 다정한 셰프. "초보도 따라할 수 있어요" 느낌. 따뜻하고 쉬운 설명.`;
}

/**
 * 레시피에서 쇼츠 핵심 3포인트를 추출한다.
 * 실패 시 레시피 기반 fallback 결과를 반환한다.
 */
export async function extractShortsKeypoints(
  recipe: RecipeDetail,
  character: string,
  googleApiKey: string,
): Promise<ShortsKeypointResult> {
  const kickSteps = (recipe.steps ?? []).filter((s) => s.isKick);
  const kickSummary = kickSteps
    .map((s) => `- ${s.title}: ${s.kickReason ?? s.description?.slice(0, 60) ?? ""}`)
    .join("\n");
  const stepSummary = (recipe.steps ?? [])
    .map((s) => `${s.number}. ${s.title}: ${s.description?.slice(0, 80) ?? ""}`)
    .join("\n");
  const ingredientSummary = (recipe.ingredients ?? [])
    .map((i) => `${i.name} ${i.amount ?? ""}${i.unit ?? ""}`.trim())
    .join(", ");

  const prompt = `당신은 SNS 쇼츠 영상 기획자입니다. 아래 레시피를 30초 쇼츠로 만들기 위한 핵심 구성요소를 추출하세요.

${buildCharacterTone(character)}

레시피 이름: ${recipe.name}
한줄 매력: ${recipe.highlight ?? ""}
맛: ${recipe.taste ?? ""}
총 조리시간: ${recipe.totalTime ?? ""}
분량: ${recipe.servings ?? ""}인분

전체 조리 단계:
${stepSummary}

킥(핵심) 단계:
${kickSummary || "(킥 단계 없음 — 전체 단계에서 가장 중요한 3가지를 직접 선별)"}

재료: ${ingredientSummary}

요구사항:
1. hook: 시청자가 스크롤을 멈추게 하는 후킹 한 문장 (의문형/도발형, 25자 이내).
2. problem: 흔히 실패하는 이유를 짚는 문제 제기 한 문장 (40자 이내). "이 N가지를 놓친 겁니다" 패턴 권장.
3. keyPoints: 이 요리 성공의 핵심 3가지. 각 title(10자 이내, 행동 요약)과 description(45자 이내, 왜 중요한지).
4. saveCard: title(레시피명 + 분량), ingredients(핵심 재료 4~6개, 수량 포함).

반드시 아래 JSON 형식만 반환하세요:
{
  "hook": "후킹 문구",
  "problem": "문제 제기 문장",
  "keyPoints": [
    { "title": "포인트 제목", "description": "포인트 설명" },
    { "title": "포인트 제목", "description": "포인트 설명" },
    { "title": "포인트 제목", "description": "포인트 설명" }
  ],
  "saveCard": {
    "title": "레시피명 N인분",
    "ingredients": ["재료1 수량", "재료2 수량"]
  }
}`;

  try {
    const text = await callGemini(prompt, googleApiKey);
    const result = parseFirstJsonObject<ShortsKeypointResult>(text);
    // 핵심 포인트는 정확히 3개로 정규화
    const keyPoints = (result.keyPoints ?? []).slice(0, 3);
    while (keyPoints.length < 3) {
      const fallbackStep = kickSteps[keyPoints.length] ?? recipe.steps?.[keyPoints.length];
      keyPoints.push({
        title: fallbackStep?.title?.slice(0, 10) ?? "핵심 포인트",
        description: fallbackStep?.kickReason ?? fallbackStep?.description?.slice(0, 45) ?? "",
      });
    }
    return { ...result, keyPoints };
  } catch {
    // fallback: 레시피 데이터로 직접 구성
    const fallbackPoints: ShortsKeyPoint[] = (kickSteps.length ? kickSteps : recipe.steps ?? [])
      .slice(0, 3)
      .map((s) => ({
        title: s.title?.slice(0, 10) ?? "핵심 포인트",
        description: s.kickReason ?? s.description?.slice(0, 45) ?? "",
      }));
    while (fallbackPoints.length < 3) {
      fallbackPoints.push({ title: "핵심 포인트", description: "" });
    }
    return {
      hook: recipe.highlight || `${recipe.name}, 이렇게 만들면 실패 없어요`,
      problem: "이 3가지만 지키면 집에서도 실패 없이 만들 수 있어요.",
      keyPoints: fallbackPoints,
      saveCard: {
        title: `${recipe.name} ${recipe.servings ?? ""}인분`.trim(),
        ingredients: (recipe.ingredients ?? [])
          .slice(0, 6)
          .map((i) => `${i.name} ${i.amount ?? ""}${i.unit ?? ""}`.trim()),
      },
    };
  }
}
