import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPlatform } from "../platform";
import { CloudConflict } from "./protocol";
import type {
  CloudRecord,
  CloudTransport,
  SyncRequest,
  SyncResult,
} from "./protocol";
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const configured = !!url && !!key;
let client: SupabaseClient | null = null;
export function supabase() {
  if (!configured) return null;
  if (!client) {
    const base = new URL(url);
    if (base.pathname !== "/" || !["https:", "http:"].includes(base.protocol))
      throw new Error("Use the base Supabase project URL.");
    client = createClient(url!, key!, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: getPlatform().storage,
      },
    });
  }
  return client;
}
export function callbackUrl(kind: "google" | "verify" | "recovery") {
  const target = new URL(import.meta.env.BASE_URL, location.origin);
  target.searchParams.set("auth", kind);
  return target.href;
}
export function cloudTransport(client: SupabaseClient): CloudTransport {
  async function call(body: unknown) {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) throw new Error("Sign in to synchronize.");
    const response = await fetch(`${url}/functions/v1/game-sync`, {
      method: "POST",
      headers: {
        apikey: key!,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error("Cloud service unavailable.");
    }
    if (response.status === 409 && data.conflict)
      throw new CloudConflict(data.conflict as CloudRecord);
    if (!response.ok)
      throw new Error(data.error ?? "Cloud service unavailable.");
    return data;
  }
  return {
    peek: () => call({ mode: "peek" }) as Promise<CloudRecord | null>,
    commit: (request: SyncRequest) =>
      call({ mode: "commit", request }) as Promise<SyncResult>,
    acknowledge: async (id) => {
      await call({ mode: "ack", id });
    },
  };
}
let boot: Promise<void> | undefined;
export function ensureGuest(client: SupabaseClient) {
  return (boot ??= (async () => {
    const {
      data: { session },
      error,
    } = await client.auth.getSession();
    if (error) throw error;
    if (
      !session &&
      getPlatform().storage.getItem("manual-labor:signed-out") !== "yes"
    ) {
      const { error } = await client.auth.signInAnonymously();
      if (error) throw error;
    }
  })().catch((error) => {
    boot = undefined;
    throw error;
  }));
}
