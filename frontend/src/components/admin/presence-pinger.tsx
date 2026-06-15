"use client";

import { useEffect } from "react";

/**
 * Heartbeat de presença. Montado no layout do app: enquanto o usuário tem uma
 * aba aberta e logada, pinga /api/v1/presence a cada 30s. O /admin usa isso pra
 * "online agora" (visto < 90s). Silencioso e barato.
 */
export function PresencePinger() {
  useEffect(() => {
    const ping = () =>
      fetch("/api/v1/presence", { method: "POST", keepalive: true }).catch(() => {});
    ping();
    const id = setInterval(ping, 30_000);
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
