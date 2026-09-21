"use client";

/**
 * Formulário de envio do Vídeos Virais 1.0: link + consentimento.
 *
 * O botão nasce DESLIGADO e só liga com o checkbox marcado (decisão do Johnny
 * 21/09). O servidor recusa igual — a trava da tela é conforto, não segurança.
 */
import { useState } from "react";
import { Link2, Loader2 } from "lucide-react";
import { CONSENTIMENTO_TEXTO } from "@/lib/virais/consentimento";

export function EnviarViral({ aoEnviar }: { aoEnviar: () => void }) {
  const [url, setUrl] = useState("");
  const [consentiu, setConsentiu] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const podeEnviar = consentiu && url.trim().length > 10 && !enviando;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    setOk(null);
    try {
      const res = await fetch("/api/v1/virais/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), consentimento: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "Não consegui enviar esse vídeo.");
      setOk(json.ja_existia ? "Esse viral já estava no acervo — agora aparece pra todos." : "Viral enviado!");
      setUrl("");
      setConsentiu(false);
      aoEnviar();
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : "Não consegui enviar esse vídeo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-[var(--ink)]">Enviar um viral</h2>
        <p className="text-[13px] text-[var(--mute)]">
          Achou um vídeo que viralizou no Instagram ou no TikTok? Cole o link aqui. Ele entra no acervo
          e fica disponível para todo mundo — e continua em <strong>Meus envios</strong>.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3">
          <Link2 className="size-4 shrink-0 text-[var(--ash)]" />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/…  ou  https://www.tiktok.com/@perfil/video/…"
            className="h-10 w-full bg-transparent font-mono text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ash)]"
          />
        </div>
        <button
          type="submit"
          disabled={!podeEnviar}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-4 text-[13px] text-[var(--ink)] transition-colors hover:bg-[var(--surface-card)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {enviando && <Loader2 className="size-4 animate-spin" />}
          {enviando ? "enviando…" : "Enviar viral"}
        </button>
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-[12px] leading-relaxed text-[var(--mute)]">
        <input
          type="checkbox"
          checked={consentiu}
          onChange={(e) => setConsentiu(e.target.checked)}
          className="mt-[3px] size-4 shrink-0 accent-[var(--status-online)]"
        />
        <span>{CONSENTIMENTO_TEXTO}</span>
      </label>

      {erro && <p className="text-[12px] text-[var(--status-error)]">{erro}</p>}
      {ok && <p className="text-[12px] text-[var(--status-online)]">{ok}</p>}
      {enviando && (
        <p className="font-mono text-[11px] text-[var(--ash)]">
          baixando o vídeo do post — pode levar até um minuto
        </p>
      )}
    </form>
  );
}
