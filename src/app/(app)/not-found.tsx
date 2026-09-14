import Link from "next/link";

export default function NotFound() {
  return (
    <>
      <div className="page-header">
        <h1>페이지를 찾을 수 없습니다</h1>
        <p className="desc">주소가 잘못됐거나 아직 만들어지지 않은 화면입니다.</p>
      </div>
      <div className="page-body">
        <Link href="/ax" className="btn">
          원고 대시보드로
        </Link>
      </div>
    </>
  );
}
