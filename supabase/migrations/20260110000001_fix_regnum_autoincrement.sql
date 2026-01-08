-- Migration: Fix REGNUM to be auto-incrementing
-- This migration adds a sequence and sets REGNUM to auto-increment

-- Create sequence for REGNUM if it doesn't exist
CREATE SEQUENCE IF NOT EXISTS "regh_regnum_seq";

-- Set the default value for REGNUM to use the sequence
ALTER TABLE "regh" 
  ALTER COLUMN "regnum" SET DEFAULT nextval('regh_regnum_seq');

-- Set the sequence owner
ALTER SEQUENCE "regh_regnum_seq" OWNED BY "regh"."regnum";

-- If there are existing rows, set the sequence to start from the max REGNUM + 1
DO $$
DECLARE
  max_regnum INTEGER;
BEGIN
  SELECT COALESCE(MAX("regnum"), 0) INTO max_regnum FROM "regh";
  PERFORM setval('regh_regnum_seq', max_regnum + 1, false);
END $$;
