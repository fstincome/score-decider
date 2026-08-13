DROP TABLE IF EXISTS public.evaluations;
DROP TABLE IF EXISTS public.projects;
DROP TABLE IF EXISTS public.session_settings;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Nouvelle compétition',
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO anon, authenticated;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read competitions" ON public.competitions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert competitions" ON public.competitions FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update competitions" ON public.competitions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete competitions" ON public.competitions FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER competitions_updated_at BEFORE UPDATE ON public.competitions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Critère',
  max_points numeric NOT NULL DEFAULT 10,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.criteria TO anon, authenticated;
GRANT ALL ON public.criteria TO service_role;
ALTER TABLE public.criteria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read criteria" ON public.criteria FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert criteria" ON public.criteria FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update criteria" ON public.criteria FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete criteria" ON public.criteria FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER criteria_updated_at BEFORE UPDATE ON public.criteria FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  project_number integer NOT NULL,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, project_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO anon, authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read teams" ON public.teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert teams" ON public.teams FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update teams" ON public.teams FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete teams" ON public.teams FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.juries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_president boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.juries TO anon, authenticated;
GRANT ALL ON public.juries TO service_role;
ALTER TABLE public.juries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read juries" ON public.juries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert juries" ON public.juries FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update juries" ON public.juries FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete juries" ON public.juries FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER juries_updated_at BEFORE UPDATE ON public.juries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE CASCADE,
  jury_id uuid NOT NULL REFERENCES public.juries(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  criterion_id uuid NOT NULL REFERENCES public.criteria(id) ON DELETE CASCADE,
  value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jury_id, team_id, criterion_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scores TO anon, authenticated;
GRANT ALL ON public.scores TO service_role;
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read scores" ON public.scores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert scores" ON public.scores FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update scores" ON public.scores FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete scores" ON public.scores FOR DELETE TO anon, authenticated USING (true);
CREATE TRIGGER scores_updated_at BEFORE UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('admin','jury')),
  jury_id uuid REFERENCES public.juries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.access_codes TO service_role;
ALTER TABLE public.access_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "No public access to access_codes" ON public.access_codes FOR SELECT TO anon, authenticated USING (false);
CREATE TRIGGER access_codes_updated_at BEFORE UPDATE ON public.access_codes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.competitions (id, name, locked) VALUES ('11111111-1111-4111-8111-111111111111', 'Marketing Digital Competition', false);

INSERT INTO public.criteria (competition_id, label, max_points, position) VALUES
 ('11111111-1111-4111-8111-111111111111', 'Innovation', 25, 0),
 ('11111111-1111-4111-8111-111111111111', 'Impact', 20, 1),
 ('11111111-1111-4111-8111-111111111111', 'Faisabilité technique', 20, 2),
 ('11111111-1111-4111-8111-111111111111', 'Qualité du prototype', 15, 3),
 ('11111111-1111-4111-8111-111111111111', 'Présentation du pitch', 10, 4),
 ('11111111-1111-4111-8111-111111111111', 'Réponses aux questions', 10, 5);

INSERT INTO public.teams (competition_id, project_number, name) VALUES
 ('11111111-1111-4111-8111-111111111111', 1, 'Turiho'),
 ('11111111-1111-4111-8111-111111111111', 2, 'Gitega Street Marketing'),
 ('11111111-1111-4111-8111-111111111111', 3, 'Echo Creative Studio'),
 ('11111111-1111-4111-8111-111111111111', 4, 'Burundi e-Market'),
 ('11111111-1111-4111-8111-111111111111', 5, 'Kwiga Design'),
 ('11111111-1111-4111-8111-111111111111', 6, 'Ingoma Creative Hub'),
 ('11111111-1111-4111-8111-111111111111', 7, 'Marketing Solutions Agency'),
 ('11111111-1111-4111-8111-111111111111', 8, 'Gitega Influencers Network');

INSERT INTO public.juries (id, competition_id, name, is_president) VALUES
 ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111111', 'Juré 1', false),
 ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111111', 'Juré 2 (Président)', true),
 ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111111', 'Juré 3', false);

INSERT INTO public.access_codes (code, role, jury_id) VALUES
 ('9999', 'admin', NULL),
 ('1111', 'jury', '22222222-2222-4222-8222-222222222201'),
 ('2222', 'jury', '22222222-2222-4222-8222-222222222202'),
 ('3333', 'jury', '22222222-2222-4222-8222-222222222203');