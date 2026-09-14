"use client";

import { Search, X } from "lucide-react";
import { useState } from "react";
import { Icon } from "./Icon";

/** 검색창: 연한 바탕 + 돋보기, Enter로 확정. 지우기(X)는 값이 있을 때만. */
export function SearchInput({
  defaultValue = "",
  placeholder,
  onSubmit,
  width = 260,
  ariaLabel,
}: {
  defaultValue?: string;
  placeholder: string;
  onSubmit: (value: string) => void;
  width?: number | string;
  ariaLabel?: string;
}) {
  const [v, setV] = useState(defaultValue);
  return (
    <label className="search" style={{ width }}>
      <Icon as={Search} className="search-ico" />
      <input
        value={v}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit(v.trim());
        }}
      />
      {v && (
        <button
          type="button"
          className="search-clear"
          aria-label="지우기"
          onClick={() => {
            setV("");
            onSubmit("");
          }}
        >
          <Icon as={X} size="sm" />
        </button>
      )}
    </label>
  );
}
