-- User-level learning insights
-- Calculates best study hour, positivity, fastest improving and most challenging topics,
-- and median optimal session card count across all decks for a given user.

CREATE OR REPLACE FUNCTION public.user_learning_insights(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH hourly AS (
    SELECT to_char(r.reviewed_at, 'HH24') AS hr,
           avg(CASE WHEN r.rating >= 2 THEN 1 ELSE 0 END) AS positivity
    FROM public.reviews r
    WHERE r.owner_id = p_user_id
      AND r.reviewed_at > now() - interval '60 days'
    GROUP BY hr
  ), best AS (
    SELECT hr FROM hourly ORDER BY positivity DESC NULLS LAST LIMIT 1
  ), recent AS (
    SELECT unnest(coalesce(c.tags, ARRAY['(untagged)'])) AS tag,
           r.reviewed_at::date AS day,
           CASE WHEN r.rating >= 2 THEN 1 ELSE 0 END AS positive
    FROM public.reviews r
    JOIN public.cards c ON c.id = r.card_id
    WHERE r.owner_id = p_user_id
      AND r.reviewed_at > now() - interval '30 days'
  ), tag_daily AS (
    SELECT tag, day, avg(positive) AS pos FROM recent GROUP BY tag, day
  ), tag_stats AS (
    SELECT tag,
           max(pos) - min(pos) AS delta,
           avg(pos) AS avg_pos
    FROM tag_daily GROUP BY tag
  ), fastest AS (
    SELECT tag FROM tag_stats ORDER BY delta DESC NULLS LAST LIMIT 1
  ), hardest AS (
    SELECT tag FROM tag_stats ORDER BY avg_pos ASC NULLS LAST LIMIT 1
  ), optimal_cards AS (
    SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY cards_studied))::int AS cards
    FROM public.study_logs
    WHERE user_id = p_user_id AND fatigue_score IS NOT NULL AND fatigue_score < 70
  ), overall AS (
    SELECT round(avg(CASE WHEN r.rating >= 2 THEN 1 ELSE 0 END)*100,0) AS positivity
    FROM public.reviews r
    WHERE r.owner_id = p_user_id
  )
  SELECT jsonb_build_object(
    'best_hour',(SELECT hr FROM best),
    'positivity',(SELECT positivity FROM overall),
    'fastest_topic',(SELECT tag FROM fastest),
    'hardest_topic',(SELECT tag FROM hardest),
    'optimal_cards',(SELECT cards FROM optimal_cards)
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_learning_insights(uuid) TO authenticated; 