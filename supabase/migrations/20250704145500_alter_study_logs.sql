-- Ensure study_logs has expected columns
alter table public.study_logs add column if not exists session_date timestamptz;
alter table public.study_logs add column if not exists cards_studied integer;
alter table public.study_logs add column if not exists time_spent_seconds integer;
alter table public.study_logs add column if not exists performance_data jsonb;
alter table public.study_logs add column if not exists retention_rate integer;
alter table public.study_logs add column if not exists session_mode text;

create index if not exists idx_study_logs_user_date on public.study_logs (user_id, coalesce(session_date, created_at)); 