
CREATE TABLE public.evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jury_name text NOT NULL,
  project_number int NOT NULL,
  project_name text NOT NULL DEFAULT '',
  innovation numeric NOT NULL DEFAULT 0,
  impact numeric NOT NULL DEFAULT 0,
  faisabilite numeric NOT NULL DEFAULT 0,
  prototype numeric NOT NULL DEFAULT 0,
  pitch numeric NOT NULL DEFAULT 0,
  questions numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (jury_name, project_number)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.evaluations TO anon, authenticated;
GRANT ALL ON public.evaluations TO service_role;

ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read evaluations"
  ON public.evaluations FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public insert evaluations"
  ON public.evaluations FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Public update evaluations"
  ON public.evaluations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public delete evaluations"
  ON public.evaluations FOR DELETE TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.evaluations;
ALTER TABLE public.evaluations REPLICA IDENTITY FULL;
