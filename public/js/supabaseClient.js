let _client = null;

export async function getSupabase() {
  if (_client) return _client;

  let config;
  try {
    const res = await fetch("/api/config");
    config    = await res.json();
  } catch {
    throw new Error("Could not connect to server. Check your internet connection.");
  }

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Server configuration error. Contact the administrator.");
  }

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
  const { data, error } = await sb
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) console.warn("getProfile error:", error.message);
  return data || null;
}
