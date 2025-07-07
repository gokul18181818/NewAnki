-- Create user_preferences table to store user settings
CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preferences JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one preferences record per user
    UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create response_times table for response time baseline learning
CREATE TABLE IF NOT EXISTS response_times (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id UUID NOT NULL,
    time_to_show_answer INTEGER NOT NULL, -- milliseconds
    time_to_rate INTEGER NOT NULL, -- milliseconds
    total_time INTEGER NOT NULL, -- milliseconds
    rating TEXT NOT NULL CHECK (rating IN ('😞', '😐', '😊', '😁')),
    difficulty REAL NOT NULL DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for response_times
CREATE INDEX IF NOT EXISTS idx_response_times_user_id ON response_times(user_id);
CREATE INDEX IF NOT EXISTS idx_response_times_timestamp ON response_times(timestamp);
CREATE INDEX IF NOT EXISTS idx_response_times_user_timestamp ON response_times(user_id, timestamp DESC);

-- Create response_time_baselines table
CREATE TABLE IF NOT EXISTS response_time_baselines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    average_time REAL NOT NULL, -- milliseconds
    standard_deviation REAL NOT NULL,
    sample_size INTEGER NOT NULL,
    by_difficulty JSONB NOT NULL DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one baseline record per user
    UNIQUE(user_id)
);

-- Create index for baselines
CREATE INDEX IF NOT EXISTS idx_response_time_baselines_user_id ON response_time_baselines(user_id);

-- Create function to cleanup old response times
CREATE OR REPLACE FUNCTION cleanup_old_response_times(p_user_id UUID, p_keep_count INTEGER DEFAULT 1000)
RETURNS VOID AS $$
BEGIN
    -- Delete all but the most recent p_keep_count records for the user
    DELETE FROM response_times 
    WHERE user_id = p_user_id 
    AND id NOT IN (
        SELECT id 
        FROM response_times 
        WHERE user_id = p_user_id 
        ORDER BY timestamp DESC 
        LIMIT p_keep_count
    );
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_time_baselines ENABLE ROW LEVEL SECURITY;

-- Policies for user_preferences
CREATE POLICY "Users can view their own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences" ON user_preferences
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for response_times
CREATE POLICY "Users can view their own response times" ON response_times
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own response times" ON response_times
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for response_time_baselines
CREATE POLICY "Users can view their own baselines" ON response_time_baselines
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own baselines" ON response_time_baselines
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own baselines" ON response_time_baselines
    FOR UPDATE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT ALL ON user_preferences TO authenticated;
GRANT ALL ON response_times TO authenticated;
GRANT ALL ON response_time_baselines TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_response_times TO authenticated;