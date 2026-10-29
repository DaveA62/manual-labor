import { useEffect, useReducer, useRef, useState } from 'react';
import { reducer } from './engine';
import { readSave, writeSave } from './save';
import { getPlatform } from '../platform';
import { createProductionClock } from '../runtime/clock';

export function useGame() {
  const host = getPlatform();
  const [state, dispatch] = useReducer(reducer, undefined, () => readSave(host.storage));
  const [saved, setSaved] = useState(true);
  const latest = useRef(state);
  const dirty = useRef(true);
  useEffect(() => { latest.current = state; dirty.current = true; }, [state]);
  // Economy and ordering changes commit immediately. Motion checkpoints at most once a second.
  useEffect(() => { setSaved(writeSave(state, host.storage)); dirty.current = false; }, [state.cash, state.lifetime, state.slots]);
  useEffect(() => {
    function flush() {
      if (dirty.current) { setSaved(writeSave(latest.current, host.storage)); dirty.current = false; }
    }
    const interval = globalThis.setInterval(flush, 1000);
    const unsubscribe = host.lifecycle.subscribe(flush);
    return () => { globalThis.clearInterval(interval); unsubscribe(); flush(); };
  }, []);
  useEffect(() => {
    // One clock owns every stored instance, independent of which screen is mounted.
    const clock = createProductionClock(host.lifecycle, elapsedMs => dispatch({ type: 'tick', elapsedMs }));
    const interval = globalThis.setInterval(clock.advance, 50);
    return () => { globalThis.clearInterval(interval); clock.dispose(); };
  }, []);
  return { state, dispatch, saved };
}
