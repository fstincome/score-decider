CREATE TABLE public.projects (
  project_number integer PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read projects" ON public.projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert projects" ON public.projects FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update projects" ON public.projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Public delete projects" ON public.projects FOR DELETE TO anon, authenticated USING (true);