import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Persona Talk - AI 언어 학습기",
  description: "AI 캐릭터와 함께하는 실시간 언어 학습 앱",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className="bg-slate-900 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
