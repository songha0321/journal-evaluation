/** Google OIDC (Authorization Code). 의존성 없이 fetch만 쓴다. */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";

export function callbackUrl(origin: string): string {
  return `${origin}/api/auth/callback`;
}

export function buildAuthUrl(clientId: string, origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  return `${AUTH_URL}?${q}`;
}

export interface GoogleIdentity {
  email: string;
  name: string;
  picture?: string;
}

/** code → id_token → Google tokeninfo로 서명·aud 검증 → 이메일 확인. */
export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  origin: string,
): Promise<GoogleIdentity> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl(origin),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const { id_token } = (await res.json()) as { id_token?: string };
  if (!id_token) throw new Error("no id_token");

  const info = await fetch(`${TOKENINFO_URL}?id_token=${encodeURIComponent(id_token)}`);
  if (!info.ok) throw new Error(`tokeninfo failed: ${info.status}`);
  const claims = (await info.json()) as {
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    name?: string;
    picture?: string;
  };
  if (claims.aud !== clientId) throw new Error("aud mismatch");
  if (!claims.email || String(claims.email_verified) !== "true") throw new Error("email not verified");
  return { email: claims.email.toLowerCase(), name: claims.name || claims.email, picture: claims.picture };
}
