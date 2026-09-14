"use client";

import { TriangleAlert } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

interface Props {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  /** 비어 있을 때 표시할 알럿 문구. showError가 true일 때만 노출 */
  error?: string;
  showError?: boolean;
  rows?: number;
  placeholder?: string;
  minHeight?: number;
}

/**
 * 글자수 제한은 없고, 공백 포함 글자수를 우측 하단에 항상 표시한다.
 * (PRD의 목차내용·한마디는 분량 제한이 없고 자세히 쓰는 것을 권장한다.)
 */
export function CharTextarea({
  label,
  hint,
  value,
  onChange,
  required,
  error,
  showError,
  rows,
  placeholder,
  minHeight,
}: Props) {
  const invalid = Boolean(showError && required && !value.trim());
  return (
    <label className="field">
      <span className="flabel">
        {label}
        {required && <span className="req">*</span>}
        {hint && <span className="fhint">{hint}</span>}
      </span>
      <div className="ta-wrap">
        <textarea
          className={invalid ? "invalid" : undefined}
          value={value}
          rows={rows}
          placeholder={placeholder}
          style={minHeight ? { minHeight } : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="char-count">{value.length.toLocaleString("ko-KR")}자 (공백 포함)</span>
      </div>
      {invalid && (
        <span className="field-error">
          <Icon as={TriangleAlert} size="sm" />
          {error || `${label}을(를) 입력하세요.`}
        </span>
      )}
    </label>
  );
}
