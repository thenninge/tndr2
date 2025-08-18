import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://vpjdqhrechwakhfrvuyvk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwamRxaHJlY3dha2hmcnZ1eXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MTQwNTMsImV4cCI6MjA3MTA5MDA1M30.zFI1WB8t0E8OGrXvdvIN1dBm6jra47wLhC4Piep1ryY'
);
