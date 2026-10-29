import { CONTINUUM } from "../../config/retirement";
import type { SkillDefinition } from "../../config/continuum/skills";
export function SkillNode({
  node,
  level,
  eligible,
  selected,
  zoom,
  onSelect,
  onNavigate,
}: {
  node: SkillDefinition;
  level: number;
  eligible: boolean;
  selected: boolean;
  zoom: number;
  onSelect: () => void;
  onNavigate: () => void;
}) {
  const origin = node.id === "first-day",
    radius = origin ? 28 : 21;
  return (
    <g
      className={`continuum-node ${level ? "is-purchased" : ""} ${eligible ? "is-available" : "is-locked"} ${selected ? "is-selected" : ""} region-${node.region.toLowerCase()}`}
      transform={`translate(${node.x} ${node.y})`}
      data-node={node.id}
      data-x={node.x}
      data-y={node.y}
      role="button"
      tabIndex={0}
      aria-label={`${node.name}, level ${level} of ${node.max}${eligible ? ", available" : ", locked"}`}
      aria-pressed={selected}
      onFocus={(e) => {
        if (e.currentTarget.matches(":focus-visible")) onNavigate();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
          onNavigate();
        }
      }}
    >
      <circle
        className="node-hit"
        r={Math.max(30, 24 / zoom)}
        fill="transparent"
        stroke="none"
      />
      <circle className="node-halo" r={radius + 11} />
      <path
        className="node-orbit"
        d={`M0 ${-radius - 7} ${radius + 7} 0 0 ${radius + 7} ${-radius - 7} 0Z`}
      />
      <circle className="node-core" r={radius} />
      <path
        className="node-sigil"
        d={origin ? "M0-12V12M-12 0H12M-8-8 8 8M8-8-8 8" : "M0-7 7 0 0 7-7 0Z"}
      />
      <text
        className="node-name"
        y={radius + 20 / zoom}
        style={{
          fontSize: Math.max(13, CONTINUUM.labelPx / zoom),
          strokeWidth: 6 / zoom,
        }}
      >
        {node.name}
      </text>
      <text
        className="node-level"
        y={radius + 35 / zoom}
        style={{
          fontSize: Math.max(11, CONTINUUM.levelPx / zoom),
          strokeWidth: 6 / zoom,
        }}
      >
        {level} / {node.max}
      </text>
    </g>
  );
}
