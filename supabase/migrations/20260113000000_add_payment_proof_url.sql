-- Migration: Add payment_proof_url column to REGH table
-- This stores the URL/path to the uploaded payment proof file

ALTER TABLE "regh" 
  ADD COLUMN IF NOT EXISTS "payment_proof_url" VARCHAR(500);

-- Add a comment to document the field
COMMENT ON COLUMN "regh"."payment_proof_url" IS 'URL to the uploaded proof of payment file (stored in Supabase Storage)';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_regh_payment_proof_url ON "regh"("payment_proof_url");
