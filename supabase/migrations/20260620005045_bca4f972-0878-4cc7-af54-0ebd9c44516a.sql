
CREATE TABLE public.savings_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  kind TEXT NOT NULL CHECK (kind IN ('deposit','withdraw')),
  description TEXT NOT NULL DEFAULT '',
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.savings_movements TO authenticated;
GRANT ALL ON public.savings_movements TO service_role;
ALTER TABLE public.savings_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own savings" ON public.savings_movements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX savings_movements_user_date_idx ON public.savings_movements(user_id, occurred_at DESC);
