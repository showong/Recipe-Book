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
  const secret = req.headers.get("x-admin-secret") ?? req.nextUrl.searchParams.get("adminSecret");
  if (checkAdminSecret(secret)) return null;
  return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
}
