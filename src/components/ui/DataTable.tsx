"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ListFilter, Search, X } from "lucide-react";
import { Icon } from "./Icon";
import { ProgressBar } from "./ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { ScoreBadge, SelectBadge } from "@/components/ScoreBadge";
import { formatWon, SUBMISSION_STATUS_LABEL, ARTICLE_STATUS_LABEL, AI_SUSPICION_LABEL } from "@/lib/format";

/**
 * 표 단일 규격 (DESIGN.md §6.2.3). 모든 목록 화면은 이 컴포넌트로 그린다.
 * - 헤더 클릭 정렬(오름 → 내림), 숫자·문자·null 혼합 처리
 * - 열 필터: 헤더의 깔때기 → 값 목록 체크(검색 포함). 스프레드시트 방식, 현재 화면의 행 안에서 동작
 * - 셀 유형으로 렌더를 통일: 링크·배지·점수·진행률·금액·말줄임
 * - 서버 컴포넌트에서는 유형만 넘기고, 클라이언트 컴포넌트에서는 render로 임의 셀을 그린다
 *
 * 행 높이(density)는 내용으로 고른다 — compact 32(숫자 요약표) / default 40(일반 목록) / comfortable 48(긴 문장·배지 여러 개).
 *
 * 규약: type "link"·"btn-link"는 `row[`${key}_href`]`를 주소로 쓴다.
 *       type "progress"는 `row[key]`(0~100)와 `row[`${key}_warn`]`(boolean)을 읽는다.
 */
export type CellType =
  | "text"
  | "strong"
  | "muted"
  | "clip"
  | "number"
  | "won"
  | "pct"
  | "link"
  | "btn-link"
  | "badge"
  | "score"
  | "select"
  | "progress";

export interface Column<R> {
  key: string;
  label: string;
  type?: CellType;
  align?: "left" | "right";
  width?: number | string;
  maxWidth?: number;
  /** 남는 폭을 모두 차지하고 넘치면 말줄임(표당 1개 권장). type "clip"과 함께 쓴다 */
  flex?: boolean;
  badgeKind?: "submission" | "article" | "suspicion";
  /** 정렬·필터 기준 필드(표시 필드와 다를 때). 예: 표시는 "9기", 정렬은 9 */
  sortKey?: string;
  sortable?: boolean;
  /** 열 필터 허용 여부. 기본: 정렬 가능한 열은 모두 허용 */
  filterable?: boolean;
  render?: (row: R) => ReactNode;
}

type Dir = "asc" | "desc";
type Primitive = string | number | boolean | null | undefined;
type Rec = Record<string, unknown>;

