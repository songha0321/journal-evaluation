/** 단계 화면 맨 위 액션 줄. 왼쪽은 요약·보조 동작, 오른쪽 끝은 항상 "다음 단계로 가는" 주요 버튼 하나. */
export function StageBar({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="stage-bar">
      <div className="sb-left">{left}</div>
      <div className="sb-right">{right}</div>
    </div>
  );
}
