'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';

/**
 * 6-digit OTP field (A3 / AU-2). Strips every non-digit on input and paste, so a
 * pasted "123-456" / "123 456" lands as "123456" instead of silently failing the
 * numeric pattern. It's a real named <input>, so a parent <form>'s FormData still
 * reads its value.
 *
 * `maxLength` is deliberately NOT set on the DOM node: the browser would truncate
 * a pasted "123-456" to 6 raw chars ("123-45") BEFORE onChange runs, losing a
 * digit. The 6-digit cap is enforced in JS after stripping instead.
 */
export function OtpCodeInput({
  name = 'code',
  ...props
}: Omit<
  React.ComponentProps<typeof Input>,
  'type' | 'inputMode' | 'autoComplete' | 'pattern' | 'maxLength' | 'value' | 'onChange'
>) {
  const [value, setValue] = React.useState('');
  return (
    <Input
      name={name}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
      {...props}
    />
  );
}
