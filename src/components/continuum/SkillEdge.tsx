import type { SkillDefinition } from "../../config/continuum/skills";
export function SkillEdge({
  a,
  b,
  lit,
}: {
  a: SkillDefinition;
  b: SkillDefinition;
  lit: boolean;
}) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    mx = (a.x + b.x) / 2,
    my = (a.y + b.y) / 2;
  return (
    <path
      vectorEffect="non-scaling-stroke"
      className={`continuum-edge ${lit ? "is-lit" : ""}`}
      d={`M${a.x} ${a.y} Q${mx - dy * 0.09} ${my + dx * 0.09} ${b.x} ${b.y}`}
    />
  );
}
