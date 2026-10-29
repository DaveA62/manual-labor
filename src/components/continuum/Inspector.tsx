import { SKILL_BY_ID } from "../../config/continuum/skills";
import type { SkillDefinition } from "../../config/continuum/skills";
import type { ServiceProgress } from "../../game/service/types";
import { eligibleSkill } from "../../game/service/progression";
export function Inspector({
  node,
  service,
  busy,
  onBuy,
  onClose,
}: {
  node: SkillDefinition;
  service: ServiceProgress;
  busy: boolean;
  onBuy: () => void;
  onClose: () => void;
}) {
  const level = service.skills[node.id] ?? 0,
    eligible = eligibleSkill(service, node.id),
    max = level >= node.max;
  const requirements = (items: { id: string; level: number }[]) =>
    items
      .map((r) => `${SKILL_BY_ID[r.id].name} Lv. ${r.level}`)
      .join(node.prerequisites.any ? " OR " : " + ");
  return (
    <aside className="continuum-inspector" aria-label="Selected skill">
      <button
        className="continuum-close"
        aria-label="Close skill details"
        onClick={onClose}
      >
        ×
      </button>
      <span className="continuum-eyebrow">
        {node.region} · LEVEL {level} / {node.max}
      </span>
      <h2>{node.name}</h2>
      <p>{node.description}</p>
      {!eligible && (
        <p className="skill-requirements">
          Requires{" "}
          {requirements(node.prerequisites.any ?? node.prerequisites.all ?? [])}
        </p>
      )}
      <button
        className="continuum-action"
        disabled={busy || max || !eligible || service.years < 1}
        onClick={onBuy}
      >
        {max
          ? "MAX LEVEL"
          : busy
            ? "SYNCHRONIZING"
            : service.years < 1
              ? "NO YEARS AVAILABLE"
              : !eligible
                ? "REQUIREMENTS NOT MET"
                : "PURCHASE LEVEL · 1 YEAR"}
      </button>
    </aside>
  );
}
