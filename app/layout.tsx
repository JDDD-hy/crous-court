import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LocaleProvider } from "@/lib/i18n/client";
import { getLocale, getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
  title: t("CROUS法庭"),
  description: t("Télécom Paris / Palaiseau 学生的 CROUS 菜品社区评级网站。"),
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html lang={locale === "en" ? "en" : "zh-CN"}>
      <body className="antialiased"><LocaleProvider locale={locale}>{children}</LocaleProvider></body>
    </html>
  );
}
