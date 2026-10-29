import type { ServiceCommand } from "../game/service/types.ts";
export function validServiceCommand(v: unknown): v is ServiceCommand {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const c = v as Record<string, unknown>,
    id = (v: unknown) =>
      typeof v === "string" && v.length > 0 && v.length <= 128;
  if (c.type === "retire") return id(c.careerId);
  if (!id(c.sessionId)) return false;
  if (c.type === "ack-transition" || c.type === "begin-career") return true;
  return (
    c.type === "buy-skill" &&
    id(c.skillId) &&
    Number.isSafeInteger(c.fromLevel) &&
    (c.fromLevel as number) >= 0
  );
}
