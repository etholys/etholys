-- ATLAS: executedDate was stamped with "now" on create/import instead of the marked date.
-- Conservative: only rows where execution was stamped the same UTC day as createdAt
-- and the marked date is on or before create (not a future forecast paid today).
-- Does not delete, null, or change amounts/titles.

BEGIN;

CREATE TEMP TABLE atlas_executed_date_fix AS
SELECT id, "date", "executedDate", "createdAt"
FROM "Transaction"
WHERE "executionStatus" = 'EXECUTED'
  AND "executedDate" IS NOT NULL
  AND ("executedDate" AT TIME ZONE 'UTC')::date = ("createdAt" AT TIME ZONE 'UTC')::date
  AND ("date" AT TIME ZONE 'UTC')::date IS DISTINCT FROM ("executedDate" AT TIME ZONE 'UTC')::date
  AND ("date" AT TIME ZONE 'UTC')::date <= ("createdAt" AT TIME ZONE 'UTC')::date;

UPDATE "Transaction" t
SET "executedDate" = t."date"
FROM atlas_executed_date_fix f
WHERE t.id = f.id;

SELECT COUNT(*) AS fixed_rows FROM atlas_executed_date_fix;

COMMIT;
