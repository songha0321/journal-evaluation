"use client";

import { useEffect } from "react";
import { applyPoint, loadPoint, DEFAULT_POINT } from "@/lib/theme";

/** 저장된 포인트 컬러를 첫 렌더 직후 적용한다. 기본색이면 아무것도 덮어쓰지 않는다. */
export function ThemeInit() {
  useEffect(() => {
    const p = loadPoint();
    if (p !== DEFAULT_POINT) applyPoint(p);
  }, []);
  return null;
}
