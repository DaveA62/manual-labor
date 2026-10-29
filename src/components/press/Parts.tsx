import type { ReactNode } from 'react';
export function Bolt({ x, y }: { x: number; y: number }) { return <g transform={`translate(${x} ${y})`}><circle r="5" fill="var(--frame)" /><path d="M-3 0h6" strokeWidth="2" /></g>; }
export function Gear({ x, y, radius, angle }: { x: number; y: number; radius: number; angle: number }) {
  return <g data-part="gear" transform={`translate(${x} ${y}) rotate(${angle})`}><circle r={radius} fill="var(--frame)" strokeWidth="7" strokeDasharray="8 5" /><circle r={radius - 7} fill="var(--steel-dark)" strokeWidth="3" /><path d={`M0 ${-radius+9}v${2*radius-18}M${-radius+9} 0h${2*radius-18}`} strokeWidth="6" /><circle r="7" fill="var(--paper)" /></g>;
}
export function Paper({ x, y, printed = false, value = 5, angle = 0 }: { x: number; y: number; printed?: boolean; value?: number; angle?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${angle} 58 26)`} className="physical-paper"><path d="M0 3 111 0l5 50L3 53z" fill={printed ? '#b8c992' : 'var(--paper)'} strokeWidth="2" /><path d="M8 10 104 8l2 34-95 3z" strokeWidth="1.5" fill="none" />{printed && <><ellipse cx="58" cy="26" rx="18" ry="19" fill="var(--mint-light)" strokeWidth="1.5" /><text x="58" y="35" textAnchor="middle" stroke="none" fill="var(--charcoal)" fontSize="27" fontFamily="var(--heading)">$</text><text x="18" y="33" stroke="none" fill="var(--charcoal)" fontFamily="var(--heading)" fontSize="18">{value}</text><path d="M86 18h15m-15 7h15m-15 7h15" strokeWidth="2" /></>}</g>;
}
export function Frame({ children }: { children: ReactNode }) {
  return <g stroke="var(--charcoal)" strokeWidth="3" strokeLinejoin="round">
    <path d="M22 437h674v19H22z" fill="var(--charcoal)" /><path d="M40 456h26v29H40zm610 0h26v29h-26z" fill="var(--steel-dark)" />
    <path d="M223 399h267l14 37H209z" fill="var(--mint)" strokeWidth="5" />
    <path d="M226 111h38v291h-38zm220 0h38v291h-38z" fill="var(--mint)" strokeWidth="5" />
    <path d="M244 142h12v246h-12zm211 0h12v246h-12z" fill="var(--frame)" />
    <path d="M217 78h274v62H217z" fill="var(--mint)" strokeWidth="5" /><path d="M221 84h266v10H221z" fill="var(--mint-light)" stroke="none" />
    <rect x="273" y="96" width="160" height="31" fill="var(--panel)" strokeWidth="2" /><text x="353" y="109" textAnchor="middle" fontFamily="var(--heading)" fontSize="10" stroke="none" fill="var(--charcoal)">PROVISIONAL INDUSTRIES</text><text x="353" y="121" textAnchor="middle" fontFamily="var(--heading)" fontSize="10" stroke="none" fill="var(--charcoal)" letterSpacing="2">MP–01 / LOAD: APPROX.</text>
    <path d="m229 267 32-5v47h-32z" fill="var(--panel)" strokeWidth="2" /><path d="M236 276h17m-17 7h17m-17 7h12" strokeWidth="2" />
    <path d="M228 102h15m-15 7h9m214 241h17m-14 6h14M236 373h14m-14 6h8" stroke="var(--paper)" strokeWidth="3" />
    <path d="M270 398h174v18H270z" fill="var(--frame)" /><path d="M267 417h180v10H267z" fill="var(--orange)" /><path d="m278 417-6 10m28-10-6 10m28-10-6 10m28-10-6 10m28-10-6 10m28-10-6 10m28-10-6 10m28-10-6 10" strokeWidth="7" />
    {[ [234,120],[474,120],[237,409],[473,409],[244,290] ].map(([x,y])=><Bolt key={`${x}-${y}`} x={x} y={y} />)}
    <path d="M476 272h80" strokeWidth="13" stroke="var(--charcoal)" />
    {children}
  </g>;
}
export function Head({ y, printing, children }: { y: number; printing: boolean; children?: ReactNode }) {
  return <g data-part="head" transform={`translate(0 ${y})`}>
    <path d="M341 137h27" transform={`translate(0 ${-y})`} strokeWidth="22" stroke="var(--charcoal)" />
    <path d={`M345 ${143-y}h19V0h-19z`} fill="var(--frame)" /><path d={`M354 ${151-y}V-4`} stroke="var(--steel-dark)" strokeWidth="2" strokeDasharray="3 8" />
    <path d="M258 1h193v35H258z" fill="var(--steel-dark)" /><path d="M275-7h160l10 48H265z" fill="var(--charcoal)" strokeWidth="5" /><path d="M280 0h148" stroke="var(--frame)" strokeWidth="3" />
    <path d="M276 42h157v9H276z" fill="var(--red)" /><path d="M333 23v8h41v-8" stroke="var(--orange)" strokeWidth="8" fill="none" />
    {printing && <g data-upgrade="printing"><rect x="290" y="5" width="129" height="16" fill="var(--panel)" strokeWidth="2" /><text x="354" y="17" textAnchor="middle" fontFamily="var(--heading)" fontSize="11" stroke="none" fill="var(--charcoal)">PRECISION PRINT / II</text><path d="M286 52h137v5H286z" fill="var(--orange)" /></g>}
    {children}
  </g>;
}
export function Crank({ angle }: { angle: number }) { return <g data-part="crank" transform={`translate(556 272) rotate(${angle})`}>
  <circle r="63" fill="var(--orange)" strokeWidth="6" /><circle r="49" fill="var(--paper)" strokeWidth="4" /><path d="M0-48v96m-42-72 84 48m-84 0 84-48" stroke="var(--orange)" strokeWidth="11" /><circle r="17" fill="var(--frame)" strokeWidth="4" /><Bolt x={0} y={0} /><rect x="46" y="-24" width="24" height="48" rx="5" fill="var(--charcoal)" /><path d="M53-16v30" stroke="var(--paper)" strokeWidth="3" />
</g>; }
export function Automation({ feeder, motor, collector, stamper, phase, progress, angle }: { feeder: boolean; motor: boolean; collector: boolean; stamper: boolean; phase: string; progress: number; angle: number }) {
  return <g>
    {feeder && <g data-upgrade="feeder"><path d="M157 378h114v16H157z" fill="var(--frame)" /><path d="M145 345h63v49h-63z" fill="var(--mint)" /><path d="M152 353h48v9h-48z" fill="var(--panel)" /><Gear x={185} y={383} radius={15} angle={phase==='feed'?progress*360:0} /><path d="M195 347v-28h-46v28" fill="none" strokeWidth="6" /><Bolt x={155} y={378} /></g>}
    {motor && <g data-upgrade="motor"><path d="M484 164h91v45h-91z" fill="var(--mint)" strokeWidth="4" /><path d="M497 173v27m10-27v27m10-27v27m10-27v27" strokeWidth="3" /><path d="M575 174h13v24h-13z" fill="var(--orange)" /><Gear x={572} y={186} radius={15} angle={angle*2} /><path d="M585 187 599 239M560 199l-24 48" strokeWidth="4" fill="none" /><path d="M489 212h81" strokeWidth="6" /><Bolt x={489} y={169} /></g>}
    {collector && <g data-upgrade="collector"><path d="M430 386h141v24H430z" fill="var(--mint)" /><path d="M434 391h132v11H434z" fill="var(--charcoal)" />{[446,473,500,527,553].map(x=><Gear key={x} x={x} y={397} radius={8} angle={phase==='collect'?progress*540:0} />)}<path d="M438 411v21m119-21v21" strokeWidth="7" /></g>}
    {stamper && <g data-upgrade="stamper"><path d="M312 40h82v36h-82z" fill="var(--orange)" /><path d="M322 47h61m-51-11V21h34v15" fill="none" /><path d="M354 41v31" strokeWidth="8" /><circle cx="379" cy="58" r="6" fill={phase==='stamp'?'var(--mint)':'var(--paper)'} /><path d="M394 60h17v76" fill="none" strokeWidth="5" /></g>}
  </g>;
}
