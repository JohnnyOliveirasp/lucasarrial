"use client";

/**
 * Vídeo Estúdio — workspace: a pessoa GRAVA (pode errar e repetir a frase à
 * vontade) ou sobe um áudio → a plataforma corta as tentativas erradas (fica
 * a última), encolhe as pausas e devolve o áudio limpo + transcrição (F0); do
 * áudio limpo dá pra montar o vídeo de teste (F1). Poll padrão Vídeo Clone.
 * Painel de resultado em studio-result.tsx (regra: <400 linhas por arquivo).
 */
import { useEffect, useRef, useState } from "react";
import { AudioLines, Loader2, Mic, Scissors, Square, Upload } from "lucide-react";
import { STUDIO_CLEAN_COST } from "@/lib/credits/config";
import { PaywallModal } from "@/components/app/paywall-modal";
import { StudioHistory } from "./studio-history";
import { StudioResult, fmtSecs, type StudioProjectDetail } from "./studio-result";

const PILL =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--pill-bg)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[transform,filter] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:brightness-95 active:scale-[0.98] disabled:opacity-50";
const GHOST =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-6 font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-[background-color,border-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98] disabled:opacity-50";
const LABEL = "font-mono text-[11px] uppercase tracking-wide text-[var(--ash)]";

export function StudioWorkspace({
  creditsTotal,
  unlimited,
}: {
  creditsTotal: number;
  unlimited: boolean;
}) {
  const [audio, setAudio] = useState<{ file: File; preview: string; source: "rec" | "file" } | null>(null);
  const [name, setName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [mics, setMics] = useState<{ deviceId: string; label: string }[]>([]);
  const [micId, setMicId] = useState<string>("");
  const [busy, setBusy] = useState<"upload" | "submit" | null>(null);
  const [project, setProject] = useState<StudioProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<{ subscribed: boolean } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const inflight =
    project?.status === "processing" || project?.montage_status === "processing";
  const canAfford = unlimited || creditsTotal >= STUDIO_CLEAN_COST;

  // ───── seletor de microfone ─────
  // Labels só aparecem depois da permissão; pedimos 1x ao montar (isto é uma
  // tela de gravação — a permissão é o esperado) e re-listamos em devicechange.
  useEffect(() => {
    let alive = true;
    async function loadMics(askPermission: boolean) {
      try {
        if (askPermission) {
          const s = await navigator.mediaDevices.getUserMedia({ audio: true });
          s.getTracks().forEach((t) => t.stop());
        }
        const devs = await navigator.mediaDevices.enumerateDevices();
        if (!alive) return;
        setMics(
          devs
            .filter((d) => d.kind === "audioinput" && d.deviceId !== "default")
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microfone ${i + 1}` })),
        );
      } catch {
        /* sem permissão: segue com o padrão do sistema */
      }
    }
    loadMics(true);
    const onChange = () => loadMics(false);
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => {
      alive = false;
      navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
    };
  }, []);

  // ───── gravador simples (MediaRecorder) ─────
  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: micId ? { deviceId: { exact: micId } } : true,
      });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const file = new File([blob], "gravacao.webm", { type: "audio/webm" });
        setAudio({ file, preview: URL.createObjectURL(blob), source: "rec" });
      };
      rec.start();
      recRef.current = rec;
      setRecSeconds(0);
      setRecording(true);
    } catch {
      setError("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function stopRecording() {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  }

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // ───── envio ─────
  async function submit() {
    if (!audio) return;
    setBusy("submit");
    setError(null);
    try {
      const pres = await fetch("/api/v1/studio/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: audio.file.name,
          content_type: audio.file.type,
          size: audio.file.size,
        }),
      });
      const pj = await pres.json().catch(() => ({}));
      if (!pres.ok) throw new Error(pj?.error?.message || "Falha ao preparar upload");
      const put = await fetch(pj.upload_url, {
        method: "PUT",
        headers: { "Content-Type": audio.file.type },
        body: audio.file,
      });
      if (!put.ok) throw new Error("Falha no upload do áudio");

      const res = await fetch("/api/v1/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_key: pj.key, name: name || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setPaywall({ subscribed: !!j?.error?.details?.subscribed });
        return;
      }
      if (!res.ok) throw new Error(j?.error?.message || "Falha ao iniciar o processamento");
      setProject({
        id: j.project.id, name: name || null, status: "processing",
        duration_raw_seconds: null, duration_clean_seconds: null,
        kept_takes: null, removed_takes: null, transcript_words: null,
        edit_report: null, error_message: null, clean_audio_url: null,
      });
      setReloadKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  // ───── F1/F2: montagem do vídeo de teste (trilha escolhida ou sem música) ─────
  async function startMontage(musicKey: string | null) {
    if (!project) return;
    setBusy("submit");
    setError(null);
    try {
      const res = await fetch(`/api/v1/studio/${project.id}/montage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ music_key: musicKey }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || "Falha ao iniciar a montagem");
      setProject({ ...project, montage_status: "processing", montage_error: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  // Poll do projeto em andamento (o GET sincroniza com o RunPod).
  useEffect(() => {
    if (!project || !inflight) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/studio/${project.id}`, { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (j.project) setProject(j.project as StudioProjectDetail);
        if (j.project?.status !== "processing" && j.project?.montage_status !== "processing") {
          setReloadKey((k) => k + 1);
        }
      } catch {
        /* próximo tick */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [project, inflight]);

  function reset() {
    setProject(null);
    setAudio(null);
    setName("");
    setError(null);
  }

  async function openFromHistory(id: string) {
    try {
      const res = await fetch(`/api/v1/studio/${id}`, { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      if (j.project) setProject(j.project as StudioProjectDetail);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      /* ignora */
    }
  }

  return (
    <div className="flex flex-col gap-12">
      <section className="rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-6">
        {project ? (
          <StudioResult
            project={project}
            busy={!!busy}
            onMontage={startMontage}
            onReset={reset}
          />
        ) : (
          /* ───── formulário: gravar OU subir ───── */
          <div className="flex flex-col gap-6">
            <input
              ref={fileInput}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setAudio({ file: f, preview: URL.createObjectURL(f), source: "file" });
              }}
            />

            <div className="flex flex-col gap-3">
              <span className={LABEL}>1. Grave sua fala (pode errar e repetir a frase — a gente corta)</span>
              {mics.length > 0 && (
                <select
                  value={micId}
                  onChange={(e) => setMicId(e.target.value)}
                  disabled={recording}
                  aria-label="Escolher microfone"
                  className="h-11 w-full max-w-md rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 font-sans text-sm text-[var(--ink)] focus:border-[var(--hairline-bright)] focus:outline-none disabled:opacity-50"
                >
                  <option value="">Microfone padrão do sistema</option>
                  {mics.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {!recording ? (
                  <button type="button" onClick={startRecording} disabled={!!busy} className={GHOST}>
                    <Mic className="h-4 w-4" /> {audio?.source === "rec" ? "Regravar" : "Gravar agora"}
                  </button>
                ) : (
                  <button type="button" onClick={stopRecording} className={PILL}>
                    <Square className="h-4 w-4" /> Parar · {fmtSecs(recSeconds)}
                  </button>
                )}
                <button type="button" onClick={() => fileInput.current?.click()} disabled={recording || !!busy} className={GHOST}>
                  <Upload className="h-4 w-4" /> Ou subir um áudio
                </button>
              </div>
              {audio && !recording && (
                <div className="flex flex-col gap-1.5">
                  <audio src={audio.preview} controls preload="metadata" className="w-full max-w-xl" />
                  <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
                    {audio.source === "rec" ? "Gravação pronta." : audio.file.name} Ouça antes de enviar, se quiser.
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className={LABEL}>2. Nome (opcional)</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                placeholder="Ex.: Vídeo sobre o lançamento"
                className="h-11 w-full max-w-md rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] px-3 font-sans text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus:border-[var(--hairline-bright)] focus:outline-none"
              />
            </div>

            {error && (
              <p role="alert" className="font-mono text-[11px] tracking-wide text-[var(--status-error)]">
                {error}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-4">
              <span className="font-mono text-[11px] tracking-wide text-[var(--ash)]">
                {`Custo: ${STUDIO_CLEAN_COST.toLocaleString("pt-BR")} créditos por áudio${!canAfford ? ` (você tem ${creditsTotal.toLocaleString("pt-BR")})` : ""}`}
              </span>
              <button type="button" disabled={!audio || recording || !!busy} onClick={submit} className={PILL}>
                {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                {busy === "submit" ? "Enviando…" : `Limpar meu áudio · ${STUDIO_CLEAN_COST.toLocaleString("pt-BR")} cr`}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 font-sans text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          <AudioLines className="h-5 w-5 text-[var(--silver)]" /> Seus áudios
        </h2>
        <StudioHistory reloadKey={reloadKey} onOpen={openFromHistory} />
      </section>

      <PaywallModal
        open={!!paywall}
        onClose={() => setPaywall(null)}
        subscribed={paywall?.subscribed ?? false}
        action="preparar o áudio no Vídeo Estúdio"
      />
    </div>
  );
}
