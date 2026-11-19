import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DataGuard — Automated Data Quality & Observability Platform",
  description: "Enterprise data quality monitoring, automated anomaly detection, SLA tracking, and one-click data remediation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col bg-[#050505] text-zinc-100 selection:bg-[#B3FF4C]/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
