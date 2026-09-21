import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/**
 * Update `metadataBase` to your production domain before deploying.
 * Used to resolve canonical URLs and Open Graph images.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://example.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Baixar Foto do Instagram Online Grátis",
  description:
    "Baixe fotos públicas do Instagram em alta qualidade. Cole o link da publicação e faça o download da imagem de forma rápida e fácil.",
  keywords: [
    "baixar foto do instagram",
    "baixar fotos do instagram",
    "download de foto do instagram",
    "baixar imagem do instagram",
    "baixar foto instagram online",
    "baixar foto do instagram grátis",
    "downloader de fotos do instagram",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Baixar Foto do Instagram",
    title: "Baixar Foto do Instagram Online Grátis",
    description:
      "Baixe fotos públicas do Instagram em alta qualidade. Cole o link da publicação e faça o download da imagem de forma rápida e fácil.",
  },
  twitter: {
    card: "summary",
    title: "Baixar Foto do Instagram Online Grátis",
    description:
      "Baixe fotos públicas do Instagram em alta qualidade. Cole o link da publicação e faça o download da imagem de forma rápida e fácil.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
