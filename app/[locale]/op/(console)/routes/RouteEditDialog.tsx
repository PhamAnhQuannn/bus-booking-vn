'use client';

/**
 * RouteEditDialog — modal for creating or editing a route (Issue 012).
 *
 * Built on the Dialog primitive (base-ui): focus trap, Esc-to-close, and
 * backdrop click are owned by the primitive. The parent mounts this only when
 * a dialog should be open, so we render with `open` forced true and surface
 * close (Esc / backdrop / Cancel) through onOpenChange → onClose.
 *
 * Props:
 *   mode="create" → empty form, title "Thêm tuyến mới"
 *   mode="edit"   → pre-filled from `route`, title "Sửa tuyến"
 *
 * onSave(origin, destination, durationMinutes) is called on valid submit.
 * onClose is called on cancel / Esc / backdrop.
 */

import { useState } from 'react';
import type { RouteItem } from './RoutesClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface CreateProps {
  mode: 'create';
  onSave: (origin: string, destination: string, durationMinutes: number) => Promise<void>;
  onClose: () => void;
  disabled: boolean;
}

interface EditProps {
  mode: 'edit';
  route: RouteItem;
  onSave: (origin: string, destination: string, durationMinutes: number) => Promise<void>;
  onClose: () => void;
  disabled: boolean;
}

type Props = CreateProps | EditProps;

export default function RouteEditDialog(props: Props) {
  const { mode, onSave, onClose, disabled } = props;
  const initial = mode === 'edit' ? props.route : null;

  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [durationMinutes, setDurationMinutes] = useState<number>(initial?.durationMinutes ?? 60);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await onSave(origin.trim(), destination.trim(), durationMinutes);
  }

  return (
    <Dialog
      open
      onOpenChange={(next: boolean) => {
        if (!next) onClose();
      }}
    >
      <DialogContent data-testid="route-edit-dialog">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Thêm tuyến mới' : 'Sửa tuyến'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="route-dialog-origin">Điểm đi</Label>
            <Input
              id="route-dialog-origin"
              type="text"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              required
              minLength={1}
              maxLength={120}
              disabled={disabled}
              data-testid="route-dialog-origin"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="route-dialog-destination">Điểm đến</Label>
            <Input
              id="route-dialog-destination"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              minLength={1}
              maxLength={120}
              disabled={disabled}
              data-testid="route-dialog-destination"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="route-dialog-duration">Thời gian (phút)</Label>
            <Input
              id="route-dialog-duration"
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10))}
              required
              min={1}
              max={7200}
              disabled={disabled}
              data-testid="route-dialog-duration"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={disabled}
              data-testid="route-dialog-cancel"
            >
              Huỷ
            </Button>
            <Button
              type="submit"
              disabled={disabled || !origin.trim() || !destination.trim()}
              data-testid="route-dialog-save"
            >
              {disabled ? 'Đang xử lý...' : mode === 'create' ? 'Tạo' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
