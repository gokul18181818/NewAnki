-- Fix function variable scope conflict in get_advanced_study_queue
-- The RETURNS TABLE column names were conflicting with query column references

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
  result_ease_factor DECIMAL,
  result_interval_days INTEGER,
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
  -- Get deck configuration
  SELECT * INTO config_record FROM public.get_deck_config(p_deck_id);
  
  -- Check how many new cards studied today (fully qualified and explicit)
  SELECT COALESCE(COUNT(*), 0) INTO new_cards_today
  FROM public.reviews review_table
  JOIN public.cards card_table ON review_table.card_id = card_table.id
  WHERE card_table.deck_id = p_deck_id
    AND review_table.reviewed_at >= CURRENT_DATE
    AND card_table.review_count = 0;
  
  -- Calculate remaining new cards for today
  remaining_new_cards := GREATEST(0, config_record.new_cards_per_day - new_cards_today);
  
  -- Return prioritized study queue with completely unambiguous column references
  RETURN QUERY
  WITH prioritized_cards AS (
    SELECT 
      card_table.id as pc_card_id,
      COALESCE(card_table.type, 'basic') as pc_card_type,
      COALESCE(card_table.front, '') as pc_front,
      COALESCE(card_table.back, '') as pc_back,
      COALESCE(card_table.card_state, 'new') as pc_card_state,
      COALESCE(card_table.learning_step, 0) as pc_learning_step,
      COALESCE(card_table.lapse_count, 0) as pc_lapse_count,
      COALESCE(card_table.is_leech, false) as pc_is_leech,
      COALESCE(card_table.next_due, NOW()) as pc_next_due,
      COALESCE(card_table.ease_factor, 2.5) as pc_ease_factor,
      COALESCE(card_table.interval, 1) as pc_interval_days,
      CASE 
        WHEN COALESCE(card_table.card_state, 'new') = 'relearning' THEN 1
        WHEN COALESCE(card_table.card_state, 'new') = 'learning' THEN 2
        WHEN COALESCE(card_table.card_state, 'new') = 'review' AND COALESCE(card_table.next_due, NOW()) <= NOW() THEN 3
        WHEN COALESCE(card_table.card_state, 'new') = 'new' OR card_table.review_count = 0 THEN 4
        ELSE 5
      END as pc_priority,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(card_table.card_state, 'new')
        ORDER BY 
          CASE WHEN COALESCE(card_table.card_state, 'new') IN ('learning', 'relearning') 
               THEN COALESCE(card_table.next_due, NOW()) END ASC NULLS LAST,
          CASE WHEN COALESCE(card_table.card_state, 'new') = 'review' 
               THEN COALESCE(card_table.next_due, NOW()) END ASC NULLS LAST,
          CASE WHEN COALESCE(card_table.card_state, 'new') = 'new' OR card_table.review_count = 0 
               THEN card_table.created_at END ASC NULLS LAST
      ) as pc_state_rank
    FROM public.cards card_table
    JOIN public.decks deck_table ON card_table.deck_id = deck_table.id
    WHERE card_table.deck_id = p_deck_id
      AND deck_table.owner_id = auth.uid()
      AND NOT COALESCE(card_table.is_leech, false)
      AND (
        COALESCE(card_table.card_state, 'new') IN ('learning', 'relearning') OR
        (COALESCE(card_table.card_state, 'new') = 'review' AND COALESCE(card_table.next_due, NOW()) <= NOW()) OR
        (COALESCE(card_table.card_state, 'new') = 'new' AND remaining_new_cards > 0) OR
        (card_table.review_count = 0 AND remaining_new_cards > 0)
      )
  )
  SELECT 
    pc.pc_card_id,
    pc.pc_card_type,
    pc.pc_front,
    pc.pc_back,
    pc.pc_card_state,
    pc.pc_learning_step,
    pc.pc_lapse_count,
    pc.pc_is_leech,
    pc.pc_next_due,
    pc.pc_ease_factor,
    pc.pc_interval_days,
    pc.pc_priority
  FROM prioritized_cards pc
  WHERE 
    (pc.pc_card_state != 'new' AND pc.pc_priority != 4) OR (pc.pc_state_rank <= remaining_new_cards)
  ORDER BY pc.pc_priority ASC, pc.pc_next_due ASC NULLS LAST
  LIMIT p_total_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_advanced_study_queue(UUID, INTEGER, INTEGER) TO authenticated;