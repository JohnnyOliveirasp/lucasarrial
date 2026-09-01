"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Upload, X, AudioLines, Check, FolderUp, Mic, ArrowRight } from "lucide-react";
import { medirDuracao, formatDuration, type MotivoFalhaMedicao } from "@/lib/audio/duration";
import {
  chaveDoMotivo,
  estadoDoItem,
  resumirMedicao,
  vaiAdiantarTentarDeNovo,
} from "@/lib/audio/medicao";
import { filterAudioFiles, gatherAudioFromDataTransfer } from "@/lib/audio/collect";
import { listClips, deleteClip } from "@/lib/audio/clip-store";
import { clientLogger } from "@/lib/logger/client";

const MIN_DURATION_SECONDS = 20 * 60; // 20 minutos
// Teto: treino com áudio demais estoura o tempo máximo de execução do worker
// (visto em prod 21/07: 79min → executionTimeout). 60min treina com folga.
const MAX_DURATION_SECONDS = 60 * 60;
const REC_DURATION_SECONDS = 30 * 60; // 30 minutos
const MAX_FILES = 20;
// Vídeo entra junto, de propósito — o worker extrai a faixa de áudio.
// Ver AUDIO_EXT_RE em lib/audio/collect.ts. `.mov` (nativo do iPhone)
// faltava aqui e no filtro, e era descartado como "não-áudio".
const ACCEPT =
  ".mp3,.wav,.m4a,.flac,.ogg,.webm,.mp4,.mov,.aac,.opus,audio/*,video/*";

type LocalFile = {
  id: string;
  file: File;
  duration: number | null;     // null enquanto mede OU se a medição falhou
  /**
   * Preenchido só quando a medição FALHOU. É o que separa "ainda estou
   * medindo" de "não consegui medir" — antes os dois eram o mesmo `null` e a
   * tela mostrava "medindo…" pra sempre nos dois casos (incidente #203).
   */
  falhaMedicao?: MotivoFalhaMedicao;
  progress: number;            // 0..100
  state: "idle" | "uploading" | "done" | "error";
  error?: string;
  key?: string;                // R2 key (preenchido após receber upload_slot)
};

/** Extensão pra telemetria. Sem o nome do arquivo — ele costuma ter o nome da pessoa. */
function extensaoDe(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i > 0 ? nome.slice(i + 1).toLowerCase() : "sem-extensao";
}

/**
 * Assinatura de um áudio para efeito de repetição: **nome + tamanho**.
 *
 * NÃO entra `lastModified`. Ele parece identificar o arquivo, mas os takes do
 * celular nascem de `new File(blob, nome)` — sem data — e o navegador carimba
 * `Date.now()`, diferente a cada montagem da tela. Com ele na chave, o mesmo
 * áudio passava duas vezes por dois caminhos: o import dos takes rodando de
 * novo, e a pessoa escolhendo no disco um arquivo que já estava na lista.
 *
 * Caso Ketty, 18/08: 3 takes de 11:26 apareceram 6 vezes, a barra somou 22:55,
 * o aviso disse "mínimo atingido" e o botão de treinar liberou com metade do
 * áudio necessário. O mínimo existe para a voz sair boa — burlá-lo com áudio
 * repetido treina o modelo no mesmo trecho e piora o resultado.
 */
function assinaturaAudio(f: File): string {
  return `${f.name.trim().toLowerCase()}|${f.size}`;
}

/** Junta `novos` em `atuais` descartando o que já está lá (por id ou conteúdo). */
function mesclarSemRepetir(novos: LocalFile[], atuais: LocalFile[]): LocalFile[] {
  const ids = new Set(atuais.map((f) => f.id));
  const assinaturas = new Set(atuais.map((f) => assinaturaAudio(f.file)));
  const inéditos = novos.filter(
    (n) => !ids.has(n.id) && !assinaturas.has(assinaturaAudio(n.file)),
  );
  return [...inéditos, ...atuais];
}

type Step = "form" | "upload" | "submitting" | "done";

// ───── shared button styles ─────
const PILL =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] disabled:opacity-[0.42] disabled:pointer-events-none";

