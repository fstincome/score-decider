
CREATE OR REPLACE FUNCTION public.login_with_code(_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; j record;
BEGIN
  SELECT role, jury_id INTO r FROM access_codes WHERE code=trim(_code) LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false); END IF;
  IF r.role='admin' THEN RETURN jsonb_build_object('ok',true,'role','admin'); END IF;
  SELECT id,name,is_president,competition_id INTO j FROM juries WHERE id=r.jury_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok',false); END IF;
  RETURN jsonb_build_object('ok',true,'role','jury','juryId',j.id,'juryName',j.name,'isPresident',j.is_president,'competitionId',j.competition_id);
END $$;

CREATE OR REPLACE FUNCTION public._assert_admin(_code text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM access_codes WHERE code=trim(_code) AND role='admin') THEN
    RAISE EXCEPTION 'Accès administrateur refusé'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public._assert_president(_code text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE pid uuid;
BEGIN
  SELECT j.id INTO pid FROM access_codes a JOIN juries j ON j.id=a.jury_id
   WHERE a.code=trim(_code) AND a.role='jury' AND j.is_president;
  IF pid IS NULL THEN RAISE EXCEPTION 'Accès président refusé'; END IF;
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public._assign_code(_jury uuid, _code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF trim(_code) !~ '^\d{3,8}$' THEN RAISE EXCEPTION 'Le code doit contenir 3 à 8 chiffres'; END IF;
  IF EXISTS (SELECT 1 FROM access_codes WHERE code=trim(_code) AND jury_id IS DISTINCT FROM _jury) THEN
    RAISE EXCEPTION 'Ce code est déjà utilisé'; END IF;
  DELETE FROM access_codes WHERE jury_id=_jury;
  INSERT INTO access_codes(code,role,jury_id) VALUES (trim(_code),'jury',_jury);
END $$;

CREATE OR REPLACE FUNCTION public.admin_list_presidents(_admin_code text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM _assert_admin(_admin_code);
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',j.id,'name',j.name,'code',COALESCE(a.code,''),'competitionId',j.competition_id,
    'competitionName',c.name,'locked',COALESCE(c.locked,false)) ORDER BY j.created_at)
   FROM juries j LEFT JOIN access_codes a ON a.jury_id=j.id
   LEFT JOIN competitions c ON c.id=j.competition_id WHERE j.is_president),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.admin_create_president(_admin_code text,_name text,_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE nid uuid;
BEGIN
  PERFORM _assert_admin(_admin_code);
  IF coalesce(trim(_name),'')='' THEN RAISE EXCEPTION 'Nom du président requis'; END IF;
  INSERT INTO juries(name,is_president,competition_id) VALUES (trim(_name),true,null) RETURNING id INTO nid;
  PERFORM _assign_code(nid,_code);
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_president_code(_admin_code text,_president uuid,_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM _assert_admin(_admin_code); PERFORM _assign_code(_president,_code); END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_president(_admin_code text,_president uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM _assert_admin(_admin_code);
  DELETE FROM access_codes WHERE jury_id=_president;
  DELETE FROM juries WHERE id=_president;
END $$;

CREATE OR REPLACE FUNCTION public.president_list_jury_codes(_code text,_competition uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM _assert_president(_code);
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('jury_id',a.jury_id,'code',a.code))
   FROM access_codes a JOIN juries j ON j.id=a.jury_id WHERE j.competition_id=_competition),'[]'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.president_set_jury_code(_code text,_jury uuid,_jury_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN PERFORM _assert_president(_code); PERFORM _assign_code(_jury,_jury_code); END $$;

REVOKE ALL ON FUNCTION public._assert_admin(text), public._assert_president(text), public._assign_code(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_with_code(text), public.admin_list_presidents(text),
  public.admin_create_president(text,text,text), public.admin_set_president_code(text,uuid,text),
  public.admin_delete_president(text,uuid), public.president_list_jury_codes(text,uuid),
  public.president_set_jury_code(text,uuid,text) TO anon, authenticated;
