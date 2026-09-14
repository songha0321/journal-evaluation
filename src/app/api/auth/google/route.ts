import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthEnv, isAuthConfigured, randomToken, STATE_COOKIE } from "@/lib/auth";
import { buildAuthUrl } from "@/lib/auth-google";

export const dynamic = "force-dynamic";

/** Google 로그인 시작. state를 쿠키에 두고 Google로 보낸다. */
export async function GET(req: Request) {
  const env = await getAuthEnv();
  const origin = env.AUTH_ORIGIN || new URL(req.url).origin;
  if (!(await isAuthConfigured())) return NextResponse.redirect(`${origin}/login?error=config`);

  const state = randomToken();
  const jar = await cookies();
  jar.set(STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", secure: origin.startsWith("https"), path: "/", maxAge: 600 });
  return NextResponse.redirect(buildAuthUrl(env.GOOGLE_CLIENT_ID!, origin, state));
}
