-- Migration: Create conference table for domain-based conference segregation
-- This table stores conference information and maps domains to specific conferences

CREATE TABLE IF NOT EXISTS public.conference (
  confcode text NOT NULL,
  name text NULL,
  date_from date NULL,
  date_to date NULL,
  venue text NULL,
  reg_limit bigint NULL,
  domain text NULL,
  CONSTRAINT conference_pkey PRIMARY KEY (confcode)
) TABLESPACE pg_default;

-- Create index on domain for faster lookups
CREATE INDEX IF NOT EXISTS idx_conference_domain ON public.conference(domain);

-- Create index on confcode (already primary key, but explicit index for clarity)
CREATE INDEX IF NOT EXISTS idx_conference_confcode ON public.conference(confcode);

-- Add comments for documentation
COMMENT ON TABLE public.conference IS 'Stores conference information and maps domains to specific conference codes';
COMMENT ON COLUMN public.conference.confcode IS 'Unique conference code (primary key)';
COMMENT ON COLUMN public.conference.name IS 'Conference name (e.g., "18th Mindanao Geographic Conference")';
COMMENT ON COLUMN public.conference.date_from IS 'Conference start date';
COMMENT ON COLUMN public.conference.date_to IS 'Conference end date';
COMMENT ON COLUMN public.conference.venue IS 'Conference venue location';
COMMENT ON COLUMN public.conference.reg_limit IS 'Registration limit for this conference (overrides config table REGISTRATION_LIMIT)';
COMMENT ON COLUMN public.conference.domain IS 'Domain/hostname that maps to this conference (e.g., "mindanaoregistration.phalga.org")';

-- Enable Row Level Security
ALTER TABLE public.conference ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public read access (conference info should be readable)
CREATE POLICY "Allow public read access on conference" ON public.conference
  FOR SELECT USING (true);

-- Example insert (uncomment and modify as needed):
-- INSERT INTO public.conference (confcode, name, date_from, date_to, venue, reg_limit, domain)
-- VALUES 
--   ('2026-GCMIN', '18th Mindanao Geographic Conference', '2026-03-15', '2026-03-17', 'Davao City', 500, 'mindanaoregistration.phalga.org'),
--   ('2026-GCLUZ', 'Luzon Geographic Conference 2026', '2026-04-20', '2026-04-22', 'Manila', 300, 'luzonregistration.phalga.org');
