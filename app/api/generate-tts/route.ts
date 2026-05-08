import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const VOICE_ID_CUTE = "tc_624cccbcadcd568510764d65";
const VOICE_ID_LAZY = "tc_63622aaa4109052e8067e303";
const TYPECAST_API = "https://typecast.ai/api/speak";

async function callTypecastTts(
  speechText: string,
  typecastKey: string,
  character = "cute",
  speedBoost = false,
): Promise<string> {
  const voiceId = character === "lazy" ? VOICE_ID_LAZY : VOICE_ID_CUTE;
  const model   = character === "lazy" ? "ssfm-v21" : "ssfm-v30";

  const startRes = await fetch(TYPECAST_API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${typecastKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      actor_id: voiceId,
      text: speechText,
      lang: "auto",
      xfaststyle: speedBoost ? "1.15" : "1",
      emotion: speedBoost ? "excited" : "neutral",
      xspeed: speedBoost ? "1.1" : "1.0",
      pitch: "0",
      model,
      sample_rate: "48000",
      max_seconds: "60",
      codec: "mp3",
    }),
  });

  if (!startRes.ok) {
    const err = await startRes.text();
    throw new Error(`Typecast API ${startRes.status}: ${err}`);
  }

  const startData = await startRes.json();
  const speakV2Url: string | undefined = startData.result?.speak_v2_url;
  if (!speakV2Url) throw new Error("Typecast API가 speak_v2_url을 반환하지 않았습니다.");

  // Poll until done (max 30s)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const pollRes = await fetch(speakV2Url, {
      headers: { "Authorization": `Bearer ${typecastKey}` },
    });
    if (!pollRes.ok) continue;
    const pollData = await pollRes.json();
    const status: string = pollData.result?.status ?? "";
    if (status === "done") {
      const audioUrl: string = pollData.result?.audio_download_url ?? "";
      if (!audioUrl) throw new Error("audio_download_url 없음");
      const audioRes = await fetch(audioUrl);
      if (!audioRes.ok) throw new Error(`오디오 다운로드 실패: ${audioRes.status}`);
      const buf = Buffer.from(await audioRes.arrayBuffer());
      return `data:audio/mpeg;base64,${buf.toString("base64")}`;
    }
    if (status === "failed" || status === "error") {
      throw new Error(`Typecast 합성 실패: ${status}`);
    }
  }
  throw new Error("Typecast 합성 타임아웃");
}

export async function POST(req: NextRequest) {
  try {
    const typecastKey = process.env.TYPECAST_API_KEY;
    if (!typecastKey) {
      return NextResponse.json({ error: "TYPECAST_API_KEY가 설정되지 않았습니다." }, { status: 500 });
    }

    const body = await req.json();
    const { mode, text, character = "cute" } = body as {
      mode?: string;
      text?: string;
      character?: string;
      recipeName?: string;
      highlight?: string;
      taste?: string;
      kickPoints?: string;
      pairings?: string;
    };

    // ── 훅 멘트 생성 모드 ──────────────────────────────────────────────────────
    if (mode === "hook") {
      const { recipeName, highlight, taste, kickPoints, pairings } = body as Record<string, string>;
      if (!recipeName) {
        return NextResponse.json({ error: "recipeName이 필요합니다." }, { status: 400 });
      }

      const characterStyle = character === "lazy"
        ? "귀차니즘 곰돌이 스타일: 처음엔 귀찮은 듯 담담하게 시작, 한 박자 쉬고 반전 한 방으로 끝냄. 무심하지만 맛에는 자신감 100%."
        : "귀여운 곰돌이 스타일: 살짝 흥분, 따뜻한 감탄사, 시청자를 끌어당기는 설레는 어조.";

      const scriptPrompt = `당신은 한국 푸드 릴스·틱톡 전문 크리에이터입니다.
시청자가 0.5초 만에 스크롤을 멈추게 만드는, 날 것의 감정이 담긴 3초짜리 훅 음성 스크립트를 작성하세요.

레시피: ${recipeName}
맛 특징: ${taste ?? ""}
핵심 포인트: ${highlight ?? ""}
성공 킥포인트: ${kickPoints ?? ""}
페어링: ${pairings ?? ""}
캐릭터: ${characterStyle}

━━━━━━━━━━━━━━━━━━━━
★ 반드시 지켜야 할 규칙 ★

[길이] 한국어 35~55자 (공백 포함) — 읽으면 딱 2.5~3초

[첫 마디] 감탄·충격·질문으로 무조건 시작
절대 금지: "안녕하세요" / "오늘은" / "소개할게요" / "만들어볼게요" / 음식 이름으로 시작

[구조] 짧고 강하게 — (반 박자 쉬고) — 클리프행어 or 반전

[감정 트리거 중 하나를 극대화]
• FOMO형: "이거 모르면 진짜 손해야..."
• 의외성형: "이게 집밥이라고요?!"
• 욕구 자극형: "이 냄새가... 진짜로"
• 공감형: "저만 이거 매일 만들어요?"
• 반전형: "실패인 줄 알았는데..."
• 도전형: "이것만 알면 식당 안 가도 돼"

[비유·감각 묘사 적극 활용]
소리(지글지글, 촤악), 향(고소한 냄새가), 식감(사르르) 등으로 청각적 욕구 자극

[예시 분위기만 참고 — 그대로 사용 금지]
• "이거 먹고 진짜 눈물 났어요... 집밥이 어떻게 이래요"
• "5분인데 이 맛이 나온다고요? 말이 돼요?!"
• "솔직히 귀찮아서 대충 했는데요. 왜 이게 더 맛있죠?"
• "지글지글 소리 들리죠? 이거 지금 우리 집 이야기예요"
• "한 입 먹고 바로 레시피 물어봤어요"
━━━━━━━━━━━━━━━━━━━━

반드시 유효한 JSON만 반환하세요. 마크다운 블록 없이:
{"script": "훅 텍스트 (35~55자)"}`;

      const geminiResult = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: scriptPrompt,
      });

      let scriptText = geminiResult.text ?? "";
      scriptText = scriptText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const { script } = JSON.parse(scriptText) as { script: string };
      if (!script) throw new Error("훅 스크립트 생성 실패");

      const audioUrl = await callTypecastTts(script, typecastKey, character, true);
      return NextResponse.json({ audioUrl, script });
    }

    // ── 단계별 TTS 모드 (기본) ──────────────────────────────────────────────
    if (!text) {
      return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });
    }

    const audioUrl = await callTypecastTts(text, typecastKey, character);
    return NextResponse.json({ audioUrl });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("TTS generation error:", message);
    return NextResponse.json({ error: `TTS 생성 오류: ${message}` }, { status: 500 });
  }
}
