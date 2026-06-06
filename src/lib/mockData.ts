// 개발/오프라인용 mock 데이터. D1(워커 런타임)이 없는 환경에서 화면을 확인하려면
// `USE_MOCK_DB=1 npm run dev` 로 실행하면 이 데이터가 사용된다. 실제 PII 아님.
// 실 데이터는 실 D1 바인딩(배포/preview)에서 그대로 조회된다.

export const USE_MOCK = process.env.USE_MOCK_DB === "1";

import type { Author, QnaItem, Evaluation, EssayRow, Article } from "@/types/entities";
import type { CohortCount, CohortFee, StatusCount, Totals } from "@/lib/queries/dashboard";
import type { EvaluationRow } from "@/lib/queries/evaluations";
import type { ArticleListRow } from "@/lib/queries/articles";

export const mockTotals: Totals = {
  authors: 429,
  submissions: 442,
  qna: 10913,
  evaluations: 564,
  articles: 0,
};

export const mockCohortCounts: CohortCount[] = [
  { cohort: 5, authors: 88, qna: 1438, evaluations: 65 },
  { cohort: 6, authors: 81, qna: 1446, evaluations: 81 },
  { cohort: 7, authors: 99, qna: 1974, evaluations: 99 },
  { cohort: 8, authors: 69, qna: 2343, evaluations: 137 },
  { cohort: 9, authors: 92, qna: 3712, evaluations: 182 },
];

export const mockCohortFees: CohortFee[] = [
  { cohort: 5, total_fee: 11700000, fee_authors: 65 },
  { cohort: 7, total_fee: 13300000, fee_authors: 84 },
  { cohort: 8, total_fee: 8570000, fee_authors: 67 },
  { cohort: 9, total_fee: 17790000, fee_authors: 86 },
];

export const mockSubmissionRollup: StatusCount[] = [
  { label: "received", n: 372 },
  { label: "selected", n: 41 },
  { label: "reviewing", n: 22 },
  { label: "rejected", n: 7 },
];

export const mockArticleRollup: StatusCount[] = [];

export const mockAiSuspicionRollup: StatusCount[] = [];

const UNIS = ["설의", "연의", "가의", "고의", "성의", "한양의"];
export const mockEssays: EssayRow[] = Array.from({ length: 24 }, (_, i) => {
  const cohort = [9, 9, 8, 7, 6, 5][i % 6];
  const score = [100, 80, 80, 60, 60, 40, 20][i % 7];
  return {
    id: `mock-a-${i}`,
    name: `작성자${cohort}${String(i).padStart(2, "0")}`,
    cohort,
    student_type: i % 7 === 0 ? "성적향상" : "성적우수",
    final_university: UNIS[i % UNIS.length],
    ai_evaluation_grade: null,
    manual_rating: null,
    submission_status: (["received", "selected", "reviewing"] as const)[i % 3],
    file_url: "https://example.com/file",
    qna_count: 18 + (i % 6),
    total_score: score,
    specificity_score: Math.round(score / 20) * 2,
    authenticity_score: Math.round(score / 20) * 2,
    narrative_score: Math.round(score / 20) * 2,
    usefulness_score: Math.round(score / 20) * 2,
    ai_suspicion_level: i % 9 === 0 ? "medium" : null,
    scholarship_amount: [250000, 220000, 190000, 150000, 130000, 100000][i % 6],
  };
});

export const mockAuthor: Author = {
  id: "mock-a-0",
  name: "작성자900",
  cohort: 9,
  student_type: "성적우수",
  hall: "W관",
  class_name: "S",
  admission_score: null,
  final_university: "설의",
  ai_evaluation_grade: null,
  manual_rating: null,
  memo: null,
  phone: null,
  sex: "남",
  birthdate: "2003-04-11",
  korean_subject: null,
  math_subject: null,
  sci1_subject: "지1",
  sci2_subject: "생2",
};

export const mockQna: QnaItem[] = [
  { question_id: "q1", question_text: "[1-2] 1년 공부몰입도에 대한 설명을 작성해주세요.", category: "그래프", sort_order: 1, answer_text: "1년간 큰 기복 없이 꾸준한 습관을 유지했습니다. (mock 데이터)" },
  { question_id: "q2", question_text: "[2-1] 수험 생활 중 특히 좌절했던 때는 언제인가요?", category: "감정", sort_order: 2, answer_text: "6월 모의평가 직후 점수가 떨어져 좌절했지만 루틴을 재점검했습니다. (mock)" },
  { question_id: "q3", question_text: "[4-1] 강점 과목과 유지 방법은?", category: "과목", sort_order: 3, answer_text: "수학이 강점이었고 매일 고난도 문항 세트를 정해진 시간에 풀었습니다. (mock)" },
];

export const mockEvaluationsForAuthor: Evaluation[] = [
  {
    id: "mock-e-0", author_id: "mock-a-0", submission_id: "mock-s-0", evaluator_type: "manual",
    total_score: 80, specificity_score: 8, authenticity_score: 8, narrative_score: 8, usefulness_score: 8,
    ai_suspicion_level: null, ai_suspicion_reason: null, evaluation_summary: "구체적이고 활용도 높음 (mock)",
    evidence: "평가자2", scholarship_amount: 220000, created_at: "2026-05-21",
  },
];

export const mockEvaluationRows: EvaluationRow[] = mockEssays.map((e, i) => ({
  evaluation_id: `mock-e-${i}`,
  author_id: e.id,
  name: e.name,
  cohort: e.cohort,
  student_type: e.student_type,
  final_university: e.final_university,
  total_score: e.total_score,
  specificity_score: e.specificity_score,
  authenticity_score: e.authenticity_score,
  narrative_score: e.narrative_score,
  usefulness_score: e.usefulness_score,
  ai_suspicion_level: e.ai_suspicion_level,
  evaluation_summary: "평가 요약 예시입니다. (mock)",
  scholarship_amount: e.scholarship_amount,
}));

export const mockArticleList: ArticleListRow[] = mockEssays
  .filter((e) => (e.total_score ?? 0) >= 80)
  .map((e) => ({
    id: null as unknown as string,
    author_id: e.id,
    name: e.name,
    cohort: e.cohort,
    title: null,
    article_status: "draft",
    editor_name: null,
    updated_at: null,
  }));

export function mockArticleByAuthor(_authorId: string): Article | null {
  return null;
}
