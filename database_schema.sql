-- Create morning_loggers table for storing logger data
CREATE TABLE IF NOT EXISTS morning_loggers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  target INTEGER NOT NULL DEFAULT 40,
  temp_offset DOUBLE PRECISION NOT NULL DEFAULT 0,
  day_offset DOUBLE PRECISION NOT NULL DEFAULT 0,
  night_offset DOUBLE PRECISION NOT NULL DEFAULT 0,
  base_temp DOUBLE PRECISION NOT NULL DEFAULT 3,
  data_table JSONB,
  accumulated_dg DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_fetched TIMESTAMP WITH TIME ZONE,
  is_running BOOLEAN NOT NULL DEFAULT false,
  start_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE morning_loggers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on morning_loggers" ON morning_loggers
  FOR ALL USING (true);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_morning_loggers_updated_at ON morning_loggers;
CREATE TRIGGER update_morning_loggers_updated_at 
  BEFORE UPDATE ON morning_loggers 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_morning_loggers_is_running ON morning_loggers(is_running);
CREATE INDEX IF NOT EXISTS idx_morning_loggers_start_time ON morning_loggers(start_time);
CREATE INDEX IF NOT EXISTS idx_morning_loggers_created_at ON morning_loggers(created_at);
