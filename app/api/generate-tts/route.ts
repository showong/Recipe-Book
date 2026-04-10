import { NextRequest, NextResponse } from "next/server";

const VOICE_ID     = "tc_611c3f692fac944dff493a04";
// v1 엔드포인트 — 동기 응답, 바이너리 오디오 직접 반환
const TTS_ENDPOINT = "https://api.typecast.ai/v1/text-to-speech";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text가 필요합니다." }, { status: 400 });
    }

    const apiKey = process.env.TYPECAST_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "TYPECAST_API_KEY 환경변수를 .env.local에 추가해주세요." },
        { status: 500 }
      );
    }

    const ttsRes = await fetch(TTS_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        voice_id: VOICE_ID,
        text,
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

    // ── 오류 응답 ────────────────────────────────────────────────────────────
    if (!ttsRes.ok) {
      const errBody = await ttsRes.text();
      console.error("[TTS] error body:", errBody.slice(0, 400));
      // 502 대신 200으로 반환 → 클라이언트가 error 필드를 항상 읽을 수 있게
      return NextResponse.json(
        { error: `Typecast ${ttsRes.status}: ${errBody}` },
        { status: 200 }
      );
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
      const base64 = btoa(binary);
      const mimeType = contentType.split(";")[0].trim();
      return NextResponse.json({ audioUrl: `data:${mimeType};base64,${base64}` });
    }

    // ── JSON 응답 (비동기 polling 방식) ───────────────────────────────────────
    const json = await ttsRes.json() as Record<string, unknown>;
    console.log("[TTS] json response:", JSON.stringify(json).slice(0, 400));

    // 즉시 완료된 경우
    const result = (json?.result ?? json) as Record<string, unknown>;
    if (result?.audio_download_url) {
      return NextResponse.json({ audioUrl: result.audio_download_url });
    }

    // 폴링이 필요한 경우
    const speakUrl = (result?.speak_v2_url ?? json?.speak_v2_url) as string | undefined;
    if (!speakUrl) {
      return NextResponse.json(
        { error: `알 수 없는 응답 형식: ${JSON.stringify(json).slice(0, 300)}` },
        { status: 200 }
      );
    }

    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const pollRes = await fetch(speakUrl, { headers: { "X-API-KEY": apiKey } });
      if (!pollRes.ok) continue;
      const pollData = await pollRes.json() as Record<string, unknown>;
      const r2 = (pollData?.result ?? pollData) as Record<string, unknown>;
      console.log(`[TTS] poll ${i + 1}: status=${r2?.status}`);
      if (r2?.status === "done" && r2?.audio_download_url) {
        return NextResponse.json({ audioUrl: r2.audio_download_url });
      }
      if (r2?.status === "error") {
        return NextResponse.json({ error: "Typecast 변환 실패" }, { status: 200 });
      }
    }

    return NextResponse.json({ error: "음성 변환 시간 초과 (40초)" }, { status: 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TTS] error:", msg);
    return NextResponse.json({ error: msg }, { status: 200 });
  }
}
