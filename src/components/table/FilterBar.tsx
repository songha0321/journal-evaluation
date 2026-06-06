"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export interface SelectField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export interface TextField {
  key: string;
  label: string;
  placeholder?: string;
}

/**
 * URL search-param driven filter bar. Selecting an option / submitting a search
 * pushes updated params; server component re-reads and re-queries.
 */
export function FilterBar({
  selects = [],
  texts = [],
}: {
  selects?: SelectField[];
  texts?: TextField[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  return (
    <div className="toolbar">
      {selects.map((f) => (
        <select
          key={f.key}
          className="select"
          value={params.get(f.key) ?? ""}
          onChange={(e) => setParam(f.key, e.target.value)}
          aria-label={f.label}
        >
          <option value="">{f.label} 전체</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      {texts.map((f) => (
        <input
          key={f.key}
          className="input"
          defaultValue={params.get(f.key) ?? ""}
          placeholder={f.placeholder ?? f.label}
          aria-label={f.label}
          onKeyDown={(e) => {
            if (e.key === "Enter") setParam(f.key, (e.target as HTMLInputElement).value.trim());
          }}
        />
      ))}
      {(params.toString() && (
        <button type="button" className="btn" onClick={() => router.push(pathname)}>
          초기화
        </button>
      )) ||
        null}
    </div>
  );
}
