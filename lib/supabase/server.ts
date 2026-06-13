import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트 (service_role 키).
 *
 * - 이 키는 RLS를 우회하는 전권 키이므로 **절대 클라이언트로 노출하면 안 된다.**
 *   API 라우트(서버) 안에서만 import 해야 한다. (NEXT_PUBLIC_ 접두사 금지)
 * - 클라이언트는 최초 1회만 생성해 재사용한다(lazy singleton).
 */

let cached: SupabaseClient | null = null;

/** SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 모두 설정되어 있는지. */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** 이미지 저장 버킷 이름 (기본값: recipe-images). */
export const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "recipe-images";

/** service_role 권한의 Supabase 클라이언트를 반환. 미설정 시 예외. */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
