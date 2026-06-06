import type { QnaItem } from "@/types/entities";

export function QnaAnswerCard({ item }: { item: QnaItem }) {
  const answer = (item.answer_text ?? "").trim();
  return (
    <div className="qna-item">
      <div className="qna-q">
        {item.category ? <span className="cat">[{item.category}]</span> : null}
        {item.question_text}
      </div>
      {answer ? (
        <div className="qna-a">{answer}</div>
      ) : (
        <div className="qna-a empty-ans">(답변 없음)</div>
      )}
    </div>
  );
}
