'use client';

/**
 * UpcomingFilter — route filter for /op/upcoming (Issue 014, story 55).
 *
 * Client island: base-ui Select navigates to ?routeId=… on change (server
 * component re-reads the filter from searchParams). base-ui Select uses
 * onValueChange, NOT onChange.
 */

import { useRouter } from 'next/navigation';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

export interface RouteOption {
  id: string;
  origin: string;
  destination: string;
}

interface Props {
  routes: RouteOption[];
  selected: string;
}

const ALL = '__all__';

export default function UpcomingFilter({ routes, selected }: Props) {
  const router = useRouter();

  function handleChange(value: string | null) {
    if (!value || value === ALL) {
      router.push('/op/upcoming');
    } else {
      router.push(`/op/upcoming?routeId=${encodeURIComponent(value)}`);
    }
  }

  return (
    <div className="mb-4 grid max-w-sm gap-1.5">
      <Label>Lọc theo tuyến</Label>
      <Select value={selected === '' ? ALL : selected} onValueChange={handleChange}>
        <SelectTrigger data-testid="upcoming-route-filter" className="min-w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>— Tất cả tuyến —</SelectItem>
          {routes.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.origin} → {r.destination}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
