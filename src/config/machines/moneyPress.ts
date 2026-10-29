import type { MachineDefinition } from "./types.ts";

export const MONEY_PRESS: MachineDefinition = {
  type: "money-press",
  name: "Money Press",
  model: "MP-01",
  price: 50,
  unit: "bill",
  stepNames: ["Load", "Raise", "Stamp", "Lift", "Collect"],
  tiers: [
    {
      id: "cash",
      name: "Cash Press",
      baseEarnings: 5,
      upgradePriceMultiplier: 1,
      finish: "mint",
    },
    {
      id: "silver",
      name: "Silver Press",
      baseEarnings: 20,
      upgradePriceMultiplier: 3,
      finish: "silver",
      refit: {
        fee: 750,
        requiredUpgrades: ["feeder", "motor", "collector", "stamper"],
      },
    },
    {
      id: "gold",
      name: "Gold Press",
      baseEarnings: 75,
      upgradePriceMultiplier: 9,
      finish: "gold",
      refit: {
        fee: 4000,
        requiredUpgrades: ["feeder", "motor", "collector", "stamper"],
      },
    },
  ],
  phases: ["feed", "raise", "stamp", "lift", "collect"],
  durationMs: { feed: 650, raise: 1100, stamp: 450, lift: 1100, collect: 650 },
  automation: {
    feed: "feeder",
    raise: "motor",
    stamp: "stamper",
    lift: "motor",
    collect: "collector",
  },
  upgrades: [
    {
      id: "feeder",
      name: "Auto Feeder",
      cost: 15,
      description: "Loads blank paper.",
      icon: "feed",
    },
    {
      id: "motor",
      name: "Motorized Lift",
      cost: 35,
      description: "Automates both lift steps.",
      icon: "motor",
    },
    {
      id: "collector",
      name: "Auto Collector",
      cost: 75,
      description: "Collects printed bills.",
      icon: "collect",
    },
    {
      id: "stamper",
      name: "Auto Stamper",
      cost: 125,
      description: "Automates stamping.",
      icon: "stamp",
    },
    {
      id: "printing",
      name: "Improved Printing",
      cost: 150,
      description: "Doubles bill value.",
      icon: "print",
    },
  ],
};

export const PRESS_BALANCE = { printingMultiplier: 2 } as const;
