"use client";

/** 페이지 오류 경계. (app)/layout 안쪽에 있으므로 사이드바는 유지된다. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <div className="page-header">
        <h1>오류가 발생했습니다</h1>
        <p className="desc">데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.</p>
      </div>
      <div className="page-body">
        <pre className="error-detail">{error.message || "알 수 없는 오류"}{error.digest ? `\n(digest ${error.digest})` : ""}</pre>
        <button className="btn primary" onClick={reset} type="button">
          다시 시도
        </button>
      </div>
    </>
  );
}
