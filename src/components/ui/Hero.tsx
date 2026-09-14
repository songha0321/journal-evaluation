import { BackLink } from "./BackLink";

/**
 * 상세 화면 공통 히어로 (DESIGN.md §6.2.3 뒤로가기·제목 규칙).
 * - 뒤로가기: 항상 왼쪽 위, "‹ 상위 화면의 제목" 그대로(임의 문구 금지). 목록 화면에는 없다.
 * - 제목: 현재 객체의 전체 이름을 한 줄 h1로. 상위 맥락은 뒤로가기에만 있고 eyebrow로 반복하지 않는다.
 * - 메타: 제목 아래 한 줄, 항목은 간격으로 구분(중간 점 금지).
 * - 표지(cover)가 있으면 오른쪽에 마스크로 녹여 깐다.
 */
export function Hero({
  back,
  title,
  meta,
  cover,
}: {
  back: { href: string; label: string };
  title: React.ReactNode;
  meta?: React.ReactNode;
  cover?: string | null;
}) {
  return (
    <div className={`hero ${cover ? "has-cover" : ""}`}>
      <div className="hero-main">
        <BackLink href={back.href} label={back.label} />
        <h1 style={{ marginTop: 12 }}>{title}</h1>
        {meta ? <div className="hero-meta">{meta}</div> : null}
      </div>
      {cover && <img className="hero-cover-img" src={cover} alt="" aria-hidden />}
    </div>
  );
}
