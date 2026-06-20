import type { Metadata } from "next";

import { Providers } from "@/components/providers/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parchment",
  description: "A slow-mail correspondence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full font-body">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
