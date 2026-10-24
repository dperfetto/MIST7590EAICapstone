import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
export const connected = Boolean(url && key);
// A password-reset email link returns here with "type=recovery" (or an error,
// if the link expired) in the URL. Supabase reads and clears the URL while it
// starts up, so record what the link said before creating the client.
const authLinkParams = new URLSearchParams(
  typeof window === "undefined"
    ? ""
    : `${window.location.hash.replace(/^#/, "")}&${window.location.search.replace(/^\?/, "")}`,
);
export const openedFromRecoveryLink = authLinkParams.get("type") === "recovery";
export const authLinkError = authLinkParams.get("error_description");
export const supabase = connected ? createClient(url, key) : null;
export async function currentUser() {
  const { data, error } = await supabase!.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in to continue.");
  return data.user;
}
