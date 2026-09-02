"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Mic, Square, Trash2, AlertCircle, AlertTriangle, Check, ArrowRight } from "lucide-react";
import { workletUrl, rms, concatFloat32, encodeWav } from "@/lib/audio/recorder";
import { formatDuration } from "@/lib/audio/duration";
import { saveClip, listClips, deleteClip, type StoredClip } from "@/lib/audio/clip-store";
import { uploadClipToServer, listServerClips, deleteServerClip } from "@/lib/audio/clip-sync";
import {
  MAX_ARQUIVOS_TREINO,
  resumirEntregaDoGravador,
} from "@/lib/audio/entrega-gravador";
import { sincronizarMarcaGravacao } from "@/lib/audio/marca-gravacao";
import { clientLogger } from "@/lib/logger/client";

const SPEECH_RMS = 0.015; // acima disso considera fala
const SILENCE_MS = 20000; // silêncio após falar → para automaticamente (20s, Johnny 04/08: 2s cortava pausas de leitura)
const MAX_SECONDS = 300; // trava por clipe (limita RAM a ~57MB/clipe)
const CLIP_PEAK = 0.99; // saturação (clipping)
// Piso de ruído: RMS médio dos frames SEM fala. Acima disso o ambiente está
// barulhento (ar-condicionado, rua, TV) — o Demucs/VAD vai descartar áudio e
// o clone sai pior. Aviso em tempo real (anti-churn).
const NOISE_FLOOR_WARN = 0.008;
// 🐛 CASO VOZ 1 MAE (22/07): mic mudo (dispositivo errado/stream morto) grava
// silêncio digital absoluto (-91dB) — todo mic REAL num ambiente real fica
// acima disso. Abaixo do piso por DEAD_MIC_MS contínuos = "não estou te
// ouvindo"; clipe inteiro sem fala nunca é salvo (a aluna gravou 20min de
// nada, treinou 4x e falhou 4x sem entender o porquê).
const DEAD_MIC_RMS = 0.0003;
const DEAD_MIC_MS = 4000;
const TARGET_SECONDS = 20 * 60; // meta de fala pro treino

/** Tooltip do pill flutuante: aparece acima do botão no hover. */
const PILL_TOOLTIP =
  "pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-2 py-1 font-sans text-[11px] font-medium text-[var(--ink)] opacity-0 shadow-[var(--elevation-popover)] transition-opacity duration-[var(--dur-base)] group-hover:opacity-100";

type Status = "idle" | "requesting" | "ready" | "recording" | "denied";
/**
 * saved: onde a gravação está guardada.
 *  - "server": no R2 — sobrevive a troca de navegador/aparelho.
 *  - "saving": subindo agora.
 *  - "failed": upload falhou — está SÓ neste navegador; a tela oferece retry.
 * (caso Allan/Alana 02/09: IndexedDB sozinho perdia 20min de gravação em troca
 *  de navegador/limpeza de dados, e o aluno lia como "apagaram meu áudio".)
 */
type SavedState = "server" | "saving" | "failed";
type ClipView = { id: string; seconds: number; createdAt: number; url: string; saved: SavedState; serverKey?: string };

/**
 * Gravador guiado: a pessoa lê o roteiro e grava CLIPES curtos (auto-stop por
 * silêncio). Cada clipe vai pro IndexedDB (anti-crash) E sobe pro servidor na
 * hora — gravou = guardado, de qualquer aparelho.
 */
