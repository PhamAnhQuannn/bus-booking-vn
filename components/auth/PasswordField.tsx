'use client';

/**
 * Shared password field: Lock leading icon + input + eye-toggle. Extracted from the login page so the
 * customer login, register, forgot/reset, and operator login all share ONE implementation (#485/#486)
 * instead of copy-pasting the toggle block. The toggle is a 44px hit target (#488) and keeps the exact
 * aria-labels + aria-pressed contract the login RTL test asserts.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authFieldClass } from './authLinkClass';
import { cn } from '@/lib/utils';

type Props = {
  id: string;
  name: string;
  label?: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  /** Sets aria-invalid + wires aria-describedby to the error line. */
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  /**
   * #490: never leave the password revealed across a submit. When this value CHANGES the field
   * force-hides. Parents pass a value that flips on submit (e.g. the `loading` flag).
   */
  revealResetKey?: unknown;
};

export function PasswordField({
  id,
  name,
  label,
  placeholder,
  autoComplete = 'current-password',
  required,
  minLength,
  disabled,
  autoFocus,
  invalid,
  describedBy,
  className,
  revealResetKey,
}: Props) {
  const t = useTranslations('auth');
  const [show, setShow] = useState(false);
  // #490: force-hide when the parent bumps revealResetKey (e.g. across a submit). React's
  // "adjust state during render on a prop change" pattern — no effect, no cascading render.
  const [prevResetKey, setPrevResetKey] = useState(revealResetKey);
  if (revealResetKey !== prevResetKey) {
    setPrevResetKey(revealResetKey);
    setShow(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {label && <Label htmlFor={id}>{label}</Label>}
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={id}
          type={show ? 'text' : 'password'}
          name={name}
          required={required}
          minLength={minLength}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          placeholder={placeholder ?? t('field.passwordPlaceholder')}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(authFieldClass, 'pl-10 pr-12', className)}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? t('field.hidePassword') : t('field.showPassword')}
          aria-pressed={show}
          // #488: 44px tap target (was size-9 = 36px, below the AU-5 / WCAG 2.5.5 minimum).
          className="absolute right-0.5 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
