import { NextRequest, NextResponse } from "next/server";

// 미들웨어와 동일한 쿠키 이름을 사용한다.
const ADMIN_COOKIE = "admin_auth";

// POST /api/admin/login → { secret } 검증 후 인증 쿠키 발급
export async function POST(req: NextRequest) {
  const { secret } = await req.json().catch(() => ({ secret: "" }));
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    return NextResponse.json(
      { error: "서버에 ADMIN_SECRET 이 설정되지 않았습니다." },
      { status: 500 },
    );
  }
  if (!secret || secret !== expected) {
    return NextResponse.json({ error: "비밀키가 올바르지 않습니다." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, secret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7일
  });
  return res;
}

// DELETE /api/admin/login → 로그아웃 (쿠키 제거)
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
