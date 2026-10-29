import { RetirementExperience } from "./components/continuum/RetirementExperience";
import { createWorkshop } from "./game/engine";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { UI, uiVariables, wideWorkshop } from "./config/ui";
import { useElementSize } from "./ui/useElementSize";
import { Modifications } from "./components/Modifications";
import { AccountPanel } from "./components/AccountPanel";
import { ShiftReport } from "./components/ShiftReport";
import { Icon } from "./components/Icon";
import { MachineScreen } from "./components/MachineScreen";
import { MachineShop } from "./components/MachineShop";
import { Storage } from "./components/Storage";
import { feedback } from "./game/feedback";
import { clearLegacySave } from "./game/save";
import { useGame } from "./game/useGame";
import { Button, DialogPanel } from "./ui/Controls";
import { money, compactMoney } from "./ui/format";

type Screen = "storage" | "workshop" | "catalog";
export default function App() {
  const game = useGame();
  const {
    ref: content,
    width,
    height,
  } = useElementSize<HTMLElement>(!game.state.service?.session);
  const wide = wideWorkshop(width, height);
  const { state: canonical, dispatch, saved } = game;
  const lastCareer = useRef(
    canonical.service?.session ? createWorkshop() : canonical,
  );
  if (!canonical.service?.session) lastCareer.current = canonical;
  const state = canonical.service?.session ? lastCareer.current : canonical;
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => {
    if (game.recovery || game.authNotice) setAccountOpen(true);
  }, [game.recovery, game.authNotice]);
  const [screen, setScreen] = useState<Screen>("workshop");
  const [selected, setSelected] = useState(state.machines[0].id);
  const machine =
    state.machines.find((item) => item.id === selected) ?? state.machines[0];
  const [renderer, setRenderer] = useState<"svg" | "phaser">(() =>
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("renderer") === "phaser"
      ? "phaser"
      : "svg",
  );
  const [sound, setSound] = useState(false);
  const [payday, setPayday] = useState(0);
  const [dialog, setDialog] = useState<"settings" | "reset" | null>(null);
  const previousLifetime = useRef(state.lifetime);
  const openMachine = useCallback((id: string) => {
    setSelected(id);
    setScreen("workshop");
  }, []);
  const openCatalog = useCallback(() => setScreen("catalog"), []);
  useEffect(() => {
    if (canonical.service?.session) {
      setAccountOpen(false);
      setDialog(null);
      setScreen("workshop");
      setPayday(0);
      previousLifetime.current = canonical.lifetime;
    }
  }, [canonical.service?.session?.id]);
  useEffect(() => {
    if (state.lifetime > previousLifetime.current) {
      setPayday(state.lifetime - previousLifetime.current);
      if (!canonical.service?.session) feedback("cash", sound);
    }
    previousLifetime.current = state.lifetime;
  }, [state.lifetime, sound]);
  useEffect(() => {
    if (!payday) return;
    const timer = window.setTimeout(() => setPayday(0), UI.animation.cashMs);
    return () => window.clearTimeout(timer);
  }, [payday, state.lifetime]);
  const factory = (
    <div
      className="game-shell"
      data-screen={screen}
      style={uiVariables as CSSProperties}
    >
      <header className="game-header">
        <button
          className="wordmark"
          onClick={() => setScreen("workshop")}
          aria-label="Manual Labor Workshop"
        >
          <span className="brand-stamp" aria-hidden="true">
            M/L
          </span>
          <span>
            MANUAL LABOR<small>QUESTIONABLY FUNCTIONAL</small>
          </span>
        </button>
        <div
          className="header-cash"
          aria-label="Available cash"
          title={`${money(state.cash)} available · ${money(state.lifetime)} lifetime earnings`}
        >
          <span className="equipment-label">CASH</span>
          <strong>
            <span className="sr-only">{money(state.cash)}</span>
            <span className="cash-full" aria-hidden="true">
              {money(state.cash)}
            </span>
            <span className="cash-compact" aria-hidden="true">
              {compactMoney(state.cash)}
            </span>
          </strong>
          {payday > 0 && (
            <span className="payday" key={state.lifetime}>
              +{money(payday)}
            </span>
          )}
        </div>
        <Button
          className="account-control"
          onClick={() => setAccountOpen(true)}
          aria-label={`Account: ${game.status}`}
        >
          <span
            className={`sync-dot sync-${game.status.toLowerCase().replaceAll(" ", "-")}`}
            aria-hidden="true"
          />
          <span>Account</span>
        </Button>
        <Button
          className="square-control header-settings"
          aria-label="Settings"
          onClick={() => setDialog("settings")}
        >
          <Icon name="settings" />
        </Button>
      </header>
      <nav className="primary-nav" aria-label="Primary navigation">
        {(
          [
            { id: "workshop", label: "Workshop", icon: "workshop" },
            { id: "storage", label: "Storage", icon: "storage" },
            { id: "catalog", label: "Catalog", icon: "catalog" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            aria-current={screen === item.id ? "page" : undefined}
            onClick={() => setScreen(item.id)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {item.id === "storage" && (
              <small>
                {state.machines.length}/{state.slots.length}
              </small>
            )}
          </button>
        ))}
      </nav>
      <main ref={content} className="game-content">
        {!saved && (
          <div className="save-warning" role="status">
            Saving unavailable. Session progress only.
          </div>
        )}
        {screen === "storage" && (
          <Storage
            state={state}
            dispatch={dispatch}
            onOpen={openMachine}
            onShop={openCatalog}
          />
        )}
        {screen === "catalog" && (
          <MachineShop state={state} dispatch={dispatch} />
        )}
        {screen === "workshop" && (
          <div className={`workshop-composition ${wide ? "is-wide" : ""}`}>
            <MachineScreen
              service={state.service}
              managed={wide || !!canonical.service?.session}
              key={machine.id}
              state={machine}
              cash={state.cash}
              number={state.machines.indexOf(machine) + 1}
              dispatch={dispatch}
              sound={sound}
              renderer={renderer}
            />
            {wide && (
              <aside
                className="workshop-management"
                aria-label="Workshop management"
              >
                <Modifications
                  key={machine.id}
                  service={state.service}
                  inline
                  open
                  onClose={() => {}}
                  machine={machine}
                  number={state.machines.indexOf(machine) + 1}
                  cash={state.cash}
                  dispatch={dispatch}
                  sound={sound}
                />
                <Storage
                  embedded
                  selectedId={machine.id}
                  state={state}
                  dispatch={dispatch}
                  onOpen={openMachine}
                  onShop={openCatalog}
                  onManage={() => setScreen("storage")}
                />
              </aside>
            )}
          </div>
        )}
        {(game.transaction || game.servicePending) && (
          <div className="service-transaction-shield" role="status">
            Saving service transaction…
          </div>
        )}
        {game.blocked && (
          <div className="session-blocker" role="status">
            <p>
              {game.status === "Connecting"
                ? "Loading account save…"
                : "Choose a save in Account."}
            </p>
            <Button onClick={() => setAccountOpen(true)}>Account</Button>
          </div>
        )}
      </main>
      <AccountPanel
        open={accountOpen && !canonical.service?.session}
        onClose={() => setAccountOpen(false)}
        game={game}
        session={game.session}
      />
      <ShiftReport
        report={canonical.service?.session ? null : game.report}
        onCollect={game.session.acknowledge}
      />
      <DialogPanel
        open={dialog === "settings" && !canonical.service?.session}
        onClose={() => setDialog(null)}
        title="Workshop record"
        code="CONTROL PANEL / 01"
        className="settings-dialog"
      >
        <dl className="record-grid">
          <div>
            <dt>Lifetime earnings</dt>
            <dd>{money(state.lifetime)}</dd>
          </div>
          <div>
            <dt>Units produced</dt>
            <dd>{state.bills.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Storage</dt>
            <dd>
              {state.machines.length} / {state.slots.length}
            </dd>
          </div>
          <div>
            <dt>Save</dt>
            <dd>{saved ? "LOCAL / OK" : "UNAVAILABLE"}</dd>
          </div>
        </dl>
        <div className="settings-actions">
          <Button
            aria-pressed={sound}
            onClick={() => {
              setSound((value) => !value);
              if (!sound) feedback("click", true);
            }}
          >
            <Icon name={sound ? "sound" : "muted"} size={20} />
            Sound {sound ? "on" : "off"}
          </Button>
          <Button tone="danger" onClick={() => setDialog("reset")}>
            <Icon name="reset" size={18} />
            {state.service ? "Reset workshop" : "Reset save"}
          </Button>
        </div>
        {import.meta.env.DEV && (
          <div className="settings-actions" aria-label="Development renderer">
            <Button
              aria-pressed={renderer === "svg"}
              onClick={() => setRenderer("svg")}
            >
              SVG baseline
            </Button>
            <Button
              aria-pressed={renderer === "phaser"}
              onClick={() => setRenderer("phaser")}
            >
              Phaser experiment
            </Button>
          </div>
        )}
        <span className="inspection-stamp">INSPECTION STATUS: PENDING</span>
      </DialogPanel>
      <DialogPanel
        open={dialog === "reset" && !canonical.service?.session}
        onClose={() => setDialog(null)}
        title={state.service ? "Restart workshop?" : "Reset workshop?"}
        code={
          state.service
            ? "CAREER RESET / SERVICE RETAINED"
            : "DELETE LOCAL SAVE"
        }
        className="reset-dialog"
      >
        <p className="dialog-copy">
          {state.service
            ? "Resets career machines, upgrades, cash and progress. Service and lifetime records remain."
            : "Deletes all machines, upgrades, cash, and production progress."}
        </p>
        <div className="settings-actions">
          <Button onClick={() => setDialog(null)}>Cancel</Button>
          <Button
            tone="danger"
            onClick={() => {
              clearLegacySave();
              dispatch({ type: "reset" });
              setScreen("workshop");
              setSelected("press-initial");
              setPayday(0);
              setDialog(null);
            }}
          >
            {state.service ? "Restart workshop" : "Reset everything"}
          </Button>
        </div>
      </DialogPanel>
    </div>
  );
  return canonical.service?.session ? (
    <RetirementExperience
      key={canonical.service.session.id}
      game={game}
      session={game.session}
      sound={sound}
      factory={factory}
    />
  ) : (
    factory
  );
}
