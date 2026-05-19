'use client';

/**
 * /auth/forgot-password — UI only.
 * Password reset flow ships in Issue 008.
 */

export default function ForgotPasswordPage() {
  return (
    <main style={{ maxWidth: 400, margin: '80px auto', padding: '0 16px' }}>
      <h1>Quên mật khẩu</h1>
      <p>
        Tính năng đặt lại mật khẩu sẽ ra mắt trong phiên bản tiếp theo.
      </p>
      <p>
        <a href="/auth/login">Quay lại đăng nhập</a>
      </p>
    </main>
  );
}
