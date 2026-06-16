"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Atualiza a tela sozinha quando uma COMPRA cai, sem o usuário dar F5.
 *
 * Por quê: o checkout da Hotmart abre num lightbox POR CIMA da página (widget
 * `hotmart__button-checkout`), então a página nunca recarrega — e o saldo é
 * renderizado no servidor. O webhook credita de forma assíncrona (segundos
 * depois). Resultado antigo: o usuário voltava do checkout e precisava dar
 * refresh manual pra ver os créditos.
 *
 * Como: ao clicar no botão de checkout (Hotmart ou Stripe), começa a observar o
 * saldo (polling leve). Quando o total aumenta (webhook processou a compra),
 * dispara `router.refresh()` — re-renderiza o layout server e o saldo novo
 * aparece no topbar. Sem popup. Para sozinho ao detectar a mudança ou no timeout.
 */
const POLL_MS = 5000;
const WINDOW_MS = 5 * 60 * 1000; // observa por até 5 min após o clique

export function PurchaseAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    let deadline = 0;
    let baseline: number | null = null;

    async function fetchTotal(): Promise<number | null> {
      try {
        const r = await fetch("/api/v1/credits/balance", { cache: "no-store" });
        if (!r.ok) return null;
        const j = await r.json();
        const t = j?.balance?.total;
        return typeof t === "number" ? t : null;
      } catch {
        return null;
      }
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
      baseline = null;
    }

    async function startWatch() {
      // renova a janela a cada novo clique (ex.: reabriu o checkout)
      deadline = Date.now() + WINDOW_MS;
      if (timer) return; // já observando
      baseline = await fetchTotal();
      timer = setInterval(async () => {
        if (Date.now() > deadline) return stop();
        const total = await fetchTotal();
        if (total != null && baseline != null && total > baseline) {
          stop();
          router.refresh();
        }
      }, POLL_MS);
    }

    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      const hit = el?.closest?.(
        '.hotmart__button-checkout, a[href*="hotmart"], a[href*="pay.hotmart"], [data-checkout]',
      );
      if (hit) startWatch();
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      stop();
    };
  }, [router]);

  return null;
}
