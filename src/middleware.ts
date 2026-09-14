import { NextResponse, type NextRequest } from "next/server";

/**
 * 1차 게이트: 세션 쿠키가 아예 없으면 /login으로. 서명 검증은 (app)/layout.tsx가 한다.
 * next dev에서는 .dev.vars가 미들웨어 process.env에 실리지 않으므로 개발 모드는 통과시키고
 * (app)/layout.tsx의 검증(AUTH_DEV_BYPASS 포함)에 맡긴다.
 */
const PUBLIC = [/^\/login$/, /^\/api\/auth\//, /^\/icon\.png$/, /^\/apple-icon\.png$/, /^\/logo-mark\.png$/];

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "development" || process.env.AUTH_DEV_BYPASS === "1") return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();
  if (req.cookies.has("hj_session")) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
