import { useLayoutEffect, useRef, useState } from 'react';
export function useElementSize<T extends HTMLElement>(enabled = true) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;
    const update = (width: number, height: number) => setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    // Measure before first paint so page count and bay count do not flash incorrect values.
    const style = getComputedStyle(element);
    update(element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom));
    const observer = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled]);
  return { ref, ...size };
}
