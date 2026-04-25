let _client = null;

export async function getSupabase() {
  if (_client) return _client;

  const res    = await fetch("/api/config");
  const config = await res.json();

  const { createClient } = window.supabase;
  _client = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return _client;
}

export async function getCurrentUser() {
  const sb = await getSupabase();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function getProfile(userId) {
  const sb = await getSupabase();
  const { data } = await sb.from("profiles").select("*").eq("id", userId).single();
  return data;
}
