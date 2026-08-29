"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { formatDuration } from "@/lib/audio/duration";
import { putToR2 } from "@/lib/images/upload";
import { CIENCIA_AUDIO, SGP_AUDIO_MAX_SEGUNDOS, SGP_AUDIO_MIN_SEGUNDOS, type SgpAudio } from "@/lib/sgp/types";
import { SGP_ERROR_CLASS, SGP_GHOST_CLASS, SGP_HINT_CLASS, SGP_PILL_CLASS } from "./sgp-classes";

const ACCEPT = ".mp3,.wav,.m4a,.flac,.ogg,.webm,.mp4,.aac,.opus,audio/*";

type Item =
  | { id: string; nome: string; fase: "enviando" | "analisando" }
  | { id: string; nome: string; fase: "aprovado"; segundos: number; key: string }
  | { id: string; nome: string; fase: "reprovado"; motivos: string[]; key: string }
  | { id: string; nome: string; fase: "indeciso" | "erro"; mensagem: string; key?: string };

/**
 * Tela 3 do SGP — Áudio para clonagem de voz (decisões 29/08):
 *  vídeo do Lucas (aviso até ele gravar) · 4 checkboxes (ciência com hora) ·
 *  upload como o gravador do app, acumula minutos · cada arquivo é MEDIDO no
 *  servidor (✅/❌ com motivo) · Continuar só com 20–60 min de fala aprovada.
 */
