-- Atomic registration submit: advisory lock + duplicate check + insert to prevent double entries from concurrent requests.

CREATE OR REPLACE FUNCTION public.submit_registration_atomic(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p_confcode text;
  p_linked_confcodes text;
  p_province text;
  p_lgu text;
  p_contactperson text;
  p_contactnum text;
  p_email text;
  p_regdate text;
  p_prefix text;
  p_participants jsonb;
  confcodes_arr text[];
  lock_key bigint;
  regid_candidate text;
  regid_final text;
  attempt int := 0;
  part jsonb;
  part_lastname text;
  part_firstname text;
  part_middleinit text;
  part_lgu text;
  part_brgy text;
  part_designation text;
  position_lvl text;
  dup_count int;
  i int;
BEGIN
  -- Extract payload
  p_confcode := coalesce(nullif(trim((payload->>'confcode')), ''), '2026-GCMIN');
  p_linked_confcodes := nullif(trim(coalesce(payload->>'linked_confcodes', '')), '');
  p_province := upper(trim(coalesce(payload->>'province', '')));
  p_lgu := upper(trim(coalesce(payload->>'lgu', '')));
  p_contactperson := upper(trim(coalesce(payload->>'contactperson', '')));
  p_contactnum := trim(coalesce(payload->>'contactnum', ''));
  p_email := lower(trim(coalesce(payload->>'email', '')));
  p_regdate := trim(coalesce(payload->>'regdate', ''));
  p_prefix := nullif(trim(coalesce(payload->>'prefix', '')), '');
  p_participants := payload->'participants';
  IF p_participants IS NULL OR jsonb_array_length(p_participants) = 0 THEN
    RAISE EXCEPTION 'No participants in payload';
  END IF;

  -- Build confcodes array (current + linked, distinct)
  confcodes_arr := ARRAY[p_confcode];
  IF p_linked_confcodes IS NOT NULL AND trim(p_linked_confcodes) <> '' THEN
    confcodes_arr := confcodes_arr || string_to_array(regexp_replace(trim(p_linked_confcodes), '\s*,\s*', ',', 'g'), ',');
  END IF;
  confcodes_arr := (SELECT array_agg(DISTINCT trim(x)) FROM unnest(confcodes_arr) AS x WHERE nullif(trim(x), '') IS NOT NULL);

  -- Advisory lock key: same conference set + same participant set => same lock (so concurrent same submission serializes)
  lock_key := abs(hashtext(p_confcode || array_to_string(confcodes_arr, ',') || p_participants::text))::bigint;
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Duplicate check per participant
  FOR i IN 0 .. jsonb_array_length(p_participants) - 1 LOOP
    part := p_participants->i;
    part_lastname := upper(trim(coalesce(part->>'lastname', '')));
    part_firstname := upper(trim(coalesce(part->>'firstname', '')));
    part_middleinit := upper(trim(coalesce(part->>'middleinit', '')));
    part_lgu := upper(trim(coalesce(nullif(trim(part->>'lgu'), ''), p_lgu)));
    part_brgy := upper(trim(coalesce(part->>'brgy', '')));
    part_designation := upper(trim(coalesce(part->>'designation', '')));

    IF part_lastname = '' OR part_firstname = '' OR part_middleinit = '' THEN
      CONTINUE;
    END IF;

    position_lvl := NULL;
    IF part_designation <> '' THEN
      SELECT lvl INTO position_lvl FROM public.positions WHERE name = part_designation LIMIT 1;
    END IF;

    SELECT COUNT(*) INTO dup_count
    FROM public.regd r
    JOIN public.regh h ON h.regid = r.regid AND h.confcode = r.confcode
    WHERE r.confcode = ANY(confcodes_arr)
      AND r.province = p_province
      AND r.lgu = part_lgu
      AND r.lastname = part_lastname
      AND r.firstname = part_firstname
      AND r.middleinit = part_middleinit
      AND (position_lvl <> 'BGY' OR part_brgy = '' OR r.brgy = part_brgy)
      AND upper(trim(coalesce(h.status, ''))) IN ('PENDING', 'APPROVED');

    IF dup_count > 0 THEN
      RAISE EXCEPTION 'Participant "% % %" already exists in % - %. Each participant can only register once.',
        part_firstname, part_middleinit, part_lastname, p_province, part_lgu;
    END IF;
  END LOOP;

  -- Generate unique regid
  LOOP
    regid_candidate := coalesce(p_prefix, '') || lpad(floor(random() * 1000000)::int::text, 6, '0');
    IF length(regid_candidate) < 6 THEN
      regid_candidate := lpad(regid_candidate, 6, '0');
    END IF;
    IF EXISTS (SELECT 1 FROM public.regh WHERE regid = regid_candidate) THEN
      attempt := attempt + 1;
      IF attempt >= 100 THEN
        RAISE EXCEPTION 'Failed to generate unique regid';
      END IF;
      CONTINUE;
    END IF;
    regid_final := regid_candidate;
    EXIT;
  END LOOP;

  -- Insert regh (default regdate to now if not provided)
  INSERT INTO public.regh (confcode, province, lgu, contactperson, contactnum, email, regdate, regid, status)
  VALUES (
    p_confcode, p_province, p_lgu, p_contactperson, p_contactnum, p_email,
    COALESCE(NULLIF(trim(p_regdate), '')::timestamp, CURRENT_TIMESTAMP),
    regid_final, 'PENDING'
  );

  -- Insert regd rows
  FOR i IN 0 .. jsonb_array_length(p_participants) - 1 LOOP
    part := p_participants->i;
    INSERT INTO public.regd (
      confcode, regid, linenum,
      lastname, firstname, middleinit, suffix,
      designation, brgy, lgu, province,
      tshirtsize, contactnum, prcnum, expirydate, email
    ) VALUES (
      p_confcode,
      regid_final,
      i + 1,
      upper(trim(coalesce(part->>'lastname', ''))),
      upper(trim(coalesce(part->>'firstname', ''))),
      upper(trim(coalesce(part->>'middleinit', ''))),
      nullif(trim(coalesce(part->>'suffix', '')), ''),
      upper(trim(coalesce(part->>'designation', ''))),
      upper(trim(coalesce(part->>'brgy', ''))),
      upper(trim(coalesce(nullif(trim(part->>'lgu'), ''), p_lgu))),
      p_province,
      upper(trim(coalesce(part->>'tshirtsize', ''))),
      upper(trim(coalesce(part->>'contactnum', ''))),
      upper(trim(coalesce(part->>'prcnum', ''))),
      CASE WHEN part->>'expirydate' <> '' AND part->>'expirydate' IS NOT NULL
        THEN (part->>'expirydate')::date
        ELSE NULL END,
      lower(trim(coalesce(part->>'email', '')))
    );
  END LOOP;

  RETURN jsonb_build_object('regid', regid_final);
END;
$$;

COMMENT ON FUNCTION public.submit_registration_atomic(jsonb) IS 'Atomically check duplicate participants (with advisory lock) and insert regh+regd. Prevents double registration from concurrent submissions.';

GRANT EXECUTE ON FUNCTION public.submit_registration_atomic(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_registration_atomic(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_registration_atomic(jsonb) TO service_role;
