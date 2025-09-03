import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "GitHub Workflows Dashboard",
  description: "View daily GitHub workflow results",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0D0D0D] font-sans antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
} 