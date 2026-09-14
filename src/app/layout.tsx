import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "항해일지 AUTO",
  description: "수기 선별, 탈고, 원고 제작 자동화 시스템",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 시대인재 Design System — Pretendard (DESIGN.md 4.2 / 10.2) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
