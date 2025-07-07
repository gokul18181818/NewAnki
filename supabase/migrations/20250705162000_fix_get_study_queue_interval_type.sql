-- Adjust interval column type in function return to NUMERIC to match cards.interval changes
CREATE OR REPLACE FUNCTION public.get_advanced_study_queue(
  p_deck_id UUID,
  p_new_limit INTEGER DEFAULT 20,
  p_total_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  result_card_id UUID,
  result_card_type TEXT,
  result_front TEXT,
  result_back TEXT,
  result_card_state TEXT,
  result_learning_step INTEGER,
  result_lapse_count INTEGER,
  result_is_leech BOOLEAN,
  result_next_due TIMESTAMPTZ,
  result_ease_factor NUMERIC,
  result_interval_days NUMERIC,
  result_priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_record public.deck_configs;
  new_cards_today INTEGER := 0;
  remaining_new_cards INTEGER;
BEGIN
  SELECT * INTO config_record FROM public.get_deck_config(p_deck_id);

  SELECT COALESCE(COUNT(*), 0) INTO new_cards_today
  FROM public.reviews r
  JOIN public.cards c ON r.card_id = c.id
  WHERE c.deck_id = p_deck_id
    AND r.reviewed_at >= CURRENT_DATE
    AND c.review_count = 0;

  remaining_new_cards := GREATEST(0, config_record.new_cards_per_day - new_cards_today);

  RETURN QUERY
  WITH prioritized_cards AS (
    SELECT 
      c.id AS pc_card_id,
      COALESCE(c.type, 'basic') AS pc_card_type,
      COALESCE(c.front, '') AS pc_front,
      COALESCE(c.back, '') AS pc_back,
      COALESCE(c.card_state, 'new') AS pc_card_state,
      COALESCE(c.learning_step, 0) AS pc_learning_step,
      COALESCE(c.lapse_count, 0) AS pc_lapse_count,
      COALESCE(c.is_leech, false) AS pc_is_leech,
      COALESCE(c.next_due, NOW()) AS pc_next_due,
      COALESCE(c.ease_factor, 2.5) AS pc_ease_factor,
      COALESCE(c.interval, 1) AS pc_interval_days,
      CASE 
        WHEN COALESCE(c.card_state, 'new') = 'relearning' THEN 1
        WHEN COALESCE(c.card_state, 'new') = 'learning' THEN 2
        WHEN COALESCE(c.card_state, 'new') = 'review' AND COALESCE(c.next_due, NOW()) <= NOW() THEN 3
        WHEN COALESCE(c.card_state, 'new') = 'new' OR c.review_count = 0 THEN 4
        ELSE 5
      END AS pc_priority,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(c.card_state, 'new')
        ORDER BY 
          CASE WHEN COALESCE(c.card_state, 'new') IN ('learning','relearning') THEN COALESCE(c.next_due, NOW()) END ASC NULLS LAST,
          CASE WHEN COALESCE(c.card_state, 'new') = 'review' THEN COALESCE(c.next_due, NOW()) END ASC NULLS LAST,
          CASE WHEN COALESCE(c.card_state, 'new') IN ('new') OR c.review_count = 0 THEN c.created_at END ASC NULLS LAST
      ) AS pc_state_rank
    FROM public.cards c
    JOIN public.decks d ON c.deck_id = d.id
    WHERE c.deck_id = p_deck_id
      AND d.owner_id = auth.uid()
      AND NOT COALESCE(c.is_leech, false)
      AND (
        COALESCE(c.card_state, 'new') IN ('learning','relearning') OR
        (COALESCE(c.card_state, 'new') = 'review' AND COALESCE(c.next_due, NOW()) <= NOW()) OR
        (COALESCE(c.card_state, 'new') = 'new' AND remaining_new_cards > 0) OR
        (c.review_count = 0 AND remaining_new_cards > 0)
      )
  )
  SELECT 
    pc_card_id,
    pc_card_type::text,
    pc_front,
    pc_back,
    pc_card_state::text,
    pc_learning_step,
    pc_lapse_count,
    pc_is_leech,
    pc_next_due,
    pc_ease_factor::numeric,
    pc_interval_days::numeric,
    pc_priority
  FROM prioritized_cards
  WHERE (pc_card_state != 'new' AND pc_priority != 4) OR (pc_state_rank <= remaining_new_cards)
  ORDER BY pc_priority ASC, pc_next_due ASC NULLS LAST
  LIMIT p_total_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_advanced_study_queue(UUID, INTEGER, INTEGER) TO authenticated; 