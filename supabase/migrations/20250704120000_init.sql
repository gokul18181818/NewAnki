-- Enable extension for UUID generation
create extension if not exists "uuid-ossp";

-- ========================================
-- TABLE: decks
-- ========================================
create table if not exists public.decks (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.decks enable row level security;

create policy "decks_select_owner" on public.decks
  for select using (owner_id = auth.uid());

create policy "decks_insert_owner" on public.decks
  for insert with check (owner_id = auth.uid());

create policy "decks_update_owner" on public.decks
  for update using (owner_id = auth.uid());

create policy "decks_delete_owner" on public.decks
  for delete using (owner_id = auth.uid());

-- ========================================
-- TABLE: cards
-- ========================================
create table if not exists public.cards (
  id uuid primary key default uuid_generate_v4(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  type text not null default 'basic',
  front text not null,
  back text not null,
  tags text[],
  difficulty double precision not null default 0,
  last_studied timestamptz,
  next_due timestamptz,
  interval integer not null default 1,
  ease_factor double precision not null default 2.5,
  review_count integer not null default 0,
  created_at timestamptz default now()
);

alter table public.cards enable row level security;

create policy "cards_access_by_deck_owner" on public.cards
  for all using (
    exists (
      select 1
      from public.decks d
      where d.id = deck_id
        and d.owner_id = auth.uid()
    )
  );

create policy "cards_insert_by_deck_owner" on public.cards
  for insert with check (
    exists (
      select 1
      from public.decks d
      where d.id = deck_id
        and d.owner_id = auth.uid()
    )
  );

create index if not exists idx_cards_deck_due on public.cards (deck_id, next_due);

-- ========================================
-- TABLE: reviews
-- ========================================
create table if not exists public.reviews (
  id bigint generated by default as identity primary key,
  card_id uuid not null references public.cards(id) on delete cascade,
  rating smallint not null check (rating between 0 and 3),
  time_taken integer not null default 0, -- seconds spent reviewing
  reviewed_at timestamptz default now(),
  owner_id uuid not null default auth.uid() references auth.users(id)
);

alter table public.reviews enable row level security;

create policy "reviews_owner_select" on public.reviews
  for select using (owner_id = auth.uid());

create policy "reviews_owner_insert" on public.reviews
  for insert with check (owner_id = auth.uid());

create index if not exists idx_reviews_card on public.reviews (card_id);
create index if not exists idx_reviews_owner_date on public.reviews (owner_id, reviewed_at);

-- ========================================
-- Trigger helpers
-- ========================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_decks_updated_at on public.decks;
create trigger tr_decks_updated_at
before update on public.decks
for each row
execute procedure public.update_updated_at_column(); 