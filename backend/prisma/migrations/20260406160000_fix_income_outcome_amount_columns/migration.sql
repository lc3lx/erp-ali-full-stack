-- Fix IncomeOutcomeEntry amount columns mismatch with Prisma model.
-- Existing DBs may still have legacy column "usdAmount" only.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'IncomeOutcomeEntry'
      AND column_name = 'usdAmount'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'IncomeOutcomeEntry'
      AND column_name = 'amountUsd'
  ) THEN
    EXECUTE 'ALTER TABLE "IncomeOutcomeEntry" RENAME COLUMN "usdAmount" TO "amountUsd"';
  END IF;
END $$;

ALTER TABLE "IncomeOutcomeEntry"
  ADD COLUMN IF NOT EXISTS "amountUsd" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "amountRmb" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "amountJineh" DECIMAL(18,4);
