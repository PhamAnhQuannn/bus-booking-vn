/**
 * Admin segment shell layout (Issue 056).
 *
 * Minimal server-component wrapper for the THIRD auth realm (/admin). Deliberately
 * does NOT import the public site chrome (header/footer/nav) — the admin console is
 * a separate surface, reachable only via the middleware-guarded /admin login boundary.
 * Full admin pages (dashboard, finance, support tooling) land in Wave 3; this shell
 * exists now so the segment + middleware guard can be wired and tested.
 */

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-xl font-semibold">Admin</h1>
        {children}
      </main>
    </div>
  );
}
