import { CONTINUUM } from "../../config/retirement";
import { useId, useState } from "react";
import {
  CONNECTIONS,
  SKILLS,
  SKILL_BY_ID,
} from "../../config/continuum/skills";
import type { GameSession, SessionView } from "../../cloud/session";
import { eligibleSkill } from "../../game/service/progression";
import type { ServiceCommand } from "../../game/service/types";
import { useElementSize } from "../../ui/useElementSize";
import { getPlatform } from "../../platform";
import { useCamera } from "./useCamera";
import { SkillNode } from "./SkillNode";
import { SkillEdge } from "./SkillEdge";
import { Inspector } from "./Inspector";
import "./continuum.css";
export function Continuum({
  game,
  session,
  sound,
}: {
  game: SessionView;
  session: GameSession;
  sound: boolean;
}) {
  const edgeMask = useId();
  const service = game.state.service!,
    [selected, setSelected] = useState<string | null>("first-day"),
    [error, setError] = useState(""),
    [begin, setBegin] = useState(false);
  const { ref, width, height } = useElementSize<HTMLDivElement>();
  const camera = useCamera(width, height, setSelected),
    visible = new Set(service.discovered);
  const busy = game.transaction || game.status !== "Synced";
  async function command(c: ServiceCommand) {
    setError("");
    try {
      await session.serviceOperation(c);
      if (c.type === "buy-skill") getPlatform().feedback("reveal", sound);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed.");
    }
  }
  const node = selected ? SKILL_BY_ID[selected] : undefined;
  return (
    <main className="continuum" aria-label="The Service Continuum">
      <div className="continuum-nebula" aria-hidden="true" />
      <div className="continuum-stars" aria-hidden="true" />
      <header className="continuum-heading">
        <div>
          <span className="continuum-eyebrow">
            CAREER {service.history.length} · RETIREMENT
          </span>
          <h1>The Service Continuum</h1>
        </div>
        <div className="service-balance">
          <strong>{service.years}</strong>
          <span>YEARS OF SERVICE</span>
        </div>
      </header>
      <div ref={ref} className="continuum-world">
        <svg
          ref={camera.ref}
          width="100%"
          height="100%"
          aria-label="Spatial skill network. Drag to pan; wheel or pinch to zoom. Tab selects discovered skills."
          onPointerDown={camera.down}
          onPointerMove={camera.move}
          onPointerUp={camera.up}
          onPointerCancel={camera.cancel}
          onLostPointerCapture={camera.cancel}
        >
          <defs>
            <radialGradient id={`${edgeMask}-gradient`}>
              <stop offset="35%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>
            <mask id={edgeMask}>
              <rect
                width="100%"
                height="100%"
                fill={`url(#${edgeMask}-gradient)`}
              />
            </mask>
          </defs>
          <g mask={`url(#${edgeMask})`}>
            <g
              transform={`translate(${width / 2 - camera.camera.x * camera.camera.zoom} ${height / 2 - camera.camera.y * camera.camera.zoom}) scale(${camera.camera.zoom})`}
              className="continuum-camera"
            >
              <g className="continuum-edges" pointerEvents="none">
                {CONNECTIONS.filter(
                  ([a, b]) => visible.has(a) && visible.has(b),
                ).map(([a, b]) => (
                  <SkillEdge
                    key={`${a}:${b}`}
                    a={SKILL_BY_ID[a]}
                    b={SKILL_BY_ID[b]}
                    lit={!!service.skills[a] && !!service.skills[b]}
                  />
                ))}
              </g>
            </g>
          </g>
          <g
            transform={`translate(${width / 2 - camera.camera.x * camera.camera.zoom} ${height / 2 - camera.camera.y * camera.camera.zoom}) scale(${camera.camera.zoom})`}
            className="continuum-camera"
          >
            {SKILLS.filter((n) => visible.has(n.id)).map((n) => (
              <SkillNode
                key={n.id}
                node={n}
                level={service.skills[n.id] ?? 0}
                eligible={eligibleSkill(service, n.id)}
                selected={selected === n.id}
                zoom={camera.camera.zoom}
                onSelect={() => setSelected(n.id)}
                onNavigate={() =>
                  camera.focus(
                    n.x,
                    n.y + (width < 650 ? CONTINUUM.compactFocusY : 0),
                  )
                }
              />
            ))}
          </g>
        </svg>
      </div>
      <nav className="continuum-camera-controls" aria-label="Skill camera">
        <button aria-label="Zoom out" onClick={() => camera.zoom(0.8)}>
          −
        </button>
        <button aria-label="Recenter skill tree" onClick={camera.recenter}>
          ⌖
        </button>
        <button aria-label="Zoom in" onClick={() => camera.zoom(1.25)}>
          +
        </button>
      </nav>
      {node && visible.has(node.id) && (
        <Inspector
          node={node}
          service={service}
          busy={busy}
          onClose={() => setSelected(null)}
          onBuy={() =>
            void command({
              type: "buy-skill",
              sessionId: service.session!.id,
              skillId: node.id,
              fromLevel: service.skills[node.id] ?? 0,
            })
          }
        />
      )}
      <footer className="continuum-footer">
        <span className="recognition-mark">
          SERVICE RECOGNITION <b>+10% GLOBAL EARNINGS</b>
        </span>
        {begin ? (
          <div className="career-confirm">
            <span>{service.years} YEARS REMAIN UNSPENT</span>
            <button onClick={() => setBegin(false)}>STAY</button>
            <button
              className="continuum-action"
              disabled={busy}
              onClick={() =>
                void command({
                  type: "begin-career",
                  sessionId: service.session!.id,
                })
              }
            >
              BEGIN NEW CAREER
            </button>
          </div>
        ) : (
          <button
            className="continuum-action"
            disabled={busy}
            onClick={() => setBegin(true)}
          >
            BEGIN NEW CAREER
          </button>
        )}
      </footer>
      {(error ||
        game.error ||
        !["Synced", "Syncing", "Connecting"].includes(game.status)) && (
        <div className="continuum-error" role="status">
          <span>{error || game.error || game.status}</span>
          {!game.transaction &&
            ["Offline", "Error", "Conflict"].includes(game.status) && (
              <>
                <button onClick={() => void session.retry()}>RETRY SYNC</button>
                <button onClick={() => void session.resolveCloud()}>
                  LOAD CLOUD SAVE
                </button>
              </>
            )}
        </div>
      )}
    </main>
  );
}
