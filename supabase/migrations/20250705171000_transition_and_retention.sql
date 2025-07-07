-- Card state transition logging and retention analytics

-- 1. Ensure reviews table has interval_before column for retention stats
ALTER TABLE IF EXISTS public.reviews
  ADD COLUMN IF NOT EXISTS interval_before integer;

-- 2. Transition log table
CREATE TABLE IF NOT EXISTS public.card_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL,
  deck_id uuid NOT NULL,
  old_state text NOT NULL,
  new_state text NOT NULL,
  transitioned_at timestamptz NOT NULL DEFAULT now()
);

-- Index for deck lookup
CREATE INDEX IF NOT EXISTS idx_card_transitions_deck ON public.card_transitions(deck_id);

-- 3. Trigger function to capture state changes on cards table
CREATE OR REPLACE FUNCTION public.log_card_state_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log when state actually changes
  IF NEW.card_state IS DISTINCT FROM OLD.card_state THEN
    INSERT INTO public.card_transitions(card_id, deck_id, old_state, new_state)
    VALUES (NEW.id, NEW.deck_id, OLD.card_state, NEW.card_state);
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_log_card_state_change ON public.cards;
CREATE TRIGGER trg_log_card_state_change
AFTER UPDATE OF card_state ON public.cards
FOR EACH ROW EXECUTE FUNCTION public.log_card_state_change();

-- 4. RPC: deck_transition_matrix(deck_id) → jsonb array of counts
CREATE OR REPLACE FUNCTION public.deck_transition_matrix(p_deck_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT jsonb_agg(jsonb_build_object(
            'from', old_state,
            'to',   new_state,
            'count', cnt
         ) ORDER BY old_state, new_state)
  FROM (
    SELECT old_state, new_state, count(*) AS cnt
      FROM public.card_transitions
     WHERE deck_id = p_deck_id
     GROUP BY old_state, new_state
  ) sub;
$$;

COMMENT ON FUNCTION public.deck_transition_matrix(uuid)
  IS 'Returns JSONB array of transition counts for heat-map visualisation.';

-- 5. View: deck_retention_buckets – 1,3,7,15,30+ day intervals
CREATE OR REPLACE VIEW public.deck_retention_buckets AS
SELECT
  r.deck_id,
  CASE
    WHEN interval_before <= 1 THEN '1'
    WHEN interval_before <= 3 THEN '3'
    WHEN interval_before <= 7 THEN '7'
    WHEN interval_before <= 15 THEN '15'
    ELSE '30+'
  END AS interval_bucket,
  count(*)                                   AS reviews,
  sum(CASE WHEN r.rating = 0 THEN 1 ELSE 0 END) AS lapses,
  round( (1 - sum(CASE WHEN r.rating = 0 THEN 1 ELSE 0 END)::numeric / count(*)) * 100, 2) AS retention
FROM public.reviews r
WHERE interval_before IS NOT NULL
GROUP BY r.deck_id, interval_bucket;

COMMENT ON VIEW public.deck_retention_buckets IS 'Aggregated retention % per interval bucket for each deck.'; 