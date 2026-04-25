import { getSupabase } from "./supabaseClient.js";

export async function register(email, password, username) {
  const sb = await getSupabase();

  // Check username taken
  const { data: existing } = await sb.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) throw new Error("Username already taken.");

  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw new Error(error.message);

  // Create profile
  await sb.from("profiles").insert({
    id: data.user.id,
    username,
    avatar_color: randomColor()
  });

  return data.user;
}

export async function login(email, password) {
  const sb = await getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function logout() {
  const sb = await getSupabase();
  await sb.auth.signOut();
}

export async function getSession() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

function randomColor() {
  const colors = ["#4f46e5","#00d084","#ff5c5c","#ffd23f","#b48cff","#ff9f1c"];
  return colors[Math.floor(Math.random() * colors.length)];
}
