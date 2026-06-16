/**
 * Indicador de "gerando áudio" — equalizer de ondas pulsando.
 *
 * Substitui o spinner de borda (`animate-spin` + `border-t`), que no tema dark
 * tinha contraste quase nulo entre o arco e o resto da borda e parecia
 * CONGELADO. Barras de waveform com defasagem nunca dão essa impressão e são
 * temáticas (geração de ÁUDIO). On-brand: prata (--silver) + glow violeta
 * (--glow-voice, o mesmo da feature "clone de voz").
 *
 * Keyframe `eq-bar` vive em globals.css. A regra global de prefers-reduced-motion
 * já congela a animação num frame estável (barras parciais), sem layout extra.
 */

// Delays (s) escalonados — desenham a "onda" andando da esquerda p/ direita.
const BAR_DELAYS = [0, 0.12, 0.24, 0.36, 0.24, 0.12, 0];

type Props = {
  label?: string;
  hint?: string;
};

export function AudioGeneratingIndicator({
  label = "Gerando áudio…",
  hint,
}: Props) {
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="relative flex flex-col items-center gap-5 overflow-hidden rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-12 text-center"
    >
      {/* glow ambiente (tema clone de voz) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-1/3 h-2/3 opacity-70"
        style={{ backgroundImage: "var(--glow-voice)" }}
      />

      {/* equalizer */}
      <div className="relative flex h-12 items-center gap-[5px]" aria-hidden>
        {BAR_DELAYS.map((delay, i) => (
          <span
            key={i}
            className="block h-full w-[5px] rounded-[var(--radius-full)] bg-[var(--silver)] shadow-[0_0_12px_var(--glow-violet)]"
            style={{
              transformOrigin: "center",
              animation: "eq-bar 1.05s var(--ease-in-out) infinite",
              animationDelay: `${delay}s`,
            }}
          />
        ))}
      </div>

      <p className="relative font-mono text-[12px] tracking-wide text-[var(--silver)]">
        {label}
      </p>
      {hint && <p className="relative text-xs text-[var(--mute)]">{hint}</p>}
    </section>
  );
}
