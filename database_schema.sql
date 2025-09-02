-- Create morning_loggers table for storing logger data (only if it doesn't exist)
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

-- Add missing columns if they don't exist (safe to run multiple times)
DO $$ 
BEGIN
  -- Add temp_offset column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'temp_offset') THEN
    ALTER TABLE morning_loggers ADD COLUMN temp_offset DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
  
  -- Add day_offset column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'day_offset') THEN
    ALTER TABLE morning_loggers ADD COLUMN day_offset DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
  
  -- Add night_offset column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'night_offset') THEN
    ALTER TABLE morning_loggers ADD COLUMN night_offset DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
  
  -- Add base_temp column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'base_temp') THEN
    ALTER TABLE morning_loggers ADD COLUMN base_temp DOUBLE PRECISION NOT NULL DEFAULT 3;
  END IF;
  
  -- Add data_table column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'data_table') THEN
    ALTER TABLE morning_loggers ADD COLUMN data_table JSONB;
  END IF;
  
  -- Add accumulated_dg column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'accumulated_dg') THEN
    ALTER TABLE morning_loggers ADD COLUMN accumulated_dg DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
  
  -- Add last_fetched column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'last_fetched') THEN
    ALTER TABLE morning_loggers ADD COLUMN last_fetched TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Add is_running column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'is_running') THEN
    ALTER TABLE morning_loggers ADD COLUMN is_running BOOLEAN NOT NULL DEFAULT false;
  END IF;
  
  -- Add start_time column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'start_time') THEN
    ALTER TABLE morning_loggers ADD COLUMN start_time TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Add created_at column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'created_at') THEN
    ALTER TABLE morning_loggers ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  
  -- Add updated_at column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'morning_loggers' AND column_name = 'updated_at') THEN
    ALTER TABLE morning_loggers ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- Enable Row Level Security (RLS) if not already enabled
ALTER TABLE morning_loggers ENABLE ROW LEVEL SECURITY;

-- Create policy only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'morning_loggers' AND policyname = 'Allow all operations on morning_loggers') THEN
    CREATE POLICY "Allow all operations on morning_loggers" ON morning_loggers
      FOR ALL USING (true);
  END IF;
END $$;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_morning_loggers_updated_at') THEN
    CREATE TRIGGER update_morning_loggers_updated_at 
      BEFORE UPDATE ON morning_loggers 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Create indexes only if they don't exist
CREATE INDEX IF NOT EXISTS idx_morning_loggers_is_running ON morning_loggers(is_running);
CREATE INDEX IF NOT EXISTS idx_morning_loggers_start_time ON morning_loggers(start_time);
CREATE INDEX IF NOT EXISTS idx_morning_loggers_created_at ON morning_loggers(created_at);
