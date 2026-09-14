"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { SearchInput } from "@/components/ui/SearchInput";

export interface SelectField {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  width?: number | string;
}

export interface TextField {
  key: string;
  label: string;
  placeholder?: string;
  width?: number | string;
}

/**
 * URL search-param 기반 필터 바. 드롭다운은 즉시, 검색은 Enter로 반영한다.
 * 필터가 바뀌면 page 파라미터는 지운다(페이징 초기화).
 */
export function FilterBar({ selects = [], texts = [] }: { selects?: SelectField[]; texts?: TextField[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete("page");
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [params, pathname, router],
  );

  return (
    <div className="toolbar">
      {selects.map((f) => (
        <Dropdown
          key={f.key}
          value={params.get(f.key) ?? ""}
          options={f.options}
          allLabel={`${f.label} 전체`}
          ariaLabel={f.label}
          onChange={(v) => setParam(f.key, v)}
          width={f.width ?? 160}
        />
      ))}
      {texts.map((f) => (
        <SearchInput
          key={f.key}
          defaultValue={params.get(f.key) ?? ""}
          placeholder={f.placeholder ?? `${f.label} 검색`}
          ariaLabel={f.label}
          onSubmit={(v) => setParam(f.key, v)}
          width={f.width ?? 280}
        />
      ))}
      {params.toString() ? (
        <button type="button" className="btn" onClick={() => router.push(pathname)}>
          초기화
        </button>
      ) : null}
    </div>
  );
}