function primitive(v: unknown): Primitive {
  if (v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v as Primitive;
  return String(v);
}

function compare(a: Primitive, b: Primitive): number {
  const an = a == null || a === "";
  const bn = b == null || b === "";
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return String(a).localeCompare(String(b), "ko", { numeric: true });
}

const BADGE_LABELS = { submission: SUBMISSION_STATUS_LABEL, article: ARTICLE_STATUS_LABEL, suspicion: AI_SUSPICION_LABEL };

/** 필터 목록에 보여줄 값 라벨. 배지는 코드 대신 한글 라벨, 금액은 원 단위 */
function filterLabel<R>(c: Column<R>, v: Primitive): string {
  if (v == null || v === "") return "(비어 있음)";
  if (c.type === "badge") return BADGE_LABELS[c.badgeKind ?? "submission"][String(v)] ?? String(v);
  if (c.type === "won") return formatWon(Number(v));
  if (c.type === "pct" || c.type === "progress") return `${v}%`;
  return String(v);
}

export function DataTable<R extends object>({
  columns,
  rows,
  rowKey,
  defaultSort,
  empty = "데이터가 없습니다.",
  density = "default",
  style,
}: {
  columns: Column<R>[];
  rows: R[];
  rowKey: string;
  defaultSort?: { key: string; dir: Dir };
  empty?: string;
  density?: "compact" | "default" | "comfortable";
  style?: React.CSSProperties;
}) {
  const [sort, setSort] = useState<{ key: string; dir: Dir } | null>(defaultSort ?? null);
  /** 열별 선택 값(문자열화). 키가 없으면 전체 */
  const [filters, setFilters] = useState<Record<string, Set<string>>>({});
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const fieldOf = (c: Column<R>) => c.sortKey ?? c.key;
  const valueOf = (row: R, c: Column<R>) => primitive((row as Rec)[fieldOf(c)]);
  const keyOf = (v: Primitive) => (v == null ? "" : String(v));

  const filtered = useMemo(() => {
    const active = Object.entries(filters).filter(([, set]) => set.size > 0);
    if (active.length === 0) return rows;
    return rows.filter((row) =>
      active.every(([ck, set]) => {
        const c = columns.find((x) => x.key === ck);
        return c ? set.has(keyOf(valueOf(row, c))) : true;
      }),
    );
  }, [rows, filters, columns]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const out = [...filtered];
    out.sort((x, y) => {
      const r = compare(valueOf(x, col), valueOf(y, col));
      return sort.dir === "asc" ? r : -r;
    });
    return out;
  }, [filtered, sort, columns]);

  function toggleSort(col: Column<R>) {
    if (!isSortable(col)) return;
    setSort((prev) =>
      prev?.key === col.key ? { key: col.key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key: col.key, dir: "asc" },
    );
  }

  const activeFilters = columns.filter((c) => (filters[c.key]?.size ?? 0) > 0);

  if (rows.length === 0) return <div className="empty">{empty}</div>;

  return (
    <div className={`table-wrap density-${density}`} style={style}>
      {activeFilters.length > 0 && (
        <div className="tbl-filters">
          <span className="faint">필터</span>
          {activeFilters.map((c) => (
            <button
              key={c.key}
              type="button"
              className="tbl-chip"
              onClick={() => setFilters((f) => ({ ...f, [c.key]: new Set() }))}
              title="이 필터 지우기"
            >
              {c.label} {filters[c.key].size}
              <Icon as={X} size="sm" />
            </button>
          ))}
          <button type="button" className="tbl-link" onClick={() => setFilters({})}>
            모두 지우기
          </button>
        </div>
      )}
      <table className="data">
        <thead>
          <tr>
            {columns.map((c) => {
              const right = c.align === "right" || isNumeric(c.type);
              const sortedOn = sort?.key === c.key;
              const sortable = isSortable(c);
              const filterable = isFilterable(c);
              const filterOn = (filters[c.key]?.size ?? 0) > 0;
              return (
                <th
                  key={c.key}
                  className={`${right ? "num" : ""} ${sortable ? "sortable" : ""} ${sortedOn || filterOn ? "sorted" : ""}`.trim()}
                  style={{ width: c.width }}
                  aria-sort={sortedOn ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}
                >
                  <span className="th-inner">
                    <span className="th-label" onClick={() => toggleSort(c)}>
                      {c.label}
                    </span>
                    <span className="th-ctrls">
                      {sortable && sortedOn && (
                        <Icon as={sort!.dir === "asc" ? ChevronUp : ChevronDown} size="sm" className="sort-ico on" />
                      )}
                    {filterable && (
                      <button
                        type="button"
                        className={`th-filter ${filterOn ? "on" : ""} ${openFilter === c.key ? "open" : ""}`}
                        aria-label={`${c.label} 필터`}
                        aria-expanded={openFilter === c.key}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenFilter((o) => (o === c.key ? null : c.key));
                        }}
                      >
                        <Icon as={ListFilter} size="sm" />
                      </button>
                    )}
                    </span>
                  </span>
                  {openFilter === c.key && (
                    <FilterPanel
                      label={c.label}
                      options={distinctOptions(rows, c, valueOf, keyOf)}
                      selected={filters[c.key] ?? new Set()}
                      onChange={(set) => setFilters((f) => ({ ...f, [c.key]: set }))}
                      onClose={() => setOpenFilter(null)}
                    />
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="tbl-empty">
                조건에 맞는 행이 없습니다.{" "}
                <button type="button" className="tbl-link" onClick={() => setFilters({})}>
                  필터 지우기
                </button>
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={String((row as Rec)[rowKey])}>
                {columns.map((c) => {
                  const right = c.align === "right" || isNumeric(c.type);
                  return (
                    <td
                      key={c.key}
                      className={`${right ? "num" : ""} ${c.type === "muted" ? "muted" : ""} ${c.type === "strong" ? "strong" : ""}`.trim()}
                      style={c.flex ? { width: "100%", maxWidth: 0 } : c.type === "clip" ? { maxWidth: c.maxWidth ?? 320 } : undefined}
                      title={c.type === "clip" ? stringOf((row as Rec)[c.key]) : undefined}
                    >
                      {c.flex && c.type !== "clip" ? (
                        <span className="clip">{c.render ? c.render(row) : renderCell(c, row)}</span>
                      ) : c.render ? (
                        c.render(row)
                      ) : (
                        renderCell(c, row)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface Opt {
  key: string;
  label: string;
  n: number;
}

function distinctOptions<R>(
  rows: R[],
  c: Column<R>,
  valueOf: (row: R, c: Column<R>) => Primitive,
  keyOf: (v: Primitive) => string,
): Opt[] {
  const map = new Map<string, { v: Primitive; n: number }>();
  for (const r of rows) {
    const v = valueOf(r, c);
    const k = keyOf(v);
    const cur = map.get(k);
    if (cur) cur.n += 1;
    else map.set(k, { v, n: 1 });
  }
  return [...map.entries()]
    .sort((a, b) => compare(a[1].v, b[1].v))
    .map(([k, { v, n }]) => ({ key: k, label: filterLabel(c, v), n }));
}

/** 열 필터 패널: 검색 + 값 체크 목록. 바깥 클릭·Esc로 닫힘 */
function FilterPanel({
  label,
  options,
  selected,
  onChange,
  onClose,
}: {
  label: string;
  options: Opt[];
  selected: Set<string>;
  onChange: (s: Set<string>) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const toggle = (k: string) => {
    const next = new Set(selected);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    onChange(next);
  };
  return (
    <div className="th-panel" ref={ref} onClick={(e) => e.stopPropagation()}>
      <div className="th-panel-head">
        <span>{label} 필터</span>
        <button type="button" className="tbl-link" onClick={() => onChange(new Set())} disabled={selected.size === 0}>
          지우기
        </button>
      </div>
      {options.length > 8 && (
        <label className="search th-search">
          <Icon as={Search} size="sm" className="search-ico" />
          <input value={q} placeholder="값 검색" onChange={(e) => setQ(e.target.value)} />
        </label>
      )}
      <div className="th-panel-tools">
        <button type="button" className="tbl-link" onClick={() => onChange(new Set(shown.map((o) => o.key)))}>
          보이는 값 모두 선택
        </button>
      </div>
      <ul className="th-panel-list">
        {shown.map((o) => (
          <li key={o.key}>
            <label>
              <input type="checkbox" checked={selected.has(o.key)} onChange={() => toggle(o.key)} />
              <span className="clip">{o.label}</span>
              <span className="faint">{o.n}</span>
            </label>
          </li>
        ))}
        {shown.length === 0 && <li className="faint" style={{ padding: "6px 10px" }}>검색 결과 없음</li>}
      </ul>
    </div>
  );
}

function isNumeric(t?: CellType) {
  return t === "number" || t === "won" || t === "pct";
}
function isSortable<R>(c: Column<R>) {
  if (c.sortable === false) return false;
  if (c.type === "btn-link") return false;
  if (c.render && !c.sortKey && c.sortable !== true) return false;
  return true;
}
function isFilterable<R>(c: Column<R>) {
  if (c.filterable === false) return false;
  if (c.type === "btn-link" || c.type === "progress") return false;
  if (c.type === "clip" && !c.sortKey) return false; // 긴 글은 값 목록이 의미 없다
  if (c.render && !c.sortKey && c.filterable !== true) return false;
  return true;
}
function stringOf(v: unknown): string {
  return v == null ? "" : String(v);
}

function renderCell<R extends object>(c: Column<R>, row: R): ReactNode {
  const rec = row as Rec;
  const v = rec[c.key];
  switch (c.type) {
    case "number":
      return typeof v === "number" ? v.toLocaleString("ko-KR") : v == null || v === "" ? <span className="faint">-</span> : String(v);
    case "won":
      return formatWon(v as number | null);
    case "pct":
      return v == null ? <span className="faint">-</span> : `${v}%`;
    case "link":
      return (
        <Link href={String(rec[`${c.key}_href`] ?? "#")} className="row-link">
          {stringOf(v) || "-"}
        </Link>
      );
    case "btn-link":
      // 표 안의 동작은 버튼 박스가 아니라 밑줄 링크로 (DESIGN.md §6.2.3)
      return (
        <Link href={String(rec[`${c.key}_href`] ?? "#")} className="tbl-link">
          {stringOf(v)}
        </Link>
      );
    case "badge":
      return <StatusBadge value={v as string | null} kind={c.badgeKind ?? "submission"} />;
    case "score":
      return <ScoreBadge totalScore={v as number | null} />;
    case "select":
      return <SelectBadge totalScore={v as number | null} />;
    case "progress":
      return <ProgressBar pct={Number(v ?? 0)} warn={Boolean(rec[`${c.key}_warn`])} />;
    case "clip":
      return (
        <span className="clip" style={c.flex ? undefined : { maxWidth: c.maxWidth ?? 320 }}>
          {stringOf(v) || <span className="faint">-</span>}
        </span>
      );
    default:
      return v == null || v === "" ? <span className="faint">-</span> : String(v);
  }
}
