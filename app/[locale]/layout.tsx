import type { Metadata } from "next";
import { Be_Vietnam_Pro, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SessionBootstrap } from "@/components/auth/SessionBootstrap";
import { CookieConsent } from "@/components/CookieConsent";
import { ConsentedAnalytics } from "@/components/ConsentedAnalytics";
import { SITE_URL } from "@/lib/seo";

const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Default document title/description per-locale (i18n P2a). openGraph.locale
// declares the right language pair; per-page generateMetadata overrides title/
// description (and adds hreflang alternates) on indexable funnel pages.
const OG_LOCALE: Record<Locale, string> = { vi: "vi_VN", en: "en_US" };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const title = t("site.title");
  const description = t("site.description");
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      type: "website",
      locale: OG_LOCALE[locale as Locale] ?? OG_LOCALE.vi,
      siteName: "BBVN",
      url: "/",
      title,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  // Enable static rendering for the whole localized subtree.
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${beVietnam.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* AX-10: skip link — first focusable element, visually hidden until focused
            so keyboard users can jump past the header nav on every page (WCAG 2.4.1). */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-toast focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-e2 focus:outline-none focus:ring-3 focus:ring-ring/50"
        >
          {locale === "en" ? "Skip to main content" : "Bỏ qua tới nội dung chính"}
        </a>
        <NextIntlClientProvider messages={messages}>
          <SessionBootstrap />
          <SiteHeader />
          <div id="main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
            {children}
          </div>
          <SiteFooter />
          <CookieConsent />
        </NextIntlClientProvider>
        {/* Dev mode loads an external debug script (va.vercel-scripts.com) that our CSP blocks — prod-only. */}
        {process.env.NODE_ENV === "production" && <ConsentedAnalytics />}
      </body>
    </html>
  );
}
