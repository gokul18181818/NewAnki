-- Add missing streak and calendar functions for proper streak persistence

-- Function to calculate and return streak information
CREATE OR REPLACE FUNCTION get_streak_info(p_user_id UUID)
RETURNS TABLE (
  current_streak INTEGER,
  longest_streak INTEGER,
  total_study_days INTEGER,
  last_study_date DATE
) AS $$
DECLARE
  study_dates DATE[];
  current_date_check DATE;
  temp_streak INTEGER;
  max_streak INTEGER;
  i INTEGER;
BEGIN
  -- Get all unique study dates from reviews table
  SELECT ARRAY_AGG(DISTINCT DATE(reviewed_at ORDER BY reviewed_at DESC))
  INTO study_dates
  FROM reviews r
  JOIN cards c ON r.card_id = c.id
  JOIN decks d ON c.deck_id = d.id
  WHERE d.owner_id = p_user_id
    AND reviewed_at >= NOW() - INTERVAL '1 year';
  
  -- Initialize variables
  current_streak := 0;
  longest_streak := 0;
  total_study_days := COALESCE(array_length(study_dates, 1), 0);
  last_study_date := NULL;
  
  -- Handle empty case
  IF total_study_days = 0 THEN
    RETURN QUERY SELECT 0, 0, 0, NULL::DATE;
    RETURN;
  END IF;
  
  -- Sort dates descending
  SELECT ARRAY_AGG(date_val ORDER BY date_val DESC)
  INTO study_dates
  FROM unnest(study_dates) AS date_val;
  
  -- Set last study date
  last_study_date := study_dates[1];
  
  -- Calculate current streak (backwards from today)
  current_date_check := CURRENT_DATE;
  FOR i IN 1..array_length(study_dates, 1) LOOP
    IF study_dates[i] = current_date_check THEN
      current_streak := current_streak + 1;
      current_date_check := current_date_check - INTERVAL '1 day';
    ELSE
      -- If we missed today, check if we studied yesterday
      IF i = 1 AND study_dates[i] = CURRENT_DATE - INTERVAL '1 day' THEN
        current_streak := current_streak + 1;
        current_date_check := current_date_check - INTERVAL '2 days';
      ELSE
        EXIT;
      END IF;
    END IF;
  END LOOP;
  
  -- Calculate longest streak
  temp_streak := 1;
  max_streak := 1;
  
  FOR i IN 2..array_length(study_dates, 1) LOOP
    IF study_dates[i] = study_dates[i-1] - INTERVAL '1 day' THEN
      temp_streak := temp_streak + 1;
      max_streak := GREATEST(max_streak, temp_streak);
    ELSE
      temp_streak := 1;
    END IF;
  END LOOP;
  
  longest_streak := max_streak;
  
  RETURN QUERY SELECT current_streak, longest_streak, total_study_days, last_study_date;
END;
$$ LANGUAGE plpgsql;

-- Function to get study calendar data
CREATE OR REPLACE FUNCTION get_study_calendar_data(p_user_id UUID)
RETURNS TABLE (
  study_date DATE,
  cards_studied INTEGER,
  sessions_count INTEGER,
  total_time_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(sl.session_date) as study_date,
    SUM(sl.cards_studied)::INTEGER as cards_studied,
    COUNT(sl.id)::INTEGER as sessions_count,
    SUM(sl.time_spent_seconds / 60)::INTEGER as total_time_minutes
  FROM study_logs sl
  WHERE sl.user_id = p_user_id
    AND sl.session_date >= NOW() - INTERVAL '1 year'
  GROUP BY DATE(sl.session_date)
  ORDER BY study_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Create a persistent streak tracking table
CREATE TABLE IF NOT EXISTS user_streaks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_study_days INTEGER NOT NULL DEFAULT 0,
  last_study_date DATE,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own streak data" ON user_streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streak data" ON user_streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streak data" ON user_streaks
  FOR UPDATE USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX idx_user_streaks_last_study_date ON user_streaks(last_study_date);

-- Function to update streak data when user studies
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
  streak_info RECORD;
BEGIN
  -- Get current streak information
  SELECT * INTO streak_info FROM get_streak_info(p_user_id);
  
  -- Upsert streak data
  INSERT INTO user_streaks (
    user_id, 
    current_streak, 
    longest_streak, 
    total_study_days, 
    last_study_date,
    last_updated
  )
  VALUES (
    p_user_id,
    streak_info.current_streak,
    streak_info.longest_streak,
    streak_info.total_study_days,
    streak_info.last_study_date,
    NOW()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    current_streak = EXCLUDED.current_streak,
    longest_streak = GREATEST(user_streaks.longest_streak, EXCLUDED.longest_streak),
    total_study_days = EXCLUDED.total_study_days,
    last_study_date = EXCLUDED.last_study_date,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update streak when reviews are added
CREATE OR REPLACE FUNCTION trigger_update_user_streak()
RETURNS TRIGGER AS $$
DECLARE
  deck_owner_id UUID;
BEGIN
  -- Get the deck owner (user who owns the card being reviewed)
  SELECT d.owner_id INTO deck_owner_id
  FROM decks d
  JOIN cards c ON d.id = c.deck_id
  WHERE c.id = NEW.card_id;
  
  -- Update streak for the deck owner
  IF deck_owner_id IS NOT NULL THEN
    PERFORM update_user_streak(deck_owner_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on reviews table
DROP TRIGGER IF EXISTS tr_update_user_streak ON reviews;
CREATE TRIGGER tr_update_user_streak
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_user_streak();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_streak_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_study_calendar_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_streak(UUID) TO authenticated;