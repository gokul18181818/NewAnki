-- Fix ambiguous column references in get_advanced_study_queue function
-- This fixes the "column reference card_id is ambiguous" error

CREATE OR REPLACE FUNCTION public.get_advanced_study_queue(
  p_deck_id UUID,
  p_new_limit INTEGER DEFAULT 20,
  p_total_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  card_id UUID,
  card_type TEXT,
  front TEXT,
  back TEXT,
  card_state TEXT,
  learning_step INTEGER,
  lapse_count INTEGER,
  is_leech BOOLEAN,
  next_due TIMESTAMPTZ,
  ease_factor DECIMAL,
  interval_days INTEGER,
  priority INTEGER
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
  
  -- Check how many new cards studied today (use fully qualified column names)
  SELECT COALESCE(COUNT(*), 0) INTO new_cards_today
  FROM public.reviews r
  JOIN public.cards c ON r.card_id = c.id
  WHERE c.deck_id = p_deck_id
    AND r.reviewed_at >= CURRENT_DATE
    AND c.review_count = 0; -- Use review_count instead of card_state for now
  
  -- Calculate remaining new cards for today
  remaining_new_cards := GREATEST(0, config_record.new_cards_per_day - new_cards_today);
  
  -- Return prioritized study queue with fully qualified column names
  RETURN QUERY
  WITH prioritized_cards AS (
    SELECT 
      cards.id as card_id,
      COALESCE(cards.type, 'basic') as card_type,
      COALESCE(cards.front, '') as front,
      COALESCE(cards.back, '') as back,
      COALESCE(cards.card_state, 'new') as card_state,
      COALESCE(cards.learning_step, 0) as learning_step,
      COALESCE(cards.lapse_count, 0) as lapse_count,
      COALESCE(cards.is_leech, false) as is_leech,
      COALESCE(cards.next_due, NOW()) as next_due,
      COALESCE(cards.ease_factor, 2.5) as ease_factor,
      COALESCE(cards.interval, 1) as interval_days,
      CASE 
        WHEN COALESCE(cards.card_state, 'new') = 'relearning' THEN 1  -- Highest priority
        WHEN COALESCE(cards.card_state, 'new') = 'learning' THEN 2    -- Second priority
        WHEN COALESCE(cards.card_state, 'new') = 'review' AND COALESCE(cards.next_due, NOW()) <= NOW() THEN 3  -- Due reviews
        WHEN COALESCE(cards.card_state, 'new') = 'new' OR cards.review_count = 0 THEN 4         -- New cards
        ELSE 5  -- Future due cards
      END as priority,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(cards.card_state, 'new')
        ORDER BY 
          CASE WHEN COALESCE(cards.card_state, 'new') IN ('learning', 'relearning') THEN COALESCE(cards.next_due, NOW()) END ASC NULLS LAST,
          CASE WHEN COALESCE(cards.card_state, 'new') = 'review' THEN COALESCE(cards.next_due, NOW()) END ASC NULLS LAST,
          CASE WHEN COALESCE(cards.card_state, 'new') = 'new' OR cards.review_count = 0 THEN cards.created_at END ASC NULLS LAST
      ) as state_rank
    FROM public.cards cards
    JOIN public.decks decks ON cards.deck_id = decks.id
    WHERE cards.deck_id = p_deck_id
      AND decks.owner_id = auth.uid()
      AND NOT COALESCE(cards.is_leech, false)  -- Exclude leeches from normal study
      AND (
        COALESCE(cards.card_state, 'new') IN ('learning', 'relearning') OR  -- Always include learning/relearning
        (COALESCE(cards.card_state, 'new') = 'review' AND COALESCE(cards.next_due, NOW()) <= NOW()) OR  -- Include due reviews
        (COALESCE(cards.card_state, 'new') = 'new' AND remaining_new_cards > 0) OR  -- Include new if under limit
        (cards.review_count = 0 AND remaining_new_cards > 0)  -- Include legacy new cards
      )
  )
  SELECT 
    pc.card_id,
    pc.card_type,
    pc.front,
    pc.back,
    pc.card_state,
    pc.learning_step,
    pc.lapse_count,
    pc.is_leech,
    pc.next_due,
    pc.ease_factor,
    pc.interval_days,
    pc.priority
  FROM prioritized_cards pc
  WHERE 
    -- Respect new card daily limit
    (pc.card_state != 'new' AND pc.priority != 4) OR (pc.state_rank <= remaining_new_cards)
  ORDER BY pc.priority ASC, pc.next_due ASC NULLS LAST
  LIMIT p_total_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_advanced_study_queue(UUID, INTEGER, INTEGER) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION public.get_advanced_study_queue IS 'Get prioritized study queue with fixed column ambiguity issues';