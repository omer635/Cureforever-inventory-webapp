"use client";

import { useEffect, useState } from "react";

// The browser only ever fires this once per page load, before we know whether the user is
// logged in yet — so this is mounted once at the root layout (like RegisterSW) rather than
// inside AppShell/LoginScreen, otherwise whichever one isn't mounted yet at that moment
// would simply never see the event.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) return; // already installed

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferredPrompt(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        zIndex: 500,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#0F1F3D",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: 8,
        boxShadow: "0 10px 30px rgba(0,0,0,.3)",
        borderLeft: "3px solid #B8935A",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>Install CureForever as an app</span>
      <button
        onClick={() => void handleInstall()}
        style={{ background: "#B8935A", color: "#0F1F3D", padding: "6px 12px", fontSize: 12, fontWeight: 700, borderRadius: 4, border: "none", cursor: "pointer" }}
      >
        Install
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{ background: "transparent", color: "#94A3B8", border: "none", fontSize: 16, cursor: "pointer", padding: "0 2px" }}
      >
        ×
      </button>
    </div>
  );
}
