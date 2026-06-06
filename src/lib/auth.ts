// FR-001 (로그인/권한)은 1차에서 스텁입니다. 실제 인증 도입 전까지 고정 사용자 반환.
// TODO: replace with real auth (session/JWT) + role-based access to PII.

export type Role = "원고작업자" | "운영관리자" | "디자인검수자";

export interface CurrentUser {
  id: string;
  name: string;
  role: Role;
}

export function getCurrentUser(): CurrentUser {
  return { id: "stub-user", name: "편집국 작업자", role: "원고작업자" };
}
