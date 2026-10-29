import { useEffect, useReducer, useRef, useState } from 'react';
import { reducer } from './engine';
import { readSave, writeSave } from './save';

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, readSave);
  const [saved, setSaved] = useState(true);
  const latest = useRef(state);
  const dirty = useRef(true);
  useEffect(() => { latest.current = state; dirty.current = true; }, [state]);
  // Economy and ordering changes commit immediately. Motion checkpoints at most once a second.
  useEffect(() => { setSaved(writeSave(state)); dirty.current = false; }, [state.cash, state.lifetime, state.slots]);
  useEffect(() => {
    function flush() {
      if (dirty.current) { setSaved(writeSave(latest.current)); dirty.current = false; }
    }
    const interval = window.setInterval(flush, 1000);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', flush);
    return () => { window.clearInterval(interval); window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', flush); flush(); };
  }, []);
  useEffect(() => {
    // One clock owns every stored instance, independent of which screen is mounted.
    let last = performance.now();
    const resetClock = () => { last = performance.now(); };
    const interval = window.setInterval(() => {
      const now = performance.now();
      const elapsedMs = Math.min(250, now - last);
      last = now;
      if (document.visibilityState === 'visible') dispatch({ type: 'tick', elapsedMs });
    }, 50);
    document.addEventListener('visibilitychange', resetClock);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', resetClock); };
  }, []);
  return { state, dispatch, saved };
}
