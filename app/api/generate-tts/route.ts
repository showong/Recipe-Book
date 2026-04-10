import { NextRequest, NextResponse } from "next/server";

const VOICE_ID    = "tc_606c6c684085209e5555abb0";
const TTS_ENDPOINT = "https://typecast.ai/api/text-to-speech";
const POLL_MAX    = 40;
const POLL_MS     = 1000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });
    }

    const apiKey = process.env.TYPECAST_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TYPECAST_API_KEY 환경변수를 설정해주세요." },
        { status: 500 }
      );
    }

    // ── Step 1: TTS 작업 생성 ────────────────────────────────────────────────
    const createRes = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        voice_id: VOICE_ID,
        text,
        lang: "auto",
        xapi_hd: true,
        model_version: "latest",
      }),
    });

    const createText = await createRes.text();
    console.log("[TTS] create status:", createRes.status, createText.slice(0, 400));

    if (!createRes.ok) {
      return NextResponse.json(
        { error: `Typecast ${createRes.status}: ${createText}` },
        { status: 502 }
      );
    }

    let createData: Record<string, unknown>;
    try {
      createData = JSON.parse(createText);
    } catch {
      return NextResponse.json(
        { error: `응답 파싱 실패: ${createText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    // ── Step 2: 즉시 완료 여부 확인 (일부 API는 동기 반환) ────────────────────
    const immediate = createData?.result as Record<string, unknown> | undefined;
    if (immediate?.audio_download_url) {
      console.log("[TTS] immediate audio_download_url");
      return NextResponse.json({ audioUrl: immediate.audio_download_url });
    }

    // ── Step 3: 비동기 → 폴링 ────────────────────────────────────────────────
    const resultObj = (createData?.result ?? createData) as Record<string, unknown>;
    const speakUrl  = (resultObj?.speak_v2_url ?? createData?.speak_v2_url) as string | undefined;

    if (!speakUrl) {
      return NextResponse.json(
        { error: `speak_v2_url 없음. 응답: ${JSON.stringify(createData).slice(0, 300)}` },
        { status: 502 }
      );
    }

    for (let i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_MS);

      const pollRes = await fetch(speakUrl, {
        headers: { "X-API-KEY": apiKey },
      });

      if (!pollRes.ok) {
        console.warn("[TTS] poll", i + 1, pollRes.status);
        continue;
      }

      const pollData = await pollRes.json() as Record<string, unknown>;
      const result   = (pollData?.result ?? pollData) as Record<string, unknown>;

      console.log(`[TTS] poll ${i + 1}: status=${result?.status}`);

      if (result?.status === "done" && result?.audio_download_url) {
        return NextResponse.json({ audioUrl: result.audio_download_url });
      }
      if (result?.status === "error") {
        return NextResponse.json({ error: "Typecast 변환 실패" }, { status: 502 });
      }
    }

    return NextResponse.json(
      { error: "음성 변환 시간 초과 (40초). 다시 시도해주세요." },
      { status: 504 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TTS] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
