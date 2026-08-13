"use client";

import React, { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { DEMO_USER_EMAIL, DEMO_USER_PASS } from "@/lib/demoData";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const startDemoMode = () => {
    localStorage.setItem("cureforever_demo_mode", "true");
    window.location.reload();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (
      cleanEmail === "demo@cureforever.com" ||
      cleanEmail === "demo2026@cureforever.com" ||
      cleanEmail === "demo@cureforever.in" ||
      cleanEmail.startsWith("demo")
    ) {
      startDemoMode();
      return;
    }

    setError("");
    setBusy(true);
    try {
      const sb = getSupabase();

      // 1. Try standard client sign in
      const { data: signData, error: signInErr } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!signInErr && signData.session) {
        localStorage.removeItem("cureforever_demo_mode");
        return;
      }

      // 2. Call /api/vendor/login server route to auto-confirm unconfirmed emails & authenticate
      const res = await fetch("/api/vendor/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.isDemo) {
          startDemoMode();
          return;
        }
        if (json.session) {
          localStorage.removeItem("cureforever_demo_mode");
          await sb.auth.setSession(json.session);
          return;
        }
      }

      const errJson = await res.json().catch(() => null);
      setError(errJson?.error || signInErr?.message || "Invalid login credentials.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img
          src="/logo.png"
          alt="CureForever Logo"
          style={{ width: 64, height: 64, borderRadius: "50%", margin: "0 auto 16px", display: "block", border: "2px solid #B8935A", background: "#0F1F3D" }}
        />
        <p className="brand" style={{ textAlign: "center" }}>CureForever</p>
        <p className="sub" style={{ textAlign: "center" }}>Enterprise Inventory Portal</p>
        {error && <div className="err">{error}</div>}
        <form onSubmit={submit}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="username"
          />
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <button className="btn-primary" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px dashed #E2E8F0", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#64748B", marginBottom: 8 }}>
            Want to showcase all features without changing live database?
          </div>
          <button
            type="button"
            onClick={() => {
              setEmail(DEMO_USER_EMAIL);
              setPassword(DEMO_USER_PASS);
              startDemoMode();
            }}
            style={{
              width: "100%",
              padding: "10px 14px",
              background: "#F8FAFC",
              border: "1px solid #CBD5E1",
              borderRadius: 6,
              color: "#0F1F3D",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            🎮 Launch Demo Showcase Mode
          </button>
          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 6 }}>
            Login: <strong>{DEMO_USER_EMAIL}</strong> | Pass: <strong>{DEMO_USER_PASS}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}