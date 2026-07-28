import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://oskgvlwdncqsnoycerud.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9za2d2bHdkbmNxc25veWNlcnVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzMTM1OTIsImV4cCI6MjA5Nzg4OTU5Mn0.5VptNDTNb2d0PxDwDtsAV-euLHLWm632UwCpO5Fk97E';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
