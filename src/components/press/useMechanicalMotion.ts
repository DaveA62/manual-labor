import { useEffect, useRef, useState } from 'react';
/** Damped visual follower. Never advances production or awards money. */
export function useMechanicalMotion(target: number, direct: boolean) {
  const position = useRef(target);
  const velocity = useRef(0);
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (direct || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      position.current = target; velocity.current = 0; setValue(target); return;
    }
    let frame = 0, previous = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - previous) / 1000, .025); previous = now;
      velocity.current += ((target - position.current) * 340 - velocity.current * 34) * dt;
      position.current += velocity.current * dt;
      setValue(position.current);
      if (Math.abs(target-position.current)>.03 || Math.abs(velocity.current)>.1) frame=requestAnimationFrame(tick);
      else { position.current=target; setValue(target); }
    };
    frame=requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, direct]);
  return value;
}
