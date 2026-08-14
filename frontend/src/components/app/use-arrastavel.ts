"use client";

/**
 * Deixa o balão da Fast ser ARRASTADO pra onde a pessoa quiser.
 *
 * 🐛 14/08: o botão fica fixo no canto inferior direito com z-50 e cobriu o
 * "Continuar" do wizard — o Johnny só conseguiu avançar depois de mudar o
 * tamanho da janela. Botão de ajuda não pode impedir o uso do produto.
 *
 * A posição fica guardada por navegador: quem moveu uma vez não move de novo.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const CHAVE = "fc-help-pos-v1";
/** Distância mínima pra considerar arrasto — abaixo disso é clique. */
const LIMIAR_PX = 4;
/** Respiro pra borda: o balão nunca some da tela. */
const MARGEM = 8;

export type PosicaoBalao = { right: number; bottom: number };

const PADRAO: PosicaoBalao = { right: 20, bottom: 20 };

function limitar(p: PosicaoBalao): PosicaoBalao {
  if (typeof window === "undefined") return p;
  const maxRight = Math.max(MARGEM, window.innerWidth - 72);
  const maxBottom = Math.max(MARGEM, window.innerHeight - 72);
  return {
    right: Math.min(Math.max(MARGEM, p.right), maxRight),
    bottom: Math.min(Math.max(MARGEM, p.bottom), maxBottom),
  };
}

export function useArrastavel() {
  const [pos, setPos] = useState<PosicaoBalao>(PADRAO);
  const [arrastando, setArrastando] = useState(false);
  /** Vira true no primeiro movimento — é o que cancela o clique. */
  const moveu = useRef(false);
  const origem = useRef<{ x: number; y: number; pos: PosicaoBalao } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHAVE);
      if (raw) setPos(limitar(JSON.parse(raw) as PosicaoBalao));
    } catch {
      /* sem posição guardada: fica no canto */
    }
  }, []);

  // Janela menor não pode deixar o balão fora da tela.
  useEffect(() => {
    const onResize = () => setPos((p) => limitar(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      moveu.current = false;
      origem.current = { x: e.clientX, y: e.clientY, pos };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [pos],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const o = origem.current;
    if (!o) return;
    const dx = e.clientX - o.x;
    const dy = e.clientY - o.y;
    if (!moveu.current && Math.hypot(dx, dy) < LIMIAR_PX) return;
    moveu.current = true;
    setArrastando(true);
    // right/bottom crescem no sentido CONTRÁRIO ao ponteiro.
    setPos(limitar({ right: o.pos.right - dx, bottom: o.pos.bottom - dy }));
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      origem.current = null;
      if (moveu.current) {
        setArrastando(false);
        try {
          localStorage.setItem(CHAVE, JSON.stringify(pos));
        } catch {
          /* sem localStorage: vale só nesta sessão */
        }
      }
    },
    [pos],
  );

  /** Clique de verdade? (arrastar não pode abrir/fechar o chat) */
  const foiArrasto = useCallback(() => moveu.current, []);

  return {
    pos,
    arrastando,
    foiArrasto,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
