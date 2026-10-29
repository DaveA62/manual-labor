import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import type { MachineRendererProps } from '../../runtime/machine';
import { activePressPart } from '../../runtime/press';
import { direction, tier } from '../../game/machines';
import { getPlatform } from '../../platform';
import { Press } from '../../components/Press';
import { pressTextures } from './textures';
import './phaser.css';
import { MoneyPressScene, RENDER_SCALE } from './MoneyPressScene';

export default function PhaserPress(props: MachineRendererProps) {
  const { state, runtime, hint } = props;
  const sceneRef = useRef<MoneyPressScene | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const parent = host.current!;
    let disposed = false, game: Phaser.Game | undefined, observer: ResizeObserver | undefined, unsubscribe: (() => void) | undefined;
    setReady(false); setError(false);
    pressTextures(runtime.read(), parent).then(sources => {
      if (disposed) return;
      const scene = new MoneyPressScene(runtime, sources, parent);
      sceneRef.current = scene;
      game = new Phaser.Game({
        type: Phaser.AUTO, parent, width: 720 * RENDER_SCALE, height: 510 * RENDER_SCALE, transparent: true, disableContextMenu: true,
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        input: { activePointers: 2, keyboard: false }, audio: { noAudio: true },
        render: { antialias: true }, scene: [scene], banner: false,
        callbacks: { postBoot: () => { if (!disposed) setReady(true); } },
      });
      observer = new ResizeObserver(() => { scene.cancel(); game?.scale.refresh(); });
      observer.observe(parent);
      unsubscribe = getPlatform().lifecycle.subscribe(active => { if (!active) scene.cancel(); });
    }).catch(() => { if (!disposed) setError(true); });
    return () => { disposed = true; sceneRef.current = null; observer?.disconnect(); unsubscribe?.(); game?.destroy(true, false); };
  }, [runtime, state.tier, state.upgrades]);
  if (error) return <Press {...props} hint={hint || 'Phaser unavailable. SVG active.'} />;
  const part = activePressPart(state);

  return <div className="machine-scene phaser-press" data-finish={tier(state).finish} data-renderer="phaser">
    <div className="phaser-host" ref={host} aria-label={`Experimental Phaser ${tier(state).name}`} role="img" />
    {!ready && <span className="renderer-loading" role="status">Loading renderer…</span>}
    {part && <button className="phaser-key-control" disabled={!ready} onClick={() => sceneRef.current?.keyboard()} aria-label={part === 'crank' ? `Turn crank ${direction(state) === 1 ? 'clockwise' : 'counterclockwise'} one quarter` : part === 'paper' ? 'Load blank paper' : part === 'head' ? 'Stamp paper' : 'Collect finished bill'}>{part === 'crank' ? 'Turn ¼' : part === 'paper' ? 'Load' : part === 'head' ? 'Stamp' : 'Collect'}</button>}
    {hint && <div className="gesture-hint" role="status">{hint}</div>}
  </div>;
}
