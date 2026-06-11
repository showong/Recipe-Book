import { NextRequest, NextResponse } from "next/server";
import { RecipeDetail } from "@/types/recipe";
import { parseFirstJsonObject } from "@/lib/parse-json";

const GEMINI_MODEL = "gemini-3.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

type Platform = "instagram" | "youtube" | "tiktok";

const PLATFORM_GUIDE: Record<Platform, string> = {
  instagram: `플랫폼: 인스타그램 피드 게시글.
- 첫 줄: 스크롤을 멈추게 하는 후킹 문장 (이모지 1~2개).
- 본문: 친근한 말투로 레시피 소개 + 핵심 포인트 + 전체 재료 + 만드는 법(번호 목록).
- 줄바꿈과 이모지를 적극 활용해 가독성 높게.
- 마지막: 저장/팔로우 유도 한 줄 + 해시태그 15~20개(한 줄에 모아서).
- 길이: 캡션 최대 2,200자 이내.`,
  youtube: `플랫폼: 유튜브(쇼츠) 영상 설명란.
- 첫 줄: 영상 제목 후보 1개 (대괄호로 표기).
- 본문: 영상 소개 2~3문장.
- "📋 재료" 섹션: 전체 재료 목록.
- "👩‍🍳 만드는 법" 섹션: 단계별 번호 목록(간결하게).
- "⏱ 타임스탬프" 섹션: 0:00 인트로 형태의 챕터 예시.
- 마지막: 구독 유도 + 해시태그 5~8개.`,
  tiktok: `플랫폼: 틱톡 게시글.
- 매우 짧고 트렌디하게. 후킹 한 줄 + 핵심 포인트 3개를 짧은 불릿으로.
- 핵심 재료만 간단히.
- 캡션은 150자 내외로 짧게, FOMO 자극.
- 해시태그 5~8개(트렌디/챌린지성 위주).`,
};

function buildPrompt(
  recipe: RecipeDetail,
  platform: Platform,
  character: string,
  caption?: string,
  hashtags?: string[],
): string {
  const tone =
    character === "lazy" ? "귀차니즘 곰돌이 — 간결하고 효율 중심."
    : character === "trend" ? "트렌드곰 — FOMO 자극, 요즘 화제성 강조."
    : "귀여운 곰돌이 — 친근하고 따뜻한 셰프.";

  const ingredients = (recipe.ingredients ?? [])
    .map((i) => `- ${i.name} ${i.amount ?? ""}${i.unit ?? ""}`.trim())
    .join("\n");
  const steps = (recipe.steps ?? [])
    .map((s) => `${s.number}. ${s.title}: ${s.description ?? ""}`)
    .join("\n");

  return `당신은 한국 음식 SNS 콘텐츠 작가입니다. 톤: ${tone}

아래 레시피로 ${platform} 게시글을 작성하세요. 실제 게시 가능한 완성형 글이어야 합니다.

${PLATFORM_GUIDE[platform]}

레시피 이름: ${recipe.name}
한줄 매력: ${recipe.highlight ?? ""}
맛: ${recipe.taste ?? ""}
총 조리시간: ${recipe.totalTime ?? ""}
분량: ${recipe.servings ?? ""}인분
${caption ? `참고 캡션: ${caption}` : ""}
${hashtags?.length ? `참고 해시태그: ${hashtags.join(" ")}` : ""}

재료:
${ingredients || "(정보 없음)"}

만드는 법:
${steps || "(정보 없음)"}

반드시 아래 JSON 형식만 반환하세요. post 값에는 줄바꿈을 \\n 으로 포함하세요:
{ "post": "완성된 게시글 전문" }`;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as string;
}

export async function POST(req: NextRequest) {
  try {
    const { recipe, platform, character, caption, hashtags } = await req.json() as {
      recipe: RecipeDetail;
      platform: Platform;
      character: string;
      caption?: string;
      hashtags?: string[];
    };

    if (!recipe?.name) return NextResponse.json({ error: "레시피 정보가 필요합니다." }, { status: 400 });
    if (!platform || !PLATFORM_GUIDE[platform]) {
      return NextResponse.json({ error: "플랫폼(instagram/youtube/tiktok)이 필요합니다." }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (!googleApiKey) return NextResponse.json({ error: "GOOGLE_API_KEY 미설정" }, { status: 500 });

    const prompt = buildPrompt(recipe, platform, character, caption, hashtags);
    const text = await callGemini(prompt, googleApiKey);
    const { post } = parseFirstJsonObject<{ post: string }>(text);
    if (!post) return NextResponse.json({ error: "게시글 생성에 실패했습니다." }, { status: 500 });

    return NextResponse.json({ post });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[generate-social-post]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
