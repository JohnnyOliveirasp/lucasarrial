"use client";

/**
 * Registro das faixas de rodapé ocupadas por elementos `fixed` do /app.
 *
 * Cada overlay ancorado embaixo (balão da Fast, pill do Gravador, uma futura
 * barra de ação) declara AQUI quantos px de faixa ele ocupa. O maior valor
 * vira a variável CSS `--fc-reserva-rodape`, que o `<main>` do layout do /app
 * transforma em `padding-bottom`. Conteúdo nenhum termina embaixo do overlay
 * — em qualquer tela do /app, inclusive as que ainda não existem.
 *
 * A régua (quanto é a faixa) mora em `lib/ui/reserva-de-rodape.ts`, pura e
 * testada; aqui é só o encanamento com o DOM.
 *
 * É um Map de módulo, não Context, porque quem declara (o balão, montado no
 * layout) e quem consome (o `<main>`, server component do mesmo layout) não
 * compartilham árvore de render — e uma variável CSS no `<html>` atravessa
 * essa fronteira sem transformar o layout inteiro em client component.
 */
import { useEffect } from "react";
import { VAR_RESERVA } from "@/lib/ui/reserva-de-rodape";

const faixas = new Map<string, number>();

function aplicar() {
  if (typeof document === "undefined") return;
  let maior = 0;
  for (const px of faixas.values()) if (px > maior) maior = px;
  document.documentElement.style.setProperty(VAR_RESERVA, `${Math.round(maior)}px`);
}

/**
 * Declara (e mantém atualizada) a faixa ocupada por um overlay fixo.
 *
 * @param id  identificador estável do overlay ("balao-de-ajuda", …)
 * @param px  altura da faixa — 0 quando o overlay não está na tela
 */
export function useReservaDeRodape(id: string, px: number) {
  useEffect(() => {
    faixas.set(id, px);
    aplicar();
    return () => {
      faixas.delete(id);
      aplicar();
    };
  }, [id, px]);
}
