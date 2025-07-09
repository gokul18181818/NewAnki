-- Fix response_time_baselines table to match the code expectations
-- Drop the old table structure and create the correct one

DROP TABLE IF EXISTS response_time_baselines;

-- Create response_time_baselines table with correct columns
CREATE TABLE IF NOT EXISTS response_time_baselines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  average_time INTEGER NOT NULL,
  standard_deviation NUMERIC NOT NULL,
  sample_size INTEGER DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  by_difficulty JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create response_times table for individual response time data
CREATE TABLE IF NOT EXISTS response_times (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  time_to_show_answer INTEGER NOT NULL,
  time_to_rate INTEGER NOT NULL,
  total_time INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  difficulty NUMERIC DEFAULT 0,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE response_time_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_times ENABLE ROW LEVEL SECURITY;

-- RLS policies for response_time_baselines
CREATE POLICY "Users can view their own response time baselines" ON response_time_baselines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own response time baselines" ON response_time_baselines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own response time baselines" ON response_time_baselines
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS policies for response_times
CREATE POLICY "Users can view their own response times" ON response_times
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own response times" ON response_times
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_response_time_baselines_user_id ON response_time_baselines(user_id);
CREATE INDEX idx_response_times_user_id ON response_times(user_id);
CREATE INDEX idx_response_times_timestamp ON response_times(user_id, timestamp DESC);

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

-- Function to cleanup old response time data
CREATE OR REPLACE FUNCTION cleanup_old_response_times(p_user_id UUID, p_keep_count INTEGER)
RETURNS void AS $$
BEGIN
  DELETE FROM response_times
  WHERE user_id = p_user_id
    AND id NOT IN (
      SELECT id FROM response_times
      WHERE user_id = p_user_id
      ORDER BY timestamp DESC
      LIMIT p_keep_count
    );
END;
$$ LANGUAGE plpgsql;