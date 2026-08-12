"use client";

import React, { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
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
        if (json.session) {
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
      </div>
    </div>
  );
}