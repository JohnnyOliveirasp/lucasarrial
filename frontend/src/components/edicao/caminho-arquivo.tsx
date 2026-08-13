"use client";

/**
 * 🚧 Estúdio Automático — E2 Áudio, caminho "Subir arquivo" (13/08).
 * Quem já tem a narração pronta envia o próprio áudio (MP3/WAV/M4A) em vez
 * de gerar ou gravar. Teto universal 120s + 25MB (regra Johnny 13/08).
 * O arquivo entra pela MESMA rotina dos takes (recorder-test → mp3 + loudnorm
 * no servidor), então segue o fluxo normal: clone Padrão, HeyGen ou cenas.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2, Upload } from "lucide-react";
import {
  AUDIO_UPLOAD_MAX_BYTES,
  AUDIO_VIDEO_MAX_S,
  medirDuracaoArquivo,
} from "@/lib/audio/duracao-arquivo";
import type { AudioSel } from "./edicao-wizard";

type Props = {
  escolher: (a: AudioSel | null) => void;
};

export function CaminhoArquivo({ escolher }: Props) {
  const t = useTranslations("edicao.audio.arquivo");
  const [token, setToken] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/v1/recorder-test/session")
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data ?? j ?? {};
        if (alive && d.token) setToken(d.token as string);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function onFile(file: File) {
    setErro(null);
    if (file.size > AUDIO_UPLOAD_MAX_BYTES) {
      setErro(t("erroTamanho"));
      return;
    }
    let dur = 0;
    try {
      dur = await medirDuracaoArquivo(file);
    } catch {
      setErro(t("erroLeitura"));
      return;
    }
    if (!Number.isFinite(dur) || dur > AUDIO_VIDEO_MAX_S + 0.5) {
      setErro(t("erroDuracao", { s: Math.round(dur), max: AUDIO_VIDEO_MAX_S }));
      return;
    }
    if (!token) return;
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/v1/recorder-test/upload", {
        method: "POST",
        headers: { "x-recorder-token": token },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || t("erroEnvio"));
      const key = (j?.data?.key ?? j?.key) as string | undefined;
      if (!key) throw new Error(t("erroEnvio"));
      escolher({ kind: "take", key, label: file.name.replace(/\.[^.]+$/, "") });
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroEnvio"));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)] p-4">
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={enviando || !token}
        className="flex items-center gap-2 self-start rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-4 py-2 text-[13px] font-medium text-[var(--ink)] disabled:opacity-40"
      >
        {enviando ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {enviando ? t("enviando") : t("botao")}
      </button>
      <span className="text-[12px] text-[var(--ash)]">{t("dica", { max: AUDIO_VIDEO_MAX_S })}</span>
      {erro && (
        <p className="flex items-start gap-1.5 text-[12.5px] text-red-400">
          <AlertTriangle className="mt-0.5 size-3.5 flex-none" /> {erro}
        </p>
      )}
    </div>
  );
}
