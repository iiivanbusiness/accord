import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accord",
  description: "Turn sales calls into signed contracts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
