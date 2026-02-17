-- Optional safeguard: BEFORE INSERT trigger on regd to block duplicate participants
-- (same confcode set + same identity, regh status PENDING/APPROVED) at DB level.

CREATE OR REPLACE FUNCTION public.regd_check_duplicate_participant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  confcodes_arr text[];
  linked_raw text;
  position_lvl text;
  dup_count int;
BEGIN
  -- Resolve confcode set: current + linked_conference from conference table
  linked_raw := coalesce(
    (SELECT linked_conference FROM public.conference WHERE confcode = NEW.confcode LIMIT 1),
    ''
  );
  confcodes_arr := (
    SELECT array_agg(DISTINCT trim(x))
    FROM unnest(
      array_cat(ARRAY[NEW.confcode], string_to_array(regexp_replace(trim(linked_raw), '\s*,\s*', ',', 'g'), ','))
    ) AS x
    WHERE nullif(trim(x), '') IS NOT NULL
  );

  -- Position LVL for BGY barangay matching
  position_lvl := NULL;
  IF NEW.designation IS NOT NULL AND trim(NEW.designation) <> '' THEN
    SELECT lvl INTO position_lvl FROM public.positions WHERE name = trim(NEW.designation) LIMIT 1;
  END IF;

  -- Check for existing participant in same confcode set (different registration) with PENDING/APPROVED
  SELECT COUNT(*) INTO dup_count
  FROM public.regd r
  JOIN public.regh h ON h.regid = r.regid AND h.confcode = r.confcode
  WHERE r.confcode = ANY(confcodes_arr)
    AND r.regid <> NEW.regid
    AND r.province = coalesce(NEW.province, '')
    AND r.lgu = coalesce(NEW.lgu, '')
    AND r.lastname = coalesce(NEW.lastname, '')
    AND r.firstname = coalesce(NEW.firstname, '')
    AND r.middleinit = coalesce(NEW.middleinit, '')
    AND (position_lvl <> 'BGY' OR coalesce(trim(NEW.brgy), '') = '' OR r.brgy = coalesce(NEW.brgy, ''))
    AND upper(trim(coalesce(h.status, ''))) IN ('PENDING', 'APPROVED');

  IF dup_count > 0 THEN
    RAISE EXCEPTION 'Duplicate participant: "% % %" already registered in this conference set (same province/LGU/identity).',
      coalesce(NEW.firstname, ''),
      coalesce(NEW.middleinit, ''),
      coalesce(NEW.lastname, '');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS regd_before_insert_check_duplicate ON public.regd;
CREATE TRIGGER regd_before_insert_check_duplicate
  BEFORE INSERT ON public.regd
  FOR EACH ROW
  EXECUTE PROCEDURE public.regd_check_duplicate_participant();

COMMENT ON FUNCTION public.regd_check_duplicate_participant() IS 'Trigger function: block regd insert if same participant (province, lgu, name, brgy when BGY) already exists in confcode set with PENDING/APPROVED status.';
