"use client";

import { useEffect } from "react";

/**
 * Heartbeat de presença. Montado no layout do app: enquanto o usuário tem uma
 * aba aberta e logada, pinga /api/v1/presence a cada 60s. O /admin usa isso pra
 * "online agora" (visto < 150s). 60s (era 30s) por causa do Disk IO Budget do
 * Supabase 07/08: cada ping era um UPDATE+WAL — ~1M de escritas acumuladas.
 */
export function PresencePinger() {
  useEffect(() => {
    const ping = () =>
      fetch("/api/v1/presence", { method: "POST", keepalive: true }).catch(() => {});
    ping();
    const id = setInterval(ping, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
