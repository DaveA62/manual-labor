import { useState } from "react";
import type { GameSession, SessionView } from "../cloud/session";
import { retirementPreview } from "../game/service/progression";
import { emptyService } from "../game/service/types";
import { SKILLS } from "../config/continuum/skills";
import { Button, Pager } from "../ui/Controls";
import { money } from "../ui/format";
export function RetirementPanel({
  game,
  session,
}: {
  game: SessionView;
  session: GameSession;
}) {
  const [summary, setSummary] = useState(false),
    [page, setPage] = useState(0),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState("");
  const s = game.state.service ?? emptyService(),
    preview = retirementPreview(game.state.cash, s.lifetimeYears),
    owned = SKILLS.filter((n) => s.skills[n.id]);
  const busy = game.transaction || game.status !== "Synced" || game.blocked;
  async function retire() {
    setError("");
    try {
      await session.serviceOperation({ type: "retire", careerId: s.careerId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Retirement failed.");
    }
  }
  return (
    <div className="retirement-account">
      <nav className="service-summary-tabs">
        <Button
          aria-pressed={!summary}
          onClick={() => {
            setSummary(false);
            setConfirm(false);
          }}
        >
          Retirement
        </Button>
        <Button
          aria-pressed={summary}
          onClick={() => {
            setSummary(true);
            setConfirm(false);
          }}
        >
          Skills · {owned.length}
        </Button>
      </nav>
      {summary ? (
        <>
          <div className="service-record">
            <strong>{s.years} UNSPENT YEARS</strong>
            <span>
              {s.lifetimeYears} EARNED · {s.history.length} RETIREMENTS
            </span>
          </div>
          {s.recognition && (
            <p className="service-recognition">
              Service Recognition · +10% global earnings
            </p>
          )}
          <div className="service-summary-list">
            {owned.length ? (
              owned.slice(page * 3, page * 3 + 3).map((n) => (
                <div key={n.id}>
                  <strong>
                    {n.name}{" "}
                    <span>
                      {s.skills[n.id]}/{n.max}
                    </span>
                  </strong>
                  <p>{n.description}</p>
                </div>
              ))
            ) : (
              <p>No purchased skills.</p>
            )}
          </div>
          <Pager
            page={Math.min(page, Math.max(0, Math.ceil(owned.length / 3) - 1))}
            pages={Math.max(1, Math.ceil(owned.length / 3))}
            onChange={setPage}
          />
        </>
      ) : (
        <>
          <dl className="retirement-preview">
            <div>
              <dt>Current cash</dt>
              <dd>{money(game.state.cash)}</dd>
            </div>
            <div>
              <dt>Years awarded</dt>
              <dd>+{preview.points}</dd>
            </div>
            <div>
              <dt>Next point cost</dt>
              <dd>{money(preview.nextCost)}</dd>
            </div>
            <div>
              <dt>Additional cash for next point</dt>
              <dd>{money(preview.needed)}</dd>
            </div>
          </dl>
          {confirm ? (
            <div
              className="retirement-reset-notice"
              role="group"
              aria-label="Confirm account retirement"
            >
              <strong>RETIRE THIS FACTORY?</strong>
              <p>
                Resets all machines, refits, upgrades, production, cash and
                purchased bays.
              </p>
              <p>Account, lifetime records, Service and skills remain.</p>
            </div>
          ) : (
            <div className="retirement-reset-notice">
              <p>
                Resets cash, all machines, refits, upgrades, progress and
                purchased bays.
              </p>
              <p>
                {s.recognition
                  ? "Service and purchased skills remain."
                  : "First retirement grants +10% global earnings permanently."}
              </p>
            </div>
          )}
          <div className="account-actions">
            {confirm && (
              <Button
                disabled={game.transaction}
                onClick={() => setConfirm(false)}
              >
                Cancel
              </Button>
            )}
            <Button
              tone="danger"
              disabled={busy || preview.points < 1}
              onClick={() => (confirm ? void retire() : setConfirm(true))}
            >
              {game.transaction
                ? "Saving retirement…"
                : confirm
                  ? `Confirm Retirement · +${preview.points} ${preview.points === 1 ? "Year" : "Years"}`
                  : preview.points < 1
                    ? `Retire at ${money(preview.nextCost)}`
                    : "Retire factory"}
            </Button>
          </div>
          {game.status !== "Synced" && (
            <p className="service-connection-note">
              Cloud synchronization required.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="account-notice" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
