import { useElementSize } from "../../ui/useElementSize";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { GameSession, SessionView } from "../../cloud/session";
import { CONTINUUM } from "../../config/retirement";
import { getPlatform } from "../../platform";
import { Continuum } from "./Continuum";
export function RetirementExperience({
  game,
  session,
  sound,
  factory,
}: {
  game: SessionView;
  session: GameSession;
  sound: boolean;
  factory: ReactNode;
}) {
  const s = game.state.service!.session!,
    [film, setFilm] = useState(!s.transitionSeen),
    acknowledging = useRef(false);
  const { ref: filmRef, width: filmWidth } =
    useElementSize<HTMLDivElement>(film);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = reduced
    ? 900
    : s.first
      ? CONTINUUM.firstTransitionMs
      : CONTINUUM.laterTransitionMs;
  useEffect(() => {
    getPlatform().silence?.();
    if (!film) return;
    const t = setTimeout(() => {
      setFilm(false);
      getPlatform().feedback("continuum", sound);
    }, duration);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (
      !film &&
      !s.transitionSeen &&
      game.status === "Synced" &&
      !game.transaction &&
      !acknowledging.current
    ) {
      acknowledging.current = true;
      void session
        .serviceOperation({ type: "ack-transition", sessionId: s.id })
        .catch(() => {})
        .finally(() => {
          acknowledging.current = false;
        });
    }
  }, [film, s.transitionSeen, game.status, game.transaction, s.id, session]);
  return (
    <>
      <div inert={film}>
        <Continuum game={game} session={session} sound={sound} />
      </div>
      {film && (
        <div
          ref={filmRef}
          className={`retirement-film ${s.first ? "is-first" : "is-later"}`}
          style={
            {
              "--film-time": `${duration}ms`,
              "--origin-shift": `${filmWidth > 0 && filmWidth < 650 ? CONTINUUM.compactFocusY * CONTINUUM.initialZoom : 0}px`,
            } as CSSProperties
          }
          aria-label="Retirement transition"
        >
          <div className="retirement-factory-echo" inert>
            {factory}
          </div>
          <div className="retirement-light" />
          <div className="retirement-award" role="status">
            <strong>+{s.award}</strong>YEARS OF SERVICE
          </div>
          {!s.first && (
            <button className="film-skip" onClick={() => setFilm(false)}>
              SKIP
            </button>
          )}
        </div>
      )}
    </>
  );
}
