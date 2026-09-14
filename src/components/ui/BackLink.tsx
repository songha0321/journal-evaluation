import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

/** 뒤로가기. 브라우저 히스토리가 아니라 명시적 상위 경로로 보낸다(딥링크 진입 대비). */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="back-link" href={href}>
      <Icon as={ChevronLeft} />
      {label}
    </Link>
  );
}
