import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-body">
      <div className="empty">
        <p>찾을 수 없는 페이지입니다.</p>
        <Link href="/dashboard" className="btn" style={{ marginTop: 12 }}>
          대시보드로
        </Link>
      </div>
    </div>
  );
}
