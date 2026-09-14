import { notFound } from "next/navigation";

/** 셸 안 catch-all. 없는 경로는 (app)/not-found.tsx로 보내 사이드바를 유지한다. */
export default function CatchAll() {
  notFound();
}
