import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "研势 · A 股市场状态研判助手",
  description: "基于可追溯证据，理解市场状态、主要矛盾与状态切换条件。",
  icons: { icon: "/favicon.svg" },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
