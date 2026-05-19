/**
 * toStaffDto — map an OperatorUser row to the client-facing staff DTO.
 *
 * Whitelist = exactly the UI contract fields. Never leak passwordHash,
 * contactPhone, notificationPhone, or operatorId internals beyond what the
 * staff list/dialog renders.
 */

export interface StaffRow {
  id: string;
  displayName: string;
  phone: string;
  role: 'admin' | 'staff';
  requiresPasswordChange: boolean;
  disabledAt: Date | null;
  assignedTripId: string | null;
  createdAt: Date;
}

export interface StaffDto {
  id: string;
  displayName: string;
  phone: string;
  role: 'admin' | 'staff';
  requiresPasswordChange: boolean;
  disabled: boolean;
  assignedTripId: string | null;
  createdAt: string;
}

export function toStaffDto(row: StaffRow): StaffDto {
  return {
    id: row.id,
    displayName: row.displayName,
    phone: row.phone,
    role: row.role,
    requiresPasswordChange: row.requiresPasswordChange,
    disabled: row.disabledAt !== null,
    assignedTripId: row.assignedTripId,
    createdAt: row.createdAt.toISOString(),
  };
}