export function StepAudioForm({ iniciais }: { iniciais: SgpAudio[] }) {
  const t = useTranslations("sgp.audio");
  const router = useRouter();
  const input = useRef<HTMLInputElement | null>(null);
  const [itens, setItens] = useState<Item[]>(() =>
    iniciais.map((a) =>
      a.status === "aprovado"
        ? { id: a.key, nome: a.nome, fase: "aprovado", segundos: a.segundos, key: a.key }
        : { id: a.key, nome: a.nome, fase: "reprovado", motivos: a.motivos ?? [], key: a.key },
    ),
  );
  const [ciencia, setCiencia] = useState<Set<string>>(new Set());
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const total = itens.reduce((s, i) => (i.fase === "aprovado" ? s + i.segundos : s), 0);
  const ocupado = itens.some((i) => i.fase === "enviando" || i.fase === "analisando");
  const dentroDaRegua = total >= SGP_AUDIO_MIN_SEGUNDOS && total <= SGP_AUDIO_MAX_SEGUNDOS;
  const podeContinuar = dentroDaRegua && !ocupado && ciencia.size === CIENCIA_AUDIO.length;
  const progresso = Math.min(100, Math.round((total / SGP_AUDIO_MIN_SEGUNDOS) * 100));

  function patch(id: string, novo: Item) {
    setItens((prev) => prev.map((i) => (i.id === id ? novo : i)));
  }

  async function enviarArquivos(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) void enviarUm(file);
  }

  async function enviarUm(file: File) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nome = file.name || "áudio";
    setItens((prev) => [...prev, { id, nome, fase: "enviando" }]);
    try {
      const tipo = file.type || "audio/mpeg";
      const r = await fetch("/api/v1/sgp/audio/slot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: nome, content_type: tipo }),
      });
      if (!r.ok) throw new Error(await mensagemDe(r, t("erroUpload")));
      const { key, upload_url } = (await r.json()) as { key: string; upload_url: string };
      await putToR2(upload_url, file, tipo);

      patch(id, { id, nome, fase: "analisando" });
      const j = await fetch("/api/v1/sgp/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, nome }),
      });
      if (j.status === 202) return patch(id, { id, nome, fase: "indeciso", mensagem: t("indeciso"), key });
      if (!j.ok) throw new Error(await mensagemDe(j, t("erroAnalise")));
      const { audio } = (await j.json()) as { audio: SgpAudio };
      patch(
        id,
        audio.status === "aprovado"
          ? { id, nome, fase: "aprovado", segundos: audio.segundos, key }
          : { id, nome, fase: "reprovado", motivos: audio.motivos ?? [], key },
      );
    } catch (e) {
      patch(id, { id, nome, fase: "erro", mensagem: e instanceof Error ? e.message : t("erroUpload") });
    }
  }

  async function remover(item: Item) {
    setItens((prev) => prev.filter((i) => i.id !== item.id));
    if ("key" in item && item.key) {
      await fetch(`/api/v1/sgp/audio?key=${encodeURIComponent(item.key)}`, { method: "DELETE" }).catch(() => {});
    }
  }

  function alternar(c: string) {
    setCiencia((prev) => {
      const n = new Set(prev);
      if (n.has(c)) n.delete(c);
      else n.add(c);
      return n;
    });
  }

  async function continuar() {
    setErro(null);
    setEnviando(true);
    try {
      const r = await fetch("/api/v1/sgp/audio/concluir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ciencia: [...ciencia] }),
      });
      if (!r.ok) throw new Error(await mensagemDe(r, t("erroConcluir")));
      router.push("/sgp/revisao");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroConcluir"));
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ⚠️ Vídeo do Lucas: ele ainda vai gravar. Quando chegar, trocar por <video controls src="/sgp/video-audio.mp4">. */}
      <div className="flex aspect-video w-full items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--status-error)] bg-[var(--surface-deep)] px-6 text-center text-[13px] text-[var(--silver)]">
        {t("videoPendente")}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[14px] font-semibold text-[var(--ink)]">{t("confirmeTitulo")}</legend>
        {CIENCIA_AUDIO.map((c) => (
          <label
            key={c}
            className="flex cursor-pointer items-center gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3.5 py-3 text-[13px] text-[var(--silver)] has-[:checked]:border-[var(--hairline-bright)] has-[:checked]:text-[var(--ink)]"
          >
            <input type="checkbox" checked={ciencia.has(c)} onChange={() => alternar(c)} className="h-4 w-4 accent-[var(--pill-bg)]" />
            {t(`ciencia.${c}`)}
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-3">
        <p className="text-[14px] font-semibold text-[var(--ink)]">{t("arquivosTitulo")}</p>
        <p className={SGP_HINT_CLASS}>{t("arquivosDica")}</p>

        <button
          type="button"
          onClick={() => input.current?.click()}
          className="sgp-btn sgp-btn--block"
        >
          {t("soltarAqui")}
        </button>
        <input ref={input} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => { void enviarArquivos(e.target.files); e.target.value = ""; }} />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[12px] text-[var(--silver)]">
            <span>{t("acumulado", { atual: formatDuration(total), minimo: SGP_AUDIO_MIN_SEGUNDOS / 60 })}</span>
            <span>{t("maximo", { max: SGP_AUDIO_MAX_SEGUNDOS / 60 })}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-deep)]">
            <div className={`h-full transition-[width] ${total > SGP_AUDIO_MAX_SEGUNDOS ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${progresso}%` }} />
          </div>
        </div>

        {itens.length ? (
          <ul className="flex flex-col gap-2">
            {itens.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3.5 py-2.5 text-[13px]">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[var(--ink)]">{i.nome}</span>
                  {i.fase === "aprovado" ? <span className="text-emerald-400">✓ {t("aprovado")} · {formatDuration(i.segundos)} {t("deFala")}</span> : null}
                  {i.fase === "reprovado" ? i.motivos.map((m) => <span key={m} className="text-red-400">✕ {m}</span>) : null}
                  {i.fase === "enviando" || i.fase === "analisando" ? <span className="text-[var(--silver)]">{i.fase === "enviando" ? t("enviando") : t("analisando")}</span> : null}
                  {i.fase === "indeciso" || i.fase === "erro" ? <span className="text-[var(--status-error)]">{i.mensagem}</span> : null}
                </div>
                {i.fase !== "enviando" && i.fase !== "analisando" ? (
                  <button type="button" onClick={() => remover(i)} className="sgp-btn sgp-btn--ghost sgp-btn--xs shrink-0">{t("remover")}</button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {erro ? <p role="alert" className={SGP_ERROR_CLASS}>{erro}</p> : null}

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={() => router.push("/sgp/foto")} className={SGP_GHOST_CLASS}>← {t("voltar")}</button>
        <button type="button" disabled={!podeContinuar || enviando} onClick={continuar} className={SGP_PILL_CLASS}>
          {enviando ? t("salvando") : `${t("continuar")} →`}
        </button>
      </div>
    </div>
  );
}

async function mensagemDe(r: Response, padrao: string): Promise<string> {
  const j = (await r.json().catch(() => null)) as { error?: { message?: string } } | null;
  return j?.error?.message ?? padrao;
}
