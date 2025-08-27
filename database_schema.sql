-- Create morning_loggers table for storing mørningsloggers
CREATE TABLE IF NOT EXISTS morning_loggers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  target INTEGER NOT NULL DEFAULT 40,
  temp_offset INTEGER NOT NULL DEFAULT 0,
  day_offset INTEGER NOT NULL DEFAULT 0,
  night_offset INTEGER NOT NULL DEFAULT 0,
  base_temp INTEGER NOT NULL DEFAULT 0,
  data_table JSONB DEFAULT '[]'::jsonb,
  accumulated_dg DOUBLE PRECISION DEFAULT 0,
  last_fetched TIMESTAMP WITH TIME ZONE,
  is_running BOOLEAN DEFAULT false,
  start_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create global settings table for tracking last real update
CREATE TABLE IF NOT EXISTS global_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  last_real_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default global settings
INSERT INTO global_settings (id, last_real_update) 
VALUES ('default', NOW()) 
ON CONFLICT (id) DO NOTHING;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_morning_loggers_created_at ON morning_loggers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_morning_loggers_is_running ON morning_loggers(is_running);

-- Enable Row Level Security (RLS)
ALTER TABLE morning_loggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for now - you can restrict this later)
CREATE POLICY "Allow all operations on morning_loggers" ON morning_loggers
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on global_settings" ON global_settings
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
CREATE TRIGGER update_morning_loggers_updated_at 
  BEFORE UPDATE ON morning_loggers 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_settings_updated_at 
  BEFORE UPDATE ON global_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
