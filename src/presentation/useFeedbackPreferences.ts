import { useEffect, useState } from "react";
import { getPlatform } from "../platform";
import { FEEL } from "../config/feedback";
export function useFeedbackPreferences() {
  const [initial] = useState(() => {
    try {
      const raw = JSON.parse(
        getPlatform().storage.getItem("manual-labor:feedback:v1") ?? "null",
      );
      return {
        sound: typeof raw?.sound === "boolean" ? raw.sound : true,
        volume:
          typeof raw?.volume === "number" && Number.isFinite(raw.volume)
            ? Math.max(0, Math.min(1, raw.volume))
            : FEEL.audio.defaultVolume,
      };
    } catch {
      return { sound: true, volume: FEEL.audio.defaultVolume };
    }
  });
  const [sound, setEnabled] = useState(initial.sound),
    [volume, setVolume] = useState(initial.volume);
  function setSound(value: boolean) {
    setEnabled(value);
    if (value) getPlatform().unlockAudio?.();
    else getPlatform().silence?.();
  }
  useEffect(() => {
    getPlatform().setAudioVolume?.(volume);
    try {
      getPlatform().storage.setItem(
        "manual-labor:feedback:v1",
        JSON.stringify({ sound, volume }),
      );
    } catch {}
  }, [sound, volume]);
  useEffect(() => {
    const unlock = () => {
      if (sound) getPlatform().unlockAudio?.();
    };
    const unsubscribe = getPlatform().lifecycle.subscribe(active => {
      if (!active) getPlatform().silence?.();
    });
    document.addEventListener("pointerdown", unlock, { capture: true });
    document.addEventListener("keydown", unlock, { capture: true });
    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      unsubscribe();
    };
  }, [sound]);
  useEffect(() => () => getPlatform().silence?.(), []);
  return { sound, setSound, volume, setVolume };
}
