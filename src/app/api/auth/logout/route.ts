import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthEnv, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const env = await getAuthEnv();
  const origin = env.AUTH_ORIGIN || new URL(req.url).origin;
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return NextResponse.redirect(`${origin}/login`);
}
