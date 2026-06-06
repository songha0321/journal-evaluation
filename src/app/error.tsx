"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="page-body">
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="section-title" style={{ marginTop: 0 }}>
          오류가 발생했습니다
        </div>
        <p className="muted" style={{ whiteSpace: "pre-wrap" }}>
          {error.message || "데이터를 불러오지 못했습니다."}
        </p>
        <p className="faint" style={{ fontSize: 12 }}>
          D1 바인딩이 없으면 `npm run cf-typegen` 후 `npm run dev`, 또는 `npm run preview`로 실행하세요.
        </p>
        <button className="btn primary" onClick={reset}>
          다시 시도
        </button>
      </div>
    </div>
  );
}
