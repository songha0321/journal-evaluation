import type { Issue } from "@/lib/ax";

/**
 * 호차 표지 이미지. `public/covers/<연도>-<호차번호>.jpg` 규약.
 * 원본은 iCloud `2026 Design/2027 항해일지 N호차/*_표지_인쇄용*.pdf`의 앞표지(오른쪽 절반)를 150dpi로 잘라 1000px 높이 JPEG로 저장한 것.
 * 새 호차 표지가 나오면 같은 규약으로 파일을 추가하고 이 목록에 넣는다.
 */
/**
 * 출처 (archive/cover 별칭 → iCloud `2025 Designs/Archive (~2024)` 표지 PDF 앞표지 = 오른쪽 절반):
 *   2021-final, 2023-2, 2023-3, 2023-4, 2025-1, 2025-2
 * 출처 (iCloud `2026 Design/2027 항해일지 N호차` 인쇄용 표지 앞표지): 2027-1, 2027-2
 * 출처 (2026 2호차 컬러 인서트의 역대 표지 갤러리 썸네일, 저해상): 2023-1, 2023-final, 2025-3, 2026-1, 2026-2
 *   → 원본 표지 PDF가 생기면 같은 키로 교체. 2026 3~5호차는 아직 없음.
 */
const COVERS = new Set([
  "2021-final",
  "2023-1", "2023-2", "2023-3", "2023-4", "2023-final",
  "2025-1", "2025-2", "2025-3",
  "2026-1", "2026-2",
  "2027-1", "2027-2",
]);

export function coverKey(issue: Pick<Issue, "project" | "issue_label">): string | null {
  const year = issue.project.match(/(20\d{2})/)?.[1];
  if (!year) return null;
  if (/final/i.test(issue.issue_label)) return `${year}-final`;
  const no = issue.issue_label.match(/(\d+)/)?.[1];
  return no ? `${year}-${no}` : null;
}

export function coverUrl(issue: Pick<Issue, "project" | "issue_label">): string | null {
  const key = coverKey(issue);
  return key && COVERS.has(key) ? `/covers/${key}.jpg` : null;
}
