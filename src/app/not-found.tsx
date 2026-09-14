import Link from "next/link";

/** 셸 밖(로그인 등) 404. 셸 안 404는 (app)/not-found.tsx가 처리한다. */
export default function RootNotFound() {
  return (
    <div className="login">
      <div className="login-box">
        <h1 className="login-title">페이지를 찾을 수 없습니다</h1>
        <p className="login-desc">주소를 확인해 주세요.</p>
        <Link href="/ax" className="login-btn">
          원고 대시보드로
        </Link>
      </div>
    </div>
  );
}