export function VoiceCreator() {
  const t = useTranslations("app.voiceCloningNew");
  const tc = useTranslations("voiceCreate");
  const router = useRouter();

  const [step, setStep] = useState<Step>("form");
  // 🐛 BUGFIX 2026-07-22: o step volta pra "upload" enquanto os arquivos sobem
  // pro R2, reativando o botão "Treinar" — segundo clique criava voz duplicada
  // (2 treinos de 10k cr). `busy` cobre do clique até a navegação final.
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [overallProgress, setOverallProgress] = useState(0);
  const [recorderImport, setRecorderImport] = useState<{ count: number; skipped: number } | null>(null);
  const recorderClipIds = useRef<string[]>([]);
  // Takes do "gravar pelo celular" (R2) importados pro treino — apagados
  // do R2 depois do envio, igual à limpeza do IndexedDB.
  const phoneTakeKeys = useRef<string[]>([]);
  const phoneToken = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement | null>(null);

  // 🎙️ BUGFIX 2026-07-13: as gravações do Gravador (IndexedDB) NUNCA eram
  // carregadas aqui — quem gravava 20min caía num upload vazio e ficava em
  // loop no formulário. Agora os clipes entram automaticamente como arquivos.
  useEffect(() => {
    listClips()
      .then((clips) => {
        if (clips.length === 0) return;
        // Teto do backend: 20 arquivos/voz — mantém os MAIORES clipes.
        const sorted = [...clips].sort((a, b) => b.seconds - a.seconds);
        const kept = sorted.slice(0, MAX_FILES);
        const additions: LocalFile[] = kept
          .sort((a, b) => a.createdAt - b.createdAt)
          .map((c, i): LocalFile => {
            // O Gravador atual salva WAV (encodeWav); clipes antigos podem ser
            // webm/opus do MediaRecorder. Nomeia pelo tipo REAL do blob — o
            // rótulo errado (.webm em bytes WAV) já atrapalhou diagnóstico de
            // treino falho (caso VOZ MAE 2, 21/07). Mime normalizado sem
            // ";codecs=..." porque o backend valida por igualdade exata.
            const isWav = (c.blob.type || "").toLowerCase().includes("wav");
            return {
              id: `rec-${c.id}`,
              file: new File([c.blob], `gravacao-${String(i + 1).padStart(2, "0")}.${isWav ? "wav" : "webm"}`, {
                type: isWav ? "audio/wav" : "audio/webm",
              }),
              // Duração medida pelo próprio gravador (blobs do MediaRecorder
              // reportam Infinity no <audio> — não dá pra re-medir).
              duration: c.seconds,
              progress: 0,
              state: "idle",
            };
          });
        recorderClipIds.current = kept.map((c) => c.id);
        setFiles((prev) => mesclarSemRepetir(additions, prev));
        setRecorderImport({ count: kept.length, skipped: clips.length - kept.length });
      })
      .catch(() => {});
    // roda 1x no mount — os clipes vêm da página do Gravador
  }, []);

  // 📱 Graduação 03/08: takes do "gravar pelo celular" (R2) também entram
  // automaticamente como arquivos do treino — a pessoa pode misturar takes
  // do navegador e do celular na mesma voz.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await fetch("/api/v1/recorder-test/session", { cache: "no-store" }).then((r) => r.json());
        if (!alive || !s?.token) return;
        phoneToken.current = s.token as string;
        const j = await fetch("/api/v1/recorder-test/takes", {
          headers: { "x-recorder-token": s.token as string },
        }).then((r) => r.json());
        const takes = (j?.takes ?? []) as { key: string; name: string; url: string }[];
        if (!alive || takes.length === 0) return;
        const additions: LocalFile[] = [];
        for (const t of takes) {
          try {
            const blob = await fetch(t.url).then((r) => r.blob());
            const file = new File([blob], t.name, { type: "audio/mpeg" });
            // MP3 do servidor tem cabeçalho — duração dá pra medir no <audio>.
            // Usa a MESMA medição do upload (antes era uma cópia inline com
            // fallback 0 e timeout de 5s: o take que não media virava 00:00
            // silencioso — mesma família do #203, um caminho de código só).
            const medida = await medirDuracao(file);
            additions.push({
              id: `cel-${t.key}`,
              file,
              duration: medida.ok ? medida.segundos : null,
              falhaMedicao: medida.ok ? undefined : medida.motivo,
              progress: 0,
              state: "idle",
            });
            phoneTakeKeys.current.push(t.key);
          } catch { /* take individual falhou — segue os outros */ }
        }
        if (alive && additions.length > 0) setFiles((prev) => mesclarSemRepetir(additions, prev));
      } catch { /* sem takes do celular — segue normal */ }
    })();
    return () => { alive = false; };
  }, []);

  // Callback ref: aplica webkitdirectory ASSIM QUE o input monta no DOM.
  // (useEffect não serve aqui — o input só renderiza no step "upload".)
  const setDirInput = useCallback((el: HTMLInputElement | null) => {
    dirInputRef.current = el;
    if (el) {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
      el.setAttribute("mozdirectory", "");
    }
  }, []);

  // A régua da medição vive em lib/audio/medicao.ts (pura e testada). Aqui só
  // se lê o resumo — inclusive `bloqueadoPorFalha`, que é o que permite
  // EXPLICAR o botão apagado em vez de deixar o aluno adivinhando.
  const resumo = useMemo(
    () =>
      resumirMedicao(
        files.map((f) => ({ duracao: f.duration, falha: f.falhaMedicao })),
        MIN_DURATION_SECONDS,
        MAX_DURATION_SECONDS,
      ),
    [files],
  );
  const totalDuration = resumo.total;
  const overMaximum = resumo.acimaDoMaximo;
  const meetsMinimum = resumo.atingeMinimo;
  const missing = resumo.faltam;

  // Quantos nomes de arquivo descartado mostramos por extenso na mensagem;
  // acima disso a mensagem viraria um parágrafo (pasta com dezenas de fotos).
  const NOMES_DESCARTADOS_EXIBIDOS = 5;

  const msgDescartados = useCallback(
    (descartados: File[]): string | null => {
      if (descartados.length === 0) return null;
      const nomes = descartados
        .slice(0, NOMES_DESCARTADOS_EXIBIDOS)
        .map((f) => f.name)
        .join(", ");
      const sufixo = descartados.length > NOMES_DESCARTADOS_EXIBIDOS ? "…" : "";
      return t("errors.unsupportedSkipped", {
        count: descartados.length,
        names: nomes + sufixo,
      });
    },
    [t],
  );

  /**
   * Mede UM arquivo e grava o desfecho — medido ou falhou, nunca um limbo.
   *
   * O defeito do #203 morava aqui: o `.then` gravava o `null` da falha como se
   * fosse duração e não havia `.catch` nenhum, então qualquer tropeço deixava
   * o arquivo em `duration: null` pra sempre — que a tela renderizava como
   * "medindo…". Agora todo caminho termina em `duration` OU `falhaMedicao`.
   */
  const medirItem = useCallback(async (id: string, file: File) => {
    // Volta pro estado "medindo" (importante no botão de tentar de novo).
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, duration: null, falhaMedicao: undefined } : f)),
    );

    const marcarFalha = (motivo: MotivoFalhaMedicao, motivoMetadata?: MotivoFalhaMedicao) => {
      setFiles((prev) =>
        prev.map((f) => (f.id === id ? { ...f, duration: null, falhaMedicao: motivo } : f)),
      );
      // Telemetria: este defeito não deixava NENHUM rastro no servidor (não
      // cria voice, não sobe pro R2, não loga) — só aparecia se o aluno
      // reclamasse. Sem PII: formato, tamanho e motivo, nunca o nome.
      clientLogger.warn("voz: medicao de audio falhou no browser", {
        motivo,
        motivoMetadata,
        extensao: extensaoDe(file.name),
        mime: file.type || "sem-mime",
        bytes: file.size,
      });
    };

    try {
      const r = await medirDuracao(file);
      if (r.ok) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, duration: r.segundos, falhaMedicao: undefined } : f,
          ),
        );
        return;
      }
      marcarFalha(r.motivo, r.motivoMetadata);
    } catch {
      // medirDuracao não deveria lançar, mas se lançar o arquivo NÃO pode
      // voltar pro limbo de "medindo…" — era assim que o aluno ficava preso.
      marcarFalha("excecao");
    }
  }, []);

  const addFiles = useCallback(async (incoming: File[], descartados: File[] = []) => {
    // Dedup contra arquivos já na lista — ver `assinaturaAudio` (nome+tamanho;
    // `lastModified` ficou de fora de propósito, era ele que deixava o mesmo
    // áudio entrar duas vezes).
    const existing = new Set(files.map((f) => assinaturaAudio(f.file)));
    const seen = new Set<string>();
    const unique: File[] = [];
    let duplicates = 0;
    for (const f of incoming) {
      const sig = assinaturaAudio(f);
      if (existing.has(sig) || seen.has(sig)) {
        duplicates++;
        continue;
      }
      seen.add(sig);
      unique.push(f);
    }

    const available = Math.max(0, MAX_FILES - files.length);
    const accepted = unique.slice(0, available);
    const overLimit = unique.length - accepted.length;

    const avisoDescartados = msgDescartados(descartados);

    if (accepted.length === 0) {
      const base =
        duplicates > 0 && overLimit === 0
          ? t("errors.allDuplicates")
          : t("errors.tooMany", { max: MAX_FILES });
      setError(avisoDescartados ? `${base}. ${avisoDescartados}` : base);
      return;
    }

    // Mensagens informativas (mas não bloqueia) — combinadas, nunca uma
    // sobrescrevendo a outra
    const partes: string[] = [];
    if (overLimit > 0 && duplicates > 0) {
      partes.push(t("errors.partialAddBoth", { duplicates, ignored: overLimit }));
    } else if (overLimit > 0) {
      partes.push(t("errors.partialOver", { ignored: overLimit, max: MAX_FILES }));
    } else if (duplicates > 0) {
      partes.push(t("errors.partialDup", { duplicates }));
    }
    if (avisoDescartados) partes.push(avisoDescartados);
    setError(partes.length > 0 ? partes.join(". ") : null);

    const additions: LocalFile[] = accepted.map((file: File) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      file,
      duration: null,
      progress: 0,
      state: "idle",
    }));

    setFiles((prev) => [...prev, ...additions]);

    // Medir duração em paralelo (não bloqueia)
    for (const item of additions) {
      void medirItem(item.id, item.file);
    }
  }, [files.length, t, msgDescartados, medirItem]);

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    // Clipe do Gravador removido da lista → some do IndexedDB também
    // (senão ele reapareceria na próxima visita).
    if (id.startsWith("rec-")) {
      const clipId = id.slice(4);
      recorderClipIds.current = recorderClipIds.current.filter((c) => c !== clipId);
      deleteClip(clipId).catch(() => {});
    }
  }

  function onDropzoneFiles(list: FileList | null) {
    if (!list) return;
    const { aceitos, descartados } = filterAudioFiles(Array.from(list));
    if (aceitos.length === 0) {
      // Nada aproveitável: se sabemos O QUE foi descartado, diz quantos e
      // quais — nunca um sumiço em silêncio (caso .amr de pasta inteira).
      setError(msgDescartados(descartados) ?? t("errors.invalidType"));
      return;
    }
    // Ordena por nome (estável quando vem de pasta com vários arquivos)
    aceitos.sort((a, b) => {
      const pa = (a as File & { webkitRelativePath?: string }).webkitRelativePath || a.name;
      const pb = (b as File & { webkitRelativePath?: string }).webkitRelativePath || b.name;
      return pa.localeCompare(pb);
    });
    addFiles(aceitos, descartados);
  }

  async function onDropItems(items: DataTransferItemList) {
    const { aceitos, descartados } = await gatherAudioFromDataTransfer(items);
    if (aceitos.length === 0) {
      setError(msgDescartados(descartados) ?? t("errors.invalidType"));
      return;
    }
    addFiles(aceitos, descartados);
  }

  async function startUpload() {
    if (busy) return;
    if (!meetsMinimum) return;
    if (files.length === 0) return;

    setBusy(true);
    setStep("submitting");
    setError(null);

    // 1. Pede backend pra criar voice + presigned URLs
    let response: Response;
    try {
      response = await fetch("/api/v1/voices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          files: files.map((f) => ({
            filename: f.file.name,
            content_type: f.file.type || "audio/mpeg",
            size_bytes: f.file.size,
          })),
        }),
      });
    } catch {
      setStep("upload");
      setBusy(false);
      setError(t("errors.network"));
      return;
    }

    if (!response.ok) {
      setStep("upload");
      setBusy(false);
      const body = await response.json().catch(() => ({}));
      setError(body?.error?.message || t("errors.generic"));
      return;
    }

    const json = await response.json();
    const voiceId: string = json.voice.id;
    const slots: Array<{ index: number; key: string; upload_url: string }> =
      json.upload_slots;

    // 2. Mapeia slot → file pelo index (mesma ordem)
    setFiles((prev) =>
      prev.map((f, i) => ({ ...f, key: slots[i]?.key, state: "uploading" })),
    );

    // 3. Upload browser → R2 (até UPLOAD_CONCURRENCY simultâneos, com retry)
    setStep("upload");
    const results = await runPool(files, UPLOAD_CONCURRENCY, (f, i) =>
      uploadOne(f, slots[i], setFiles, setOverallProgress, files.length),
    );

    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) {
      setBusy(false);
      setError(t("errors.uploadFailed", { count: failed }));
      return;
    }

    // 4. Avisa backend que terminou — manda também durações medidas no browser
    const uploadedKeys = slots.map((s) => s.key);
    const clientDurations = files.map((f) => f.duration ?? 0);
    const completeResp = await fetch(
      `/api/v1/voices/${voiceId}/uploads-complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploaded_keys: uploadedKeys,
          client_durations: clientDurations,
        }),
      },
    );

    if (!completeResp.ok) {
      setBusy(false);
      const body = await completeResp.json().catch(() => ({}));
      setError(body?.error?.message || t("errors.generic"));
      return;
    }

    // Gravações do Gravador enviadas com sucesso → limpa o IndexedDB
    // (best-effort; se falhar, só reapareceriam pré-carregadas).
    for (const clipId of recorderClipIds.current) {
      deleteClip(clipId).catch(() => {});
    }
    // Takes do celular enviados → apaga do R2 (mesma lógica, best-effort).
    for (const key of phoneTakeKeys.current) {
      void fetch(`/api/v1/recorder-test/takes?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { "x-recorder-token": phoneToken.current ?? "" },
      }).catch(() => {});
    }

    setStep("done");
    router.push(`/app/voice-cloning/${voiceId}`);
    router.refresh();
  }

  // ───── render ─────

  if (step === "form") {
    return (
      <FormStep
        name={name}
        setName={setName}
        consent={consent}
        setConsent={setConsent}
        onNext={() => setStep("upload")}
        t={t}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Dropzone
        onPickFiles={() => inputRef.current?.click()}
        onPickFolder={() => dirInputRef.current?.click()}
        onDrop={onDropzoneFiles}
        onDropItems={onDropItems}
        disabled={step === "submitting"}
        t={t}
      />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          onDropzoneFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={setDirInput}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          onDropzoneFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/*
        SAÍDA PRA QUEM CAIU NA TELA ERRADA (#215, reincidência do #e05561c5).
        Esta tela é SÓ upload — não tem botão de gravar. Quem chega aqui
        querendo gravar no navegador ficava preso, perguntava pra Fast e ela
        mandava apertar um botão que não existe aqui. Agora a saída está na
        própria tela e não depende de ninguém responder.
        Escondido quando o aluno já veio do Gravador (recorderImport), pra não
        mandar de volta pra onde ele acabou de sair.
      */}
      {!recorderImport && (
        <Link
          href="/app/voice-cloning/script"
          className="flex items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--hairline-bright)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-[var(--ink)] transition-[background-color,border-color] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-strong)] hover:bg-[var(--surface-raised)]"
        >
          <span className="flex items-center gap-2">
            <Mic className="h-4 w-4 flex-shrink-0 text-[var(--status-online)]" />
            <span>{t("recordInstead.text")}</span>
          </span>
          <span className="flex flex-shrink-0 items-center gap-1.5 font-medium">
            {t("recordInstead.cta")}
            <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
      )}

      {recorderImport && (
        <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-bright)] bg-[var(--surface-elevated)] px-3 py-2.5 text-sm text-[var(--ink)]">
          <Mic className="h-4 w-4 flex-shrink-0 text-[var(--status-online)]" />
          <span>
            {tc("recorderImport.loaded", { count: recorderImport.count })}
            {recorderImport.skipped > 0
              ? ` ${tc("recorderImport.skipped", { skipped: recorderImport.skipped, max: MAX_FILES })}`
              : ""}
          </span>
        </p>
      )}

      {files.length > 0 && (
        <FileList files={files} onRemove={removeFile} onRemeasure={medirItem} t={t} />
      )}

      {/*
        O aviso que faltava. Arquivo não medido vale 0 no total — o que é
        honesto, já que ninguém leu a duração dele — mas ficar CALADO sobre
        isso é o defeito do #203: o aluno via o botão morto sem uma linha de
        explicação. Agora ele lê por que está travado e o que fazer.
      */}
      {resumo.falhados > 0 && (
        <p
          role="alert"
          className={`rounded-[var(--radius)] border px-3 py-2 font-mono text-[11px] leading-relaxed tracking-wide ${
            resumo.bloqueadoPorFalha
              ? "border-[var(--status-error)]/40 bg-[var(--surface-card)] text-[var(--status-error)]"
              : "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--mute)]"
          }`}
        >
          {resumo.bloqueadoPorFalha
            ? t("errors.measureBlocked", {
                count: resumo.falhados,
                min: Math.round(MIN_DURATION_SECONDS / 60),
              })
            : t("errors.measureNotCounted", { count: resumo.falhados })}
        </p>
      )}

      <DurationMeter
        total={totalDuration}
        min={MIN_DURATION_SECONDS}
        recommended={REC_DURATION_SECONDS}
        missing={missing}
        meets={meetsMinimum}
        t={t}
      />

      {overMaximum && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          {t("errors.overMax", { max: Math.round(MAX_DURATION_SECONDS / 60) })}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]"
        >
          {error}
        </p>
      )}

      {step === "submitting" || (step === "upload" && files.some((f) => f.state === "uploading")) ? (
        <UploadProgress files={files} overall={overallProgress} t={t} />
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep("form")}
          className="font-mono text-[12px] text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
        >
          ← {t("back")}
        </button>
        <button
          type="button"
          onClick={startUpload}
          disabled={!meetsMinimum || busy || step === "submitting" || files.length === 0}
          className={PILL}
        >
          {busy || step === "submitting"
            ? t("submitting")
            : t("train", { duration: formatDuration(totalDuration) })}
        </button>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Subcomponents
// ───────────────────────────────────────────────────────────────

type TFn = (key: string, params?: Record<string, string | number>) => string;

function FormStep({
  name,
  setName,
  consent,
  setConsent,
  onNext,
  t,
}: {
  name: string;
  setName: (v: string) => void;
  consent: boolean;
  setConsent: (v: boolean) => void;
  onNext: () => void;
  t: TFn;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onNext();
      }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="voice-name"
          className="font-mono text-[11px] tracking-wide text-[var(--mute)]"
        >
          {t("nameLabel")}
        </label>
        <input
          id="voice-name"
          type="text"
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("namePlaceholder")}
          className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
        />
      </div>

      <div className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4">
        <div className="mb-3 font-mono text-[11px] tracking-wide text-[var(--silver)]">
          {t("rules.title")}
        </div>
        <ul className="flex flex-col gap-2 text-sm text-[var(--body)]">
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--silver)]" /><span>{t("rules.min")}</span></li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--silver)]" /><span>{t("rules.recommended")}</span></li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--silver)]" /><span>{t("rules.clean")}</span></li>
          <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--silver)]" /><span>{t("rules.variety")}</span></li>
        </ul>
      </div>

      <label className="flex cursor-pointer select-none items-start gap-3">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 accent-[var(--ink)]"
        />
        <span className="text-sm text-[var(--ink)]">{t("consent")}</span>
      </label>

      <button
        type="submit"
        disabled={!name.trim() || !consent}
        className={PILL}
      >
        {t("next")} →
      </button>
    </form>
  );
}

