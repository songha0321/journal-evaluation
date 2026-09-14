/**
 * 포인트 컬러 환경설정. 기본은 제품 마크 실측 #0074D2(DESIGN.md §6.2.3).
 * 사용자가 고른 색은 브라우저(localStorage)에 저장되고, wash·진한색·포커스 링은 그 색에서 계산한다.
 */
export const DEFAULT_POINT = "#0074D2";
export const THEME_KEY = "hj.point";

export const PRESETS: { name: string; hex: string; note: string }[] = [
  { name: "마크 블루", hex: "#0074D2", note: "기본. 제품 마크 색" },
  { name: "블루 블랙", hex: "#010D19", note: "SDIJ 브랜드 1순위 색" },
  { name: "네이비", hex: "#052645", note: "SDIJ 서브 브랜드" },
  { name: "틸", hex: "#0A5457", note: "SDIJ 서브 브랜드" },
  { name: "퍼플", hex: "#38268A", note: "SDIJ 서브 브랜드" },
  { name: "딥 그레이", hex: "#293B47", note: "SDIJ 그레이 계열" },
];

export function isHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}
/** 두 색을 t(0~1) 비율로 섞는다. t=1이면 b */
function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return hex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

export interface Palette {
  point: string;
  pointDark: string;
  wash1: string;
  wash2: string;
  ring: string;
}

export function palette(point: string): Palette {
  const p = isHex(point) ? point.toUpperCase() : DEFAULT_POINT;
  const [r, g, b] = rgb(p);
  return {
    point: p,
    pointDark: mix(p, "#000000", 0.22),
    wash1: mix(p, "#FFFFFF", 0.9),
    wash2: mix(p, "#FFFFFF", 0.8),
    ring: `rgba(${r}, ${g}, ${b}, 0.18)`,
  };
}

export function applyPoint(point: string) {
  const pal = palette(point);
  const st = document.documentElement.style;
  st.setProperty("--point", pal.point);
  st.setProperty("--point-dark", pal.pointDark);
  st.setProperty("--wash-1", pal.wash1);
  st.setProperty("--wash-2", pal.wash2);
  st.setProperty("--point-ring", pal.ring);
}

export function loadPoint(): string {
  try {
    const raw = JSON.parse(localStorage.getItem("hj.settings") ?? "{}") as { point?: string };
    return raw.point && isHex(raw.point) ? raw.point.toUpperCase() : DEFAULT_POINT;
  } catch {
    return DEFAULT_POINT;
  }
}
