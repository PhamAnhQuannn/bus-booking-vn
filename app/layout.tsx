import type { ReactNode } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/seo";

// metadataBase lives at the root so it is inherited by EVERY surface — including the
// root-level metadata routes (opengraph-image, icons) that sit outside app/[locale].
// Per-locale title/description/openGraph are layered on in app/[locale]/layout.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
};

/**
 * Root passthrough layout.
 *
 * The real document shell — `<html lang={locale}>`, `<body>`, fonts, site chrome —
 * lives in `app/[locale]/layout.tsx` so the `lang` attribute can track the active
 * locale (vi → `lang="vi"`, en → `lang="en"`). A nested layout cannot change the
 * `<html>` its parent already rendered, so the root MUST NOT render `<html>`/`<body>`
 * here (that would nest under the locale layout's document and break hydration).
 *
 * This file still exists because root-level files (global-error, metadata routes,
 * a top-level not-found) require a layout ancestor. It only forwards children — the
 * documented next-intl setup for a per-locale root document. globals.css is imported
 * here so it also covers those root-level surfaces.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
