import { NextRequest, NextResponse } from "next/server";

const BASE_URL = () =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId   = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID 환경변수가 없습니다." },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData 파싱 실패" }, { status: 400 });
  }

  const video    = formData.get("video")    as File   | null;
  const postText = formData.get("postText") as string | null;
  const caption  = formData.get("caption")  as string | null;

  // ── 1. 인스타 게시글 텍스트 먼저 전송 ─────────────────────────────────────
  if (postText) {
    const msgRes = await fetch(`${BASE_URL()}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       postText,
        parse_mode: "HTML",
      }),
    });
    const msgJson = await msgRes.json() as Record<string, unknown>;
    if (!msgJson.ok) {
      console.error("[Telegram] sendMessage failed:", msgJson.description);
    }
  }

  // ── 2. 동영상 전송 ─────────────────────────────────────────────────────────
  if (video) {
    const tgForm = new FormData();
    tgForm.append("chat_id", chatId);
    tgForm.append("video", video, video.name || "reels.mp4");
    tgForm.append("supports_streaming", "true");
    if (caption) tgForm.append("caption", caption);

    const vidRes = await fetch(`${BASE_URL()}/sendVideo`, {
      method: "POST",
      body:   tgForm,
    });
    const vidJson = await vidRes.json() as Record<string, unknown>;
    if (!vidJson.ok) {
      console.error("[Telegram] sendVideo failed:", vidJson.description);
      return NextResponse.json(
        { error: `Telegram 영상 전송 실패: ${vidJson.description}` },
        { status: 502 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
