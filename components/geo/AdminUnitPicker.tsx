'use client';

/**
 * AdminUnitPicker — cascading Tỉnh/Thành phố → Quận/Huyện → Phường/Xã selector
 * over the vendored VN admin dataset. Controlled component.
 *
 * Used by: operator registration (province-only), the console pickup-area menu
 * (full ward depth), and the customer booking pickup step.
 *
 * The ~690 KB dataset stays SERVER-side (lib/geo/vnAdmin); this client component
 * fetches each tier from GET /api/geo on demand so the tree never lands in the
 * operator-console bundle. The full label is composed client-side from the
 * fetched names (same order as the server's resolveLabel).
 *
 * base-ui Select is controlled via `onValueChange`, NOT `onChange`.
 */

import { useEffect, useState } from 'react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Unit {
  code: string;
  name: string;
}

// query=null → resolves [] (a cleared tier) without a request, and crucially
// keeps state updates async-only (no synchronous setState inside the effects).
async function loadUnits(query: string | null): Promise<Unit[]> {
  if (query === null) return [];
  try {
    const res = await fetch(`/api/geo${query}`);
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: Unit[] };
    return json.items ?? [];
  } catch {
    return [];
  }
}

const nameOf = (list: Unit[], code?: string): string | undefined =>
  code ? list.find((u) => u.code === code)?.name : undefined;

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
  const [provinces, setProvinces] = useState<Unit[]>([]);
  const [districts, setDistricts] = useState<Unit[]>([]);
  const [wards, setWards] = useState<Unit[]>([]);

  // Provinces load once on mount.
  useEffect(() => {
    let active = true;
    loadUnits('').then((u) => active && setProvinces(u));
    return () => {
      active = false;
    };
  }, []);

  // Districts (re)load whenever the selected province changes (cleared when none).
  useEffect(() => {
    let active = true;
    const q = value.provinceCode ? `?province=${encodeURIComponent(value.provinceCode)}` : null;
    loadUnits(q).then((u) => active && setDistricts(u));
    return () => {
      active = false;
    };
  }, [value.provinceCode]);

  // Wards (re)load whenever the selected district changes (cleared when none).
  useEffect(() => {
    let active = true;
    const q = value.districtCode ? `?district=${encodeURIComponent(value.districtCode)}` : null;
    loadUnits(q).then((u) => active && setWards(u));
    return () => {
      active = false;
    };
  }, [value.districtCode]);

  const wantsDistrict = level === 'district' || level === 'ward';
  const wantsWard = level === 'ward';

  function emit(next: AdminUnitValue) {
    // Compose the label from the fetched names (ward, district, province order —
    // matches the server's resolveLabel). Null until the triple is complete.
    let label: string | null = null;
    if (next.provinceCode && next.districtCode && next.wardCode) {
      const p = nameOf(provinces, next.provinceCode);
      const d = nameOf(districts, next.districtCode);
      const w = nameOf(wards, next.wardCode);
      label = p && d && w ? `${w}, ${d}, ${p}` : null;
    }
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
