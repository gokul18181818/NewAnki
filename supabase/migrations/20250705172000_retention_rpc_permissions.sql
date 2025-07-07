-- Permissions and RPC for retention buckets

-- Grant select on card_transitions table & view to authenticated users
GRANT SELECT ON public.card_transitions TO authenticated;
GRANT SELECT ON public.deck_retention_buckets TO authenticated;

-- Grant execute on transition matrix function
GRANT EXECUTE ON FUNCTION public.deck_transition_matrix(uuid) TO authenticated;

-- RPC to return retention buckets as JSON
CREATE OR REPLACE FUNCTION public.deck_retention_buckets_json(p_deck_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
            'interval_bucket', interval_bucket,
            'retention', retention,
            'reviews', reviews,
            'lapses', lapses
          ) ORDER BY interval_bucket), '[]'::jsonb)
  FROM public.deck_retention_buckets
  WHERE deck_id = p_deck_id;
$$;

GRANT EXECUTE ON FUNCTION public.deck_retention_buckets_json(uuid) TO authenticated; 