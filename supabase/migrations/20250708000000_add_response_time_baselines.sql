-- Add response_time_baselines table for anti-burnout system
CREATE TABLE IF NOT EXISTS response_time_baselines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE,
  card_difficulty_range TEXT NOT NULL, -- 'easy', 'medium', 'hard'
  baseline_response_time_ms INTEGER NOT NULL,
  confidence_interval NUMERIC DEFAULT 0.95,
  sample_size INTEGER DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, deck_id, card_difficulty_range)
);

-- Enable RLS
ALTER TABLE response_time_baselines ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own response time baselines" ON response_time_baselines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own response time baselines" ON response_time_baselines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own response time baselines" ON response_time_baselines
  FOR UPDATE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_response_time_baselines_user_id ON response_time_baselines(user_id);
CREATE INDEX idx_response_time_baselines_deck_id ON response_time_baselines(deck_id);

-- Function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_response_time_baselines_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update last_updated
CREATE TRIGGER update_response_time_baselines_updated_at_trigger
  BEFORE UPDATE ON response_time_baselines
  FOR EACH ROW
  EXECUTE FUNCTION update_response_time_baselines_updated_at();