import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId   = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다." }, { status: 500 });
    }

    const { data, mimeType, filename, caption } = await req.json() as {
      data: string;
      mimeType: string;
      filename?: string;
      caption?: string;
    };

    if (!data || !mimeType) {
      return NextResponse.json({ error: "data와 mimeType이 필요합니다." }, { status: 400 });
    }

    const buffer = Buffer.from(data, "base64");
    const blob   = new Blob([buffer], { type: mimeType });

    const formData = new FormData();
    formData.append("chat_id", chatId);
    if (caption) formData.append("caption", caption);

    const isVideo  = mimeType.startsWith("video/");
    const endpoint = isVideo ? "sendVideo" : "sendDocument";
    const field    = isVideo ? "video" : "document";
    formData.append(field, blob, filename ?? "reel");

    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/${endpoint}`,
      { method: "POST", body: formData },
    );

    const result = await res.json() as { ok: boolean; description?: string };
    if (!res.ok || !result.ok) {
      throw new Error(result.description ?? `Telegram API error ${res.status}`);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Telegram send error:", message);
    return NextResponse.json({ error: `텔레그램 전송 실패: ${message}` }, { status: 500 });
  }
}
