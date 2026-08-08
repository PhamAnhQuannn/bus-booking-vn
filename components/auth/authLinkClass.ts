/**
 * Shared affordance for inline text links on the auth pages: the 44px min tap
 * target (AU-5) + the AA-contrast strong colour token (AX-2), in one place so the
 * recipe can't drift across the four auth pages (review #8). Compose per-site
 * extras (e.g. `text-sm`, `font-medium`) after it.
 */
export const authLinkClass =
  'inline-flex min-h-11 w-fit items-center text-primary-strong underline-offset-4 hover:underline';

/**
 * Larger, white-surfaced field for the desktop auth forms (48px vs the app-wide 36px
 * `ui/input`; `bg-card` = pure white vs the default `bg-transparent`). The card was
 * removed from the auth pages, so the white input surface is now what separates the
 * controls from the warm page field — the same white-on-warm mechanism the design
 * system uses everywhere (globals.css). Auth-scoped only: the global Input default is
 * untouched, so settings/booking forms keep their compact transparent height.
 */
export const authFieldClass = 'h-12 bg-card text-base';
