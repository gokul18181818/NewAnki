-- Ensure study_logs has deck_id column (some clouds previously missing)
alter table public.study_logs
  add column if not exists deck_id uuid references public.decks(id) on delete cascade;

-- Backfill existing rows if deck reference info stored elsewhere (skip for now) 