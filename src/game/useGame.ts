import { useEffect, useState, useSyncExternalStore } from "react";
import { getPlatform } from "../platform";
import { GameSession } from "../cloud/session";
import { cloudTransport, ensureGuest, supabase } from "../cloud/client";
export function useGame() {
  const [session] = useState(() => new GameSession(getPlatform()));
  const view = useSyncExternalStore(session.subscribe, session.getSnapshot);
  useEffect(() => {
    session.start();
    let live = true;
    let unsubscribe: undefined | (() => void);
    const params = new URLSearchParams(location.search);
    let authReturnHandled = false;
    const authError = params.get("error_description");
    if (authError) {
      session.setAuthNotice(
        /already|identity.*exist/i.test(authError)
          ? "Login already linked. Sign in to that account; saves stay separate."
          : authError.slice(0, 400),
      );
      for (const key of ["error", "error_description", "error_code"])
        params.delete(key);
      history.replaceState(
        null,
        "",
        `${location.pathname}${params.size ? "?" + params.toString() : ""}`,
      );
    }
    try {
      const client = supabase();
      if (client) {
        const transport = cloudTransport(client);
        const { data } = client.auth.onAuthStateChange((event, next) => {
          if (
            !authReturnHandled &&
            (event === "PASSWORD_RECOVERY" ||
              (params.get("auth") === "recovery" && next?.user) ||
              (params.get("auth") === "verify" &&
                next?.user.email_confirmed_at))
          ) {
            authReturnHandled = true;
            session.setRecovery(true);
          }
          queueMicrotask(() => {
            if (live) void session.attach(next?.user ?? null, transport);
          });
        });
        unsubscribe = () => data.subscription.unsubscribe();
        void ensureGuest(client).catch((error) => {
          if (live) session.authError(error.message);
        });
      }
    } catch (error) {
      session.authError(
        error instanceof Error ? error.message : "Account service unavailable.",
      );
    }
    return () => {
      live = false;
      unsubscribe?.();
      session.stop();
    };
  }, [session]);
  return { ...view, dispatch: session.dispatch, session };
}
