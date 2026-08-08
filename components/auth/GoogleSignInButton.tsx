'use client';

/**
 * "Đăng nhập với Google" — FD-012 §2A.4.
 *
 * Plain browser navigation to GET /api/auth/google/start (no fetch/CSRF — the OAuth
 * handshake is a top-level redirect). Renders ONLY when the public enable flag is on
 * (NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED); it mirrors the server-side GOOGLE_OAUTH_ENABLED
 * so the button never shows while the /start route is 404-gated. Both must be "true".
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const ENABLED = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true';

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5 shrink-0">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export function GoogleSignInButton({ returnTo }: { returnTo?: string }) {
  const [loading, setLoading] = useState(false);
  if (!ENABLED) return null;

  function go() {
    setLoading(true);
    const qs = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
    window.location.assign(`/api/auth/google/start${qs}`);
  }

  return (
    // Divider + button are ONE unit (alternate login) — grouped so they read as a pair,
    // not two independent siblings of the outer form column (proximity fix).
    <div className="flex flex-col gap-4">
      {/* AX-12: only the rule lines are decorative — the word "hoặc" must reach
          screen-readers as a real separator, so aria-hidden goes on the spans. */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span>hoặc</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="h-12 w-full gap-2 text-base"
        onClick={go}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          'Đang chuyển tới Google…'
        ) : (
          <>
            <GoogleGlyph />
            Đăng nhập với Google
          </>
        )}
      </Button>
    </div>
  );
}
