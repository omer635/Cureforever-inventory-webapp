"use client";

import { AppProvider, useApp } from "@/components/AppProvider";
import LoginScreen from "@/components/LoginScreen";
import AppShell from "@/components/AppShell";

function Gate() {
  const { session, booted } = useApp();

  if (!booted) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B7280", fontSize: 14 }}>
        Loading…
      </div>
    );
  }

  if (!session) return <LoginScreen />;
  return <AppShell />;
}

export default function Home() {
  return (
    <AppProvider>
      <Gate />
    </AppProvider>
  );
}