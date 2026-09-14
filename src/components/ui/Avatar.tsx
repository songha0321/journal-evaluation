/** 사용자 프로필 원형 28px. 사진이 없으면 이름 첫 글자를 wash 바탕에 표시한다. */
export function Avatar({ name, picture, size = 28 }: { name: string; picture?: string | null; size?: number }) {
  const initial = (name ?? "").trim().charAt(0) || "?";
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.43) }} aria-hidden>
      {picture ? <img src={picture} alt="" width={size} height={size} referrerPolicy="no-referrer" /> : initial}
    </span>
  );
}
