/** 역할·사용자 타입. next/headers에 의존하지 않아 클라이언트 컴포넌트에서도 import할 수 있다. */
export type Role = "관리자" | "편집자";

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  picture?: string;
}

export function isAdmin(user: { role: Role } | null | undefined): boolean {
  return user?.role === "관리자";
}

/** app_users 행 (관리자 화면·API 공용) */
export interface AppUserRow {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  is_active: number;
  last_login_at: string | null;
  created_at: string | null;
}
