import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrintERP",
  description: "3D 打印商家经营管理系统"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
