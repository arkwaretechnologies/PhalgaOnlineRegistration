-- Migration: Add remarks column to REGH table
-- This stores remarks/notes about the registration

ALTER TABLE "regh" 
  ADD COLUMN IF NOT EXISTS "remarks" TEXT;

-- Add a comment to document the field
COMMENT ON COLUMN "regh"."remarks" IS 'Remarks or notes about the registration';
