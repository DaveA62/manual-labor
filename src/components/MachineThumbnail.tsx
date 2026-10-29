import type { MachineTier } from '../game/definitions';
/** Catalog/bay illustration only. The interactive press artwork is maintained separately. */
export function MachineThumbnail({ finish = 'mint' }: { finish?: MachineTier['finish'] }) {
  return <svg data-finish={finish} viewBox="0 0 280 190" className="machine-thumbnail" aria-hidden="true" fill="none" stroke="var(--charcoal)" strokeWidth="3" strokeLinejoin="round">
    <path d="M28 166h224v13H28z" fill="var(--frame)" />
    <path d="M78 42h17v116H78zm102 0h17v116h-17z" fill="var(--machine-paint, var(--mint))" />
    <path d="M67 25h143v28H67z" fill="var(--machine-paint, var(--mint))" />
    <path d="M74 31h130" stroke="var(--machine-highlight, var(--mint-light))" strokeWidth="3" />
    <path d="M130 53h17v57h-17z" fill="var(--frame)" />
    <path d="m131 64 15-4m-15 16 15-4m-15 16 15-4m-15 16 15-4" strokeWidth="2" />
    <path d="M104 106h69l7 22H97z" fill="var(--machine-paint, var(--mint))" />
    <path d="M123 128v10h32v-10" strokeWidth="6" />
    <path d="M93 151h86v8H93zM72 159h132v8H72z" fill="var(--machine-shade, var(--steel-dark))" />
    <path d="M111 147h46v4h-46z" fill="var(--paper)" strokeWidth="2" />
    <path d="M197 100h31" strokeWidth="7" />
    <circle cx="227" cy="100" r="29" fill="var(--panel)" />
    <path d="M227 72v56m-24-42 48 28m-48 0 48-28" strokeWidth="5" />
    <circle cx="227" cy="100" r="8" fill="var(--machine-paint, var(--mint))" />
    <rect x="250" y="89" width="10" height="23" rx="2" fill="var(--orange)" />
    <path d="M8 151h44v15H8z" fill="var(--machine-highlight, var(--mint-light))" strokeWidth="2" />
    <path d="M219 155h46v11h-46z" fill="var(--frame)" strokeWidth="2" />
    <rect x="106" y="32" width="64" height="14" fill="var(--panel)" strokeWidth="1.5" />
    <text x="138" y="42" textAnchor="middle" fill="var(--charcoal)" stroke="none" fontFamily="var(--heading)" fontSize="10" letterSpacing="2">MP—01</text>
    <path d="M79 31h10m-10 5h7m99 43h11m-11 6h7M105 114h8m-12 4h10" stroke="var(--paper)" strokeWidth="2" />
    <path d="m80 128 13-3v17H80z" fill="var(--panel)" strokeWidth="2" />
    <path d="M171 35h8v5h-8" fill="var(--red)" strokeWidth="1.5" />
    {[ [77,39], [199,39], [86,150], [188,150] ].map(([x,y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="3" fill="var(--charcoal)" stroke="none" /><path d={`M${x-2} ${y}h4`} stroke="var(--panel)" strokeWidth="1" /></g>)}
  </svg>;
}
