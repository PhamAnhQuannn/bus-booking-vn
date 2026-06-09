/**
 * TripServiceError — typed error for trip lifecycle operations (Issue 013).
 * Error codes sourced verbatim from AC (Issue 004 rule).
 */

export type TripErrorCode =
  | 'bus_in_maintenance'
  | 'capacity_too_small'
  | 'bus_deactivated'
  | 'bus_overlap'
  | 'bus_overlap_with_outbound'
  | 'already_cancelled'
  | 'trip_cancelled'
  | 'invalid_pickup_area'
  | 'not_found';

export interface TripServiceErrorMeta {
  required?: number;
  provided?: number;
}

export class TripServiceError extends Error {
  constructor(
    public readonly code: TripErrorCode,
    public readonly meta?: TripServiceErrorMeta
  ) {
    super(code);
    this.name = 'TripServiceError';
  }
}
