import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId   = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      return NextResponse.json(
        { error: "TELEGRAM_BOT_TOKEN 또는 TELEGRAM_CHAT_ID가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const body = await req.json() as {
      // Preferred: pre-uploaded public URL (avoids Vercel 4.5 MB body limit).
      videoUrl?: string;
      storagePath?: string;
      // Legacy: raw base64-encoded video/document.
      data?: string;
      mimeType?: string;
      filename?: string;
      caption?: string;
    };

    const { videoUrl, storagePath, data, mimeType, filename, caption } = body;

    let res: Response;

    if (videoUrl) {
      // Telegram downloads from the public URL — nothing large goes through Vercel.
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        video: videoUrl,
        supports_streaming: true,
      };
      if (caption) payload.caption = caption;
      res = await fetch(`https://api.telegram.org/bot${botToken}/sendVideo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      if (!data || !mimeType) {
        return NextResponse.json({ error: "videoUrl 또는 data+mimeType이 필요합니다." }, { status: 400 });
      }
      const buffer   = Buffer.from(data, "base64");
      const blob     = new Blob([buffer], { type: mimeType });
      const formData = new FormData();
      formData.append("chat_id", chatId);
      if (caption) formData.append("caption", caption);
      const isVideo  = mimeType.startsWith("video/");
      const endpoint = isVideo ? "sendVideo" : "sendDocument";
      const field    = isVideo ? "video" : "document";
      formData.append(field, blob, filename ?? "reel");
      res = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
        method: "POST",
        body: formData,
      });
    }

    const result = await res.json() as { ok: boolean; description?: string };
    if (!res.ok || !result.ok) {
      throw new Error(result.description ?? `Telegram API error ${res.status}`);
    }

    // Clean up the temporary Supabase storage object after successful delivery.
    if (storagePath && videoUrl) {
      try {
        const { isSupabaseConfigured, getSupabaseAdmin, SUPABASE_BUCKET } = await import(
          "@/lib/supabase/server"
        );
        if (isSupabaseConfigured()) {
          await getSupabaseAdmin().storage.from(SUPABASE_BUCKET).remove([storagePath]);
        }
      } catch {
        console.warn("[send-telegram] temp video cleanup failed for path:", storagePath);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Telegram send error:", message);
    return NextResponse.json({ error: `텔레그램 전송 실패: ${message}` }, { status: 500 });
  }
}
