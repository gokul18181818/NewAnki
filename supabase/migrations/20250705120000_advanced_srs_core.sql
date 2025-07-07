-- Advanced SRS Core Implementation
-- This migration adds the core state machine and configuration system for advanced spaced repetition

-- ========================================
-- PHASE 1: Core SRS State Machine
-- ========================================

-- Add core SRS state columns to existing cards table
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS card_state TEXT DEFAULT 'new' 
  CHECK (card_state IN ('new', 'learning', 'review', 'relearning'));

ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS learning_step INTEGER DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS lapse_count INTEGER DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS is_leech BOOLEAN DEFAULT FALSE;

-- Add index for efficient state-based queries
CREATE INDEX IF NOT EXISTS idx_cards_state_due ON public.cards (card_state, next_due) WHERE NOT is_leech;
CREATE INDEX IF NOT EXISTS idx_cards_learning_step ON public.cards (learning_step) WHERE card_state IN ('learning', 'relearning');

-- ========================================
-- DECK CONFIGURATION SYSTEM
-- ========================================

-- Create deck configurations table for per-deck SRS settings
CREATE TABLE IF NOT EXISTS public.deck_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
  
  -- Learning phase settings
  learning_steps INTEGER[] DEFAULT '{1, 10}', -- minutes: [1 min, 10 min]
  graduating_interval INTEGER DEFAULT 1, -- days to first review after learning
  easy_interval INTEGER DEFAULT 4, -- days for easy graduation
  
  -- Relearning settings  
  relearning_steps INTEGER[] DEFAULT '{10}', -- minutes: [10 min]
  
  -- Daily limits and constraints
  new_cards_per_day INTEGER DEFAULT 20,
  maximum_interval INTEGER DEFAULT 36500, -- ~100 years in days
  
  -- Ease factor settings
  starting_ease DECIMAL DEFAULT 2.5,
  easy_bonus DECIMAL DEFAULT 0.15, -- Ease bonus for easy ratings
  hard_penalty DECIMAL DEFAULT 0.15, -- Ease penalty for hard ratings
  lapse_penalty DECIMAL DEFAULT 0.2, -- Ease penalty for lapses
  
  -- Leech detection
  lapse_threshold INTEGER DEFAULT 8, -- Number of lapses before marking as leech
  
  -- Timing metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one config per deck
  UNIQUE(deck_id)
);

-- Enable RLS for deck configs
ALTER TABLE public.deck_configs ENABLE ROW LEVEL SECURITY;

-- Deck config policies - only deck owners can access
CREATE POLICY "deck_configs_owner_access" ON public.deck_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.decks d 
      WHERE d.id = deck_id AND d.owner_id = auth.uid()
    )
  );

-- Index for efficient config lookups
CREATE INDEX IF NOT EXISTS idx_deck_configs_deck_id ON public.deck_configs (deck_id);

-- ========================================
-- DEFAULT CONFIGURATION HELPER
-- ========================================

-- Function to get or create default deck configuration
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
  WHERE deck_id = p_deck_id;
  
  -- If no config exists, create default one
  IF NOT FOUND THEN
    INSERT INTO public.deck_configs (deck_id)
    VALUES (p_deck_id)
    RETURNING * INTO config_record;
  END IF;
  
  RETURN config_record;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_deck_config(UUID) TO authenticated;

-- ========================================
-- ENHANCED STUDY QUEUE FUNCTION
-- ========================================

-- Advanced study queue that respects card states and learning progression
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
  new_cards_today INTEGER;
  remaining_new_cards INTEGER;
