import { NextRequest, NextResponse } from "next/server";

/**
 * 관리자 보호 미들웨어 (비밀키 방식).
 *
 * - /admin/* 페이지와 관리자 전용 생성 API를 보호한다.
 * - 인증은 httpOnly 쿠키(admin_auth)에 저장된 값이 ADMIN_SECRET 과 일치하는지로 판단.
 * - ADMIN_SECRET 이 설정되지 않으면 보호가 비활성화된다(로컬 개발 편의).
 *   ⚠️ 프로덕션 배포 시 반드시 ADMIN_SECRET 환경변수를 설정할 것.
 */

const ADMIN_COOKIE = "admin_auth";

// 관리자 전용 API (일반 유저 화면에선 호출하지 않는 것들)
const PROTECTED_API = [
  "/api/generate-shorts",
  "/api/generate-shorts-map",
  "/api/generate-social-post",
];

function isProtected(pathname: string): boolean {
  if (pathname.startsWith("/admin")) return true;
  return PROTECTED_API.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 로그인 화면/엔드포인트는 항상 통과
  if (pathname === "/admin/login" || pathname === "/api/admin/login") {
    return NextResponse.next();
  }
  if (!isProtected(pathname)) return NextResponse.next();

  const secret = process.env.ADMIN_SECRET;
  // 비밀키 미설정 → 보호 비활성 (로컬 개발). 프로덕션에선 반드시 설정.
  if (!secret) return NextResponse.next();

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  if (cookie && cookie === secret) return NextResponse.next();

  // 미인증
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/admin/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/generate-shorts",
    "/api/generate-shorts-map",
    "/api/generate-social-post",
  ],
};
