import Link from "next/link";
import { ArrowRight, Terminal, TriangleAlert } from "lucide-react";
import { Icon } from "@/components/ui/Icon";
import { DataTable } from "@/components/ui/DataTable";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { listIssues, listAllTocs, listRecentManuscripts, getRunnerState, runnerAgeSec, RUNNER_STALE_SEC, tocLabel, type Toc } from "@/lib/ax";
import { issueProgress, issueFunnel, issueStages, tocProgress, formatEditedAt, GNB_TABS } from "@/lib/ax-progress";
import { getCohortReadiness } from "@/lib/queries/data";
import { listPublishedIssues } from "@/lib/queries/published";
import { cohortLabel } from "@/lib/format";
import { cookies } from "next/headers";
import { parseSettingsCookie, SETTINGS_KEY } from "@/lib/settings";

export const dynamic = "force-dynamic";

const MS_STATUS: Record<string, { label: string; tone: string }> = {
  confirmed: { label: "확정 수기", tone: "gray" },
  edited: { label: "탈고됨", tone: "blue" },
  final: { label: "원고 확정", tone: "green" },
};

function ageLabel(sec: number | null): string {
  if (sec == null) return "신호 없음";
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

export default async function ManuscriptDashboard() {
  const [issues, allTocs, recent, runner, readiness, published] = await Promise.all([
    listIssues("editing"),
    listAllTocs(),
    listRecentManuscripts(10),
    getRunnerState(),
    getCohortReadiness(),
    listPublishedIssues(),
  ]);
  const editingIds = new Set(issues.map((i) => i.id));
  const byIssue = new Map<string, Toc[]>();
  for (const t of allTocs) {
    if (!editingIds.has(t.issue_id)) continue;
    byIssue.set(t.issue_id, [...(byIssue.get(t.issue_id) ?? []), t]);
  }
  const editingTocs = [...byIssue.values()].flat();

  /* ── KPI ── */
  const funnel = issueFunnel(editingTocs);
  const overall = issueProgress(editingTocs);
  const needsReview = editingTocs.reduce((s, t) => s + (t.needs_review_count ?? 0), 0);

  /* ── 할 일 ── */
  const awaitingPick = editingTocs.filter((t) => t.shortlisted_at && (t.ms_count ?? 0) < t.select_count);
  const awaitingRevise = editingTocs.reduce((s, t) => s + Math.max(0, (t.ms_count ?? 0) - (t.composed_count ?? 0)), 0);
  const awaitingFinal = editingTocs.reduce((s, t) => s + Math.max(0, (t.composed_count ?? 0) - (t.final_count ?? 0)), 0);
  const exportable = editingTocs.filter((t) => t.finalized_at && !t.exported_at);
  const todos = [
    awaitingPick.length > 0 && {
      label: "편집자 확정 대기 목차",
      n: awaitingPick.length,
      href: `/ax/issues/${awaitingPick[0].issue_id}/ai-select`,
      tone: "info",
    },
    needsReview > 0 && { label: "검수 필요 원고", n: needsReview, href: `/ax/issues/${issues[0]?.id}/revise`, tone: "warn" },
    awaitingRevise > 0 && { label: "탈고 대기 원고", n: awaitingRevise, href: `/ax/issues/${issues[0]?.id}/revise`, tone: "" },
    awaitingFinal > 0 && { label: "원고 확정 대기", n: awaitingFinal, href: `/ax/issues/${issues[0]?.id}/revise`, tone: "" },
    exportable.length > 0 && { label: "EXPORT 가능 목차", n: exportable.length, href: `/ax/toc/${exportable[0].id}`, tone: "ok" },
  ].filter(Boolean) as { label: string; n: number; href: string; tone: string }[];

  /* ── 러너 ── */
  const staleSec = parseSettingsCookie((await cookies()).get(SETTINGS_KEY)?.value).runnerStaleMin * 60 || RUNNER_STALE_SEC;
  const age = runnerAgeSec(runner?.last_seen_at);
  const runnerAlive = age != null && age <= staleSec;

  /* ── 최근 편집 원고 표 ── */
  const recentRows = recent.map((m) => ({
    ...m,
    subtitle_text: m.subtitle?.trim() || "(소제목 미입력)",
    subtitle_text_href: `/ax/toc/${m.toc_id}/${m.id}`,
    toc: `${m.issue_label} ${tocLabel(m)}`,
    status_label: MS_STATUS[m.status]?.label ?? m.status,
    review: m.needs_review ? "검수 필요" : "",
    edited: formatEditedAt(m.updated_at),
  }));

  const pubArticles = published.reduce((s, p) => s + p.article_count, 0);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>원고 대시보드</h1>
          <p className="desc">편집 중인 항해일지의 제작 현황과 오늘 할 일</p>
        </div>
      </div>

      <div className="page-body">
        <div className="dash-grid">
          {/* ── 왼쪽 ── */}
          <div className="dash-main">
            {/* KPI — 왼쪽 컬럼 맨 위 */}
            <section>
            <div className="stat-grid kpi">
          <div className="stat-card">
            <div className="label">편집 중 호차</div>
            <div className="value">{issues.length}</div>
            <div className="sub">{issues.map((i) => `${i.project} ${i.issue_label}`).join(", ") || "없음"}</div>
          </div>
          <div className="stat-card">
            <div className="label">전체 제작 진행률</div>
            <div className="value">{overall.pct}%</div>
            <div className="sub">목차 {editingTocs.length}개 기준</div>
          </div>
          <div className="stat-card">
            <div className="label">확정 수기 / 원고 확정</div>
            <div className="value">
              {funnel.confirmed} <span className="faint" style={{ fontSize: 16, fontWeight: 500 }}>/ {funnel.finalized}편</span>
            </div>
            <div className="sub">탈고 완료 {funnel.revised}편</div>
          </div>
          <div className="stat-card">
            <div className="label">검수 필요</div>
            <div className="value" style={needsReview ? { color: "var(--amber)" } : undefined}>{needsReview}</div>
            <div className="sub">확정 전에 확인할 원고</div>
          </div>
        </div>

            </section>

            <section>
            <div className="section-title">호차별 진행</div>
            {issues.length === 0 ? (
              <div className="empty">편집 중인 항해일지가 없습니다.</div>
            ) : (
              <div className="issue-grid">
                {issues.map((issue) => {
                  const tocs = byIssue.get(issue.id) ?? [];
                  const prog = issueProgress(tocs);
                  const stages = issueStages(tocs);
                  const currentIdx = stages.findIndex((s) => !s.done);
                  return (
                    <div key={issue.id} className="issue-card">
                      <div className="ic-head">
                        <div>
                          <div className="ic-project">{issue.project}</div>
                          <h3>{issue.issue_label}</h3>
                        </div>
                        <Link className="btn" href={`/ax/issues/${issue.id}`}>
                          이동하기
                          <Icon as={ArrowRight} />
                        </Link>
                      </div>
                      <div>
                        <div className="faint" style={{ fontSize: 12, marginBottom: 5 }}>제작 진행률</div>
                        <ProgressBar pct={prog.pct} warn={prog.needsReview > 0} />
                      </div>
                      {/* 3단계 막대 */}
                      <div className="stage-bars">
                        {GNB_TABS.map((g, gi) => {
                          const members = g.stages.map((k) => stages.find((s) => s.key === k)!).filter(Boolean);
                          const ratio = members.length ? members.reduce((s, m) => s + m.ratio, 0) / members.length : 0;
                          const done = members.every((m) => m.done);
                          const cur = members.some((m) => stages.indexOf(m) === currentIdx);
                          return (
                            <Link key={g.slug} href={`/ax/issues/${issue.id}/${g.slug}`} className={`stage-bar-item ${done ? "done" : cur ? "current" : ""}`}>
                              <span className="sbi-label">
                                {gi + 1} {g.label}
                              </span>
                              <span className="sbi-track">
                                <i style={{ width: `${Math.round(ratio * 100)}%` }} />
                              </span>
                              <span className="sbi-pct">{Math.round(ratio * 100)}%</span>
                            </Link>
                          );
                        })}
                      </div>
                      {tocs.length > 0 && (
                        <div className="ic-toc">
                          {tocs.map((t) => {
                            const p = tocProgress(t);
                            return (
                              <Link key={t.id} href={`/ax/toc/${t.id}`} className="ic-toc-row">
                                <span className="t">{tocLabel(t)}</span>
                                <span className="faint" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                                  {p.current ? `${p.current.label} (${p.current.actor})` : "완료"}
                                </span>
                                <span style={{ width: 76, flexShrink: 0 }}>
                                  <ProgressBar pct={p.pct} warn={p.needsReview > 0} showPct={false} />
                                </span>
                                <span className="faint" style={{ fontSize: 11, width: 30, textAlign: "right", flexShrink: 0 }}>
                                  {p.pct}%
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            </section>

            <section>
            <div className="section-title">최근 편집 원고</div>
            <DataTable
              rowKey="id"
              rows={recentRows}
              empty="아직 편집한 원고가 없습니다."
              columns={[
                { key: "subtitle_text", label: "소제목", type: "link", flex: true },
                { key: "name", label: "학생", width: 90 },
                { key: "toc", label: "목차", type: "clip", maxWidth: 240 },
                { key: "status_label", label: "상태", width: 90 },
                { key: "review", label: "검수", type: "muted", width: 80 },
                { key: "edited", label: "수정 일시", type: "muted", sortKey: "updated_at", width: 140 },
              ]}
              defaultSort={{ key: "edited", dir: "desc" }}
            />
            </section>
          </div>

          {/* ── 오른쪽 ── */}
          <aside className="dash-side">
            <section>
              <div className="section-title">할 일</div>
              {todos.length === 0 ? (
                <p className="faint" style={{ fontSize: 13 }}>지금 처리할 일이 없습니다.</p>
              ) : (
                <ul className="todo-list">
                  {todos.map((t) => (
                    <li key={t.label} className={t.tone}>
                      <Link href={t.href}>
                        <span className={`todo-n ${t.n >= 100 ? "wide" : ""}`}>{t.n}</span>
                        <span className="todo-label">{t.label}</span>
                        <Icon as={ArrowRight} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <div className="section-title">AI 러너</div>
              <div className={`runner-card ${runnerAlive ? "alive" : "dead"}`}>
                <div className="rc-head">
                  <Icon as={runnerAlive ? Terminal : TriangleAlert} />
                  <b>{runnerAlive ? "실행 중" : "꺼짐"}</b>
                  <span className="faint">{ageLabel(age)}</span>
                </div>
                <div className="rc-body">
                  <div>
                    <span className="faint">상태</span> {runner?.status ?? "-"}
                  </div>
                  <div>
                    <span className="faint">메모</span> {runner?.note ?? "-"}
                  </div>
                  {!runnerAlive && (
                    <p className="rc-hint">
                      AI 선별과 탈고는 로컬 러너가 처리합니다. 실행 명령: <code>node scripts/ax-runner.mjs</code>
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section>
              <div className="section-title">
                데이터 준비 현황
                <Link href="/data" className="tbl-link" style={{ marginLeft: "auto", fontWeight: 500 }}>
                  데이터 대시보드
                </Link>
              </div>
              <ul className="mini-bars">
                {readiness.map((r) => {
                  const pct = r.authors ? Math.round((r.evaluated / r.authors) * 100) : 0;
                  return (
                    <li key={r.cohort}>
                      <span className="mb-label">{cohortLabel(r.cohort)}</span>
                      <span className="mb-track">
                        <i style={{ width: `${pct}%` }} />
                      </span>
                      <span className="mb-val">
                        {r.evaluated}/{r.authors}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <div className="section-title">발행</div>
              <p className="pub-summary">
                역대 발행 호차 <b>{published.length}</b>개, 게재 원고 <b>{pubArticles.toLocaleString("ko-KR")}</b>편
                <Link href="/ax/published" className="tbl-link" style={{ marginLeft: 8 }}>
                  편집 완료 항해일지
                </Link>
              </p>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
