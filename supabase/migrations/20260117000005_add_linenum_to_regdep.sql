-- Migration: Fix linenum column in regdep table to allow NULL
-- This allows payment proofs to be associated with specific participants (line numbers)
-- If column was manually added with NOT NULL, this will fix it

-- Step 1: Add linenum column if it doesn't exist (as nullable)
ALTER TABLE public.regdep 
ADD COLUMN IF NOT EXISTS linenum INTEGER NULL;

-- Step 2: If column exists with NOT NULL constraint, we need to:
--   a) Update any existing rows to have a value (if needed)
--   b) Drop the NOT NULL constraint
DO $$
BEGIN
  -- Check if column exists and has NOT NULL constraint
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'regdep' 
      AND column_name = 'linenum'
      AND is_nullable = 'NO'
  ) THEN
    -- Column exists with NOT NULL - first ensure all rows have a value (set to NULL)
    -- Note: This should work if we're setting NOT NULL values to NULL before dropping constraint
    -- Actually, we can't set NOT NULL values to NULL directly, so we need to:
    -- 1. Add a temporary default or update existing rows
    -- 2. Then drop NOT NULL
    
    -- Try to drop NOT NULL (if there are existing rows with NULL, this might fail)
    -- So we'll use a default value first if needed
    BEGIN
      ALTER TABLE public.regdep 
      ALTER COLUMN linenum DROP NOT NULL;
      
      RAISE NOTICE 'Dropped NOT NULL constraint on regdep.linenum';
    EXCEPTION
      WHEN OTHERS THEN
        -- If dropping NOT NULL fails (e.g., existing rows have NULL), set default first
        ALTER TABLE public.regdep 
        ALTER COLUMN linenum SET DEFAULT NULL;
        
        -- Update any existing rows that might have NULL (shouldn't happen if NOT NULL, but just in case)
        UPDATE public.regdep SET linenum = NULL WHERE linenum IS NULL;
        
        -- Now try to drop NOT NULL again
        ALTER TABLE public.regdep 
        ALTER COLUMN linenum DROP NOT NULL;
        
        -- Remove the default
        ALTER TABLE public.regdep 
        ALTER COLUMN linenum DROP DEFAULT;
        
        RAISE NOTICE 'Fixed NOT NULL constraint on regdep.linenum';
    END;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.regdep.linenum IS 'Line number of the participant (from regd table). NULL if payment proof is for the entire registration.';

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_regdep_linenum ON public.regdep (linenum);