function Dropzone({
  onPickFiles,
  onPickFolder,
  onDrop,
  onDropItems,
  disabled,
  t,
}: {
  onPickFiles: () => void;
  onPickFolder: () => void;
  onDrop: (list: FileList | null) => void;
  onDropItems: (items: DataTransferItemList) => Promise<void>;
  disabled: boolean;
  t: TFn;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
          // Suporta pastas arrastadas — usa items + webkitGetAsEntry
          onDropItems(e.dataTransfer.items);
        } else {
          onDrop(e.dataTransfer.files);
        }
      }}
      className={[
        "flex flex-col items-center justify-center gap-4 rounded-[var(--radius-lg)] border border-dashed p-12 text-center transition-colors",
        over
          ? "border-[var(--hairline-bright)] bg-[var(--surface-card)]"
          : "border-[var(--hairline-strong)] bg-[var(--surface-card)]",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      <Upload className={`h-8 w-8 ${over ? "text-[var(--ink)]" : "text-[var(--mute)]"}`} />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-[var(--ink)]">{t("dropzone.title")}</p>
        <p className="text-xs text-[var(--mute)]">{t("dropzone.hint")}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={onPickFiles}
          disabled={disabled}
          className={SECONDARY}
        >
          <Upload className="h-3.5 w-3.5" />
          {t("dropzone.pickFiles")}
        </button>
        <button
          type="button"
          onClick={onPickFolder}
          disabled={disabled}
          className={SECONDARY}
        >
          <FolderUp className="h-3.5 w-3.5" />
          {t("dropzone.pickFolder")}
        </button>
      </div>
    </div>
  );
}

