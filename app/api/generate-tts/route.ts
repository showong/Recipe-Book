import { NextRequest, NextResponse } from "next/server";

const VOICE_ID_CUTE = "tc_624cccbcadcd568510764d65";
const VOICE_ID_LAZY = "tc_606c6c155e38f609c6789d2b";
const TTS_ENDPOINT  = "https://api.typecast.ai/v1/text-to-speech";
const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
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

// ── 구어체 텍스트 → 절반 이하로 압축 ────────────────────────────────────────
async function compressSpeechText(converted: string, googleApiKey: string, character: string): Promise<string> {
  const targetLen = Math.floor(converted.length / 2);
  const prompt = `다음 한국어 구어체 문장을 절반 이하 길이로 압축해 주세요.

압축 규칙:
1. 목표 길이: ${targetLen}자 이하 (현재 ${converted.length}자의 절반)
2. 핵심 동작과 핵심 재료/수치만 남기고 나머지 생략
3. 구어체 어미 유지 (예: "~해요", "~하면 돼요")
4. 완전한 문장 형태 유지 — 단어 하나·조각 표현 금지
5. 한국어 텍스트만 출력 (설명 없이)

원문:
${converted}

압축된 텍스트:`;

  const result = await callGemini(prompt, googleApiKey, 128);
  console.log("[TTS] 압축 완료 (길이:", result.length, "/목표:", targetLen, "):", result);
  return result || converted;
}

// ── 레시피 단계 텍스트 → 구어체 변환 → 압축 ────────────────────────────────
async function toSpeechText(raw: string, googleApiKey: string, character: string): Promise<string> {
  const isLazy = character === "lazy";

  const promptOpening = isLazy
    ? `다음 요리 레시피 조리 단계를 귀차니즘 곰돌이 스타일의 TTS 음성 낭독에 적합하도록 변환해 주세요.\n\n변환 목표:\n- 핵심 동작만 짧게 요약, 군더더기 설명 없음\n- 낭독 시 3~5초 분량 (약 40자 이내)`
    : `다음 요리 레시피 조리 단계를 TTS 음성 낭독에 적합하도록 변환해 주세요.\n\n변환 목표:\n- 원문의 핵심 내용을 요약하고, 용량이나 시간과 같이 불필요한 반복·부연 설명은 생략\n- 낭독 시 5~6초 분량 (약 50자이내)`;

  const rule3 = isLazy
    ? `3. 건조하고 직접적인 구어체 어미 (예: "~하세요", "~해요", "그냥 ~하면 됩니다")`
    : `3. 자연스러운 구어체 어미 사용 (예: "~해줘요", "~하면 돼요", "~해주세요")`;

  const rule5 = isLazy
    ? `5. 문장은 반드시 "~하세요" 또는 "하면 됩니다"로 끝맺음`
    : `5. 문장은 반드시 "~하세요"이나 "해주세요"로 끝맺음을 해야한다.`;

  const prompt = `${promptOpening}

변환 규칙:
1. 숫자+단위 → 한국어 발음 (예: 200g → 이백 그램, 2큰술 → 두 큰술, 180°C → 백팔십 도)
2. 특수문자 제거 또는 구어화 (예: ~ → 정도, / → 또는, → → 넣어)
${rule3}
4. 한국어 텍스트만 출력 (설명·번호 없이)
${rule5}
원문:
${raw}

변환된 구어체:`;

  const converted = await callGemini(prompt, googleApiKey, 256);
  console.log("[TTS] 구어체 변환 (길이:", converted.length, "):", converted.slice(0, 150));
  if (!converted) return raw;

  // Step 2: 변환된 구어체를 절반 이하로 압축
  const compressed = await compressSpeechText(converted, googleApiKey, character);
  return compressed || converted;
}

