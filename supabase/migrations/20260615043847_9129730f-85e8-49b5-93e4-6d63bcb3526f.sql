CREATE TABLE public.ri_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ri_modules TO authenticated;
GRANT ALL ON public.ri_modules TO service_role;
ALTER TABLE public.ri_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own RI modules" ON public.ri_modules FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ri_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.ri_modules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  content text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ri_notes TO authenticated;
GRANT ALL ON public.ri_notes TO service_role;
ALTER TABLE public.ri_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own RI notes" ON public.ri_notes FOR ALL TO authenticated USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.ri_modules m WHERE m.id = module_id AND m.user_id = auth.uid())) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.ri_modules m WHERE m.id = module_id AND m.user_id = auth.uid()));

CREATE TABLE public.ri_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.ri_modules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  question text NOT NULL CHECK (char_length(question) BETWEEN 1 AND 2000),
  answer text NOT NULL CHECK (char_length(answer) BETWEEN 1 AND 5000),
  review_status text NOT NULL DEFAULT 'unreviewed' CHECK (review_status IN ('unreviewed', 'correct', 'incorrect')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ri_questions TO authenticated;
GRANT ALL ON public.ri_questions TO service_role;
ALTER TABLE public.ri_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own RI questions" ON public.ri_questions FOR ALL TO authenticated USING (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.ri_modules m WHERE m.id = module_id AND m.user_id = auth.uid())) WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.ri_modules m WHERE m.id = module_id AND m.user_id = auth.uid()));

CREATE INDEX ri_modules_user_position_idx ON public.ri_modules(user_id, position);
CREATE INDEX ri_notes_module_position_idx ON public.ri_notes(module_id, position);
CREATE INDEX ri_questions_module_position_idx ON public.ri_questions(module_id, position);

CREATE TRIGGER set_ri_modules_updated_at BEFORE UPDATE ON public.ri_modules FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_ri_notes_updated_at BEFORE UPDATE ON public.ri_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_ri_questions_updated_at BEFORE UPDATE ON public.ri_questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();