import { getToc, listManuscriptsByToc, assembleOriginal, tocLabel } from "@/lib/ax";

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

// 목차별 원고를 Word로 열 수 있는 .doc(HTML) 파일로 export.
export async function GET(_req: Request, ctx: { params: Promise<{ tocId: string }> }) {
  const { tocId } = await ctx.params;
  const toc = await getToc(tocId);
  if (!toc) return new Response("목차 없음", { status: 404 });
  const mss = await listManuscriptsByToc(tocId);

  const parts: string[] = [];
  for (const m of mss) {
    const body = m.edited_text && m.edited_text.trim() ? m.edited_text : await assembleOriginal(m.author_id);
    let highlights: string[] = [];
    try {
      highlights = m.highlights_json ? (JSON.parse(m.highlights_json) as string[]) : [];
    } catch {
      highlights = [];
    }
    const bodyHtml = underline(esc(body).replace(/\n/g, "<br/>"), highlights);
    const uni = m.final_university && m.final_university !== "-" ? ` · ${esc(m.final_university)}` : "";
    parts.push(`
      <div style="margin:0 0 28pt 0;">
        <h2 style="font-size:15pt;margin:0 0 4pt;">${esc(m.subtitle || "(소제목 미정)")}</h2>
        <p style="color:#666;font-size:9pt;margin:0 0 8pt;">${esc(m.name || "")}${uni}</p>
        ${m.comment ? `<p style="font-style:italic;color:#444;border-left:3px solid #ccc;padding-left:10pt;margin:0 0 10pt;">${esc(m.comment)}</p>` : ""}
        <div style="font-size:11pt;line-height:1.7;">${bodyHtml}</div>
      </div>`);
  }

  const html = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><title>${esc(tocLabel(toc))}</title></head>
  <body style="font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;">
    <p style="color:#888;font-size:9pt;margin:0;">${esc(toc.project)} · ${esc(toc.issue)}</p>
    <h1 style="font-size:19pt;margin:2pt 0 2pt;">${esc(tocLabel(toc))}</h1>
    ${toc.hanmadi ? `<p style="font-size:11pt;color:#333;margin:0 0 6pt;">${esc(toc.hanmadi)}</p>` : ""}
    <hr/>
    ${parts.join("\n") || "<p>선별된 수기가 없습니다.</p>"}
  </body></html>`;

  const today = toc.created_at?.slice(0, 10).replace(/-/g, "") || "date";
  const safeTitle = tocLabel(toc).replace(/[^가-힣a-zA-Z0-9]+/g, "_").slice(0, 40);
  const fname = `${toc.project.replace(/\s+/g, "")}_${toc.issue}_${safeTitle}_${today}.doc`;
  return new Response("﻿" + html, {
    headers: {
      "content-type": "application/msword; charset=utf-8",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
    },
  });
}
