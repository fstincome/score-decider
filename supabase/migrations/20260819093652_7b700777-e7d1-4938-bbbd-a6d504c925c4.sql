ALTER TABLE public.juries ALTER COLUMN competition_id DROP NOT NULL;
ALTER TABLE public.competitions ADD COLUMN IF NOT EXISTS owner_jury_id uuid REFERENCES public.juries(id) ON DELETE SET NULL;