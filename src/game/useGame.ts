import { useEffect, useReducer, useState } from 'react';
import { automated, createGame, reducer } from './engine';
import { readSave, writeSave } from './save';

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, () => createGame(readSave()));
  const [saved, setSaved] = useState(true);
  useEffect(() => { setSaved(writeSave(state)); }, [state.cash, state.lifetime, state.bills, state.upgrades]);
  const auto = automated(state);
  useEffect(() => {
    if (!auto) return;
    if (state.phase === 'feed' || state.phase === 'collect') {
      const id = window.setTimeout(() => dispatch({ type: state.phase === 'feed' ? 'feed' : 'collect' }), 650);
      return () => window.clearTimeout(id);
    }
    let frame = 0;
    let previous = performance.now();
    function tick(now: number) {
      // Clamp after backgrounding: no offline progress or instant surprise motion.
      const elapsed = Math.min(now - previous, 50);
      previous = now;
      dispatch({ type: 'turn', amount: elapsed / 1100 });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [auto, state.phase]);
  return { state, dispatch, saved };
}
