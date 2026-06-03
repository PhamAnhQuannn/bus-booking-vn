/**
 * /admin segment root layout (Issue 056 → Issue 064).
 *
 * Intentionally MINIMAL — a transparent pass-through. The authenticated console
 * chrome (sidebar + 7-tab nav) lives in the `(console)` route group's layout
 * (app/admin/(console)/layout.tsx); /admin/login sits OUTSIDE that group and so
 * renders bare (no console chrome), reachable via the middleware-guarded boundary.
 *
 * Deliberately does NOT import the public site chrome — the admin console is the
 * separate THIRD auth realm surface.
 */

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
