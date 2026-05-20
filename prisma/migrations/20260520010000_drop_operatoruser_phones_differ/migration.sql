-- Drop OperatorUser_phones_differ (added in Issue 010).
--
-- The CHECK ("contactPhone" <> "notificationPhone") was wrong for OperatorUser:
-- an OperatorUser is one person provisioned from a single login phone, so
-- createStaff (Issue 017) and createOperator (Issue 020) seed contactPhone and
-- notificationPhone identically. The constraint rejected every provisioning
-- insert. Distinct contact vs notification phones only make sense on the
-- Operator (company) model, which is unaffected.
ALTER TABLE "OperatorUser" DROP CONSTRAINT IF EXISTS "OperatorUser_phones_differ";
