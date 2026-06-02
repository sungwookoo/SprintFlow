import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SprintFlow",
  description: "로컬 단일 사용자용 Jira형 작업 및 일정관리 도구"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
