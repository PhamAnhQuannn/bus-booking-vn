/**
 * Shared affordance for inline text links on the auth pages: the 44px min tap
 * target (AU-5) + the AA-contrast strong colour token (AX-2), in one place so the
 * recipe can't drift across the four auth pages (review #8). Compose per-site
 * extras (e.g. `text-sm`, `font-medium`) after it.
 */
export const authLinkClass =
  'inline-flex min-h-11 w-fit items-center text-primary-strong underline-offset-4 hover:underline';
