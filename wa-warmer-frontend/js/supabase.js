import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://eevlafxgxplfjfpcbghc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVldmxhZnhneHBsZmpmcGNiZ2hjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NTI2NjEsImV4cCI6MjA5MDQyODY2MX0.8lkUZBkl8zFRwxWcmF-v4q8OD4eQ4ld4mbwUBl0Kr3Q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);