import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { CookieConsent } from "@/components/CookieConsent";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/seo";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "Đặt vé xe khách | BBVN";
const SITE_DESC = "Tìm và đặt vé xe khách liên tỉnh trên toàn quốc.";

export const metadata: Metadata = {
  // Absolute base for canonical + OG/Twitter image resolution (app/opengraph-image).
  metadataBase: new URL(SITE_URL),
  // Per-page titles already carry the "| BBVN" suffix, so no title.template here
  // (a template would double the suffix). Pages set their own full title string.
  title: SITE_TITLE,
  description: SITE_DESC,
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "BBVN",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${beVietnam.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
        <CookieConsent />
        {/* Dev mode loads an external debug script (va.vercel-scripts.com) that our CSP blocks — prod-only. */}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  );
}
