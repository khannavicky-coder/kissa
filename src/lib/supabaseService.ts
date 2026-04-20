import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Child = Tables<"children">;
export type ChildInsert = TablesInsert<"children">;
export type ChildUpdate = TablesUpdate<"children">;

export type Profile = Tables<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;

/* ------------------------------- Auth helpers ------------------------------ */

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/* -------------------------------- Profiles -------------------------------- */

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  updates: ProfileUpdate,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/* -------------------------------- Children -------------------------------- */

export async function listChildren(parentUserId: string): Promise<Child[]> {
  const { data, error } = await supabase
    .from("children")
    .select("*")
    .eq("parent_user_id", parentUserId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getFirstChild(parentUserId: string): Promise<Child | null> {
  const { data, error } = await supabase
    .from("children")
    .select("*")
    .eq("parent_user_id", parentUserId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

export async function createChild(child: ChildInsert): Promise<Child> {
  const { data, error } = await supabase
    .from("children")
    .insert(child)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateChild(
  id: string,
  updates: ChildUpdate,
): Promise<Child> {
  const { data, error } = await supabase
    .from("children")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteChild(id: string): Promise<void> {
  const { error } = await supabase.from("children").delete().eq("id", id);
  if (error) throw error;
}
