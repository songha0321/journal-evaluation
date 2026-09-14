"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Icon } from "./Icon";

export interface DropdownOption {
  value: string;
  label: string;
}

/**
 * 커스텀 드롭다운 (DESIGN.md §7.10 [적용]). 브라우저 기본 <select>를 쓰지 않는다.
 * 트리거: 36px, 보더 1px, radius 3, 화살표는 오른쪽 끝 고정. 패널: 흰 배경 + 그림자, 항목 hover wash.
 * Esc·바깥 클릭으로 닫힌다. 선택 항목에는 체크가 붙는다.
 */
export function Dropdown({
  value,
  options,
  onChange,
  placeholder = "전체",
  allLabel,
  ariaLabel,
  width,
  disabled,
}: {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** 주면 맨 위에 "전체" 항목(value "")을 만든다 */
  allLabel?: string;
  ariaLabel?: string;
  width?: number | string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const items = allLabel != null ? [{ value: "", label: allLabel }, ...options] : options;
  const current = items.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`dd ${open ? "open" : ""}`} ref={ref} style={{ width }}>
      <button
        type="button"
        className="dd-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className={`dd-label ${current ? "" : "placeholder"}`}>{current?.label ?? placeholder}</span>
        <Icon as={ChevronDown} className="dd-chevron" />
      </button>
      {open && (
        <ul className="dd-panel" role="listbox" id={id}>
          {items.map((o) => {
            const on = o.value === value;
            return (
              <li
                key={o.value || "__all"}
                role="option"
                aria-selected={on}
                className={`dd-item ${on ? "on" : ""}`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="clip">{o.label}</span>
                {on && <Icon as={Check} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
