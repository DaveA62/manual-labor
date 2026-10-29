import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { MachineInstance } from '../../game/types';
import { earnings, tier } from '../../game/machines';
import { Automation, Crank, Frame, Gear, Head, Paper } from '../../components/press/Parts';
import headingFont from '../../assets/fonts/barlow-condensed-latin-700-normal.woff2?url';

type Bounds = [number, number, number, number];
export interface TextureSource { image: HTMLImageElement; bounds: Bounds }
export type PressTextures = Record<string, TextureSource>;
let embeddedFont: Promise<string> | undefined;
function font() {
  return embeddedFont ??= fetch(headingFont).then(response => {
    if (!response.ok) throw new Error('Could not load equipment font');
    return response.blob();
  }).then(blob => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
  }));
}
/** Dev-only bridge: one raster texture per reusable SVG assembly, never per-frame SVG rendering. */
export async function pressTextures(machine: MachineInstance, host: HTMLElement): Promise<PressTextures> {
  const style = getComputedStyle(host);
  const fontUrl = await font();
  const resolveTokens = (text: string) => {
    for (let i = 0; i < 4; i++) text = text.replace(/var\((--[\w-]+)(?:,\s*([^()]+))?\)/g, (_, key: string, fallback: string) => style.getPropertyValue(key).trim() || fallback || '');
    return text;
  };
  const items: Record<string, [ReactNode, Bounds]> = {
    frame: [<Frame tierName={tier(machine).name}>{null}</Frame>, [0, 0, 720, 510]],
    head: [<Head y={208} printing={machine.upgrades.includes('printing')} />, [256, 199, 198, 70]],
    crank: [<Crank angle={0} />, [480, 196, 152, 152]],
    blank: [<Paper x={0} y={0} />, [-2, -2, 120, 58]],
    bill: [<Paper x={0} y={0} printed value={earnings(machine)} />, [-2, -2, 120, 58]],
    trayBack: [<path d="m545 408 13-29h118l14 29v29H545z" fill="var(--frame)" />, [540, 375, 155, 65]],
    tray: [<g><path d="M545 409h145v28H545z" fill="var(--machine-paint)" /><rect x="569" y="417" width="99" height="13" fill="var(--panel)" strokeWidth="1.5" /><text x="618" y="427" fontSize="10" textAnchor="middle" fontFamily="var(--heading)" stroke="none" fill="var(--charcoal)">COLLECTION / OUT</text><path d="M39 418h135v18H39z" fill="var(--steel-dark)" /></g>, [0, 375, 700, 65]],
  };
  for (const radius of [26, 20, 15, 8]) items[`gear${radius}`] = [<Gear x={0} y={0} radius={radius} angle={0} />, [-radius - 6, -radius - 6, (radius + 6) * 2, (radius + 6) * 2]];
  const regions: Record<string, Bounds> = { feeder: [140, 310, 135, 90], motor: [478, 156, 130, 100], collector: [425, 380, 150, 56], stamper: [307, 17, 202, 134] };
  for (const name of ['feeder', 'motor', 'collector', 'stamper'] as const) {
    if (machine.upgrades.includes(name)) items[name] = [<Automation feeder={name === 'feeder'} motor={name === 'motor'} collector={name === 'collector'} stamper={name === 'stamper'} phase="idle" progress={0} angle={0} gears={false} />, regions[name]];
  }
  const entries = await Promise.all(Object.entries(items).map(async ([key, [art, bounds]]) => {
    const [x, y, w, h] = bounds;
    const svg = resolveTokens(renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={w * 2} height={h * 2} viewBox={`${x} ${y} ${w} ${h}`}><defs><style>{`@font-face{font-family:'Barlow Condensed';src:url('${fontUrl}') format('woff2');font-weight:700}text{font-weight:700}`}</style></defs><g fill="none" stroke="var(--charcoal)" strokeWidth="3" strokeLinejoin="round">{art}</g></svg>));
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const image = new Image();
    try { image.src = url; await image.decode(); } finally { URL.revokeObjectURL(url); }
    return [key, { image, bounds }] as const;
  }));
  return Object.fromEntries(entries);
}
