import { NextRequest, NextResponse } from "next/server";

const BASE_URL = () =>
  `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const TG_MSG_LIMIT = 4000; // Telegram hard limit is 4096; leave headroom for headers

// Split long text into Telegram-sized chunks (plain text, no markup).
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > TG_MSG_LIMIT) {
    let cut = rest.lastIndexOf("\n", TG_MSG_LIMIT);
    if (cut < TG_MSG_LIMIT * 0.6) cut = TG_MSG_LIMIT; // no good newline → hard cut
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.trim()) chunks.push(rest);
  return chunks;
}

async function sendMessage(chatId: string, text: string, parseHtml = false): Promise<boolean> {
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (parseHtml) body.parse_mode = "HTML";
  const res = await fetch(`${BASE_URL()}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json() as Record<string, unknown>;
  if (!json.ok) console.error("[Telegram] sendMessage failed:", json.description);
  return Boolean(json.ok);
}

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

  const video         = formData.get("video")         as File   | null;
  const videoUrl      = formData.get("videoUrl")      as string | null;
  const storagePath   = formData.get("storagePath")   as string | null;
  const postText      = formData.get("postText")      as string | null;
  const caption       = formData.get("caption")       as string | null;

  // Platform-specific posts (shorts pipeline) — each sent as its own message.
  const platformPosts: { label: string; text: string | null }[] = [
    { label: "📸 인스타그램", text: formData.get("instagram") as string | null },
    { label: "▶️ 유튜브",     text: formData.get("youtube")   as string | null },
    { label: "🎵 틱톡",       text: formData.get("tiktok")    as string | null },
  ];

  // ── 1. 게시글 텍스트 전송 ──────────────────────────────────────────────────
  // Backward-compatible single-post field (recipe page).
  if (postText) {
    await sendMessage(chatId, postText, true);
  }

  // Per-platform posts: plain text with a header, chunked if too long.
  for (const { label, text } of platformPosts) {
    if (!text || !text.trim()) continue;
    const parts = chunkText(text.trim());
    for (let i = 0; i < parts.length; i++) {
      const header = parts.length > 1 ? `${label} (${i + 1}/${parts.length})` : label;
      await sendMessage(chatId, `${header}\n\n${parts[i]}`);
    }
  }

  // ── 2. 동영상 전송 ─────────────────────────────────────────────────────────
  // Prefer a pre-uploaded public URL (avoids Vercel 4.5 MB body limit).
  // Fall back to a raw File blob when no URL is provided.
  if (videoUrl || video) {
    let vidRes: Response;

    if (videoUrl) {
      // Telegram downloads the video directly from the public URL.
      const body: Record<string, unknown> = {
        chat_id: chatId,
        video: videoUrl,
        supports_streaming: true,
      };
      if (caption) body.caption = caption;
      vidRes = await fetch(`${BASE_URL()}/sendVideo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      const tgForm = new FormData();
      tgForm.append("chat_id", chatId);
      tgForm.append("video", video!, video!.name || "reels.mp4");
      tgForm.append("supports_streaming", "true");
      if (caption) tgForm.append("caption", caption);
      vidRes = await fetch(`${BASE_URL()}/sendVideo`, { method: "POST", body: tgForm });
    }

    const vidJson = await vidRes.json() as Record<string, unknown>;
    if (!vidJson.ok) {
      console.error("[Telegram] sendVideo failed:", vidJson.description);
      return NextResponse.json(
        { error: `Telegram 영상 전송 실패: ${vidJson.description}` },
        { status: 502 },
      );
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
        // Cleanup failure is non-fatal; log and continue.
        console.warn("[send-telegram] temp video cleanup failed for path:", storagePath);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
