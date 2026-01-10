-- Migration: Fix RLS policies for regdep table
-- This ensures proper policies are in place even if the table was created before

-- Drop existing policy if it exists (in case it's not working)
DROP POLICY IF EXISTS "Allow all access to regdep" ON public.regdep;

-- Create separate policies for each operation (following the pattern from other tables)
CREATE POLICY "Allow public read access on regdep" 
    ON public.regdep
    FOR SELECT
    TO public
    USING (true);

CREATE POLICY "Allow public insert on regdep" 
    ON public.regdep
    FOR INSERT
    TO public
    WITH CHECK (true);

CREATE POLICY "Allow public update on regdep" 
    ON public.regdep
    FOR UPDATE
    TO public
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete on regdep" 
    ON public.regdep
    FOR DELETE
    TO public
    USING (true);
