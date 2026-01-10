-- Migration: Change regdep primary key from id to composite (regid, confcode, linenum)
-- This ensures one payment proof per participant per registration per conference

-- First, ensure confcode and linenum are NOT NULL (required for primary key)
DO $$
BEGIN
  -- Make confcode NOT NULL if it's currently nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'regdep'
    AND column_name = 'confcode'
    AND is_nullable = 'YES'
  ) THEN
    -- Update NULL confcode values (shouldn't happen, but handle it)
    UPDATE public.regdep SET confcode = (SELECT confcode FROM regh WHERE regh.regid = regdep.regid LIMIT 1) WHERE confcode IS NULL;
    -- Now make it NOT NULL
    ALTER TABLE public.regdep ALTER COLUMN confcode SET NOT NULL;
  END IF;

  -- Make linenum NOT NULL if it's currently nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'regdep'
    AND column_name = 'linenum'
    AND is_nullable = 'YES'
  ) THEN
    -- Set default linenum to 1 for existing NULL values
    UPDATE public.regdep SET linenum = 1 WHERE linenum IS NULL;
    -- Now make it NOT NULL
    ALTER TABLE public.regdep ALTER COLUMN linenum SET NOT NULL;
  END IF;
END $$;

-- Drop existing primary key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
    AND table_name = 'regdep'
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name = 'regdep_pkey'
  ) THEN
    ALTER TABLE public.regdep DROP CONSTRAINT regdep_pkey;
  END IF;
END $$;

-- Drop the id column if it exists (no longer needed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'regdep'
    AND column_name = 'id'
  ) THEN
    ALTER TABLE public.regdep DROP COLUMN id;
  END IF;
END $$;

-- Create composite primary key on (regid, confcode, linenum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
    AND table_name = 'regdep'
    AND constraint_type = 'PRIMARY KEY'
    AND constraint_name = 'regdep_pkey'
  ) THEN
    ALTER TABLE public.regdep
    ADD CONSTRAINT regdep_pkey PRIMARY KEY (regid, confcode, linenum);
  END IF;
END $$;

-- Update comments
COMMENT ON COLUMN public.regdep.regid IS 'Registration ID (part of composite primary key, foreign key to regh.regid)';
COMMENT ON COLUMN public.regdep.confcode IS 'Conference code (part of composite primary key)';
COMMENT ON COLUMN public.regdep.linenum IS 'Sequential line number for payment proof uploads (part of composite primary key). This is NOT tied to participant linenum - it represents the upload sequence (1, 2, 3, etc.). Maximum uploads allowed equals the number of participants in regd for the same regid and confcode.';

-- Ensure indexes are still in place (regid index is still useful)
CREATE INDEX IF NOT EXISTS idx_regdep_regid ON public.regdep (regid);
CREATE INDEX IF NOT EXISTS idx_regdep_confcode ON public.regdep (confcode);
CREATE INDEX IF NOT EXISTS idx_regdep_linenum ON public.regdep (linenum);
