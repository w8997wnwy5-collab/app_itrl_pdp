// "Add to Home Screen" support: Android/desktop install prompt and iPhone hints.
import { useEffect, useState } from "react";
import { isIOS, isStandalone } from "./push";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notifyAll = () => listeners.forEach((l) => l());

/** Call once at startup, before the browser fires the event. */
export function captureInstallPrompt(): void {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notifyAll();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notifyAll();
  });
}

export type InstallMode = "installed" | "ios" | "prompt" | "none";

export function useInstall(): { mode: InstallMode; install: () => Promise<void> } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const mode: InstallMode = isStandalone() ? "installed" : isIOS() ? "ios" : deferred ? "prompt" : "none";
  return {
    mode,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice.catch(() => undefined);
      deferred = null;
      notifyAll();
    },
  };
}
