import { NextRequest, NextResponse } from "next/server";

const VOICE_ID     = "tc_624cccbcadcd568510764d65";
const TTS_ENDPOINT = "https://api.typecast.ai/v1/text-to-speech";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ── Gemini로 레시피 텍스트를 자연스러운 구어체로 변환 ─────────────────────────
async function toSpeechText(raw: string, googleApiKey: string): Promise<string> {
  const prompt = `다음은 요리 레시피 조리 단계 텍스트입니다.
이 텍스트를 TTS(음성 낭독)에 적합한 자연스러운 한국어 구어체로 변환해 주세요.

변환 규칙:
1. 숫자+단위 → 한국어 발음 (예: 200g → 이백 그램, 2큰술 → 두 큰술, 180°C → 백팔십 도, 5분 → 오 분)
2. 특수문자 제거 또는 구어화 (예: ~ → 에서, / → 또는, · → 그리고, → → 넣고)
3. 레시피 제목·단계 번호는 포함하지 말 것
4. 문장이 자연스럽게 이어지도록 연결어 추가
5. 간결하게 유지 (원문 대비 1.2배 이내)
6. 한국어만 출력 (번역·설명 없이 변환된 텍스트만)

원문:
${raw}

변환된 구어체 텍스트:`;

  const res = await fetch(`${GEMINI_URL}?key=${googleApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    console.warn("[TTS] Gemini 변환 실패, 원문 사용:", res.status);
    return raw;
  }

  const data = await res.json();
  // parts가 여러 개일 수 있으므로 전체 합산
  const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const converted = parts.map((p) => p.text ?? "").join("").trim();
  console.log("[TTS] 구어체 변환 완료 (길이:", converted.length, "):", converted.slice(0, 80));
  return converted || raw;
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });
    }

    const typecastKey = process.env.TYPECAST_API_KEY;
    if (!typecastKey) {
      return NextResponse.json(
        { error: "TYPECAST_API_KEY 환경변수를 .env.local에 추가해주세요." },
        { status: 500 }
      );
    }

    const googleKey = process.env.GOOGLE_API_KEY;
    if (!googleKey) {
      return NextResponse.json(
        { error: "GOOGLE_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // ── Step 1: Gemini로 구어체 변환 ─────────────────────────────────────────
    const speechText = await toSpeechText(text, googleKey);

    // ── Step 2: Typecast TTS 호출 ─────────────────────────────────────────────
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

    // ── 바이너리 오디오 직접 반환 ─────────────────────────────────────────────
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

    // ── JSON 응답 (폴링 방식 fallback) ───────────────────────────────────────
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TTS] error:", msg);
    return NextResponse.json({ error: msg });
  }
}
