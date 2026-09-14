"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Icon } from "./Icon";

/** 600px 이상 내려가면 오른쪽 아래에 나타나는 맨 위로 버튼. */
export function ScrollTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      className="scroll-top"
      aria-label="맨 위로"
      title="맨 위로"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      <Icon as={ArrowUp} />
    </button>
  );
}
