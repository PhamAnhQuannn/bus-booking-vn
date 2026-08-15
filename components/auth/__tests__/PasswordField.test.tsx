import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PasswordField } from '../PasswordField';

afterEach(cleanup);

describe('PasswordField', () => {
  it('renders a hidden password input + a "show" toggle by default', () => {
    render(<PasswordField id="pw" name="pw" label="Mật khẩu" />);
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).type).toBe('password');
    expect(screen.getByRole('button', { name: 'Hiện mật khẩu' })).toBeTruthy();
  });

  it('toggle flips password↔text and updates aria-pressed/label', () => {
    render(<PasswordField id="pw" name="pw" label="Mật khẩu" />);
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).type).toBe('text');
    const hide = screen.getByRole('button', { name: 'Ẩn mật khẩu' });
    expect(hide.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(hide);
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).type).toBe('password');
  });

  it('re-hides when revealResetKey changes (#490 — never revealed across a submit)', () => {
    const { rerender } = render(
      <PasswordField id="pw" name="pw" label="Mật khẩu" revealResetKey={false} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).type).toBe('text');
    rerender(<PasswordField id="pw" name="pw" label="Mật khẩu" revealResetKey={true} />);
    expect((screen.getByLabelText('Mật khẩu') as HTMLInputElement).type).toBe('password');
  });
});
