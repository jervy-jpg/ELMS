const supabaseUrl = "https://uuxamxpoeuinjpebvxfw.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1eGFteHBvZXVpbmpwZWJ2eGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMjc2NDgsImV4cCI6MjA5MjgwMzY0OH0.XcghSzJZD3-vwQQSMHz_U3gzPf73v2I1mMwyFE_LJ7A";

// ✅ Create client WITHOUT declaring a new `supabase` variable
// ✅ Attach it to window.supabaseClient exactly as dashboard expects
window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey);