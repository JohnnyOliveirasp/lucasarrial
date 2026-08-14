/**
 * Pedaços compartilhados da tela "Vídeos Virais" — o componente principal
 * passou de 400 linhas e foi quebrado (padrão do projeto).
 *
 * ⚠️ Classes do design system: `var(--bg)` NÃO existe. Campo é
 * `--surface-deep` + `--hairline-strong`; botão é `--ink` sobre
 * `--surface-deep` (o Johnny pegou os dois erros na tela em 14/08).
 */
export const CAMPO =
  "rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]";

export const BOTAO =
  "rounded-[var(--radius-sm)] bg-[var(--ink)] px-5 text-[14px] font-semibold text-[var(--surface-deep)] disabled:opacity-40";

/**
 * Folha de contato: são 100+ vídeos pra bater o olho, não 6 cenas. Miniatura
 * pequena mesmo — o Johnny pediu menor duas vezes em 14/08.
 */
export const GRADE = "grid grid-cols-5 gap-1 sm:grid-cols-8 lg:grid-cols-12 xl:grid-cols-14";

/** Ficha de filtro (tema, faixa de likes, período, ordem). */
export function ficha(ativa: boolean): string {
  return `h-7 rounded-full border px-2.5 text-[11px] transition-colors ${
    ativa
      ? "border-[var(--ink)] bg-[var(--ink)] font-semibold text-[var(--surface-deep)]"
      : "border-[var(--hairline-strong)] text-[var(--ink)] hover:border-[var(--ink)]"
  }`;
}

export function compacto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}k`;
  return String(n);
}
