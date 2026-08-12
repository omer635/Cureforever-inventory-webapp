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
      const { error: signInErr } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInErr) {
        // Fallback: Check if vendor record exists in database for this email
        const { data: vRow } = await sb
          .from("vendors")
          .select("*")
          .ilike("email", email.trim())
          .maybeSingle();

        if (vRow) {
          // Auto-provision Supabase Auth User for this vendor store account
          const { data: signUpData, error: signUpErr } = await sb.auth.signUp({
            email: email.trim(),
            password,
          });

          if (!signUpErr && signUpData?.user) {
            // Bind user_id to vendor record
            await sb.from("vendors").update({ user_id: signUpData.user.id }).eq("id", vRow.id);

            // Retry sign in
            const { error: retryErr } = await sb.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (!retryErr) return;
          }
        }

        setError(signInErr.message);
        setBusy(false);
        return;
      }
    } catch (err) {
      setError((err as Error).message);
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