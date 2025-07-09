-- Add user learning profiles table for adaptive personalization
CREATE TABLE IF NOT EXISTS user_learning_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_cards_studied INTEGER DEFAULT 0,
  average_session_length NUMERIC DEFAULT 25.0, -- in minutes
  average_cards_per_session NUMERIC DEFAULT 15.0,
  average_retention_rate NUMERIC DEFAULT 0.75, -- 0-1 scale
  preferred_study_times INTEGER[] DEFAULT ARRAY[9, 14, 19], -- hours of day
  fatigue_threshold NUMERIC DEFAULT 65.0, -- personalized fatigue warning threshold
  optimal_break_interval INTEGER DEFAULT 25, -- minutes between breaks
  optimal_break_duration INTEGER DEFAULT 10, -- minutes for breaks
  celebration_frequency INTEGER DEFAULT 5, -- every X correct answers
  milestone_progression INTEGER[] DEFAULT ARRAY[25, 75, 150, 300, 500], -- personalized milestones
  study_velocity NUMERIC DEFAULT 5.0, -- cards per hour
  consistency_score NUMERIC DEFAULT 0.5, -- 0-1 scale
  difficulty_tolerance NUMERIC DEFAULT 0.7, -- 0-1 scale
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS policies
ALTER TABLE user_learning_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own learning profile" ON user_learning_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own learning profile" ON user_learning_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning profile" ON user_learning_profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_user_learning_profiles_user_id ON user_learning_profiles(user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_learning_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_learning_profile_updated_at_trigger
  BEFORE UPDATE ON user_learning_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_learning_profile_updated_at();