function FileList({
  files,
  onRemove,
  onRemeasure,
  t,
}: {
  files: LocalFile[];
  onRemove: (id: string) => void;
  onRemeasure: (id: string, file: File) => void;
  t: TFn;
}) {
  const tc = useTranslations("voiceCreate");
  return (
    <ul className="flex flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--hairline-strong)]">
      {files.map((f, i) => {
        // Três estados DISTINTOS. Antes "medindo" e "falhou" eram o mesmo
        // `null` e os dois apareciam como "medindo…" — o aluno nunca sabia
        // que a medição tinha desistido (incidente #203).
        const estado = estadoDoItem({ duracao: f.duration, falha: f.falhaMedicao });
        return (
        <li
          key={f.id}
          className={`flex items-center gap-3 bg-[var(--surface-card)] px-4 py-3 ${
            i > 0 ? "border-t border-[var(--hairline)]" : ""
          }`}
        >
          <AudioLines
            className={`h-4 w-4 flex-shrink-0 ${
              estado === "falhou" ? "text-[var(--status-error)]" : "text-[var(--silver)]"
            }`}
          />
          <span className="flex-1 truncate text-sm text-[var(--ink)]">{f.file.name}</span>
          {estado === "falhou" && f.falhaMedicao ? (
            <>
              <span className="text-right font-mono text-[10px] leading-tight text-[var(--status-error)]">
                {t("measureFailed")}
                <span className="hidden sm:inline">
                  {" · "}
                  {t(`errors.measureFailed.${chaveDoMotivo(f.falhaMedicao)}`)}
                </span>
              </span>
              {vaiAdiantarTentarDeNovo(f.falhaMedicao) && (
                <button
                  type="button"
                  onClick={() => onRemeasure(f.id, f.file)}
                  disabled={f.state === "uploading"}
                  className="font-mono text-[10px] text-[var(--mute)] underline transition-colors hover:text-[var(--ink)] disabled:opacity-30"
                >
                  {t("retryMeasure")}
                </button>
              )}
            </>
          ) : (
            <span className="font-mono text-[10px] tabular-nums text-[var(--ash)]">
              {estado === "medindo" ? t("measuring") : formatDuration(f.duration ?? 0)}
            </span>
          )}
          {f.state === "uploading" && (
            <span className="font-mono text-[10px] tabular-nums text-[var(--silver)]">
              {f.progress}%
            </span>
          )}
          {f.state === "done" && <Check className="h-4 w-4 text-[var(--status-online)]" />}
          <button
            type="button"
            onClick={() => onRemove(f.id)}
            disabled={f.state === "uploading"}
            className="text-[var(--mute)] transition-colors hover:text-[var(--ink)] disabled:opacity-30"
            aria-label={tc("fileList.remove")}
          >
            <X className="h-4 w-4" />
          </button>
        </li>
        );
      })}
    </ul>
  );
}

