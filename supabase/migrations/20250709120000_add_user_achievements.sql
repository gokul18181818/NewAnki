-- Add user achievements table for tracking unlocked badges
create extension if not exists pgcrypto;

create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  unique(user_id, achievement_id)
);

-- Enable Row Level Security so each user can only see their rows
alter table public.user_achievements enable row level security;

-- Policy: users can read their own achievements
create policy "select_own_achievements" on public.user_achievements
  for select using ( auth.uid() = user_id );

-- Policy: users can insert achievements for themselves
create policy "insert_own_achievements" on public.user_achievements
  for insert with check ( auth.uid() = user_id );

-- Helpful index
create index if not exists idx_user_achievements_user_id on public.user_achievements (user_id); 