// ── 레시피 정보 → 3초 훅 멘트 생성 ──────────────────────────────────────────
async function generateHookMentText(
  recipeName: string,
  highlight: string,
  taste: string,
  kickPoints: string,
  pairings: string,
  googleApiKey: string,
  character: string,
): Promise<string> {
  const isLazy = character === "lazy";

  const rule3 = isLazy
    ? `3. 엄청난 요리 내공이 느껴지면서도 귀찮음을 이겨낸 장인의 감성 — 집에 있는 재료만으로 아내를 위해 몰래 만든 비밀 레시피 느낌`
    : `3. FOMO + 궁금증 자극 — "이거 뭐야?", "어떻게 이래?" 반응 유도`;

  const examples = isLazy
    ? `좋은 예시:
"마트 안 가도 됩니다. 집에 있는 거로 충분해요."
"귀찮아서 만든 건데, 아내가 맛집이냐고 물어봤어요."
"어차피 먹을 건데, 이왕이면 제대로 먹어야죠."
"재료 없어도 됩니다. 다 필요 없어요, 이것만 있으면 됩니다."`
    : `좋은 예시:
"이거 한 번만 봐봐, 진짜 미쳐버려."
"오늘 저녁은 무조건 이거야, 후회 없어."
"이 맛 알면 다른 거 못 먹어, 진짜로."
"뭔데 이게 이렇게 맛있어, 말도 안 돼."`;

  const lazyPersona = isLazy
    ? `당신은 엄청난 요리 내공을 가진 장인인데 너무너무 귀찮습니다. 아내를 위해 마트에 가기 싫어서 집에 있는 재료만 가지고 몰래 레시피를 만들었지만, 그 결과물이 놀라울 정도로 맛있습니다. 이 비밀이 들키지 않게 하되, 요리에 대한 진심과 내공이 느껴지는 임팩트 있는 훅 멘트를 작성하세요.\n\n`
    : "";

  const prompt = `${lazyPersona}다음 레시피 정보를 바탕으로 시청자의 궁금함을 즉시 자극하는 한국어 훅 멘트 한문장을 생성하세요.

레시피: ${recipeName}
특징: ${highlight}
맛: ${taste}
킥포인트: ${kickPoints}
어울리는 것: ${pairings}

훅 멘트 규칙:
1. 낭독 시 3~4초 분량 (약 20자)
2. 완전한 문장 1~2개로 구성 — 단어 하나만 쓰면 안 됨
${rule3}
4. 자연스러운 구어체, 이모지 없음
5. 훅 멘트 텍스트만 출력 (설명 없이)

${examples}

훅 멘트:`;

  const result = await callGemini(prompt, googleApiKey, 128);
  console.log("[TTS] 훅 멘트 생성:", result);
  return result || `${recipeName}, 지금 바로 만들어봐요.`;
}

// ── Typecast TTS 호출 + 바이너리 MP3 → base64 반환 ──────────────────────────
async function callTypecastTts(
  speechText: string,
  typecastKey: string,
  extraData: Record<string, unknown> = {},
  character = "cute",
): Promise<NextResponse> {
  const voiceId = character === "lazy" ? VOICE_ID_LAZY : VOICE_ID_CUTE;
  const ttsRes = await fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": typecastKey,
    },
    body: JSON.stringify({
      voice_id: voiceId,
      text: speechText,
      model: "ssfm-v30",
      language: "kor",
      output: {
        audio_format: "mp3",
        audio_pitch: 0,
        audio_tempo: 1.3,
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
    return NextResponse.json({ audioUrl: `data:${mimeType};base64,${btoa(binary)}`, ...extraData });
  }

  // JSON 응답 (폴링 방식 fallback)
  const json = await ttsRes.json() as Record<string, unknown>;
  const result = (json?.result ?? json) as Record<string, unknown>;

  if (result?.audio_download_url) {
    return NextResponse.json({ audioUrl: result.audio_download_url, ...extraData });
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
      return NextResponse.json({ audioUrl: r2.audio_download_url, ...extraData });
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
    const { mode, text, recipeName, highlight, taste, kickPoints, pairings, character } = body as {
      mode?: string;
      text?: string;
      recipeName?: string;
      highlight?: string;
      taste?: string;
      kickPoints?: string;
      pairings?: string;
      character?: string;
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
        character ?? "cute",
      );
      console.log("[TTS] 훅 멘트 TTS 변환:", hookText);
      return callTypecastTts(hookText, typecastKey, {}, character ?? "cute");
    }

    // ── 모드 2: 레시피 단계 구어체 압축 + TTS ────────────────────────────────
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });
    }

    const speechText = await toSpeechText(text, googleKey, character ?? "cute");
    return callTypecastTts(speechText, typecastKey, { speechText }, character ?? "cute");

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TTS] error:", msg);
    return NextResponse.json({ error: msg });
  }
}
