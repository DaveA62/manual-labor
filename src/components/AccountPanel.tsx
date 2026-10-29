import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button, DialogPanel } from "../ui/Controls";
import {
  callbackUrl,
  configured,
  ensureGuest,
  supabase,
} from "../cloud/client";
import type { GameSession, SessionView } from "../cloud/session";
import { getPlatform } from "../platform";

type Form = "home" | "signin" | "register" | "recover" | "password" | "signout";
export function AccountPanel({
  open,
  onClose,
  game,
  session,
}: {
  open: boolean;
  onClose: () => void;
  game: SessionView;
  session: GameSession;
}) {
  const [tab, setTab] = useState<"account" | "sync">("account");
  const [form, setForm] = useState<Form>("home");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (open) {
      if (game.recovery) {
        setTab("account");
        setForm("password");
      } else if (game.status === "Conflict") setTab("sync");
    } else {
      setPassword("");
      setForm("home");
      setMessage("");
    }
  }, [open, game.recovery, game.status]);
  const user = game.user,
    guest = !!user?.is_anonymous;
  const methods =
    [...new Set(user?.identities?.map((i) => i.provider) ?? [])].join(" + ") ||
    (guest ? "anonymous" : "none");
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (error) {
      const text =
        error instanceof Error ? error.message : "Account operation failed.";
      setMessage(
        /already|identity.*exist|email.*use/i.test(text)
          ? "Login already linked. Sign in to that account; saves stay separate."
          : text,
      );
    } finally {
      setBusy(false);
      setPassword("");
    }
  }
  async function google(link: boolean) {
    await run(async () => {
      const client = supabase();
      if (!client) throw Error("Cloud configuration unavailable.");
      await session.prepareAuth();
      const result = link
        ? await client.auth.linkIdentity({
            provider: "google",
            options: { redirectTo: callbackUrl("google") },
          })
        : await client.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: callbackUrl("google"),
              queryParams: { prompt: "select_account" },
            },
          });
      if (result.error) throw result.error;
    });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void run(async () => {
      const client = supabase();
      if (!client) throw Error("Cloud configuration unavailable.");
      if (form === "signin") {
        await session.prepareAuth();
        const { error } = await client.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setForm("home");
      }
      if (form === "register") {
        await session.prepareAuth();
        if (guest) {
          const { error } = await client.auth.updateUser(
            { email },
            { emailRedirectTo: callbackUrl("verify") },
          );
          if (error) throw error;
          setMessage("Check email to verify. Then set a password.");
        } else {
          const { error } = await client.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: callbackUrl("verify") },
          });
          if (error) throw error;
          setMessage("Check email for verification.");
        }
      }
      if (form === "recover") {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: callbackUrl("recovery"),
        });
        if (error) throw error;
        setMessage("Check email for the recovery link.");
      }
      if (form === "password") {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        session.setRecovery(false);
        setForm("home");
        setMessage("Password updated.");
        const target = new URL(location.href);
        target.searchParams.delete("auth");
        history.replaceState(null, "", target.pathname + target.search);
      }
    });
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(session.exportBackup(), null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "manual-labor-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <DialogPanel
      open={open}
      onClose={onClose}
      title="Account"
      code="PLAYER RECORD / CLOUD LINK"
      className="account-dialog"
    >
      <div className="account-summary">
        <strong>
          {user
            ? guest
              ? "Guest account"
              : "Linked account"
            : "Device account"}
        </strong>
        <span
          className={`sync-status sync-${game.status.toLowerCase().replaceAll(" ", "-")}`}
        >
          {game.status}
        </span>
      </div>
      <nav className="maintenance-tabs" aria-label="Account sections">
        <Button
          aria-pressed={tab === "account"}
          onClick={() => setTab("account")}
        >
          Login
        </Button>
        <Button aria-pressed={tab === "sync"} onClick={() => setTab("sync")}>
          Synchronization
        </Button>
      </nav>
      <div className="account-content">
        {tab === "sync" ? (
          <div className="account-sync">
            <p className="account-notice" role="status">
              {game.error ||
                (configured
                  ? "Progress is cached on this device."
                  : "Cloud is not configured. Device saving remains active.")}
            </p>
            {(game.status === "Conflict" || game.blocked) && (
              <>
                <p className="account-notice">
                  Device copy is backed up before loading cloud progress.
                  Accounts are never merged.
                </p>
                <div className="account-actions">
                  <Button
                    tone="primary"
                    disabled={busy}
                    onClick={() => void run(session.resolveCloud)}
                  >
                    Load cloud / earlier save
                  </Button>
                  <Button disabled={busy} onClick={session.keepLocal}>
                    Keep device copy
                  </Button>
                </div>
              </>
            )}
            {game.localUnverified && (
              <p className="account-notice">
                Device-only offline earnings cannot be imported.
              </p>
            )}
            <div className="account-actions">
              <Button
                disabled={busy || !configured}
                onClick={() =>
                  void run(async () => {
                    if (user) await session.retry();
                    else {
                      const client = supabase();
                      if (client) await ensureGuest(client);
                    }
                  })
                }
              >
                Retry sync
              </Button>
              {user && game.status !== "Conflict" && !game.blocked && (
                <Button
                  disabled={busy}
                  onClick={() => void run(session.resolveCloud)}
                >
                  Load cloud
                </Button>
              )}
              <Button onClick={download}>Download backup</Button>
            </div>
          </div>
        ) : form === "home" ? (
          <>
            <div className="account-login-details">
              <span className="equipment-label">LOGIN METHOD</span>
              <strong>{methods}</strong>
              {user?.email && <span>{user.email}</span>}
            </div>
            <div className="account-actions">
              {guest && (
                <>
                  <Button
                    tone="primary"
                    disabled={busy || !configured}
                    onClick={() => void google(true)}
                  >
                    Link Google
                  </Button>
                  <Button
                    disabled={busy || !configured}
                    onClick={() => setForm("register")}
                  >
                    Link email
                  </Button>
                </>
              )}
              <Button
                disabled={busy || !configured}
                onClick={() => void google(false)}
              >
                Sign in with Google
              </Button>
              <Button
                disabled={busy || !configured}
                onClick={() => setForm("signin")}
              >
                Email sign-in
              </Button>
              {!user && (
                <Button
                  disabled={busy || !configured}
                  onClick={() => setForm("register")}
                >
                  Register email
                </Button>
              )}
              {user?.email_confirmed_at && (
                <Button disabled={busy} onClick={() => setForm("password")}>
                  Set password
                </Button>
              )}
              {user ? (
                <Button disabled={busy} onClick={() => setForm("signout")}>
                  Sign out
                </Button>
              ) : (
                <Button
                  disabled={busy || !configured}
                  onClick={() =>
                    void run(async () => {
                      const client = supabase();
                      if (client) {
                        getPlatform().storage.removeItem(
                          "manual-labor:signed-out",
                        );
                        const { error } = await client.auth.signInAnonymously();
                        if (error) throw error;
                      }
                    })
                  }
                >
                  Play as guest
                </Button>
              )}
            </div>
          </>
        ) : form === "signout" ? (
          <div className="account-sync">
            <p>
              {guest
                ? "Guest login cannot be recovered after sign-out. A device backup is retained."
                : "Unsynced changes remain on this device. Cloud progress stays with this account."}
            </p>
            <div className="account-actions">
              <Button onClick={() => setForm("home")}>Cancel</Button>
              <Button
                tone="danger"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await session.prepareAuth();
                    getPlatform().storage.setItem(
                      "manual-labor:signed-out",
                      "yes",
                    );
                    const { error } = await supabase()!.auth.signOut({
                      scope: "local",
                    });
                    if (error) throw error;
                    setForm("home");
                  })
                }
              >
                Confirm sign out
              </Button>
            </div>
          </div>
        ) : (
          <form className="account-form" onSubmit={submit}>
            <h3>
              {form === "signin"
                ? "Email sign-in"
                : form === "register"
                  ? guest
                    ? "Link email"
                    : "Register email"
                  : form === "recover"
                    ? "Password recovery"
                    : "Set password"}
            </h3>
            {form !== "password" && (
              <label>
                Email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
            )}
            {(form === "signin" ||
              form === "password" ||
              (form === "register" && !guest)) && (
              <label>
                Password
                <input
                  type="password"
                  minLength={8}
                  required
                  autoComplete={
                    form === "signin" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            )}
            <div className="account-actions">
              <Button
                type="button"
                onClick={() => {
                  setForm("home");
                  setMessage("");
                }}
              >
                Back
              </Button>
              <Button
                tone="primary"
                type="submit"
                disabled={busy || !configured}
              >
                {busy
                  ? "Working…"
                  : form === "recover"
                    ? "Send recovery link"
                    : form === "register"
                      ? "Send verification"
                      : form === "password"
                        ? "Save password"
                        : "Sign in"}
              </Button>
              {form === "signin" && (
                <Button type="button" onClick={() => setForm("recover")}>
                  Forgot password
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
      {(message || game.authNotice) && (
        <div className="account-message" role="status">
          {message || game.authNotice}
        </div>
      )}
    </DialogPanel>
  );
}
