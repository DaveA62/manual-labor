import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { synchronize } from "../../../src/cloud/server.ts";
import { CloudConflict } from "../../../src/cloud/protocol.ts";
import type {
  CloudRecord,
  SyncRequest,
  SyncResult,
} from "../../../src/cloud/protocol.ts";
function runtimeKey(dictionary: string, single: string, legacy: string) {
  const values = JSON.parse(Deno.env.get(dictionary) ?? "{}");
  const key =
    values.default ??
    Object.values(values).find((value) => typeof value === "string") ??
    Deno.env.get(single) ??
    Deno.env.get(legacy);
  if (typeof key !== "string" || !key)
    throw new Error("Backend API key unavailable.");
  return key;
}
const origins = (
  Deno.env.get("ALLOWED_ORIGINS") ??
  "https://davea62.github.io,http://localhost:5173,http://localhost:4173,http://terminal.local:4173"
).split(",");
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origins.includes(origin)
      ? origin
      : origins[0],
    "Access-Control-Allow-Headers":
      "authorization,apikey,content-type,x-client-info",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
  const reply = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!,
      anon = runtimeKey(
        "SUPABASE_PUBLISHABLE_KEYS",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_ANON_KEY",
      );
    const auth = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in required" }, 401);
    const {
      data: { user },
      error: authError,
    } = await auth.auth.getUser(token);
    if (authError || !user) return reply({ error: "Session expired" }, 401);
    const raw = await req.text();
    if (raw.length > 4_000_000)
      return reply({ error: "Save request too large" }, 413);
    const body = JSON.parse(raw);
    const db = createClient(
      url,
      runtimeKey(
        "SUPABASE_SECRET_KEYS",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const read = async (id: string) => {
      const { data, error } = await db.rpc("ml_read", {
        p_player: user.id,
        p_request: id,
      });
      if (error) throw error;
      return data as {
        now: string;
        record: CloudRecord | null;
        receipt?: SyncResult;
      };
    };
    if (body.mode === "peek")
      return reply((await read(crypto.randomUUID())).record);
    if (body.mode === "ack") {
      if (!/^[0-9a-f-]{36}$/i.test(body.id))
        return reply({ error: "Invalid report" }, 400);
      const { error } = await db.rpc("ml_ack_report", {
        p_player: user.id,
        p_report: body.id,
      });
      if (error) throw error;
      return reply({ ok: true });
    }
    if (body.mode !== "commit")
      return reply({ error: "Invalid operation" }, 400);
    const result = await synchronize(user.id, body.request as SyncRequest, {
      read: (_player, id) => read(id),
      commit: async (_player, expected, next) => {
        const { data, error } = await db.rpc("ml_commit", {
          p_player: user.id,
          p_expected: expected,
          p_next: next,
        });
        if (error?.code === "40001")
          throw new CloudConflict((await read(crypto.randomUUID())).record!);
        if (error) throw error;
        return data as SyncResult;
      },
    });
    return reply(result);
  } catch (error) {
    if (error instanceof CloudConflict)
      return reply({ error: error.message, conflict: error.record }, 409);
    console.error(
      "game-sync failed",
      error instanceof Error ? error.message : "Database operation failed",
    );
    return reply(
      {
        error:
          error instanceof Error
            ? error.message
            : "Cloud service unavailable. Deploy the database migrations and game-sync function.",
      },
      400,
    );
  }
});
