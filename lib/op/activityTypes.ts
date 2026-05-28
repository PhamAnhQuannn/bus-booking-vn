/**
 * Activity-feed event types — synthesized from existing tables (no new schema).
 *
 * Sources unioned in lib/op/getActivityFeed.ts:
 *   - Booking (paid, escalated)
 *   - Trip   (low-capacity within 24h, departed, completed, cancelled)
 *
 * `id` is synthetic — `<type>:<sourceId>:<unixMs>` — used as React key.
 */

export type ActivityEventType =
  | "booking.paid"
  | "booking.escalated"
  | "trip.low_capacity"
  | "trip.departed"
  | "trip.completed"
  | "trip.cancelled"

export type Severity = "info" | "success" | "warning" | "danger"

export interface ActivityEvent {
  id: string
  type: ActivityEventType
  ts: string // ISO 8601
  severity: Severity
  title: string
  body: string
  href?: string
}
