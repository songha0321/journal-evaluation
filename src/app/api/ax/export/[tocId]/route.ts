import { getToc, listManuscriptsByToc, tocLabel } from "@/lib/ax";
import { getDB } from "@/lib/db";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function underline(html: string, phrases: string[]): string {
  let out = html;
  for (const p of phrases) {
    if (!p || p.length < 2) continue;
    out = out.split(esc(p)).join(`<u>${esc(p)}</u>`);
  }
  return out;
}

/**
 * 목차별 원고를 Word로 열 수 있는 .doc(HTML)으로 export.
 * 모든 원고가 확정(status='final')된 뒤에만 다운로드할 수 있다 — PROCESS.md S5 → S6 순서.
 */
export async function GET(req: Request, ctx: { params: Promise<{ tocId: string }> }) {
  const { tocId } = await ctx.params;
  const toc = await getToc(tocId);
  if (!toc) return new Response("목차 없음", { status: 404 });

  const mss = await listManuscriptsByToc(tocId);
  if (mss.length === 0) return new Response("확정된 원고가 없습니다.", { status: 409 });

  const notFinal = mss.filter((m) => m.status !== "final").length;
  if (notFinal > 0) {
    return new Response(`아직 확정되지 않은 원고가 ${notFinal}건 있습니다. ‘원고 확정’ 후 다운로드하세요.`, {
      status: 409,
    });
  }

  const parts = mss.map((m) => {
    const body = m.edited_text?.trim() ? m.edited_text : (m.answer_text ?? "");
    let highlights: string[] = [];
    try {
      highlights = m.highlights_json ? (JSON.parse(m.highlights_json) as string[]) : [];
    } catch {
      highlights = [];
    }
    const bodyHtml = underline(esc(body).replace(/\n/g, "<br/>"), highlights);
    const uni = m.final_university && m.final_university !== "-" ? ` · ${esc(m.final_university)}` : "";
    return `
      <div style="margin:0 0 28pt 0;">
        <h2 style="font-size:15pt;margin:0 0 4pt;">${esc(m.subtitle || "(소제목 미정)")}</h2>
        <p style="color:#666;font-size:9pt;margin:0 0 8pt;">${esc(m.name || "")}${uni}</p>
        ${m.comment ? `<p style="font-style:italic;color:#444;border-left:3px solid #ccc;padding-left:10pt;margin:0 0 10pt;">${esc(m.comment)}</p>` : ""}
        <div style="font-size:11pt;line-height:1.7;">${bodyHtml}</div>
      </div>`;
  });

  const project = toc.project ?? "항해일지";
  const issueLabel = toc.issue_label ?? "";
  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>${esc(tocLabel(toc))}</title></head>
  <body style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;">
    <p style="color:#888;font-size:9pt;margin:0;">${esc(project)} · ${esc(issueLabel)}</p>
    <h1 style="font-size:19pt;margin:2pt 0 2pt;">${esc(tocLabel(toc))}</h1>
    ${toc.hanmadi ? `<p style="font-size:11pt;color:#333;margin:0 0 6pt;">${esc(toc.hanmadi)}</p>` : ""}
    <hr/>
    ${parts.join("\n")}
  </body></html>`;

  // S6 완료 기록 — 이 시각이 없으면 진행률이 EXPORT 단계에서 멈춘다.
  const db = await getDB();
  await db.prepare(`UPDATE ax_toc SET exported_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(tocId).run();

  const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const safeTitle = tocLabel(toc)
    .replace(/[^가-힣a-zA-Z0-9]+/g, "_")
    .slice(0, 40);
  const fname = `${project.replace(/\s+/g, "")}_${issueLabel}_${safeTitle}_v1_${today}.doc`;
  return new Response("﻿" + html, {
    headers: {
      "content-type": "application/msword; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
    },
  });
}
