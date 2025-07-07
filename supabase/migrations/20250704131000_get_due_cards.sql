-- Function: get_due_cards
create or replace function public.get_due_cards(p_deck uuid, p_limit int default 30)
returns setof public.cards
language sql
security definer
set search_path = public
as $$
  select c.*
  from public.cards c
  join public.decks d on d.id = c.deck_id
  where c.deck_id = p_deck
    and d.owner_id = auth.uid()
    and (c.next_due is null or c.next_due <= now())
  order by c.next_due nulls first
  limit p_limit;
$$;

grant execute on function public.get_due_cards(uuid,int) to authenticated; 