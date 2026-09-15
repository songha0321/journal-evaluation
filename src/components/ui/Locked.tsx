import Link from "next/link";
import { Lock } from "lucide-react";
import { Icon } from "./Icon";

/** 권한이 없는 화면. 셸은 유지하고 본문만 잠금 안내로 바꾼다. */
export function Locked({ title }: { title: string }) {
  return (
    <>
      <div className="page-header">
        <h1>{title}</h1>
        <p className="desc">관리자만 볼 수 있는 화면입니다.</p>
      </div>
      <div className="page-body">
        <div className="locked-box">
          <Icon as={Lock} size="lg" />
          <div>
            <b>잠겨 있습니다</b>
            <p className="muted">편집자 계정은 원고 관리, 수기 DB, 작성자 DB만 쓸 수 있습니다. 권한이 필요하면 관리자에게 요청하세요.</p>
            <Link href="/ax" className="tbl-link">
              원고 대시보드로
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
