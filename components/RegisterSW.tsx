"use client";

import { useEffect } from "react";

// Registered only in production — a service worker caching static assets during local dev
// would fight with Turbopack's HMR (you'd keep seeing stale chunks after every edit).
export default function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* installability is a progressive enhancement — nothing to do if it fails */
    });
  }, []);

  return null;
}
