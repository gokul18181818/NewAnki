-- Create study_logs table to record session summaries
create table if not exists public.study_logs (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  cards_studied integer not null,
  time_spent_seconds integer not null,
  performance_data jsonb,
  retention_rate integer,
  session_mode text,
  session_date timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.study_logs enable row level security;

create policy "study_logs_owner_select" on public.study_logs
  for select using (user_id = auth.uid());

create policy "study_logs_owner_insert" on public.study_logs
  for insert with check (user_id = auth.uid());

create index if not exists idx_study_logs_user_date on public.study_logs (user_id, session_date); 