export function VoiceRecorder({ extraSeconds = 0 }: { extraSeconds?: number } = {}) {
  const t = useTranslations("voiceCreate.recorder");
  const [status, setStatus] = useState<Status>("idle");
  const [level, setLevel] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [clipping, setClipping] = useState(false);
  const [noisy, setNoisy] = useState(false);
  const [deadMic, setDeadMic] = useState(false);
  const noiseEmaRef = useRef<number | null>(null);
  const lastSoundRef = useRef(0);
  const [clips, setClips] = useState<ClipView[]>([]);
  // 🐛 #235 (Alana): os dois acessos ao IndexedDB eram `.catch(() => {})`.
  // Gravação que não salvou continuava aparecendo na lista, a barra subia, a
  // CTA liberava — e a tela seguinte abria vazia. Falha de armazenamento agora
  // é ESTADO, e estado vira aviso na tela.
  const [falhaLeitura, setFalhaLeitura] = useState(false);
  /**
   * Ids de clipes que NÃO conseguiram entrar no IndexedDB. Desde 02/09 o clipe
   * também sobe pra conta, então isto sozinho não significa perda: o aviso na
   * tela cruza esta lista com o upload (`clipesPerdidos`) para nunca dizer
   * "vai se perder" de uma gravação que já está guardada no servidor.
   */
  const [semDisco, setSemDisco] = useState<string[]>([]);
  /**
   * A lista de clipes já veio do IndexedDB? Enquanto for `false`, uma lista
   * vazia NÃO é prova de que não há gravação — é só o estado inicial. Sem esta
   * distinção o efeito da marca apagava o bilhete no mount (ver abaixo).
   */
  const [leituraConfiavel, setLeituraConfiavel] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const muteRef = useRef<GainNode | null>(null);
  const wUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const meterBufRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  const chunksRef = useRef<Float32Array[]>([]);
  const recordingRef = useRef(false);
  const hasSpokenRef = useRef(false);
  const lastSpeechRef = useRef(0);
  const startedRef = useRef(0);
  const clipsRef = useRef<ClipView[]>([]);
  clipsRef.current = clips;

  /** Sobe um clipe local pro servidor e atualiza a linha dele na lista. */
  const syncClip = useCallback(async (id: string, blob: Blob, seconds: number) => {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, saved: "saving" } : c)));
    const key = await uploadClipToServer(blob, seconds);
    if (key) {
      // Confirmado no R2 → o IndexedDB deixa de ser a única cópia.
      void deleteClip(id).catch(() => {});
      setClips((prev) => prev.map((c) => (c.id === id ? { ...c, saved: "server", serverKey: key } : c)));
    } else {
      setClips((prev) => prev.map((c) => (c.id === id ? { ...c, saved: "failed" } : c)));
    }
  }, []);
  const syncRef = useRef(syncClip);
  syncRef.current = syncClip;

  // Carrega gravações do SERVIDOR (qualquer aparelho) + clipes locais que
  // ainda não subiram (crash/upload falho) — e tenta subir esses na hora.
  useEffect(() => {
    let alive = true;
    (async () => {
      // O servidor é a fonte de verdade (02/09) e o IndexedDB é o que sobrou
      // pra trás. Mas a LEITURA do IndexedDB pode falhar (aba privada, cota,
      // storage bloqueado) e falha engolida foi o defeito do #235 — por isso
      // aqui interessa o DESFECHO da leitura, não só o resultado dela.
      const [server, local] = await Promise.all([
        listServerClips(),
        listClips().then(
          (stored) => ({ ok: true, stored }),
          (e: unknown) => {
            clientLogger.warn("gravador: nao consegui LER as gravacoes (IndexedDB)", {
              erro: e instanceof Error ? e.name : String(e),
            });
            return { ok: false, stored: [] as StoredClip[] };
          },
        ),
      ]);
      if (!alive) return;
      // Não dá pra ler o armazenamento deste navegador. Antes isso era
      // engolido e a pessoa recomeçava do zero achando que nunca gravou.
      if (!local.ok) setFalhaLeitura(true);
      const doServidor: ClipView[] = server.clips.map((s) => ({
        id: s.key,
        seconds: s.seconds,
        createdAt: s.at ? Date.parse(s.at) : 0,
        url: s.url,
        saved: "server",
        serverKey: s.key,
      }));
      const locais = local.stored.map((c) => ({ ...toView(c), saved: "failed" as SavedState }));
      setClips([...doServidor, ...locais].sort((a, b) => a.createdAt - b.createdAt));
      // Só a partir daqui uma lista vazia significa "não há gravação" — e só
      // quando AS DUAS leituras deram certo. Se qualquer uma falhou, vazio não
      // é prova de nada, e apagar o bilhete destruiria a prova da vítima do
      // #235 (é `leituraConfiavel` que autoriza o efeito da marca a apagar).
      if (local.ok && server.ok) setLeituraConfiavel(true);
      // Retry automático dos que ficaram pra trás (inclusive de visitas antigas).
      for (const c of local.stored) void syncRef.current(c.id, c.blob, c.seconds);
    })();
    return () => {
      alive = false;
      teardownAudio();
      clipsRef.current.forEach((c) => {
        if (c.url.startsWith("blob:")) URL.revokeObjectURL(c.url);
      });
    };
  }, []);

  // Deixa o bilhete num armário DIFERENTE do IndexedDB (localStorage). É ele
  // que permite a tela de criar voz dizer "você gravou aqui e eu não achei
  // as gravações" em vez de abrir um formulário mudo (#235).
  //
  // ⚠️ Este efeito roda no MOUNT, quando `clips` ainda é `[]` porque o
  // `listClips()` acima nem respondeu. Marcar zero aqui APAGARIA o bilhete só
  // de abrir a página — e apagaria justamente para quem tem a leitura do
  // IndexedDB quebrada, que é a vítima do #235. Por isso a decisão de apagar
  // depende de `leituraConfiavel`, e mora em `sincronizarMarcaGravacao`
  // (testada em marca-gravacao.test.ts).
  useEffect(() => {
    sincronizarMarcaGravacao(
      leituraConfiavel,
      clips.length,
      clips.reduce((s, c) => s + c.seconds, 0),
    );
  }, [clips, leituraConfiavel]);

  function teardownAudio() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    workletRef.current?.disconnect();
    analyserRef.current?.disconnect();
    muteRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current?.close().catch(() => {});
    if (wUrlRef.current) URL.revokeObjectURL(wUrlRef.current);
    ctxRef.current = null;
    streamRef.current = null;
    analyserRef.current = null;
    workletRef.current = null;
    muteRef.current = null;
    wUrlRef.current = null;
  }

  const finalizeClip = useCallback((blob: Blob, secs: number) => {
    const clip: StoredClip = {
      id: crypto.randomUUID(),
      blob,
      seconds: secs,
      createdAt: Date.now(),
    };
    // IndexedDB primeiro (anti-crash), servidor em seguida (anti-perda real).
    //
    // ⚠️ #235: gravar SEM conseguir salvar é o pior caminho da tela — o clipe
    // aparece na lista, a barra sobe, a CTA libera, e o áudio morre quando a
    // aba fecha. O erro precisa CHEGAR NO ALUNO enquanto ele ainda pode reagir
    // (não fechar a aba, trocar de navegador, sair do modo anônimo). Depois de
    // 02/09 o clipe TAMBÉM sobe pra conta, então falhar aqui só é fatal se o
    // upload falhar junto — quem cruza as duas coisas é `clipesPerdidos`.
    void saveClip(clip).catch((e: unknown) => {
      setSemDisco((prev) => (prev.includes(clip.id) ? prev : [...prev, clip.id]));
      clientLogger.warn("gravador: nao consegui SALVAR a gravacao (IndexedDB)", {
        erro: e instanceof Error ? e.name : String(e),
        segundos: Math.round(secs),
        bytes: blob.size,
      });
    });
    setClips((prev) => [...prev, { ...toView(clip), saved: "saving" as SavedState }]);
    void syncClip(clip.id, blob, secs);
  }, [syncClip]);

  const stopRecording = useCallback(() => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    const ctx = ctxRef.current;
    const samples = concatFloat32(chunksRef.current);
    chunksRef.current = [];
    setStatus("ready");
    if (!ctx || samples.length === 0) return;
    const dur = samples.length / ctx.sampleRate;
    if (dur < 0.4) return; // descarta clique acidental
    // Clipe onde NUNCA houve fala não vira dataset — mic mudo salvo em
    // IndexedDB seguia até o treino e falhava lá (caso VOZ 1 MAE).
    if (!hasSpokenRef.current) {
      setError(t("errors.muteClip"));
      return;
    }
    finalizeClip(encodeWav(samples, ctx.sampleRate), dur);
  }, [finalizeClip, t]);

  const tick = useCallback(() => {
    const an = analyserRef.current;
    if (an) {
      const buf = meterBufRef.current ?? (meterBufRef.current = new Float32Array(an.fftSize));
      an.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i++) {
        const a = Math.abs(buf[i]);
        if (a > peak) peak = a;
      }
      const r = rms(buf);
      setLevel(Math.min(1, r * 6));
      // Mic mudo: silêncio DIGITAL contínuo (≠ ambiente silencioso, que tem
      // piso de ruído). Vale com o mic aberto mesmo antes de gravar.
      const nowMs = performance.now();
      if (r > DEAD_MIC_RMS) lastSoundRef.current = nowMs;
      setDeadMic(nowMs - lastSoundRef.current > DEAD_MIC_MS);
      // Piso de ruído (frames SEM fala): média móvel exponencial. Vale com o
      // mic aberto mesmo antes de gravar — a pessoa arruma o ambiente ANTES.
      if (r <= SPEECH_RMS) {
        const prev = noiseEmaRef.current;
        const ema = prev === null ? r : prev * 0.95 + r * 0.05;
        noiseEmaRef.current = ema;
        setNoisy(ema > NOISE_FLOOR_WARN);
      }
      if (recordingRef.current) {
        const now = performance.now();
        if (peak >= CLIP_PEAK) setClipping(true);
        if (r > SPEECH_RMS) {
          hasSpokenRef.current = true;
          lastSpeechRef.current = now;
        }
        const elapsed = (now - startedRef.current) / 1000;
        setSeconds(Math.floor(elapsed));
        const silenceStopped = hasSpokenRef.current && now - lastSpeechRef.current > SILENCE_MS;
        if (silenceStopped || elapsed >= MAX_SECONDS) stopRecording();
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [stopRecording]);

  async function activateMic() {
    setError(null);
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      await ctx.resume();
      const url = workletUrl();
      wUrlRef.current = url;
      await ctx.audioWorklet.addModule(url);

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      const worklet = new AudioWorkletNode(ctx, "pcm-processor");
      workletRef.current = worklet;
      const mute = ctx.createGain();
      mute.gain.value = 0;
      muteRef.current = mute;

      worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (recordingRef.current) chunksRef.current.push(e.data);
      };

      source.connect(analyser);
      source.connect(worklet);
      worklet.connect(mute);
      mute.connect(ctx.destination);

      lastSoundRef.current = performance.now(); // zera o relógio do mic mudo
      setStatus("ready");
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? t("errors.micDenied")
          : t("errors.micGeneric"),
      );
      setStatus("denied");
    }
  }

  function startRecording() {
    setError(null);
    chunksRef.current = [];
    hasSpokenRef.current = false;
    startedRef.current = performance.now();
    lastSpeechRef.current = performance.now();
    recordingRef.current = true;
    setClipping(false);
    setSeconds(0);
    setStatus("recording");
  }

  async function removeClip(id: string) {
    const c = clipsRef.current.find((x) => x.id === id);
    if (c?.url.startsWith("blob:")) URL.revokeObjectURL(c.url);
    setClips((prev) => prev.filter((x) => x.id !== id));
    if (c?.serverKey) await deleteServerClip(c.serverKey).catch(() => {});
    await deleteClip(id).catch(() => {});
  }

  /** Retry manual do upload de um clipe que ficou só neste navegador. */
  async function retrySave(id: string) {
    const stored = await listClips().catch(() => [] as StoredClip[]);
    const c = stored.find((x) => x.id === id);
    if (c) void syncClip(c.id, c.blob, c.seconds);
  }

  // extraSeconds = fala gravada PELO CELULAR (takes no R2) — soma na barra,
  // porque tudo entra no mesmo treino (pedido Johnny 03/08).
  // 🐛 #235: a CTA NÃO pode olhar o total da barra — ela tem que olhar o que
  // a tela de destino consegue importar sozinha (os MAX_ARQUIVOS_TREINO
  // maiores clipes + os takes do celular). Régua pura e testada em
  // lib/audio/entrega-gravador.ts.
  const entrega = resumirEntregaDoGravador(clips, extraSeconds, TARGET_SECONDS);
  const totalSeconds = entrega.totalGravado;
  // Gravação que não entrou no IndexedDB E também não subiu pra conta: essa
  // sim morre ao fechar a aba. Se o upload deu certo (`saved === "server"`),
  // falhar no disco do navegador deixou de ser perda — e prometer perda que
  // não existe é o mesmo tipo de mentira que o #235 combate.
  const clipesPerdidos = clips.filter((c) => c.saved !== "server" && semDisco.includes(c.id)).length;
  // Enquanto houver clipe fora da conta, o aviso de "só neste navegador" vale.
  const temClipeForaDaConta = clips.some((c) => c.saved !== "server");
  const pct = Math.min(100, Math.round((totalSeconds / TARGET_SECONDS) * 100));
  const meterPct = Math.round(level * 100);
  const showPill = status === "ready" || status === "recording";
  const targetMet = entrega.liberaEnvio;

  return (
    <>
      {/* Pill flutuante (fixed, CENTRO inferior): Mic + Stop + Timer + mini
          meter. Aparece quando o mic está pronto/gravando pra acompanhar a
          leitura sem scrollar. ⚠️ NÃO usar canto inferior direito: o balão da
          Fast (help-widget, bottom-5 right-5 z-50) fica na frente e esconde a
          pill — caso Johnny 28/07. */}
      {showPill && (
        <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)]/95 px-3 py-2 shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm">
          {/* Mini medidor (5 barras verticais) — saída de áudio: canal ativo violeta */}
          <div className="flex h-6 items-end gap-0.5" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => {
              const active = meterPct / 100 >= (i + 1) / 5 * 0.4;
              return (
                <span
                  key={i}
                  className={`w-1 rounded-[var(--radius-full)] transition-all duration-75 ${
                    active ? "h-full bg-[var(--hue-violet)]" : "h-1.5 bg-[var(--hairline-strong)]"
                  }`}
                />
              );
            })}
          </div>
          {/* Timer do clipe atual */}
          <span className="w-10 text-center font-mono text-[11px] tabular-nums text-[var(--ink)]">
            {formatDuration(seconds)}
          </span>
          {/* Botão único Mic/Stop — tooltip no hover (pill flutuante não tem
              texto; sem isso ninguém sabe o que o botão faz) */}
          {status === "ready" ? (
            <button
              type="button"
              onClick={startRecording}
              aria-label={t("recordHint")}
              className="group relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-full)] bg-[var(--pill-bg)] text-[var(--pill-ink)] transition-transform hover:scale-110 active:scale-95"
            >
              <Mic className="h-4 w-4" />
              <span className={PILL_TOOLTIP}>{t("recordHint")}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              aria-label={t("stopRecording")}
              className="group relative flex h-9 w-9 animate-pulse items-center justify-center rounded-[var(--radius-full)] border-2 border-[var(--status-error)] text-[var(--status-error)]"
            >
              <Square className="h-4 w-4 fill-current" />
              <span className={PILL_TOOLTIP}>{t("stopRecording")}</span>
            </button>
          )}
        </div>
      )}

      <section className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-6">
      <div className="flex items-center gap-2">
        <Mic className="h-4 w-4 text-[var(--silver)]" />
        <h2 className="font-mono text-[12px] tracking-wide text-[var(--silver)]">{t("title")}</h2>
      </div>

      {/* Progresso acumulado (anti-perda: vem do IndexedDB) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between font-mono text-[10px] tracking-wide text-[var(--mute)]">
          <span>{t("accumulated")}</span>
          <span className="tabular-nums text-[var(--silver)]">
            {formatDuration(totalSeconds)} / {formatDuration(TARGET_SECONDS)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-[var(--radius-full)] bg-[var(--surface-deep)] border border-[var(--hairline-strong)]">
          <div className="h-full rounded-[var(--radius-full)] bg-[var(--silver)] transition-[width] duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Medidor de nível — saída de áudio ao vivo: violeta */}
      {(status === "ready" || status === "recording") && (
        <div className="flex items-center gap-3">
          <div className="h-3 flex-1 overflow-hidden rounded-[var(--radius-full)] bg-[var(--surface-deep)] border border-[var(--hairline-strong)]">
            <div
              className="h-full rounded-[var(--radius-full)] bg-[var(--hue-violet)] transition-[width] duration-75"
              style={{ width: `${meterPct}%` }}
            />
          </div>
          <span className="w-10 text-right font-mono text-[10px] tabular-nums text-[var(--mute)]">
            {formatDuration(seconds)}
          </span>
        </div>
      )}

      {clipping && (
        <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--status-warn)]/40 bg-[var(--surface-deep)] px-3 py-2 font-mono text-[10px] tracking-wide text-[var(--status-warn)]">
          <AlertTriangle className="h-4 w-4" /> {t("clipping")}
        </p>
      )}

      {deadMic && (status === "ready" || status === "recording") && (
        <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-deep)] px-3 py-2 font-mono text-[10px] tracking-wide text-[var(--status-error)]">
          <AlertCircle className="h-4 w-4" /> {t("deadMic")}
        </p>
      )}

      {noisy && !clipping && !deadMic && (status === "ready" || status === "recording") && (
        <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--status-warn)]/40 bg-[var(--surface-deep)] px-3 py-2 font-mono text-[10px] tracking-wide text-[var(--status-warn)]">
          <AlertTriangle className="h-4 w-4" /> {t("noisy")}
        </p>
      )}

      {status === "recording" && (
        <p className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-[var(--mute)]">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-[var(--radius-full)] bg-[var(--status-error)]" />
          {t("recordingAuto", { seconds: SILENCE_MS / 1000 })}
        </p>
      )}

      {error && (
        <p className="flex items-center gap-2 rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-deep)] px-3 py-2 font-mono text-[11px] tracking-wide text-[var(--status-error)]">
          <AlertCircle className="h-4 w-4" /> {error}
        </p>
      )}

      {/*
        #235: as duas falhas de armazenamento que a tela engolia. Ficam no
        TOPO das ações porque a hora de reagir é ANTES de gravar mais 20 min.
      */}
      {clipesPerdidos > 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-deep)] px-3 py-2 text-[12px] leading-relaxed text-[var(--status-error)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{t("errors.saveFailed", { count: clipesPerdidos })}</span>
        </p>
      )}

      {falhaLeitura && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-deep)] px-3 py-2 text-[12px] leading-relaxed text-[var(--status-error)]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{t("errors.storageUnreadable")}</span>
        </p>
      )}

      {/* Ações */}
      <div className="flex flex-wrap gap-3">
        {(status === "idle" || status === "denied") && (
          <button type="button" onClick={activateMic} className={btnPrimary}>
            <Mic className="h-4 w-4" /> {t("activateMic")}
          </button>
        )}
        {status === "requesting" && (
          <span className="font-mono text-[12px] tracking-wide text-[var(--silver)]">{t("requesting")}</span>
        )}
        {status === "ready" && (
          <button type="button" onClick={startRecording} className={btnPrimary}>
            <Mic className="h-4 w-4" /> {t("record")}
          </button>
        )}
        {status === "recording" && (
          <button type="button" onClick={stopRecording} className={btnOutline}>
            <Square className="h-4 w-4" /> {t("stop")}
          </button>
        )}
      </div>

      {/* Lista de clipes gravados */}
      {clips.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-[var(--hairline)] pt-4">
          <span className="font-mono text-[10px] tracking-wide text-[var(--mute)]">
            {t("clipsRecorded", { count: clips.length })}
          </span>
          {/*
            #235 (Alana): a gravação que ainda não subiu pra conta existe SÓ
            aqui — no armazenamento deste navegador, neste aparelho. Ela gravou
            20 min, abriu a tela seguinte e não havia nada; ninguém tinha
            avisado que era assim. Perder 20 min em silêncio é o pior sintoma
            desta tela, então o risco fica escrito ANTES de acontecer.

            ⚠️ O aviso é CONDICIONAL de propósito: desde 02/09 o clipe sobe pra
            conta e cada linha já diz onde ela está. Repetir "isto está só no
            navegador" com tudo salvo no servidor seria mentira na direção
            oposta — e a régua dos dois consertos é a mesma: a tela não promete
            o que não guardou, nem assusta com perda que não existe.
          */}
          {temClipeForaDaConta && (
            <p className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--hairline-bright)] bg-[var(--surface-elevated)] px-3 py-2 text-[12px] leading-relaxed text-[var(--mute)]">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--status-warn)]" />
              <span>{t("localOnly")}</span>
            </p>
          )}
          {clips.map((c, i) => (
            <div key={c.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <span className="w-6 font-mono text-[10px] tabular-nums text-[var(--ash)]">{i + 1}</span>
                <audio src={c.url} controls className="h-9 flex-1" preload="metadata" />
                <span className="w-10 text-right font-mono text-[10px] tabular-nums text-[var(--mute)]">
                  {formatDuration(c.seconds)}
                </span>
                <button
                  type="button"
                  onClick={() => removeClip(c.id)}
                  aria-label={t("deleteClip")}
                  className="text-[var(--mute)] transition-colors hover:text-[var(--status-error)]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {/* Onde a gravação está — a tela nunca mais promete o que não
                  guardou (caso Allan/Alana 02/09). */}
              {c.saved === "server" ? (
                <span className="pl-9 font-mono text-[10px] tracking-wide text-[var(--status-online)]">
                  ✓ {t("clipSaved")}
                </span>
              ) : c.saved === "saving" ? (
                <span className="pl-9 font-mono text-[10px] tracking-wide text-[var(--mute)]">{t("clipSaving")}</span>
              ) : (
                <span className="flex items-center gap-2 pl-9 font-mono text-[10px] tracking-wide text-[var(--status-warn)]">
                  <AlertTriangle className="h-3 w-3" /> {t("clipOnlyLocal")}
                  <button
                    type="button"
                    onClick={() => retrySave(c.id)}
                    className="underline underline-offset-2 transition-colors hover:text-[var(--ink)]"
                  >
                    {t("clipRetrySave")}
                  </button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/*
        #235: a barra bateu a meta mas a tela de destino NÃO consegue somar
        tudo isso (clipes além do teto de arquivos ficam de fora). Sumir com a
        CTA e não dizer nada seria o mesmo botão mudo de sempre — aqui a tela
        explica o que aconteceu e o que fazer.
      */}
      {entrega.metaIlusoria && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius)] border border-[var(--status-warn)]/40 bg-[var(--surface-deep)] px-3 py-2 text-[12px] leading-relaxed text-[var(--status-warn)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            {t("overFileCap", {
              extra: entrega.clipesForaDoTeto,
              max: MAX_ARQUIVOS_TREINO,
              usable: formatDuration(entrega.aproveitados),
              minutes: TARGET_SECONDS / 60,
            })}
          </span>
        </p>
      )}

      {/* CTA enviar pra treinamento — aparece ao bater 20min DE ÁUDIO QUE A
          TELA SEGUINTE CONSEGUE IMPORTAR (ver `entrega`). Usuário pode
          continuar gravando (CTA fica disponível, não bloqueia). */}
      {targetMet && (
        <div className="flex flex-col gap-3 rounded-[var(--radius)] border border-[var(--hairline-bright)] bg-[var(--surface-elevated)] p-4">
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-[var(--status-online)]">
            <Check className="h-4 w-4" /> {t("targetMet", { minutes: TARGET_SECONDS / 60 })}
          </p>
          <Link
            href="/app/voice-cloning/new"
            className={`${btnOutline} justify-center`}
          >
            {t("sendToTraining")} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-[var(--mute)]">
            {t("keepRecording")}
          </p>
        </div>
      )}
    </section>
    </>
  );
}

function toView(c: StoredClip): Omit<ClipView, "saved"> {
  return { id: c.id, seconds: c.seconds, createdAt: c.createdAt, url: URL.createObjectURL(c.blob) };
}

const btnPrimary =
  "inline-flex h-10 items-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98]";
const btnOutline =
  "inline-flex h-10 items-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] active:scale-[0.98]";
