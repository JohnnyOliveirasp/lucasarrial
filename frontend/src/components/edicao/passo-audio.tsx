"use client";

/**
 * 🚧 Vídeo Edição 2.0 — E2 Áudio (W2 da spec 11/08).
 * Pergunta primeiro: gerar com a voz clonada (IA) ou gravar você mesmo?
 *  - IA: campo JÁ PREENCHIDO com o roteiro da E1 (editável) → TTS → poll.
 *  - Gravar: teleprompter (componente do Gravador, parametrizado com o
 *    roteiro) + take salvo no R2 via rotina do recorder-test (reutilizável
 *    depois no treino da voz — mesma regra do HeyGen 11/08).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Loader2, Mic, MonitorPlay, Sparkles, Square, Trash2, Upload } from "lucide-react";
import { Teleprompter } from "@/components/voice/teleprompter";
import { CaminhoArquivo } from "./caminho-arquivo";
import type { AudioSel, EdicaoDraft } from "./edicao-wizard";

const TEXT_MAX = 2000; // teto do POST /voices/[id]/generate
// Regra universal 13/08: áudio de vídeo tem teto de 120s em todo lugar
// (roteiro máx 90s, gravar, subir arquivo) — Reels não passa de 2 minutos.
const REC_MAX_S = 120;

type Voz = { id: string; name: string; status: string };
type Take = { key: string; name: string; url: string };

type Props = {
  draft: EdicaoDraft;
  onChange: (patch: Partial<EdicaoDraft>) => void;
};

export function PassoAudio({ draft, onChange }: Props) {
  const t = useTranslations("edicao.audio");
  const [caminho, setCaminho] = useState<"ia" | "gravar" | "arquivo" | null>(
    draft.audio ? (draft.audio.kind === "generation" ? "ia" : "gravar") : null,
  );

  const escolher = useCallback((a: AudioSel | null) => onChange({ audio: a }), [onChange]);

  return (
    <div className="flex flex-col gap-4">
      {/* Escolha do caminho */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {(["ia", "gravar", "arquivo"] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCaminho(c);
              if (draft.audio && (draft.audio.kind === "generation") !== (c === "ia")) escolher(null);
            }}
            className={[
              "rounded-[var(--radius)] border p-4 text-left",
              caminho === c
                ? "border-[var(--ink)]"
                : "border-[var(--hairline)] hover:border-[var(--hairline-strong)]",
            ].join(" ")}
          >
            <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
              {c === "ia" ? <Sparkles className="size-4" /> : c === "gravar" ? <Mic className="size-4" /> : <Upload className="size-4" />}
              {t(`caminhos.${c}.titulo`)}
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--mute)]">{t(`caminhos.${c}.corpo`)}</p>
          </button>
        ))}
      </div>

      {draft.audio && (
        <p className="rounded-[var(--radius-sm)] border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
          {t("escolhido", { label: draft.audio.label })}
        </p>
      )}

      {caminho === "ia" && <CaminhoIA draft={draft} escolher={escolher} />}
      {caminho === "gravar" && <CaminhoGravar draft={draft} escolher={escolher} />}
      {caminho === "arquivo" && <CaminhoArquivo escolher={escolher} />}
    </div>
  );
}

