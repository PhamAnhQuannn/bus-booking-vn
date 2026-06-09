'use client';

/**
 * AdminUnitPicker — cascading Tỉnh/Thành phố → Quận/Huyện → Phường/Xã selector
 * over the vendored VN admin dataset (`lib/geo/vnAdmin`). Controlled component.
 *
 * Used by: operator registration (province-only), the console pickup-area menu
 * (full ward depth), and the customer booking pickup step.
 *
 * base-ui Select is controlled via `onValueChange`, NOT `onChange`.
 */

import { useMemo } from 'react';
import { listProvinces, listDistricts, listWards, resolveLabel } from '@/lib/geo';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export interface AdminUnitValue {
  provinceCode?: string;
  districtCode?: string;
  wardCode?: string;
}

export interface AdminUnitPickerProps {
  value: AdminUnitValue;
  /** Fires on any level change. `label` is the full resolved label once the
   *  triple is complete (level='ward'), otherwise null. */
  onChange: (value: AdminUnitValue, label: string | null) => void;
  /** How deep the picker goes. Defaults to full ward depth. */
  level?: 'province' | 'district' | 'ward';
  disabled?: boolean;
  /** Prefix for field ids (a11y) — distinct when multiple pickers on a page. */
  idPrefix?: string;
}

export function AdminUnitPicker({
  value,
  onChange,
  level = 'ward',
  disabled,
  idPrefix = 'admin-unit',
}: AdminUnitPickerProps) {
  const provinces = useMemo(() => listProvinces(), []);
  const districts = useMemo(
    () => (value.provinceCode ? listDistricts(value.provinceCode) : []),
    [value.provinceCode]
  );
  const wards = useMemo(
    () => (value.districtCode ? listWards(value.districtCode) : []),
    [value.districtCode]
  );

  const wantsDistrict = level === 'district' || level === 'ward';
  const wantsWard = level === 'ward';

  function emit(next: AdminUnitValue) {
    const label =
      next.provinceCode && next.districtCode && next.wardCode
        ? resolveLabel({
            provinceCode: next.provinceCode,
            districtCode: next.districtCode,
            wardCode: next.wardCode,
          })
        : null;
    onChange(next, label);
  }

  function onProvince(code: string | null) {
    // changing province resets the deeper levels
    emit({ provinceCode: code ?? undefined });
  }
  function onDistrict(code: string | null) {
    emit({ provinceCode: value.provinceCode, districtCode: code ?? undefined });
  }
  function onWard(code: string | null) {
    emit({
      provinceCode: value.provinceCode,
      districtCode: value.districtCode,
      wardCode: code ?? undefined,
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor={`${idPrefix}-province`} className="mb-1">
          Tỉnh / Thành phố
        </Label>
        <Select value={value.provinceCode ?? ''} onValueChange={onProvince}>
          <SelectTrigger id={`${idPrefix}-province`} disabled={disabled}>
            <SelectValue placeholder="— Chọn tỉnh/thành —" />
          </SelectTrigger>
          <SelectContent>
            {provinces.map((p) => (
              <SelectItem key={p.code} value={p.code}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {wantsDistrict && (
        <div>
          <Label htmlFor={`${idPrefix}-district`} className="mb-1">
            Quận / Huyện
          </Label>
          <Select value={value.districtCode ?? ''} onValueChange={onDistrict}>
            <SelectTrigger id={`${idPrefix}-district`} disabled={disabled || !value.provinceCode}>
              <SelectValue placeholder="— Chọn quận/huyện —" />
            </SelectTrigger>
            <SelectContent>
              {districts.map((d) => (
                <SelectItem key={d.code} value={d.code}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {wantsWard && (
        <div>
          <Label htmlFor={`${idPrefix}-ward`} className="mb-1">
            Phường / Xã
          </Label>
          <Select value={value.wardCode ?? ''} onValueChange={onWard}>
            <SelectTrigger id={`${idPrefix}-ward`} disabled={disabled || !value.districtCode}>
              <SelectValue placeholder="— Chọn phường/xã —" />
            </SelectTrigger>
            <SelectContent>
              {wards.map((w) => (
                <SelectItem key={w.code} value={w.code}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
