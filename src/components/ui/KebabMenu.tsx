"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Icon } from "./Icon";

export interface KebabItem {
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/** 케밥(⋯) 버튼 → 오른쪽 정렬 패널. 한 번에 하나만 열리고 Esc·바깥 클릭으로 닫힌다. */
export function KebabMenu({ items, label = "더 보기", disabled }: { items: KebabItem[]; label?: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="kebab" ref={ref}>
      <button type="button" className="kebab-btn" aria-label={label} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <Icon as={MoreHorizontal} />
      </button>
      {open && (
        <div className="kebab-panel" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className={`kebab-item ${it.danger ? "danger" : ""}`}
              disabled={it.disabled}
              onClick={() => {
                setOpen(false);
                it.onSelect();
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
