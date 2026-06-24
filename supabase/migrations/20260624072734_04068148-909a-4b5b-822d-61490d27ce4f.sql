CREATE TABLE public.session_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  locked BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT singleton CHECK (id = 1)
);
GRANT SELECT, INSERT, UPDATE ON public.session_settings TO anon, authenticated;
GRANT ALL ON public.session_settings TO service_role;
ALTER TABLE public.session_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read session_settings" ON public.session_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public insert session_settings" ON public.session_settings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Public update session_settings" ON public.session_settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
INSERT INTO public.session_settings (id, locked) VALUES (1, false) ON CONFLICT (id) DO NOTHING;