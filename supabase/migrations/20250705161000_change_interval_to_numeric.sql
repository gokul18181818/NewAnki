-- Change interval column to numeric to allow sub-day fractional intervals
ALTER TABLE public.cards
  ALTER COLUMN interval TYPE numeric USING interval::numeric,
  ALTER COLUMN interval SET DEFAULT 1;

-- No policy changes needed; numeric still works for comparisons. 