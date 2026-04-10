import { NextRequest, NextResponse } from "next/server";

const TYPECAST_VOICE_ID = "tc_606c6c684085209e5555abb0";
const TYPECAST_TTS_URL = "https://typecast.ai/api/speak";
const TYPECAST_POLL_MAX = 30;   // 최대 30회 폴링 (약 30초)
const TYPECAST_POLL_MS  = 1000; // 1초 간격

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
        { error: "TYPECAST_API_KEY 환경변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 1) TTS 작업 생성
    const createRes = await fetch(TYPECAST_TTS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        actor_id: TYPECAST_VOICE_ID,
        text,
        lang: "auto",
        xapi_hd: true,
        model_version: "latest",
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.text();
      return NextResponse.json(
        { error: `Typecast API 오류 ${createRes.status}: ${err}` },
        { status: 502 }
      );
    }

    const createData = await createRes.json();
    const speakUrl: string | undefined =
      createData?.result?.speak_v2_url ?? createData?.speak_v2_url;

    if (!speakUrl) {
      return NextResponse.json(
        { error: "speak_v2_url을 받지 못했습니다." },
        { status: 502 }
      );
    }

    // 2) 폴링 — status가 "done"이 될 때까지 대기
    for (let i = 0; i < TYPECAST_POLL_MAX; i++) {
      await sleep(TYPECAST_POLL_MS);

      const pollRes = await fetch(speakUrl, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      const result = pollData?.result ?? pollData;

      if (result?.status === "done" && result?.audio_download_url) {
        return NextResponse.json({ audioUrl: result.audio_download_url });
      }

      if (result?.status === "error") {
        return NextResponse.json(
          { error: "Typecast 음성 변환에 실패했습니다." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { error: "음성 변환 시간 초과 (30초). 다시 시도해주세요." },
      { status: 504 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
