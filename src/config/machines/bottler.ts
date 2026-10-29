import type { MachineDefinition } from "./types.ts";

export const BOTTLER: MachineDefinition = {
  type: "bottler",
  name: "Bottling Machine",
  model: "BT-02",
  price: 250,
  unit: "bottle",
  stepNames: ["Load", "Fill", "Slide", "Cap", "Collect"],
  tiers: [
    {
      id: "water",
      name: "Water Bottler",
      baseEarnings: 25,
      upgradePriceMultiplier: 1,
      finish: "mint",
    },
    {
      id: "soda",
      name: "Soda Bottler",
      baseEarnings: 100,
      upgradePriceMultiplier: 3,
      finish: "silver",
      refit: {
        fee: 3750,
        requiredUpgrades: [
          "bottle-loader",
          "flow-regulator",
          "auto-capper",
          "crate-conveyor",
        ],
      },
    },
    {
      id: "premium",
      name: "Premium Bottler",
      baseEarnings: 375,
      upgradePriceMultiplier: 9,
      finish: "gold",
      refit: {
        fee: 20000,
        requiredUpgrades: [
          "bottle-loader",
          "flow-regulator",
          "auto-capper",
          "crate-conveyor",
        ],
      },
    },
  ],
  phases: ["load", "fill", "transfer", "cap", "collect"],
  durationMs: { load: 700, fill: 4000, transfer: 800, cap: 650, collect: 850 },
  automation: {
    load: "bottle-loader",
    fill: "flow-regulator",
    transfer: "auto-capper",
    cap: "auto-capper",
    collect: "crate-conveyor",
  },
  upgrades: [
    {
      id: "bottle-loader",
      name: "Bottle Loader",
      cost: 75,
      description: "Loads empty bottles.",
      icon: "feed",
    },
    {
      id: "flow-regulator",
      name: "Flow Regulator",
      cost: 150,
      description: "Fills to target. Base payout; no precision bonus.",
      icon: "motor",
    },
    {
      id: "auto-capper",
      name: "Auto Capper",
      cost: 250,
      description: "Transfers and seals bottles.",
      icon: "stamp",
    },
    {
      id: "crate-conveyor",
      name: "Crate Conveyor",
      cost: 350,
      description: "Collects sealed bottles.",
      icon: "collect",
    },
  ],
};
export const BOTTLING = {
  sizes: ["standard", "short", "tall"] as const,
  capacity: { short: 0.8, standard: 1, tall: 1.2 },
  valveTravel: Math.PI * 1.5,
  residualMs: 240,
  residualRate: 0.12,
  maxFill: 1.25,
  regulatedFill: 1,
  quality: {
    preciseMin: 0.95,
    preciseMax: 1,
    acceptableMin: 0.85,
    acceptableMax: 1.05,
    epsilon: 1e-9,
  },
  payout: { precise: 1.2, acceptable: 1, poor: 0.7 },
};
