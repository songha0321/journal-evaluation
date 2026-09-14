"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

interface Props {
  open: boolean;
  title: string;
  sub?: string;
  wide?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** 공통 모달. ESC·배경 클릭·닫기 버튼 3가지 경로로 항상 빠져나갈 수 있어야 한다. */
export function Modal({ open, title, sub, wide, onClose, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div>
            <h2>{title}</h2>
            {sub && <p className="sub">{sub}</p>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="닫기" type="button">
            <Icon as={X} size="lg" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
