import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/shell/site-header";
import { SiteFooter, PrintFooter } from "@/components/shell/site-footer";

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  axes: ["opsz"],
  display: "swap",
});
const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-plex-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "FSFSI: Food System Financing Stress Index", template: "%s · FSFSI" },
  description:
    "The Food System Financing Stress Index joins an executed budget, line by line, to food-system outcome indicators and measures the part of each gap that spending leaves unfinanced.",
};

export const viewport: Viewport = {
  themeColor: "#0F3D33",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 bg-white px-3 py-2 font-medium text-evergreen focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        <Providers>
          <SiteHeader />
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
          <SiteFooter />
          <PrintFooter />
        </Providers>
      </body>
    </html>
  );
}
