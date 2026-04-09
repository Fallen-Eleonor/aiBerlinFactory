import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Startup OS - Start your company in 30 seconds",
  description: "Four AI agents work in parallel across legal, finance, hiring, and ops. No law firm. No tax advisor. Just results.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
