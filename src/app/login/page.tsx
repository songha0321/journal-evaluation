import { redirect } from "next/navigation";
import { getCurrentUser, isAuthConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  unauthorized: "허가되지 않은 계정입니다. 운영관리자에게 계정 등록을 요청하세요.",
  oauth: "Google 인증에 실패했습니다. 다시 시도해 주세요.",
  config: "로그인 설정이 아직 완료되지 않았습니다. 운영관리자에게 문의하세요.",
};

function GoogleMark() {
  // Google 공식 'G' 마크 — 브랜드 가이드상 색을 바꾸지 않는다. 아이콘 단일 규격의 유일한 예외.
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.3l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.2z" />
      <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.1C1 16.4 0 20.1 0 24s1 7.6 2.6 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.3 0 11.7-2.1 15.6-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentUser()) redirect("/ax");
  const { error } = await searchParams;
  const configured = await isAuthConfigured();
  const message = error ? ERRORS[error] : !configured ? ERRORS.config : null;

  return (
    <div className="login">
      <div className="login-box">
        <img src="/logo-mark.png" alt="" width={64} height={64} className="login-mark" />
        <h1 className="login-title">항해일지 AUTO</h1>
        <p className="login-desc">허가된 편집국 계정만 접근할 수 있습니다.</p>
        <a className="login-btn" href="/api/auth/google" aria-disabled={!configured}>
          <GoogleMark />
          Google로 로그인
        </a>
        {message && (
          <p className={`login-msg ${error === "unauthorized" || error === "oauth" ? "err" : ""}`}>{message}</p>
        )}
      </div>
      <p className="login-foot">시대인재 편집국</p>
    </div>
  );
}
