import Link from "next/link";
import { listTocs, listCohorts, tocLabel } from "@/lib/ax";

export const dynamic = "force-dynamic";

export default async function AxHome() {
  const [tocs, cohorts] = await Promise.all([listTocs(), listCohorts()]);
  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1>항해일지 AX</h1>
          <p className="muted">2027 항해일지 · 수기 선별 → 탈고 → 원고 → export 워크플로우</p>
        </div>
        <Link className="btn" href="/ax/select" style={{ background: "var(--accent)", color: "#fff" }}>
          + 새 선별 시작
        </Link>
      </div>

      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="faint">목차</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{tocs.length}</div>
        </div>
        <div className="stat-card">
          <div className="faint">선별·편집 원고</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{tocs.reduce((a, t) => a + (t.ms_count ?? 0), 0)}</div>
        </div>
        <div className="stat-card">
          <div className="faint">수기 풀(기수)</div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>{cohorts.map((c) => `${c.cohort}기`).join(" · ") || "-"}</div>
        </div>
      </div>

      <div className="section-title">목차 목록</div>
      {tocs.length === 0 ? (
        <div className="empty">아직 만든 목차가 없습니다. “새 선별 시작”으로 첫 목차를 구성하세요.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>목차</th>
                <th>프로젝트 · 호차</th>
                <th>기수</th>
                <th>원고</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tocs.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{tocLabel(t)}</td>
                  <td className="muted">
                    {t.project} · {t.issue}
                  </td>
                  <td>{t.cohort ? `${t.cohort}기` : "-"}</td>
                  <td>
                    <span className="badge">{t.ms_count ?? 0}개</span>
                  </td>
                  <td>
                    <Link className="row-link" href={`/ax/toc/${t.id}`}>
                      원고 편집 →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