/* ── IA: voz clonada + roteiro pré-preenchido → TTS ── */
function CaminhoIA({ draft, escolher }: { draft: EdicaoDraft; escolher: (a: AudioSel | null) => void }) {
  const t = useTranslations("edicao.audio");
  const [vozes, setVozes] = useState<Voz[] | null>(null);
  const [vozId, setVozId] = useState<string>("");
  const [texto, setTexto] = useState<string>(draft.roteiro.slice(0, TEXT_MAX));
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  // Id da geração no player — habilita o apagar (bug Johnny 13/08: só o
  // take gravado tinha lixeira; o áudio de IA não tinha como descartar).
  const [genAtual, setGenAtual] = useState<string | null>(null);
  const [apagando, setApagando] = useState(false);
  const vivoRef = useRef(true);

  useEffect(() => {
    vivoRef.current = true;
    void fetch("/api/v1/voices")
      .then((r) => r.json())
      .then((j) => {
        const vs = ((j?.data?.voices ?? j?.voices ?? []) as Voz[]).filter((v) => v.status === "ready");
        setVozes(vs);
        if (vs.length === 1) setVozId(vs[0].id);
      })
      .catch(() => setVozes([]));
    return () => {
      vivoRef.current = false;
    };
  }, []);

  const custo = Math.max(400, texto.length);

  async function gerar() {
    setGerando(true);
    setErro(null);
    setAudioUrl(null);
    try {
      const res = await fetch(`/api/v1/voices/${vozId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: texto }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(j?.error?.message ?? j?.message ?? t("erroGerar"));
        setGerando(false);
        return;
      }
      const genId = (j?.data?.generation_id ?? j?.generation_id) as string;
      // poll até ready/failed (a rota sincroniza com o RunPod sozinha)
      for (;;) {
        if (!vivoRef.current) return;
        await new Promise((r) => setTimeout(r, 3000));
        const g = await fetch(`/api/v1/generations/${genId}`)
          .then((r) => r.json())
          .then((x) => x?.data?.generation ?? x?.generation)
          .catch(() => null);
        if (!g) continue;
        if (g.status === "ready") {
          const voz = vozes?.find((v) => v.id === vozId);
          escolher({
            kind: "generation",
            id: genId,
            label: t("labelGeracao", { voz: voz?.name ?? "voz", s: Math.round(g.duration_seconds ?? 0) }),
          });
          setAudioUrl(g.audio_url ?? null);
          setGenAtual(genId);
          break;
        }
        if (g.status === "failed") {
          setErro(g.error_message || t("erroGerar"));
          break;
        }
      }
    } finally {
      if (vivoRef.current) setGerando(false);
    }
  }

  if (vozes === null) return <p className="text-[13px] text-[var(--mute)]">{t("carregando")}</p>;
  if (vozes.length === 0) {
    return (
      <p className="rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2 text-[13px] text-[var(--mute)]">
        {t("semVoz")}{" "}
        <Link href="/app/voice-cloning" className="underline underline-offset-2 text-[var(--ink)]">
          {t("semVozCta")}
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[13px] text-[var(--mute)]">{t("voz")}</label>
        <select
          value={vozId}
          onChange={(e) => setVozId(e.target.value)}
          className="rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13px] text-[var(--ink)]"
        >
          <option value="">{t("escolhaVoz")}</option>
          {vozes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, TEXT_MAX))}
          rows={7}
          className="w-full rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--ink)]"
        />
        <p className="mt-1 text-[11.5px] text-[var(--ash)]">
          {t("custoTts", { chars: texto.length, custo })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void gerar()}
        disabled={gerando || !vozId || texto.trim().length === 0}
        className="flex w-fit items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--ink)] px-4 py-2 text-[13px] font-semibold text-[var(--surface-deep)] disabled:opacity-40"
      >
        {gerando ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {gerando ? t("gerandoAudio") : t("gerarAudio")}
      </button>
      {erro && <p className="text-[13px] text-red-400">{erro}</p>}
      {audioUrl && (
        <div className="flex items-center gap-2">
          <audio src={audioUrl} controls className="h-9 w-full max-w-md" />
          {/* Apagar o áudio de IA (mesma rota do Histórico, com as proteções
              de referência da voz) — destrava gerar de novo. */}
          {genAtual && (
            <button
              type="button"
              onClick={async () => {
                setApagando(true);
                try {
                  await fetch("/api/v1/generations", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ids: [genAtual] }),
                  });
                  setAudioUrl(null);
                  setGenAtual(null);
                  escolher(null);
                } finally {
                  setApagando(false);
                }
              }}
              disabled={apagando || gerando}
              title={t("apagarAudio")}
              className="shrink-0 text-[var(--ash)] hover:text-[var(--danger,#e5484d)] disabled:opacity-40"
            >
              {apagando ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Gravar: teleprompter com o roteiro + take salvo (rotina recorder-test) ── */
function CaminhoGravar({ draft, escolher }: { draft: EdicaoDraft; escolher: (a: AudioSel | null) => void }) {
  const t = useTranslations("edicao.audio");
  const [prompter, setPrompter] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [takes, setTakes] = useState<Take[]>([]);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [subindo, setSubindo] = useState(false);
  const [apagando, setApagando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const j = await fetch("/api/v1/recorder-test/session").then((r) => r.json());
        const tk = (j?.data?.token ?? j?.token) as string | undefined;
        if (!tk) throw new Error();
        setToken(tk);
        await listar(tk);
      } catch {
        setErro(t("erroSessao"));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Apaga um take ruim (rota DELETE do recorder-test, posse pelo token). */
  async function apagarTake(key: string) {
    if (!token) return;
    setApagando(key);
    try {
      await fetch(`/api/v1/recorder-test/takes?key=${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: { "x-recorder-token": token },
      });
      // Se o apagado era o take escolhido, destrava a seleção da estação.
      if (draft.audio?.kind === "take" && draft.audio.key === key) escolher(null);
      await listar(token);
    } finally {
      setApagando(null);
    }
  }

  async function listar(tk: string) {
    const j = await fetch("/api/v1/recorder-test/takes", { headers: { "x-recorder-token": tk } })
      .then((r) => r.json())
      .catch(() => null);
    const list = ((j?.data?.takes ?? j?.takes ?? []) as Take[]).slice().reverse();
    setTakes(list.slice(0, 6));
    return list;
  }

  function limpar() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recRef.current?.stream.getTracks().forEach((tr) => tr.stop());
    recRef.current = null;
    setGravando(false);
    setSegundos(0);
  }

  async function iniciar() {
    setErro(null);
    try {
      // mesma receita do gravador: sem NR/eco (timbre real), AGC nivelando
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = (rec.mimeType || "audio/webm").split(";")[0];
        const blob = new Blob(chunksRef.current, { type });
        limpar();
        if (blob.size > 0) void subir(blob, type);
      };
      recRef.current = rec;
      rec.start(1000);
      setGravando(true);
      setSegundos(0);
      timerRef.current = setInterval(() => {
        setSegundos((s) => {
          if (s + 1 >= REC_MAX_S) recRef.current?.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setErro(t("erroMic"));
    }
  }

  async function subir(blob: Blob, type: string) {
    if (!token) return;
    setSubindo(true);
    try {
      const fd = new FormData();
      const ext = type === "audio/mp4" ? "m4a" : "webm";
      fd.append("file", new File([blob], `take.${ext}`, { type }));
      const res = await fetch("/api/v1/recorder-test/upload", {
        method: "POST",
        headers: { "x-recorder-token": token },
        body: fd,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.error?.message || t("erroEnvio"));
      const key = (j?.data?.key ?? j?.key) as string | undefined;
      const list = await listar(token);
      const mine = key ?? list[0]?.key;
      if (mine) escolher({ kind: "take", key: mine, label: t("labelTake") });
    } catch (e) {
      setErro(e instanceof Error ? e.message : t("erroEnvio"));
    } finally {
      setSubindo(false);
    }
  }

  const mm = String(Math.floor(segundos / 60));
  const ss = String(segundos % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-3">
      {prompter && (
        <Teleprompter paragraphs={draft.roteiro.split(/\n+/).filter(Boolean)} onClose={() => setPrompter(false)} />
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setPrompter((v) => !v)}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--ink)] hover:bg-[var(--surface-raised)]"
        >
          <MonitorPlay className="size-4" />
          {prompter ? t("fecharPrompter") : t("abrirPrompter")}
        </button>
        <button
          type="button"
          onClick={() => (gravando ? recRef.current?.stop() : void iniciar())}
          disabled={subindo || !token}
          className={[
            "flex size-11 items-center justify-center rounded-full border-2 transition-transform active:scale-95 disabled:opacity-40",
            gravando ? "border-red-500 bg-red-500/15" : "border-[var(--hairline-strong)] bg-[var(--surface-deep)]",
          ].join(" ")}
          aria-label={gravando ? t("parar") : t("gravar")}
        >
          {subindo ? (
            <Loader2 className="size-5 animate-spin text-[var(--mute)]" />
          ) : gravando ? (
            <Square className="size-4 fill-red-400 text-red-400" />
          ) : (
            <Mic className="size-5 text-[var(--ink)]" />
          )}
        </button>
        <span className="text-[13px] text-[var(--mute)]">
          {subindo ? t("salvando") : gravando ? `${mm}:${ss}` : t("dicaGravar")}
        </span>
      </div>
      {erro && <p className="text-[13px] text-red-400">{erro}</p>}
      {takes.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {takes.map((tk) => (
            <li key={tk.key}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] border border-[var(--hairline)] px-3 py-2">
                <input
                  type="radio"
                  name="edicao-take"
                  checked={draft.audio?.kind === "take" && draft.audio.key === tk.key}
                  onChange={() => escolher({ kind: "take", key: tk.key, label: t("labelTake") })}
                  className="accent-[var(--ink)]"
                />
                <span className="truncate text-[12.5px] text-[var(--ink)]">{tk.name}</span>
                <audio src={tk.url} controls preload="none" className="ml-auto h-8 max-w-[220px]" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    void apagarTake(tk.key);
                  }}
                  disabled={apagando === tk.key}
                  title={t("apagarTake")}
                  className="shrink-0 text-[var(--ash)] hover:text-[var(--danger,#e5484d)] disabled:opacity-40"
                >
                  {apagando === tk.key ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              </label>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[12px] text-[var(--ash)]">{t("takeFicaSalvo")}</p>
    </div>
  );
}
