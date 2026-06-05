-- Issue 100: add 'refunded' terminal state for oversold-race refund path.
-- ISOLATED migration (ADD VALUE cannot share a transaction with DML that uses the new value).
-- Pattern from 20260602070000_notification_channel_email: ADD VALUE must be its own directory.
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'refunded';
