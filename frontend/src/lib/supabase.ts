import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://emqiscdnvmjjrqapccib.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtcWlzY2Rudm1qanJxYXBjY2liIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIzNDM1MjQsImV4cCI6MjA2NzkxOTUyNH0.EhPcX3k9V45sgMUdN8o-wvk2FjUCvRdsQrGup3y7GtI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
