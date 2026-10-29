import { useEffect, useRef } from "react";
import type { MachineInstance } from "../game/types";
import { automated } from "../game/machines";
import { getPlatform } from "../platform";
import type { MachineVoice } from "../platform/contracts";
/** One voice for the viewed machine; Storage instances never mount audio engines. */
export function useMachineAudio(machine: MachineInstance, sound: boolean) {
  const current = useRef<{voice: MachineVoice | null; sound: boolean}>({voice:null,sound});
  useEffect(() => {
    const m = machine,
      auto = automated(m);
    let voice: MachineVoice | null = null;
    if (
      m.type === "bottler" &&
      m.phase === "fill" &&
      (m.bottler!.valve > 0 || m.bottler!.dripMs > 0)
    )
      voice = {
        kind: "bottler",
        action: "flow",
        intensity: m.bottler!.valve || 0.06,
      };
    else if (auto)
      voice = {
        kind: m.type === "bottler" ? "bottler" : "press",
        action:
          m.phase === "raise" || m.phase === "lift"
            ? "lift"
            : m.phase === "feed" || m.phase === "load"
              ? "feed"
              : m.phase === "transfer"
                ? "carriage"
                : m.phase === "cap"
                  ? "cap"
                  : "collect",
        intensity: 0.4 + Math.sin(m.progress * Math.PI) * 0.4,
      };
    current.current = {voice,sound};
    getPlatform().machineAudio?.(voice, sound);
  }, [
    machine.phase,
    machine.progress,
    machine.bottler?.valve,
    machine.bottler?.dripMs,
    sound,
  ]);
  useEffect(() => {
    const host = getPlatform();
    const unsubscribe = host.lifecycle.subscribe(active => host.machineAudio?.(active ? current.current.voice : null, active && current.current.sound));
    return () => {unsubscribe(); host.machineAudio?.(null,false);};
  }, []);
}
