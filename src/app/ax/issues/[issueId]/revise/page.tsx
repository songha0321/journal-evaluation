import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { listTocsByIssue, tocLabel } from "@/lib/ax";
import { tocProgress, formatEditedAt } from "@/lib/ax-progress";
import { ProgressBar } from "@/components/ui/ProgressBar";

export const dynamic = "force-dynamic";

export default async function RevisePage({ params }: { params: Promise<{ issueId: string }> }) {
  const { issueId } = await params;
  const tocs = await listTocsByIssue(issueId);
  const pending = tocs.filter((t) => (t.ms_count ?? 0) === 0);

  return (
    <div className="page-body">
      {pending.length > 0 && (
        <div className="alert warn">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
          수기가 확정되지 않은 목차가 {pending.length}개 있습니다. [AI 수기 선별]에서 먼저 확정하세요.
        </div>
      )}

      {tocs.length === 0 ? (
        <div className="empty">목차가 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>목차</th>
                <th className="num">선별 원고</th>
                <th className="num">탈고</th>
                <th className="num">확정</th>
                <th style={{ width: 170 }}>진행률</th>
                <th>최종 편집 일시</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tocs.map((t) => {
                const p = tocProgress(t);
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{tocLabel(t)}</td>
                    <td className="num">{t.ms_count ?? 0}</td>
                    <td className="num">{t.composed_count ?? 0}</td>
                    <td className="num">{t.final_count ?? 0}</td>
                    <td>
                      <ProgressBar pct={p.pct} warn={p.needsReview > 0} />
                    </td>
                    <td className="muted">{formatEditedAt(t.last_edited_at)}</td>
                    <td>
                      <Link className="btn" href={`/ax/toc/${t.id}`}>
                        원고 작업
                        <ArrowRight size={14} strokeWidth={2} aria-hidden />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
