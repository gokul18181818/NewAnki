-- Fix Advanced SRS Functions and Data Issues
-- This migration fixes the function return type mismatches and data conflicts

-- ========================================
-- FIX 1: DUPLICATE DECK CONFIGS
-- ========================================

-- Remove duplicate deck configs (keep the first one for each deck)
DELETE FROM public.deck_configs 
WHERE id NOT IN (
  SELECT DISTINCT ON (deck_id) id 
  FROM public.deck_configs 
  ORDER BY deck_id, created_at ASC
);

-- ========================================
-- FIX 2: GET_DECK_CONFIG FUNCTION
-- ========================================

-- Fix the get_deck_config function to handle duplicates properly
CREATE OR REPLACE FUNCTION public.get_deck_config(p_deck_id UUID)
RETURNS public.deck_configs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  config_record public.deck_configs;
BEGIN
  -- Try to get existing config
  SELECT * INTO config_record 
  FROM public.deck_configs 
  WHERE deck_id = p_deck_id
  LIMIT 1; -- Ensure we only get one record
  
  -- If no config exists, create default one
  IF NOT FOUND THEN
    -- Use INSERT ... ON CONFLICT to handle race conditions
    INSERT INTO public.deck_configs (deck_id)
    VALUES (p_deck_id)
    ON CONFLICT (deck_id) DO NOTHING;
    
    -- Now get the config (either the one we just inserted or existing one)
    SELECT * INTO config_record 
    FROM public.deck_configs 
    WHERE deck_id = p_deck_id
    LIMIT 1;
  END IF;
  
  RETURN config_record;
END;
$$;

-- ========================================
-- FIX 3: ADVANCED STUDY QUEUE FUNCTION
-- ========================================

