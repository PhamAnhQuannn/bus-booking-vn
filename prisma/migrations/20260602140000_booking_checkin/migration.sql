-- Issue 073: operator boarding scan + single-use check-in + no-show.
-- checkedInAt: SET-ONCE via atomic conditional UPDATE (WHERE "checkedInAt" IS NULL).
-- noShowAt: paired with status='no_show' (Issue 014 verb-At+status rule); mutually
--           exclusive with checkedInAt (can't no-show an already-boarded passenger).
ALTER TABLE "Booking" ADD COLUMN "checkedInAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "noShowAt" TIMESTAMP(3);
