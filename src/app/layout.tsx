import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { getProductName } from "@/lib/product";

export async function generateMetadata(): Promise<Metadata> {
  const name = await getProductName();
  return {
    title: { default: name, template: `%s · ${name}` },
    description: "Seu negócio de beleza organizado, com a sua marca.",
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
