/**
 * 환경설정 (브라우저별). localStorage에 저장하고, 서버 컴포넌트가 읽어야 하는 값은 쿠키(`hj.settings`)에도 같이 둔다.
 */
import { DEFAULT_POINT, isHex } from "./theme";

export interface Settings {
  /** 포인트 컬러 #RRGGBB */
  point: string;
  /** 사이드바 기본 상태 */
  sidebar: "open" | "collapsed";
  /** 수기 DB 한 화면 행 수 */
  qnaPageSize: 25 | 50 | 100;
  /** AI 러너를 "꺼짐"으로 볼 무응답 시간(분) */
  runnerStaleMin: 3 | 10 | 30;
  /** 표 정렬·필터 상태를 화면 이동 후에도 기억(예약) */
  rememberTable: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  point: DEFAULT_POINT,
  sidebar: "open",
  qnaPageSize: 50,
  runnerStaleMin: 3,
  rememberTable: false,
};

export const SETTINGS_KEY = "hj.settings";

export function normalize(raw: unknown): Settings {
  const r = (raw ?? {}) as Partial<Record<keyof Settings, unknown>>;
  return {
    point: typeof r.point === "string" && isHex(r.point) ? r.point.toUpperCase() : DEFAULT_SETTINGS.point,
    sidebar: r.sidebar === "collapsed" ? "collapsed" : "open",
    qnaPageSize: r.qnaPageSize === 25 || r.qnaPageSize === 100 ? r.qnaPageSize : 50,
    runnerStaleMin: r.runnerStaleMin === 10 || r.runnerStaleMin === 30 ? r.runnerStaleMin : 3,
    rememberTable: r.rememberTable === true,
  };
}

/** 서버: 쿠키 문자열에서 설정 복원 */
export function parseSettingsCookie(value: string | undefined): Settings {
  if (!value) return DEFAULT_SETTINGS;
  try {
    return normalize(JSON.parse(decodeURIComponent(value)));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/* ── 브라우저 전용 ── */
export function loadSettings(): Settings {
  try {
    return normalize(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}"));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  const n = normalize(s);
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(n));
    document.cookie = `${SETTINGS_KEY}=${encodeURIComponent(JSON.stringify(n))}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  } catch {
    /* ignore */
  }
}
