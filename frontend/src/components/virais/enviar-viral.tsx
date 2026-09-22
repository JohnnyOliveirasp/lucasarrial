"use client";

/**
 * Formulário de envio do Vídeos Virais 1.0 — DOIS caminhos (ordem do Johnny
 * 22/09): colar o LINK do post, ou mandar o ARQUIVO do vídeo.
 *
 * O arquivo vai do navegador direto pro R2 (presigned PUT): nada de 100 MB
 * atravessando a aplicação, porque o /tmp do servidor é RAM.
 *
 * A duração é conferida AQUI (o `<video>` sabe antes de subir) e o tamanho é
 * conferido de novo no servidor, contra o arquivo real.
 *
 * O botão nasce DESLIGADO e só liga com o consentimento marcado. O servidor
 * recusa igual — a trava da tela é conforto, não segurança.
 */
import { useRef, useState } from "react";
import { Link2, Loader2, Upload } from "lucide-react";
import { CONSENTIMENTO_TEXTO } from "@/lib/virais/consentimento";
import { LIMITE_VIRAL, recusaPorDuracao, recusaPorTamanho } from "@/lib/virais/limites";

/** Lê a duração sem subir nada: o navegador já sabe pelo cabeçalho do arquivo. */
async function duracaoDoArquivo(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(v.duration) ? v.duration : null);
    };
    v.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    v.src = url;
  });
}

export function EnviarViral({ aoEnviar }: { aoEnviar: () => void }) {
  const [modo, setModo] = useState<"link" | "arquivo">("link");
  const [url, setUrl] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [consentiu, setConsentiu] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const podeEnviar =
    consentiu && !enviando && (modo === "link" ? url.trim().length > 10 : !!arquivo);

  async function escolherArquivo(f: File | null) {
    setErro(null);
    setArquivo(null);
    if (!f) return;
    if (f.size > LIMITE_VIRAL.bytes) {
      setErro(recusaPorTamanho(f.size));
      return;
    }
    const seg = await duracaoDoArquivo(f);
    if (seg !== null && seg > LIMITE_VIRAL.segundos) {
      setErro(recusaPorDuracao(seg));
      return;
    }
    setArquivo(f);
  }

  /** Sobe o arquivo pro R2 e devolve a chave que o /enviar vai publicar. */
  async function subirArquivo(f: File): Promise<string> {
    setProgresso("pedindo espaço no servidor…");
    const r1 = await fetch("/api/v1/virais/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content_type: f.type || "video/mp4", bytes: f.size, filename: f.name }),
    });
    const j1 = await r1.json().catch(() => ({}));
    if (!r1.ok) throw new Error(j1?.error?.message || "Não consegui preparar o envio.");

    setProgresso(`enviando ${(f.size / 1024 / 1024).toFixed(0)} MB…`);
    const put = await fetch(j1.upload_url as string, {
      method: "PUT",
      headers: { "Content-Type": f.type || "video/mp4" },
      body: f,
    });
    if (!put.ok) throw new Error("O envio do arquivo falhou. Tente de novo.");
    return j1.key as string;
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!podeEnviar) return;
    setEnviando(true);
    setErro(null);
    setOk(null);
    try {
      const corpo: Record<string, unknown> = { consentimento: true };
      if (modo === "arquivo" && arquivo) {
        corpo.arquivo_key = await subirArquivo(arquivo);
        corpo.titulo = arquivo.name.replace(/\.[a-z0-9]+$/i, "");
      } else {
        corpo.url = url.trim();
      }
      setProgresso(modo === "arquivo" ? "publicando no acervo…" : "lendo o post…");
      const res = await fetch("/api/v1/virais/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message || "Não consegui enviar esse vídeo.");
      setOk(json.ja_existia ? "Esse viral já estava no acervo — agora aparece pra todos." : "Viral enviado!");
      setUrl("");
      setArquivo(null);
      if (inputArquivo.current) inputArquivo.current.value = "";
      setConsentiu(false);
      aoEnviar();
    } catch (e2) {
      setErro(e2 instanceof Error ? e2.message : "Não consegui enviar esse vídeo.");
    } finally {
      setEnviando(false);
      setProgresso(null);
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

      {/* Dois caminhos lado a lado: quem tem o link cola, quem tem o arquivo
          manda. Nenhum é "o certo" — o aluno escolhe. */}
      <div className="flex items-center gap-1">
        {(["link", "arquivo"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setModo(m);
              setErro(null);
            }}
            className={`rounded-[var(--radius)] px-3 py-1.5 font-mono text-[11px] transition-colors ${
              modo === m
                ? "bg-[var(--surface-elevated)] text-[var(--ink)]"
                : "text-[var(--ash)] hover:text-[var(--ink)]"
            }`}
          >
            {m === "link" ? "colar link" : "enviar arquivo"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {modo === "link" ? (
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3">
            <Link2 className="size-4 shrink-0 text-[var(--ash)]" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.instagram.com/reel/…  ou  https://www.tiktok.com/@perfil/video/…"
              className="h-10 w-full bg-transparent font-mono text-[12px] text-[var(--ink)] outline-none placeholder:text-[var(--ash)]"
            />
          </div>
        ) : (
          <label className="flex min-w-[260px] flex-1 cursor-pointer items-center gap-2 rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3">
            <Upload className="size-4 shrink-0 text-[var(--ash)]" />
            <input
              ref={inputArquivo}
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
              className="h-10 w-full bg-transparent font-mono text-[11px] text-[var(--mute)] outline-none file:mr-3 file:rounded-[var(--radius)] file:border-0 file:bg-[var(--surface-elevated)] file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:text-[var(--ink)]"
            />
          </label>
        )}
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

      <p className="font-mono text-[11px] text-[var(--ash)]">
        {modo === "arquivo"
          ? `MP4, MOV ou WebM · até ${LIMITE_VIRAL.mb} MB e ${LIMITE_VIRAL.segundos / 60} minutos`
          : "se o link não abrir, use “enviar arquivo” — algumas redes bloqueiam a leitura automática"}
      </p>

      {erro && <p className="text-[12px] text-[var(--status-error)]">{erro}</p>}
      {ok && <p className="text-[12px] text-[var(--status-online)]">{ok}</p>}
      {enviando && progresso && (
        <p className="font-mono text-[11px] text-[var(--ash)]">{progresso}</p>
      )}
    </form>
  );
}
