import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "OnniLens",
  description: "Real-time GitHub workflow monitoring and analytics platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0D0D0D] font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
} 