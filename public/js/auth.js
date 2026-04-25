import { getSupabase } from "./supabaseClient.js";

// Register via backend (bypasses Supabase email confirmation + RLS)
export async function register(email, password, username) {
  const res  = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password, username: username.trim() })
  });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Registration failed.");

  // Auto-login after successful registration
  return await login(email.trim(), password);
}

// Login via Supabase client
export async function login(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.includes("Invalid login credentials")) {
      throw new Error("Wrong email or password.");
    }
    throw new Error(error.message);
  }

  return data.user;
}

export async function logout() {
  const sb = await getSupabase();
  await sb.auth.signOut();
  sessionStorage.clear();
}

export async function getSession() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}
