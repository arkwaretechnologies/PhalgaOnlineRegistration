-- Migration: Create/Update regdep table for multiple payment proofs per registration
-- This table stores multiple payment proof files for each registration
-- 
-- NOTE: If you have an existing regdep table, this migration will:
-- 1. Add an 'id' column (UUID primary key) if it doesn't exist
-- 2. Add an 'uploaded_at' timestamp column if it doesn't exist
-- 3. Add a foreign key constraint if it doesn't exist
--
-- If the table doesn't exist, it will be created with all columns.

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.regdep (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regid TEXT NOT NULL,
  confcode TEXT NULL,
  payment_proof_url CHARACTER VARYING NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT regdep_regid_fkey FOREIGN KEY (regid) REFERENCES regh (regid) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Add id column if table exists but doesn't have it
DO $$
DECLARE
  has_id_column BOOLEAN;
  has_primary_key BOOLEAN;
BEGIN
  -- Check if table exists and if id column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'regdep' 
    AND column_name = 'id'
  ) INTO has_id_column;

  -- Check if table already has a primary key
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'regdep' 
    AND constraint_type = 'PRIMARY KEY'
  ) INTO has_primary_key;

  -- Only add id column if it doesn't exist
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'regdep'
  ) AND NOT has_id_column THEN
    -- Add id column
    ALTER TABLE public.regdep ADD COLUMN id UUID DEFAULT gen_random_uuid();
    -- Update existing rows to have unique IDs
    UPDATE public.regdep SET id = gen_random_uuid() WHERE id IS NULL;
    -- Make id NOT NULL
    ALTER TABLE public.regdep ALTER COLUMN id SET NOT NULL;
    -- Add primary key only if table doesn't already have one
    IF NOT has_primary_key THEN
      ALTER TABLE public.regdep ADD PRIMARY KEY (id);
    END IF;
  END IF;
END $$;

-- Add uploaded_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'regdep' 
    AND column_name = 'uploaded_at'
  ) THEN
    ALTER TABLE public.regdep 
    ADD COLUMN uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_schema = 'public' 
    AND table_name = 'regdep' 
    AND constraint_name = 'regdep_regid_fkey'
  ) THEN
    ALTER TABLE public.regdep 
    ADD CONSTRAINT regdep_regid_fkey 
    FOREIGN KEY (regid) REFERENCES regh (regid) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_regdep_regid ON public.regdep (regid);
CREATE INDEX IF NOT EXISTS idx_regdep_confcode ON public.regdep (confcode);
CREATE INDEX IF NOT EXISTS idx_regdep_uploaded_at ON public.regdep (uploaded_at);

-- Enable Row Level Security
ALTER TABLE public.regdep ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Create separate policies for each operation (following pattern from other tables)
-- These will be created/updated by the fix_regdep_rls migration
-- The fix migration will handle dropping and recreating policies properly

-- Add comments for documentation
COMMENT ON TABLE public.regdep IS 'Stores multiple payment proof files per registration';
COMMENT ON COLUMN public.regdep.id IS 'Unique identifier for each payment proof';
COMMENT ON COLUMN public.regdep.regid IS 'Registration ID (foreign key to regh.regid)';
COMMENT ON COLUMN public.regdep.confcode IS 'Conference code';
COMMENT ON COLUMN public.regdep.payment_proof_url IS 'URL to the payment proof file in Supabase Storage';
COMMENT ON COLUMN public.regdep.uploaded_at IS 'Timestamp when the payment proof was uploaded';