BEGIN
  -- Get deck configuration
  SELECT * INTO config_record FROM public.get_deck_config(p_deck_id);
  
  -- Check how many new cards studied today
  SELECT COUNT(*) INTO new_cards_today
  FROM public.reviews r
  JOIN public.cards c ON r.card_id = c.id
  WHERE c.deck_id = p_deck_id
    AND r.reviewed_at >= CURRENT_DATE
    AND c.card_state = 'new';
  
  -- Calculate remaining new cards for today
  remaining_new_cards := GREATEST(0, config_record.new_cards_per_day - new_cards_today);
  
  -- Return prioritized study queue
  RETURN QUERY
  WITH prioritized_cards AS (
    SELECT 
      c.id as card_id,
      c.type as card_type,
      c.front,
      c.back,
      c.card_state,
      c.learning_step,
      c.lapse_count,
      c.is_leech,
      c.next_due,
      c.ease_factor,
      c.interval,
      CASE 
        WHEN c.card_state = 'relearning' THEN 1  -- Highest priority
        WHEN c.card_state = 'learning' THEN 2    -- Second priority
        WHEN c.card_state = 'review' AND c.next_due <= NOW() THEN 3  -- Due reviews
        WHEN c.card_state = 'new' THEN 4         -- New cards (if under limit)
        ELSE 5  -- Future due cards
      END as priority,
      ROW_NUMBER() OVER (
        PARTITION BY c.card_state 
        ORDER BY 
          CASE WHEN c.card_state IN ('learning', 'relearning') THEN c.next_due END ASC NULLS LAST,
          CASE WHEN c.card_state = 'review' THEN c.next_due END ASC NULLS LAST,
          CASE WHEN c.card_state = 'new' THEN c.created_at END ASC NULLS LAST
      ) as state_rank
    FROM public.cards c
    JOIN public.decks d ON c.deck_id = d.id
    WHERE c.deck_id = p_deck_id
      AND d.owner_id = auth.uid()
      AND NOT c.is_leech  -- Exclude leeches from normal study
      AND (
        c.card_state IN ('learning', 'relearning') OR  -- Always include learning/relearning
        (c.card_state = 'review' AND c.next_due <= NOW()) OR  -- Include due reviews
        (c.card_state = 'new' AND remaining_new_cards > 0)  -- Include new if under limit
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
    (pc.card_state != 'new' OR pc.state_rank <= remaining_new_cards)
  ORDER BY pc.priority ASC, pc.next_due ASC NULLS LAST
  LIMIT p_total_limit;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_advanced_study_queue(UUID, INTEGER, INTEGER) TO authenticated;

-- ========================================
-- MIGRATION DATA UPDATES
-- ========================================

-- Update existing cards to use new state system
-- All existing cards with review_count = 0 are 'new'
-- All existing cards with review_count > 0 are 'review'
UPDATE public.cards 
SET card_state = CASE 
  WHEN review_count = 0 THEN 'new'
  ELSE 'review'
END
WHERE card_state = 'new';  -- Only update if still default

-- Create default configurations for existing decks
INSERT INTO public.deck_configs (deck_id)
SELECT DISTINCT d.id
FROM public.decks d
LEFT JOIN public.deck_configs dc ON d.id = dc.deck_id
WHERE dc.deck_id IS NULL;

-- ========================================
-- HELPER VIEWS FOR ANALYTICS
-- ========================================

-- View for deck statistics with state breakdown
CREATE OR REPLACE VIEW public.deck_stats AS
SELECT 
  d.id as deck_id,
  d.name as deck_name,
  COUNT(c.id) as total_cards,
  COUNT(CASE WHEN c.card_state = 'new' THEN 1 END) as new_cards,
  COUNT(CASE WHEN c.card_state = 'learning' THEN 1 END) as learning_cards,
  COUNT(CASE WHEN c.card_state = 'review' THEN 1 END) as review_cards,
  COUNT(CASE WHEN c.card_state = 'relearning' THEN 1 END) as relearning_cards,
  COUNT(CASE WHEN c.is_leech THEN 1 END) as leech_cards,
  COUNT(CASE WHEN c.card_state = 'review' AND c.next_due <= NOW() THEN 1 END) as due_reviews
FROM public.decks d
LEFT JOIN public.cards c ON d.id = c.deck_id
WHERE d.owner_id = auth.uid()
GROUP BY d.id, d.name;

-- ========================================
-- UPDATE TRIGGERS
-- ========================================

-- Ensure updated_at is maintained for deck_configs
DROP TRIGGER IF EXISTS tr_deck_configs_updated_at ON public.deck_configs;
CREATE TRIGGER tr_deck_configs_updated_at
  BEFORE UPDATE ON public.deck_configs
  FOR EACH ROW
  EXECUTE PROCEDURE public.update_updated_at_column();

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON TABLE public.deck_configs IS 'Configuration settings for advanced SRS behavior per deck';
COMMENT ON COLUMN public.cards.card_state IS 'Current learning state: new, learning, review, or relearning';
COMMENT ON COLUMN public.cards.learning_step IS 'Current step in learning/relearning progression (0-based index)';
COMMENT ON COLUMN public.cards.lapse_count IS 'Number of times this card has been forgotten (rating 0)';
COMMENT ON COLUMN public.cards.is_leech IS 'Card marked as leech due to excessive forgetting';
COMMENT ON FUNCTION public.get_advanced_study_queue IS 'Returns prioritized cards for study respecting SRS states and daily limits';