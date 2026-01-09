-- Migration: Set up Supabase Storage bucket and RLS policies for payment proofs
-- This creates the storage bucket and allows public uploads/reads

-- Create the storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true, -- Public bucket for easy access
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to payment-proofs bucket
CREATE POLICY IF NOT EXISTS "Allow public uploads to payment-proofs"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'payment-proofs');

-- Allow public reads from payment-proofs bucket
CREATE POLICY IF NOT EXISTS "Allow public reads from payment-proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-proofs');

-- Allow public updates (for replacing files)
CREATE POLICY IF NOT EXISTS "Allow public updates to payment-proofs"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'payment-proofs')
WITH CHECK (bucket_id = 'payment-proofs');

-- Allow public deletes (for cleanup if needed)
CREATE POLICY IF NOT EXISTS "Allow public deletes from payment-proofs"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'payment-proofs');
