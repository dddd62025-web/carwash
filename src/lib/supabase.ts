import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xlvnjueaiwiqkejsnodg.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhsdm5qdWVhaXdpcWtlanNub2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3ODY1NTcsImV4cCI6MjA5OTM2MjU1N30.T1gotW1V-izEqahhC-PG68ltSTz-svH6Xf0aPGC4isg';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isMockEnabled = false; 