-- Fix the return type mismatch by ensuring all columns exist and match
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
  interval INTEGER,
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
  
  -- Check how many new cards studied today (safer query)
  SELECT COALESCE(COUNT(*), 0) INTO new_cards_today
  FROM public.reviews r
  JOIN public.cards c ON r.card_id = c.id
  WHERE c.deck_id = p_deck_id
    AND r.reviewed_at >= CURRENT_DATE
    AND c.review_count = 0; -- Use review_count instead of card_state for now
  
  -- Calculate remaining new cards for today
  remaining_new_cards := GREATEST(0, config_record.new_cards_per_day - new_cards_today);
  
  -- Return prioritized study queue with explicit column mapping
  RETURN QUERY
  WITH prioritized_cards AS (
    SELECT 
      c.id as card_id,
      COALESCE(c.type, 'basic') as card_type,
      COALESCE(c.front, '') as front,
      COALESCE(c.back, '') as back,
      COALESCE(c.card_state, 'new') as card_state,
      COALESCE(c.learning_step, 0) as learning_step,
      COALESCE(c.lapse_count, 0) as lapse_count,
      COALESCE(c.is_leech, false) as is_leech,
      COALESCE(c.next_due, NOW()) as next_due,
      COALESCE(c.ease_factor, 2.5) as ease_factor,
      COALESCE(c.interval, 1) as interval,
      CASE 
        WHEN COALESCE(c.card_state, 'new') = 'relearning' THEN 1  -- Highest priority
        WHEN COALESCE(c.card_state, 'new') = 'learning' THEN 2    -- Second priority
        WHEN COALESCE(c.card_state, 'new') = 'review' AND COALESCE(c.next_due, NOW()) <= NOW() THEN 3  -- Due reviews
        WHEN COALESCE(c.card_state, 'new') = 'new' OR c.review_count = 0 THEN 4         -- New cards
        ELSE 5  -- Future due cards
      END as priority,
      ROW_NUMBER() OVER (
        PARTITION BY COALESCE(c.card_state, 'new')
        ORDER BY 
          CASE WHEN COALESCE(c.card_state, 'new') IN ('learning', 'relearning') THEN COALESCE(c.next_due, NOW()) END ASC NULLS LAST,
          CASE WHEN COALESCE(c.card_state, 'new') = 'review' THEN COALESCE(c.next_due, NOW()) END ASC NULLS LAST,
          CASE WHEN COALESCE(c.card_state, 'new') = 'new' OR c.review_count = 0 THEN c.created_at END ASC NULLS LAST
      ) as state_rank
    FROM public.cards c
    JOIN public.decks d ON c.deck_id = d.id
    WHERE c.deck_id = p_deck_id
      AND d.owner_id = auth.uid()
      AND NOT COALESCE(c.is_leech, false)  -- Exclude leeches from normal study
      AND (
        COALESCE(c.card_state, 'new') IN ('learning', 'relearning') OR  -- Always include learning/relearning
        (COALESCE(c.card_state, 'new') = 'review' AND COALESCE(c.next_due, NOW()) <= NOW()) OR  -- Include due reviews
        (COALESCE(c.card_state, 'new') = 'new' AND remaining_new_cards > 0) OR  -- Include new if under limit
        (c.review_count = 0 AND remaining_new_cards > 0)  -- Include legacy new cards
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
    pc.interval,
    pc.priority
  FROM prioritized_cards pc
  WHERE 
    -- Respect new card daily limit
    (pc.card_state != 'new' AND pc.priority != 4) OR (pc.state_rank <= remaining_new_cards)
  ORDER BY pc.priority ASC, pc.next_due ASC NULLS LAST
  LIMIT p_total_limit;
END;
$$;

-- ========================================
-- FIX 4: ENSURE ALL CARDS HAVE PROPER STATES
-- ========================================

-- Safely update cards that don't have proper states
UPDATE public.cards 
SET 
  card_state = CASE 
    WHEN review_count = 0 THEN 'new'
    ELSE 'review'
  END,
  learning_step = COALESCE(learning_step, 0),
  lapse_count = COALESCE(lapse_count, 0),
  is_leech = COALESCE(is_leech, false)
WHERE card_state IS NULL;

-- ========================================
-- FIX 5: ENHANCED DECK STATS VIEW
-- ========================================

-- Recreate the deck_stats view with better error handling
DROP VIEW IF EXISTS public.deck_stats;

CREATE VIEW public.deck_stats AS
SELECT 
  d.id as deck_id,
  d.name as deck_name,
  COUNT(c.id) as total_cards,
  COUNT(CASE WHEN COALESCE(c.card_state, 'new') = 'new' OR c.review_count = 0 THEN 1 END) as new_cards,
  COUNT(CASE WHEN COALESCE(c.card_state, 'new') = 'learning' THEN 1 END) as learning_cards,
  COUNT(CASE WHEN COALESCE(c.card_state, 'new') = 'review' AND c.review_count > 0 THEN 1 END) as review_cards,
  COUNT(CASE WHEN COALESCE(c.card_state, 'new') = 'relearning' THEN 1 END) as relearning_cards,
  COUNT(CASE WHEN COALESCE(c.is_leech, false) = true THEN 1 END) as leech_cards,
  COUNT(CASE WHEN COALESCE(c.card_state, 'new') = 'review' AND COALESCE(c.next_due, NOW()) <= NOW() AND c.review_count > 0 THEN 1 END) as due_reviews
FROM public.decks d
LEFT JOIN public.cards c ON d.id = c.deck_id
WHERE d.owner_id = auth.uid()
GROUP BY d.id, d.name;

-- ========================================
-- FIX 6: STUDY_LOGS TABLE COMPATIBILITY
-- ========================================

-- Check if study_logs table exists and has proper structure
DO $$
BEGIN
  -- Add missing columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_logs' AND column_name = 'user_id') THEN
    ALTER TABLE public.study_logs ADD COLUMN user_id UUID REFERENCES auth.users(id);
    UPDATE public.study_logs SET user_id = auth.uid() WHERE user_id IS NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_logs' AND column_name = 'deck_id') THEN
    ALTER TABLE public.study_logs ADD COLUMN deck_id UUID REFERENCES public.decks(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_logs' AND column_name = 'cards_studied') THEN
    ALTER TABLE public.study_logs ADD COLUMN cards_studied INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_logs' AND column_name = 'time_spent_seconds') THEN
    ALTER TABLE public.study_logs ADD COLUMN time_spent_seconds INTEGER DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_logs' AND column_name = 'retention_rate') THEN
    ALTER TABLE public.study_logs ADD COLUMN retention_rate DECIMAL DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_logs' AND column_name = 'session_date') THEN
    ALTER TABLE public.study_logs ADD COLUMN session_date TIMESTAMPTZ DEFAULT NOW();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'study_logs' AND column_name = 'performance_data') THEN
    ALTER TABLE public.study_logs ADD COLUMN performance_data JSONB DEFAULT '{}';
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    -- Create study_logs table if it doesn't exist
    CREATE TABLE public.study_logs (
      id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE,
      cards_studied INTEGER DEFAULT 0,
      time_spent_seconds INTEGER DEFAULT 0,
      retention_rate DECIMAL DEFAULT 0,
      session_date TIMESTAMPTZ DEFAULT NOW(),
      performance_data JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    
    -- Enable RLS
    ALTER TABLE public.study_logs ENABLE ROW LEVEL SECURITY;
    
    -- Create policies
    CREATE POLICY "study_logs_owner_access" ON public.study_logs
      FOR ALL USING (user_id = auth.uid());
      
    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_study_logs_user_date ON public.study_logs (user_id, session_date DESC);
END $$;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_deck_config(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_advanced_study_queue(UUID, INTEGER, INTEGER) TO authenticated;

-- Add helpful comments
COMMENT ON FUNCTION public.get_deck_config IS 'Get or create default deck configuration with duplicate handling';
COMMENT ON FUNCTION public.get_advanced_study_queue IS 'Get prioritized study queue with proper state management and column mapping';

-- Verify function exists and is accessible
SELECT 'get_deck_config function exists' as status 
WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_deck_config');

SELECT 'get_advanced_study_queue function exists' as status 
WHERE EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_advanced_study_queue');