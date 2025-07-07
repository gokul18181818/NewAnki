-- Check current schema of user_preferences table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'user_preferences' 
AND table_schema = 'public';

-- Add missing tables if they don't exist
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

CREATE TABLE IF NOT EXISTS response_time_baselines (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    average_time REAL NOT NULL, -- milliseconds
    standard_deviation REAL NOT NULL,
    sample_size INTEGER NOT NULL,
    by_difficulty JSONB NOT NULL DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_response_times_user_id ON response_times(user_id);
CREATE INDEX IF NOT EXISTS idx_response_times_timestamp ON response_times(timestamp);
CREATE INDEX IF NOT EXISTS idx_response_time_baselines_user_id ON response_time_baselines(user_id);

-- Enable RLS on new tables
ALTER TABLE response_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_time_baselines ENABLE ROW LEVEL SECURITY;

-- Create policies for response_times
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own response times' AND tablename = 'response_times') THEN
        CREATE POLICY "Users can view their own response times" ON response_times
            FOR SELECT USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own response times' AND tablename = 'response_times') THEN
        CREATE POLICY "Users can insert their own response times" ON response_times
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Create policies for response_time_baselines
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own baselines' AND tablename = 'response_time_baselines') THEN
        CREATE POLICY "Users can manage their own baselines" ON response_time_baselines
            FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_response_times(p_user_id UUID, p_keep_count INTEGER DEFAULT 1000)
RETURNS VOID AS $$
BEGIN
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

-- Grant permissions
GRANT ALL ON response_times TO authenticated;
GRANT ALL ON response_time_baselines TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_response_times TO authenticated;