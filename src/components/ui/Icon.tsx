import type { LucideIcon, LucideProps } from "lucide-react";

/**
 * 아이콘 단일 규격 (DESIGN.md §6.2.3).
 * lucide-react 선형 아이콘만 쓰고, 크기는 세 단계, 선 굵기는 크기와 무관하게 1.5px 고정(absoluteStrokeWidth).
 * 색은 currentColor. 장식 아이콘이므로 기본 aria-hidden — 의미가 있으면 aria-label을 넘긴다.
 *
 *   sm 12px  배지·칩·표 안 인라인
 *   md 16px  내비·버튼·알림 (기본)
 *   lg 20px  페이지 헤더·빈 상태
 */
export const ICON_SIZE = { sm: 12, md: 16, lg: 20 } as const;
export type IconSize = keyof typeof ICON_SIZE;

type Props = Omit<LucideProps, "size" | "strokeWidth" | "absoluteStrokeWidth"> & {
  as: LucideIcon;
  size?: IconSize;
};

export function Icon({ as: Glyph, size = "md", ...rest }: Props) {
  return <Glyph size={ICON_SIZE[size]} strokeWidth={1.5} absoluteStrokeWidth aria-hidden {...rest} />;
}
