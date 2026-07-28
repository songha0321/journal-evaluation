import { Terminal, TriangleAlert } from "lucide-react";

export interface RunnerInfo {
  last_seen_at: string | null;
  status: string | null;
  note: string | null;
}

/** 러너를 살아있다고 볼 최대 무응답 시간(초). */
const STALE_SEC = 180;

function ageSec(last: string | null | undefined): number | null {
  if (!last) return null;
  const t = Date.parse(last.includes("T") ? last : last.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 1000));
}

function ageLabel(sec: number): string {
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  return `${Math.floor(sec / 3600)}시간 전`;
}

/**
 * 러너 생존 표시.
 * 러너가 죽어 있으면 큐에만 쌓이고 결과가 영영 안 나온다 — 그 상황을 화면에서 즉시 알린다.
 */
export function RunnerNotice({ runner }: { runner: RunnerInfo | null | undefined }) {
  const sec = ageSec(runner?.last_seen_at);
  const dead = sec === null || sec > STALE_SEC;

  if (dead) {
    return (
      <div className="alert warn" style={{ marginTop: 10, marginBottom: 0 }}>
        <TriangleAlert size={15} strokeWidth={1.75} aria-hidden />
        <span>
          로컬 러너가 응답하지 않습니다{sec !== null && ` (마지막 응답 ${ageLabel(sec)})`}. 요청은 큐에
          쌓여 있으며, 아래 명령을 실행하면 이어서 처리됩니다.
          <code
            style={{
              display: "block",
              marginTop: 6,
              padding: "6px 8px",
              background: "rgba(0,0,0,0.06)",
              borderRadius: 4,
              fontSize: 12,
            }}
          >
            node scripts/ax-runner.mjs --watch
          </code>
        </span>
      </div>
    );
  }

  return (
    <div className="faint" style={{ marginTop: 10, fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}>
      <Terminal size={13} strokeWidth={1.75} aria-hidden />
      러너 연결됨 · 마지막 응답 {ageLabel(sec)}
      {runner?.note ? ` · ${runner.note}` : ""}
    </div>
  );
}