function DurationMeter({
  total,
  min,
  recommended,
  missing,
  meets,
  t,
}: {
  total: number;
  min: number;
  recommended: number;
  missing: number;
  meets: boolean;
  t: TFn;
}) {
  const tc = useTranslations("voiceCreate");
  const pct = Math.min(100, (total / recommended) * 100);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[11px] tracking-wide text-[var(--mute)]">
          {t("meter.total")}
        </span>
        <span className="font-mono text-3xl tabular-nums leading-none text-[var(--ink)]">
          {formatDuration(total)}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-[var(--radius-full)] bg-[var(--hairline-strong)]">
        <div
          className={`absolute inset-y-0 left-0 rounded-[var(--radius-full)] transition-all duration-300 ${
            meets ? "bg-[var(--status-online)]" : "bg-[var(--silver)]"
          }`}
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute inset-y-0 w-px bg-[var(--ink)]"
          style={{ left: `${(min / recommended) * 100}%` }}
          aria-label={tc("meter.minThreshold")}
        />
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] tracking-wide text-[var(--ash)]">
        <span>
          {t("meter.min")}: {formatDuration(min)}
        </span>
        <span className={meets ? "text-[var(--status-online)]" : "text-[var(--silver)]"}>
          {meets
            ? `✓ ${t("meter.ok")}`
            : `${t("meter.missing")}: ${formatDuration(missing)}`}
        </span>
        <span>
          {t("meter.recommended")}: {formatDuration(recommended)}
        </span>
      </div>
    </div>
  );
}

