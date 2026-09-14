import { TriangleAlert, Download } from "lucide-react";
import { StageBar } from "@/components/ax/StageBar";
import { Icon } from "@/components/ui/Icon";
import { DataTable } from "@/components/ui/DataTable";
import { listTocsByIssue, tocLabel } from "@/lib/ax";
import { tocProgress, formatEditedAt } from "@/lib/ax-progress";

export const dynamic = "force-dynamic";

export default async function RevisePage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const tocs = await listTocsByIssue(issueId);
  const pending = tocs.filter((t) => (t.ms_count ?? 0) === 0);
  const rows = tocs.map((t) => {
    const p = tocProgress(t);
    return {
      id: t.id,
      label: tocLabel(t),
      ms_count: t.ms_count ?? 0,
      composed_count: t.composed_count ?? 0,
      final_count: t.final_count ?? 0,
      pct: p.pct,
      pct_warn: p.needsReview > 0,
      last_edited_at: t.last_edited_at ?? null,
      edited: formatEditedAt(t.last_edited_at),
      go: "원고 작업",
      go_href: `/ax/toc/${t.id}`,
    };
  });

  const allFinal = tocs.length > 0 && tocs.every((t) => Boolean(t.finalized_at));
  const finalCount = tocs.reduce((s, t) => s + (t.final_count ?? 0), 0);
  const msCount = tocs.reduce((s, t) => s + (t.ms_count ?? 0), 0);

  return (
    <div className="page-body">
      <StageBar
        left={
          <span className="faint">
            목차 {tocs.length}개, 원고 확정 {finalCount}/{msCount}편
          </span>
        }
        right={
          allFinal && tocs.length === 1 ? (
            <a className="btn primary" href={`/api/ax/export/${tocs[0].id}`}>
              <Icon as={Download} />
              원고 EXPORT
            </a>
          ) : (
            <span
              className="btn primary"
              aria-disabled="true"
              style={{ opacity: 0.55, cursor: "not-allowed" }}
              title={allFinal ? "목차가 여러 개면 각 목차의 원고 작업 화면에서 내려받습니다." : "모든 목차의 원고를 확정하면 EXPORT할 수 있습니다."}
            >
              <Icon as={Download} />
              원고 EXPORT
            </span>
          )
        }
      />
      {pending.length > 0 && (
        <div className="alert warn">
          <Icon as={TriangleAlert} />
          수기가 확정되지 않은 목차가 {pending.length}개 있습니다. [AI 수기 선별]에서 먼저 확정하세요.
        </div>
      )}

      <DataTable
        rowKey="id"
        rows={rows}
        empty="목차가 없습니다."
        columns={[
          { key: "label", label: "목차", type: "strong" },
          { key: "ms_count", label: "선별 원고", type: "number", width: 90 },
          { key: "composed_count", label: "탈고", type: "number", width: 70 },
          { key: "final_count", label: "확정", type: "number", width: 70 },
          { key: "pct", label: "진행률", type: "progress", width: 200 },
          { key: "edited", label: "최종 편집 일시", type: "muted", sortKey: "last_edited_at", width: 150 },
          { key: "go", label: "", type: "btn-link", width: 120 },
        ]}
      />
    </div>
  );
}
