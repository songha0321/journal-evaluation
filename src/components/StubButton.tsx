"use client";

/** 1차 미구현(AI 평가/탈고/export 등) 액션. 클릭 시 "준비중" 안내. */
export function StubButton({
  label,
  primary,
  note = "이 기능은 다음 차수에서 제공됩니다.",
}: {
  label: string;
  primary?: boolean;
  note?: string;
}) {
  return (
    <button
      type="button"
      className={`btn ${primary ? "primary" : ""}`}
      onClick={() => alert(`${label} — 준비중\n${note}`)}
      title="준비중"
    >
      {label}
    </button>
  );
}
