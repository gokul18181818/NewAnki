-- Learning insights (best study hour + positivity %)

CREATE OR REPLACE FUNCTION public.deck_learning_insights(p_deck_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH hourly AS (
    SELECT to_char(r.created_at AT TIME ZONE 'UTC', 'HH24') AS hr,
           avg(CASE WHEN r.rating >= 2 THEN 1 ELSE 0 END) AS positivity
    FROM reviews r
    JOIN cards c ON c.id = r.card_id
    WHERE c.deck_id = p_deck_id
    GROUP BY hr
  ), best AS (
    SELECT hr
    FROM hourly
    ORDER BY positivity DESC NULLS LAST
    LIMIT 1
  ), overall AS (
    SELECT round(avg(CASE WHEN r.rating >= 2 THEN 1 ELSE 0 END) * 100, 0) AS positivity
    FROM reviews r
    JOIN cards c ON c.id = r.card_id
    WHERE c.deck_id = p_deck_id
  )
  SELECT jsonb_build_object(
    'best_hour', (SELECT hr FROM best LIMIT 1),
    'positivity', (SELECT positivity FROM overall)
  );
$$;

GRANT EXECUTE ON FUNCTION public.deck_learning_insights(uuid) TO authenticated; 