function UploadProgress({
  files,
  overall,
  t,
}: {
  files: LocalFile[];
  overall: number;
  t: TFn;
}) {
  const done = files.filter((f) => f.state === "done").length;
  return (
    <div className="rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-wide text-[var(--silver)]">
          {t("uploading")}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-[var(--mute)]">
          {done} / {files.length}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-[var(--radius-full)] bg-[var(--hairline-strong)]">
        <div
          className="h-full rounded-[var(--radius-full)] bg-[var(--silver)] transition-all duration-200"
          style={{ width: `${overall}%` }}
        />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────
// Upload helpers — XHR pra ter progress, com retry e concorrência limitada
// ───────────────────────────────────────────────────────────────

const MAX_UPLOAD_ATTEMPTS = 3;
const UPLOAD_CONCURRENCY = 3; // arquivos grandes não disputam toda a banda de uma vez

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Roda `worker` sobre os itens com no máximo `limit` em paralelo. */
async function runPool<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = new Array(items.length);
  let cursor = 0;
  async function lane() {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        await worker(items[i], i);
        results[i] = { status: "fulfilled", value: undefined };
      } catch (e) {
        results[i] = { status: "rejected", reason: e };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => lane()),
  );
  return results;
}

/** Um PUT único pro R2 com progresso. Rejeita em erro de rede/HTTP. */
function putToR2(
  file: LocalFile,
  uploadUrl: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.file.type || "audio/mpeg");
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(file.file);
  });
}

