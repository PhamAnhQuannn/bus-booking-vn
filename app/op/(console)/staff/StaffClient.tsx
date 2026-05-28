'use client';

/**
 * StaffClient — client island for operator staff management (Issue 017).
 *
 * All mutations go through lib/api/staffClient.ts (CSRF double-submit: X-CSRF-Token
 * on every non-GET; GET roster refresh sends none).
 *
 * UI surface (admin only):
 *   - List of staff (initialStaff from RSC; refresh after each mutation).
 *   - Create-staff form (POST /api/op/staff) → temp-password-sent confirmation.
 *   - Per-row Rename (PATCH /[id]).
 *   - Per-row Disable (POST /[id]/disable).
 *
 * Staff (non-admin) callers see the roster read-only — the API enforces adminOnly
 * (403) regardless; this just hides the controls (action-band gating via isAdmin).
 *
 * Design-system surface: Card create form (Label/Input), Table roster, Badge status,
 * Alert messages, Button actions. Every data-testid is preserved (sandbox-gated e2e
 * keys off them).
 */

import { useState } from 'react';
import {
  listStaffApi,
  createStaffApi,
  renameStaffApi,
  disableStaffApi,
} from '@/lib/api/staffClient';
import type { StaffDto } from '@/lib/staff/toStaffDto';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/op/ConfirmDialog';

interface Props {
  initialStaff: StaffDto[];
  isAdmin: boolean;
}

function translateError(code: string): string {
  switch (code) {
    case 'phone_in_use': return 'Số điện thoại đã được sử dụng';
    case 'not_found': return 'Không tìm thấy';
    case 'invalid_input': return 'Dữ liệu không hợp lệ';
    case 'invalid_body': return 'Dữ liệu không hợp lệ';
    default: return 'Đã xảy ra lỗi';
  }
}

function errorMessage(err: unknown): string {
  return translateError((err as { data?: { error?: string } }).data?.error ?? '');
}

export default function StaffClient({ initialStaff, isAdmin }: Props) {
  const [staff, setStaff] = useState<StaffDto[]>(initialStaff);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [isError, setIsError] = useState(false);
  // PR 4: ConfirmDialog replaces window.confirm for disabling staff.
  const [pendingDisable, setPendingDisable] = useState<string | null>(null);

  // Create-staff form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  function ok(text: string) {
    setMessage(text);
    setIsError(false);
  }
  function fail(err: unknown) {
    setMessage(errorMessage(err));
    setIsError(true);
  }

  async function refreshStaff() {
    const { staff: next } = await listStaffApi();
    setStaff(next ?? []);
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await createStaffApi({ name: newName, phone: newPhone });
      ok(`Đã tạo nhân viên. Mật khẩu tạm thời đã gửi qua SMS tới ${newPhone}.`);
      setNewName('');
      setNewPhone('');
      await refreshStaff();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(staffId: string, name: string) {
    setBusy(true);
    setMessage('');
    try {
      await renameStaffApi(staffId, name);
      ok('Đã cập nhật tên.');
      await refreshStaff();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable(staffId: string) {
    setBusy(true);
    setMessage('');
    try {
      await disableStaffApi(staffId);
      ok('Đã vô hiệu hoá nhân viên.');
      await refreshStaff();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <Alert variant={isError ? 'error' : 'success'} data-testid="staff-message">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Tạo nhân viên mới</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid max-w-md gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="new-staff-name">Tên nhân viên</Label>
                <Input
                  id="new-staff-name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  minLength={1}
                  maxLength={120}
                  data-testid="new-staff-name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="new-staff-phone">Số điện thoại</Label>
                <Input
                  id="new-staff-phone"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  required
                  data-testid="new-staff-phone"
                />
              </div>
              <div>
                <Button type="submit" disabled={busy} data-testid="create-staff-submit">
                  {busy ? 'Đang xử lý...' : 'Tạo nhân viên'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Danh sách nhân viên ({staff.length})</h2>
        {staff.length === 0 ? (
          <Card>
            <CardContent>
              <p className="py-6 text-center text-sm text-muted-foreground">Chưa có nhân viên nào.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden py-0">
            <Table data-testid="staff-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>SĐT</TableHead>
                  <TableHead>Chuyến gán</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  {isAdmin && <TableHead>Hành động</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((member) => (
                  <StaffRow
                    key={member.id}
                    member={member}
                    isAdmin={isAdmin}
                    onRename={(name) => handleRename(member.id, name)}
                    onDisable={() => setPendingDisable(member.id)}
                    disabled={busy}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={pendingDisable !== null}
        onClose={() => setPendingDisable(null)}
        onConfirm={async () => {
          const id = pendingDisable;
          setPendingDisable(null);
          if (id) await handleDisable(id);
        }}
        title="Vô hiệu hoá nhân viên?"
        description="Hành động không thể hoàn tác."
        consequences={[
          'Mọi phiên đăng nhập của nhân viên sẽ bị thu hồi.',
          'Tài khoản không thể đăng nhập lại.',
          'Lịch sử hoạt động được giữ nguyên.',
        ]}
        confirmLabel="Vô hiệu hoá"
        destructive
        busy={busy}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-row sub-component
// ---------------------------------------------------------------------------

interface RowProps {
  member: StaffDto;
  isAdmin: boolean;
  onRename: (name: string) => Promise<void>;
  onDisable: () => void;
  disabled: boolean;
}

function StaffRow({ member, isAdmin, onRename, onDisable, disabled }: RowProps) {
  const [editName, setEditName] = useState<string>(member.displayName);

  return (
    <TableRow data-testid={`staff-row-${member.id}`}>
      <TableCell>
        {isAdmin ? (
          <Input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={120}
            data-testid={`staff-name-${member.id}`}
            className="h-8"
          />
        ) : (
          <span data-testid={`staff-name-${member.id}`}>{member.displayName}</span>
        )}
      </TableCell>
      <TableCell data-testid={`staff-phone-${member.id}`}>{member.phone}</TableCell>
      <TableCell className="font-mono text-xs">{member.assignedTripId ?? '—'}</TableCell>
      <TableCell data-testid={`staff-status-${member.id}`}>
        <Badge variant={member.disabled ? 'danger' : 'success'}>
          {member.disabled ? 'Đã vô hiệu hoá' : 'Hoạt động'}
        </Badge>
      </TableCell>
      {isAdmin && (
        <TableCell>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRename(editName)}
              disabled={disabled || editName === member.displayName || editName.trim().length === 0}
              data-testid={`staff-rename-${member.id}`}
            >
              Lưu tên
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onDisable}
              disabled={disabled || member.disabled}
              data-testid={`staff-disable-${member.id}`}
            >
              Vô hiệu hoá
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
