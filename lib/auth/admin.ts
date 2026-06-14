import { NextRequest, NextResponse } from "next/server";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email.toLowerCase());
}

export function checkAdminSecret(secret: string | null | undefined): boolean {
  if (!secret) return false;
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  return secret === adminSecret;
}

export function requireAdmin(req: NextRequest): NextResponse | null {
  // ADMIN_SECRET 미설정 시 보호 비활성 (로컬 개발). 미들웨어와 동일한 정책.
  if (!process.env.ADMIN_SECRET) return null;
  // 인증 쿠키(admin_auth) → 헤더 → 쿼리 파라미터 순으로 확인
  const secret =
    req.cookies.get("admin_auth")?.value ??
    req.headers.get("x-admin-secret") ??
    req.nextUrl.searchParams.get("adminSecret");
  if (checkAdminSecret(secret)) return null;
  return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
}
