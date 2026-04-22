import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Child = Tables<"children">;
export type ChildInsert = TablesInsert<"children">;
export type ChildUpdate = TablesUpdate<"children">;

export type Profile = Tables<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;

export type VoiceProfile = Tables<"voice_profiles">;
export type VoiceProfileInsert = TablesInsert<"voice_profiles">;
export type VoiceProfileUpdate = TablesUpdate<"voice_profiles">;

export type Story = Tables<"stories">;
export type StoryInsert = TablesInsert<"stories">;
export type StoryUpdate = TablesUpdate<"stories">;

export type StoryEditInsert = TablesInsert<"story_edits">;

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

export async function updateChild(id: string, updates: ChildUpdate): Promise<Child> {
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

/* ----------------------------- Voice Profiles ----------------------------- */

export async function getVoiceProfile(parentUserId: string): Promise<VoiceProfile | null> {
  const { data, error } = await supabase
    .from("voice_profiles")
    .select("*")
    .eq("parent_user_id", parentUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/* --------------------------------- Stories -------------------------------- */

export async function listStories(parentUserId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("parent_user_id", parentUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listStoriesForChild(childId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("child_id", childId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getStory(id: string): Promise<Story | null> {
  const { data, error } = await supabase
    .from("stories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createStory(story: StoryInsert): Promise<Story> {
  const { data, error } = await supabase
    .from("stories")
    .insert(story)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStory(id: string, updates: StoryUpdate): Promise<Story> {
  const { data, error } = await supabase
    .from("stories")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStory(id: string): Promise<void> {
  const { error } = await supabase.from("stories").delete().eq("id", id);
  if (error) throw error;
}

export async function logStoryEdit(edit: StoryEditInsert): Promise<void> {
  const { error } = await supabase.from("story_edits").insert(edit);
  if (error) throw error;
}

export async function incrementPlayCount(id: string, current: number): Promise<void> {
  const { error } = await supabase
    .from("stories")
    .update({ played_count: current + 1, last_played_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
