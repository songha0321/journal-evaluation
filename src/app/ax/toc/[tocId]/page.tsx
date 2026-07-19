import Link from "next/link";
import { notFound } from "next/navigation";
import { getToc, listManuscriptsByToc, tocLabel } from "@/lib/ax";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  selected: "선별됨",
  edited: "편집중",
  final: "확정",
};

export default async function TocPage({ params }: { params: Promise<{ tocId: string }> }) {
  const { tocId } = await params;
  const toc = await getToc(tocId);
  if (!toc) notFound();
  const mss = await listManuscriptsByToc(tocId);

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <p className="muted" style={{ margin: 0 }}>
            {toc.project} · {toc.issue}
          </p>
          <h1>{tocLabel(toc)}</h1>
          {toc.toc_content && <p className="muted">목차내용: {toc.toc_content}</p>}
          {toc.hanmadi && <p className="muted">한마디: {toc.hanmadi}</p>}
        </div>
        <a
          className="btn"
          href={`/api/ax/export/${toc.id}`}
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          ⬇ 목차 docx export
        </a>
      </div>

      <div className="section-title">선별 원고 {mss.length}개</div>
      {mss.length === 0 ? (
        <div className="empty">선별된 수기가 없습니다.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>소제목</th>
                <th>이름</th>
                <th>최종대학</th>
                <th>점수</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {mss.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.subtitle || <span className="faint">(미정)</span>}</td>
                  <td>{m.name}</td>
                  <td className="muted">{m.final_university || "-"}</td>
                  <td>
                    <span className="score-chip">{m.total_score ?? "-"}</span>
                  </td>
                  <td>
                    <span className="badge">{STATUS_LABEL[m.status] || m.status}</span>
                  </td>
                  <td>
                    <Link className="row-link" href={`/ax/edit/${m.id}`}>
                      편집 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 16 }}>
        <Link className="row-link" href="/ax">
          ← 목차 목록
        </Link>
      </p>
    </div>
  );
}
