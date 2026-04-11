import { NextRequest, NextResponse } from "next/server";

const VOICE_ID     = "tc_624cccbcadcd568510764d65";
const TTS_ENDPOINT = "https://api.typecast.ai/v1/text-to-speech";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Gemini 공통 호출 헬퍼 ─────────────────────────────────────────────────────
async function callGemini(prompt: string, googleApiKey: string, maxTokens = 80): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${googleApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
    }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p) => p.text ?? "").join("").trim();
}

// ── 레시피 단계 텍스트 → 3초 이내 핵심 구어체 압축 ────────────────────────────
async function toSpeechText(raw: string, googleApiKey: string): Promise<string> {
  const prompt = `다음 요리 레시피 조리 단계에서 가장 핵심이 되는 동작 하나만 골라서,
5초 이내(약 15~22자)에 읽을 수 있는 자연스러운 한국어 구어체 세 문장으로 압축해 주세요.

압축 규칙:
1. 핵심 동작 딱 하나만 
2. 22자 이내 (공백 포함)
3. 숫자+단위 → 한국어 발음 (200g → 이백 그램, 3분 → 삼 분)
4. 자연스러운 구어체 (예: "~해줘", "~하면 돼", "~해요")
5. 한국어 텍스트만 출력 (설명·번호 없이)

원문: ${raw}

압축된 한 문장:`;

  const result = await callGemini(prompt, googleApiKey, 80);
  console.log("[TTS] 핵심 압축 (길이:", result.length, "):", result);
  return result || raw.slice(0, 40); // 실패 시 원문 앞 40자 fallback
}

// ── 레시피 정보 → 3초 훅 멘트 생성 ──────────────────────────────────────────
async function generateHookMentText(
  recipeName: string,
  highlight: string,
  taste: string,
  kickPoints: string,
  pairings: string,
  googleApiKey: string,
): Promise<string> {
  const prompt = `다음 레시피 정보를 바탕으로 시청자의 궁금함을 즉시 자극하는 한국어 훅 멘트 한문장을 생성하세요.

레시피: ${recipeName}
특징: ${highlight}
맛: ${taste}
킥포인트: ${kickPoints}
어울리는 것: ${pairings}

훅 멘트 규칙:
1. 3초 이내(20자 이내, 공백 포함)
2. FOMO + 궁금증 자극 — "이거 뭐야?", "어떻게 이래?" 반응 유도
3. 자연스러운 구어체, 이모지 없음
4. 훅 멘트 텍스트만 출력 (설명 없이)
5. 단어 하나 생성은 금지, 반드시 하나의 문장으로 작성
좋은 예시: "이거 한 번만 봐봐, 진짜야" / "오늘 저녁은 무조건 이거야" / "이 맛 알면 다른 거 못 먹어" / "뭔데 이게 이렇게 맛있어"

훅 멘트:`;

  const result = await callGemini(prompt, googleApiKey, 60);
  console.log("[TTS] 훅 멘트 생성:", result);
  return result || `${recipeName}, 지금 바로 만들어봐`;
}

// ── Typecast TTS 호출 + 바이너리 MP3 → base64 반환 ──────────────────────────
async function callTypecastTts(
  speechText: string,
  typecastKey: string,
): Promise<NextResponse> {
  const ttsRes = await fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": typecastKey,
    },
    body: JSON.stringify({
      voice_id: VOICE_ID,
      text: speechText,
      model: "ssfm-v30",
      language: "kor",
      output: {
        audio_format: "mp3",
        audio_pitch: 0,
        audio_tempo: 1.0,
        volume: 100,
      },
    }),
  });

  const contentType = ttsRes.headers.get("content-type") ?? "";
  console.log("[TTS] status:", ttsRes.status, "content-type:", contentType);

  if (!ttsRes.ok) {
    const errBody = await ttsRes.text();
    console.error("[TTS] error body:", errBody.slice(0, 400));
    return NextResponse.json({ error: `Typecast ${ttsRes.status}: ${errBody}` });
  }

  // 바이너리 오디오 직접 반환
  if (contentType.includes("audio/")) {
    const buffer = await ttsRes.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const CHUNK = 8192;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.slice(i, i + CHUNK));
    }
    const mimeType = contentType.split(";")[0].trim();
    return NextResponse.json({ audioUrl: `data:${mimeType};base64,${btoa(binary)}` });
  }

  // JSON 응답 (폴링 방식 fallback)
  const json = await ttsRes.json() as Record<string, unknown>;
  const result = (json?.result ?? json) as Record<string, unknown>;

  if (result?.audio_download_url) {
    return NextResponse.json({ audioUrl: result.audio_download_url });
  }

  const speakUrl = (result?.speak_v2_url ?? json?.speak_v2_url) as string | undefined;
  if (!speakUrl) {
    return NextResponse.json({ error: `알 수 없는 응답: ${JSON.stringify(json).slice(0, 200)}` });
  }

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const pollRes = await fetch(speakUrl, { headers: { "X-API-KEY": typecastKey } });
    if (!pollRes.ok) continue;
    const pd = await pollRes.json() as Record<string, unknown>;
    const r2 = (pd?.result ?? pd) as Record<string, unknown>;
    if (r2?.status === "done" && r2?.audio_download_url) {
      return NextResponse.json({ audioUrl: r2.audio_download_url });
    }
    if (r2?.status === "error") {
      return NextResponse.json({ error: "Typecast 변환 실패" });
    }
  }

  return NextResponse.json({ error: "음성 변환 시간 초과 (40초)" });
}

// ── POST Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, text, recipeName, highlight, taste, kickPoints, pairings } = body as {
      mode?: string;
      text?: string;
      recipeName?: string;
      highlight?: string;
      taste?: string;
      kickPoints?: string;
      pairings?: string;
    };

    const typecastKey = process.env.TYPECAST_API_KEY;
    if (!typecastKey) {
      return NextResponse.json(
        { error: "TYPECAST_API_KEY 환경변수를 .env.local에 추가해주세요." },
        { status: 500 },
      );
    }

    const googleKey = process.env.GOOGLE_API_KEY;
    if (!googleKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    // ── 모드 1: 훅 멘트 생성 ─────────────────────────────────────────────────
    if (mode === "hook") {
      const hookText = await generateHookMentText(
        recipeName ?? "",
        highlight ?? "",
        taste ?? "",
        kickPoints ?? "",
        pairings ?? "",
        googleKey,
      );
      console.log("[TTS] 훅 멘트 TTS 변환:", hookText);
      return callTypecastTts(hookText, typecastKey);
    }

    // ── 모드 2: 레시피 단계 구어체 압축 + TTS ────────────────────────────────
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });
    }

    const speechText = await toSpeechText(text, googleKey);
    return callTypecastTts(speechText, typecastKey);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TTS] error:", msg);
    return NextResponse.json({ error: msg });
  }
}
