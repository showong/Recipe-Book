import type { ImageStore } from "@/lib/image-store";
import { getSupabaseAdmin, SUPABASE_BUCKET } from "@/lib/supabase/server";

/**
 * Supabase Storage 기반 ImageStore 구현.
 *
 * - put(): data URL을 디코드해 버킷에 업로드하고, 오브젝트 경로(ref)를 반환한다.
 * - resolve(): 오브젝트 경로 → 공개 URL. (버킷은 public 이어야 <img>에서 바로 로드됨)
 * - remove(): 오브젝트 경로의 파일을 삭제한다.
 * - 이미 http(s) URL이면 그대로 통과시킨다(외부 이미지 대비).
 */

const isHttpUrl = (ref: string) => /^https?:\/\//.test(ref);

function parseDataUrl(
  dataUrl: string,
): { buffer: Buffer; contentType: string; ext: string } | null {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  const contentType = m[1];
  const buffer = Buffer.from(m[2], "base64");
  // image/png → png, image/svg+xml → svg
  const ext = contentType.split("/")[1]?.split("+")[0] ?? "png";
  return { buffer, contentType, ext };
}

export const supabaseImageStore: ImageStore = {
  async put(dataUrl) {
    // 이미 공개 URL이면 저장 없이 그대로 사용
    if (isHttpUrl(dataUrl)) return dataUrl;

    const parsed = parseDataUrl(dataUrl);
    if (!parsed) throw new Error("이미지 형식(data URL)을 해석할 수 없습니다.");

    const objectPath = `img_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${parsed.ext}`;
    const sb = getSupabaseAdmin();
    const { error } = await sb.storage.from(SUPABASE_BUCKET).upload(objectPath, parsed.buffer, {
      contentType: parsed.contentType,
      upsert: false,
    });
    if (error) throw new Error(`이미지 업로드 실패: ${error.message}`);
    return objectPath;
  },

  async resolve(ref) {
    if (!ref) return null;
    if (isHttpUrl(ref) || ref.startsWith("data:")) return ref;
    const sb = getSupabaseAdmin();
    const { data } = sb.storage.from(SUPABASE_BUCKET).getPublicUrl(ref);
    return data?.publicUrl ?? null;
  },

  async remove(ref) {
    if (!ref || isHttpUrl(ref) || ref.startsWith("data:")) return;
    const sb = getSupabaseAdmin();
    await sb.storage.from(SUPABASE_BUCKET).remove([ref]);
  },
};
