import { Lock } from 'lucide-react';

/**
 * Shared "Bảo mật thông tin" reassurance footer for the auth pages (#485/#486). Extracted from the
 * login page so every auth surface shows the same security note.
 */
export function AuthSecurityFooter() {
  return (
    <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold text-foreground">Bảo mật thông tin</p>
        <p>Dữ liệu của bạn được mã hóa và bảo vệ.</p>
      </div>
    </div>
  );
}