/** Sobe um arquivo com até MAX_UPLOAD_ATTEMPTS tentativas. */
async function uploadOne(
  file: LocalFile,
  slot: { index: number; key: string; upload_url: string } | undefined,
  setFiles: React.Dispatch<React.SetStateAction<LocalFile[]>>,
  setOverall: (v: number) => void,
  totalFiles: number,
): Promise<void> {
  if (!slot) {
    setFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, state: "error", error: "no-slot" } : f)),
    );
    throw new Error("no slot");
  }

  const setProgress = (pct: number) =>
    setFiles((prev) => {
      const next = prev.map((f) =>
        f.id === file.id ? { ...f, progress: pct } : f,
      );
      const sum = next.reduce((acc, f) => acc + f.progress, 0);
      setOverall(Math.round(sum / Math.max(1, totalFiles)));
      return next;
    });

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_UPLOAD_ATTEMPTS; attempt++) {
    try {
      setProgress(0);
      await putToR2(file, slot.upload_url, setProgress);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, state: "done", progress: 100 } : f,
        ),
      );
      return;
    } catch (e) {
      lastErr = e;
      if (attempt < MAX_UPLOAD_ATTEMPTS) {
        // backoff crescente; o presigned vale 6h, então retry cabe na janela
        await sleep(1000 * attempt);
      }
    }
  }

  setFiles((prev) =>
    prev.map((f) =>
      f.id === file.id
        ? { ...f, state: "error", error: lastErr instanceof Error ? lastErr.message : "error" }
        : f,
    ),
  );
  throw lastErr instanceof Error ? lastErr : new Error("upload failed");
}
