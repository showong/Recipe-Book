import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, SUPABASE_BUCKET, isSupabaseConfigured } from "@/lib/supabase/server";

// POST /api/upload-video-presign
// Returns a Supabase presigned upload URL so the client can POST the video blob
// directly to Supabase Storage, bypassing Vercel's 4.5 MB body size limit.
export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase가 설정되지 않았습니다." }, { status: 503 });
  }

  let filename: string;
  try {
    const body = await req.json() as { filename?: string };
    filename = body.filename ?? "video.mp4";
  } catch {
    return NextResponse.json({ error: "요청 파싱 실패" }, { status: 400 });
  }

  try {
    const ext = (filename.split(".").pop() ?? "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "mp4";
    const path = `tmp/vid_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const sb = getSupabaseAdmin();
    const { data, error } = await sb.storage.from(SUPABASE_BUCKET).createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json({ error: `서명 URL 생성 실패: ${error?.message}` }, { status: 500 });
    }

    const { data: publicData } = sb.storage.from(SUPABASE_BUCKET).getPublicUrl(path);

    return NextResponse.json({
      signedUrl: data.signedUrl,
      token: data.token,
      path,
      publicUrl: publicData.publicUrl,
    });
  } catch (e) {
    console.error("[upload-video-presign] error:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "서버 오류" }, { status: 500 });
  }
}
