"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ImagePlus, Sparkles, Wand2, Download, Film, X, Loader2, ShieldAlert } from "lucide-react";
import { SupportError } from "@/components/ui/support-error";
import { PaywallModal } from "@/components/app/paywall-modal";
import { AudioGeneratingIndicator } from "@/components/voice/audio-generating-indicator";
import { FieldHint } from "@/components/image/field-hint";
import { ensureUploadableImage, IMAGE_ACCEPT_WITH_HEIC, isHeicFile } from "@/lib/images/heic";
import { putToR2, UploadError, uploadErrorText } from "@/lib/images/upload";
import { clientLogger } from "@/lib/logger/client";
import {
  ASPECT_RATIOS,
  RESOLUTIONS,
  IMAGE_MIN_CREDITS,
  allowedResolutions,
  resolveResolutionForAspect,
  imageCreditCost,
} from "@/lib/kie/config";

const PILL =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[var(--radius)] bg-[var(--pill-bg)] px-[20px] font-sans text-[14px] font-medium tracking-[-0.01em] text-[var(--pill-ink)] transition-[background-color,transform] duration-[var(--dur-base)] ease-[var(--ease-out)] hover:bg-white active:scale-[0.98] disabled:opacity-[0.42] disabled:pointer-events-none";
const SECONDARY =
  "inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-elevated)] px-[18px] font-sans text-[13px] font-medium tracking-[-0.01em] text-[var(--ink)] transition-colors duration-[var(--dur-base)] ease-[var(--ease-out)] hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-raised)] disabled:opacity-[0.42] disabled:pointer-events-none";
const LABEL = "flex items-center gap-1.5 font-mono text-[11px] tracking-wide text-[var(--mute)]";

const PROMPT_MAX = 2000;
const IDEA_MAX = 600;
// gpt-image-2 aceita até 16; o fallback Seedream corta em 10 sozinho e a fixa
// vai primeiro no array — então 15 é seguro nos dois motores (pedido 19/08).
const MAX_IMAGES = 15;
const MAX_EXTRAS = MAX_IMAGES - 1; // 1 fixa + 14 extras

/** Referência FIXA (29/07): persiste entre gerações e sessões (localStorage). */
export type FixedRef = { key: string; url: string };
const fixedRefStorageKey = (userId: string) => `fc:image-ref:${userId}`;

type RefImage = { id: string; preview: string; key: string | null; uploading: boolean };
type Step = "form" | "submitting" | "polling" | "done" | "error";
type ImageDto = {
  id: string;
  status: "pending" | "generating" | "ready" | "failed";
  image_url: string | null;
  error_message: string | null;
};

export function ImageStudio({
  creditsTotal,
  unlimited,
  userId,
  refRequest,
  extraRequest,
  removeRequest,
  onGenerated,
  onAnimate,
  onFixedRefKey,
  onRefsChanged,
  onExtrasChange,
}: {
  creditsTotal: number;
  unlimited: boolean;
  /** Escopo do localStorage da referência fixa (multi-conta no mesmo browser). */
  userId: string;
  /** "Usar como referência" do histórico: troca a referência fixa. */
  refRequest?: (FixedRef & { seq: number }) | null;
  /** "Adicionar como extra" do banco de referências: entra nas fotos extras. */
  extraRequest?: (FixedRef & { seq: number }) | null;
  /** Foto apagada do banco: sai do quadro também (principal ou extra). */
  removeRequest?: { key: string; seq: number } | null;
  onGenerated?: () => void;
  /** Abre o painel "Animar" desta imagem no histórico (feature Vídeo). */
  onAnimate?: (imageId: string) => void;
  /** Avisa o pai qual é a chave da referência ATUAL (aba marca "em uso"). */
  onFixedRefKey?: (key: string | null) => void;
  /** Uma foto nova entrou no banco de referências (a aba recarrega). */
  onRefsChanged?: () => void;
  /** Chaves das fotos extras no quadro (a aba marca "já está nas extras"). */
  onExtrasChange?: (keys: string[]) => void;
}) {
  const t = useTranslations("images.studio");
  const tUpload = useTranslations("uploadErrors");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<string | null>(null);

  // Referência FIXA (sempre 1) + fotos extras (até 5, como antes).
  const [fixedRef, setFixedRef] = useState<FixedRef | null>(null);
  const [fixedUploading, setFixedUploading] = useState(false);
  const [refs, setRefs] = useState<RefImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null); // extras (multiple)
  const replaceInputRef = useRef<HTMLInputElement>(null); // troca a fixa (single)

  function persistFixedRef(next: FixedRef | null) {
    setFixedRef(next);
    onFixedRefKey?.(next?.key ?? null);
    // Exclusividade (19/08, pedido do Johnny): a mesma foto NUNCA fica na
    // principal E nas extras ao mesmo tempo — virou principal, sai das extras.
    if (next) setRefs((prev) => prev.filter((x) => x.key !== next.key));
    // Adoção (19/08): toda referência passa por AQUI, então é aqui que ela é
    // copiada pra área "refs/" que o apagar-do-histórico não alcança. Antes, a
    // chave apontava pro input_* DENTRO de uma geração — apagar aquela geração
    // matava a referência de todo mundo que dependia dela. Em segundo plano:
    // a tela não espera; quando a cópia responde, a chave guardada troca.
    if (next && !next.key.includes("/refs/")) {
      void fetch("/api/v1/images/refs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: next.key }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j?.key) return;
          setFixedRef((atual) => (atual?.key === next.key ? { key: j.key, url: j.url ?? atual.url } : atual));
          onFixedRefKey?.(j.key);
          setRefs((prev) => prev.filter((x) => x.key !== j.key));
          onRefsChanged?.();
          try {
            if (localStorage.getItem(fixedRefStorageKey(userId)) === next.key) {
              localStorage.setItem(fixedRefStorageKey(userId), j.key);
            }
          } catch { /* sem localStorage, segue */ }
        })
        .catch(() => { /* adoção falhou: a referência original segue valendo */ });
    }
    try {
      if (next) localStorage.setItem(fixedRefStorageKey(userId), next.key);
      else localStorage.removeItem(fixedRefStorageKey(userId));
    } catch {
      /* storage indisponível — segue só em memória */
    }
  }

  // Reidrata a referência fixa da sessão anterior (chave → URL fresca).
  // Sem localStorage (1º login), cai pra referência definida no SERVIDOR
  // (profiles.image_ref_key — onboarding via planilha, 12/08).
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(fixedRefStorageKey(userId));
    } catch {
      stored = null;
    }
    let cancelled = false;
    if (!stored) {
      (async () => {
        try {
          const r = await fetch("/api/v1/images/ref-default", { cache: "no-store" });
          if (!r.ok) return;
          const { key, url } = await r.json();
          if (!cancelled && key && url) persistFixedRef({ key, url });
        } catch {
          /* sem referência do servidor — segue vazio */
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const r = await fetch("/api/v1/images/ref-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: stored }),
        });
        if (!r.ok) throw new Error("ref-url");
        const { url } = await r.json();
        // persistFixedRef, não setFixedRef: é o que dispara a ADOÇÃO — este
        // caminho (chave antiga no localStorage) é a migração dos ~570 alunos.
        if (!cancelled) persistFixedRef({ key: stored!, url });
      } catch {
        // chave morta (imagem apagada) — limpa em silêncio
        try {
          localStorage.removeItem(fixedRefStorageKey(userId));
        } catch {
          /* noop */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // "Usar como referência" vindo do histórico.
  useEffect(() => {
    if (refRequest) persistFixedRef({ key: refRequest.key, url: refRequest.url });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refRequest?.seq]);

  // "Adicionar como extra" vindo do banco: a foto já está no R2, só entra no
  // quadro (sem upload novo). Duplicada ou igual à fixa não entra de novo.
  useEffect(() => {
    if (!extraRequest) return;
    if (fixedRef?.key === extraRequest.key) return;
    if (refs.some((x) => x.key === extraRequest.key)) return;
    if (refs.length >= MAX_EXTRAS) {
      setError(t("errors.maxPhotos", { max: MAX_IMAGES }));
      return;
    }
    setRefs((prev) => [
      ...prev,
      { id: crypto.randomUUID(), preview: extraRequest.url, key: extraRequest.key, uploading: false },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraRequest?.seq]);

  // Foto apagada do banco sai do quadro também (principal ou extra) — senão a
  // geração apontaria pra uma chave morta, o defeito que o banco existe pra curar.
  useEffect(() => {
    if (!removeRequest) return;
    if (fixedRef?.key === removeRequest.key) persistFixedRef(null);
    setRefs((prev) => prev.filter((x) => x.key !== removeRequest.key));
    // Foto apagada do banco também sai do aviso "ficou de fora da geração".
    setBankKeys((prev) => prev.filter((k) => k !== removeRequest.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removeRequest?.seq]);

  // A aba do banco marca quem já está nas extras — avisa a cada mudança.
  useEffect(() => {
    onExtrasChange?.(refs.filter((r) => r.key).map((r) => r.key as string));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refs]);

  // prompt
  const [idea, setIdea] = useState("");
  const [prompt, setPrompt] = useState("");
  const [genPrompting, setGenPrompting] = useState(false);

  // opções
  const [aspect, setAspect] = useState<string>("auto");
  const [resolution, setResolution] = useState<string>("1K");

  // paywall
  const [noCredits, setNoCredits] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [paywallDetail, setPaywallDetail] = useState<string | null>(null);

  const [result, setResult] = useState<ImageDto | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cost = imageCreditCost(resolution);
  // Trava por crédito: precisa do mínimo (12 = 1K) pra gerar qualquer coisa, e
  // do custo da resolução escolhida (ex.: 4K=30) pra aquela resolução.
  const hasMinCredits = unlimited || creditsTotal >= IMAGE_MIN_CREDITS;
  const canAfford = unlimited || creditsTotal >= cost;
  const affordableResolution = (v: string) =>
    unlimited || creditsTotal >= imageCreditCost(v);
  // A fixa vai SEMPRE primeiro (é a âncora da semelhança); extras completam.
  const readyKeys = [
    ...(fixedRef ? [fixedRef.key] : []),
    ...refs.filter((r) => r.key).map((r) => r.key as string),
  ];
  const anyUploading = fixedUploading || refs.some((r) => r.uploading);
  const canSubmit =
    Boolean(fixedRef) && !anyUploading && prompt.trim().length > 0 && canAfford;

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Clampa a resolução às restrições da proporção E ao saldo: se a escolhida
  // não couber no crédito, cai na mais barata que couber (e seja permitida).
  useEffect(() => {
    setResolution((r) => {
      const next = resolveResolutionForAspect(aspect, r);
      if (affordableResolution(next)) return next;
      const cheapest = allowedResolutions(aspect).find(affordableResolution);
      return cheapest ?? next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, creditsTotal, unlimited]);

  // Envio pro BANCO (19/08, pedido do Johnny): o upload em lote NUNCA preenche
  // o quadro (nem a principal, nem as extras) — a foto cai em "Imagens de
  // Referência" e a pessoa escolhe DE LÁ o que vai pro quadro.
  const [bankUpload, setBankUpload] = useState<{ done: number; total: number } | null>(null);
  const [bankSaved, setBankSaved] = useState(0);
  // Chaves (já adotadas em refs/) das fotos que entraram no banco NESTA sessão.
  // É por elas que o aviso ao lado do Gerar sabe se a foto nova ficou de fora
  // da geração (incidente 8379549c: aluno subia a foto, gerava com a referência
  // velha e pagava crédito por uma imagem que nunca viu a foto dele).
  const [bankKeys, setBankKeys] = useState<string[]>([]);
  // Fotos salvas no banco nesta sessão que NÃO estão no quadro (nem principal,
  // nem extras): a geração não vai usá-las e a tela precisa dizer isso.
  const bankPendingCount = bankKeys.filter((k) => !readyKeys.includes(k)).length;
  const extrasCount = refs.filter((r) => r.key).length;

  /** Sobe 1 arquivo direto pro banco de referências (upload + adoção).
   *  Devolve a foto ADOTADA (chave em `refs/` + URL) ou null se falhou — o
   *  chamador precisa dela pra encher o quadro quando ele está vazio. */
  async function uploadToBank(file: File): Promise<{ key: string; url: string } | null> {
    try {
      const r = await fetch("/api/v1/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_type: file.type }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("errors.prepareUpload"));
      }
      const { key, upload_url } = await r.json();
      // PUT direto no R2 com retry em falha transitória (rede/5xx).
      await putToR2(upload_url, file, file.type);
      // Adoção = a cópia em `refs/` que o apagar-do-histórico não alcança.
      const ad = await fetch("/api/v1/images/refs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (!ad.ok) {
        const j = await ad.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("errors.upload"));
      }
      // Guarda a chave ADOTADA (refs/...): é ela que o quadro passa a usar se a
      // pessoa escolher a foto no banco — só assim o aviso sabe comparar.
      const adopted = (await ad.json().catch(() => null)) as {
        key?: unknown;
        url?: unknown;
      } | null;
      let saida: { key: string; url: string } | null = null;
      if (adopted && typeof adopted.key === "string" && adopted.key) {
        const nova = adopted.key;
        setBankKeys((prev) => (prev.includes(nova) ? prev : [...prev, nova]));
        saida = {
          key: nova,
          url: typeof adopted.url === "string" ? adopted.url : URL.createObjectURL(file),
        };
      }
      onRefsChanged?.();
      return saida;
    } catch (e) {
      // O upload vai do navegador DIRETO pro R2 (URL assinada) — sem este log
      // a falha não existe em lugar nenhum do nosso lado (caso VP, 19/08).
      clientLogger.error("image.upload_failed", {
        stage: "bank",
        filename: file.name,
        type: file.type,
        size: file.size,
        message: e instanceof Error ? e.message : String(e),
      });
      setError(
        e instanceof UploadError
          ? uploadErrorText(e, file, tUpload)
          : e instanceof Error
            ? e.message
            : t("errors.upload"),
      );
      return null;
    }
  }

  /** Sobe 1 arquivo e o torna a referência FIXA (substitui a atual). */
  async function uploadFixed(rawFile: File) {
    const file = await ensureUploadableImage(rawFile); // iPhone .heic -> jpeg
    if (!file.type.startsWith("image/")) {
      clientLogger.warn("image.invalid_file", {
        stage: "fixed",
        filename: rawFile.name,
        type: rawFile.type,
        size: rawFile.size,
      });
      setError(t("errors.invalidFiles"));
      return;
    }
    setError(null);
    setFixedUploading(true);
    const preview = URL.createObjectURL(file);
    try {
      const r = await fetch("/api/v1/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content_type: file.type }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.error?.message || t("errors.prepareUpload"));
      }
      const { key, upload_url } = await r.json();
      // PUT direto no R2 com retry em falha transitória (rede/5xx).
      await putToR2(upload_url, file, file.type);
      persistFixedRef({ key, url: preview });
    } catch (e) {
      URL.revokeObjectURL(preview);
      // Mesmo motivo do uploadToBank: falha navegador→R2 só existe se registrarmos.
      clientLogger.error("image.upload_failed", {
        stage: "fixed",
        filename: file.name,
        type: file.type,
        size: file.size,
        message: e instanceof Error ? e.message : String(e),
      });
      setError(
        e instanceof UploadError
          ? uploadErrorText(e, file, tUpload)
          : e instanceof Error
            ? e.message
            : t("errors.upload"),
      );
    } finally {
      setFixedUploading(false);
      if (replaceInputRef.current) replaceInputRef.current.value = "";
    }
  }

  /** Arquivos novos: TODOS vão pro banco de referências — nada entra no
   *  quadro sozinho. A pessoa escolhe lá quem é a principal e as extras. */
  async function handleFiles(files: FileList | File[]) {
    setError(null);
    setBankSaved(0);
    // HEIC do iPhone pode vir com MIME vazio — a extensao vale como imagem.
    const raw = Array.from(files).filter((f) => f.type.startsWith("image/") || isHeicFile(f));
    if (raw.length === 0) {
      clientLogger.warn("image.invalid_file", {
        stage: "bank",
        files: Array.from(files).map((f) => ({ filename: f.name, type: f.type, size: f.size })),
      });
      setError(t("errors.invalidFiles"));
      return;
    }
    const imgs = await Promise.all(raw.map(ensureUploadableImage));
    const take = imgs.slice(0, MAX_IMAGES);
    if (take.length < imgs.length) {
      setError(t("errors.maxPhotosIgnored", { max: MAX_IMAGES }));
    }
    setBankUpload({ done: 0, total: take.length });
    // UMA POR VEZ: paralelo saturava o link de subida do aluno e derrubava
    // uploads aleatórios (incidente 5bb774b8 — "às vezes a 1ª, às vezes da 2ª").
    let ok = 0;
    let primeira: { key: string; url: string } | null = null;
    for (const f of take) {
      const subida = await uploadToBank(f);
      if (subida) {
        ok++;
        if (!primeira) primeira = subida;
      }
      setBankUpload((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    setBankUpload(null);
    setBankSaved(ok);

    // QUADRO VAZIO NÃO PODE CONTINUAR VAZIO DEPOIS DE SUBIR FOTO.
    //
    // ⚠️ Medido no caso da Joanna (21/08): `canSubmit` exige `fixedRef`, então
    // com o quadro vazio o botão Gerar fica DESABILITADO — do lado dela o
    // sintoma é "a plataforma não está deixando gerar imagem". Ela subiu a
    // mesma foto três vezes seguidas (15:15, 15:17, 15:18), acumulou 24 fotos
    // no banco e gerou ZERO: cada upload ia pro banco e o quadro seguia vazio.
    // A saída existia (escolher a foto no banco e promover), mas ninguém
    // descobre isso sozinho — e o `image_ref_key` dela estava NULL, então nem
    // o padrão do servidor salvava.
    //
    // A regra de 19/08 ("lote NUNCA preenche o quadro") continua valendo pra
    // quem JÁ TEM uma referência — lá ela protege de trocar a âncora sem querer
    // e o aviso do 8379549c cuida do resto. Aqui não há o que proteger: quadro
    // vazio é aluno travado.
    if (!fixedRef && primeira) persistFixedRef(primeira);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /** Promove uma foto extra a referência FIXA; a fixa atual desce pras extras
   *  (troca de lugar — as duas já estão no R2, nenhum upload novo). */
  function promoteRef(id: string) {
    const chosen = refs.find((x) => x.id === id);
    if (!chosen?.key || chosen.uploading || fixedUploading) return;
    const oldFixed = fixedRef;
    setRefs((prev) => {
      const rest = prev.filter((x) => x.id !== id);
      return oldFixed
        ? [...rest, { id: crypto.randomUUID(), preview: oldFixed.url, key: oldFixed.key, uploading: false }]
        : rest;
    });
    persistFixedRef({ key: chosen.key, url: chosen.preview });
  }

  function removeRef(id: string) {
    setRefs((prev) => {
      const found = prev.find((x) => x.id === id);
      if (found) URL.revokeObjectURL(found.preview);
      return prev.filter((x) => x.id !== id);
    });
  }

  function clearImages() {
    setRefs((prev) => {
      prev.forEach((x) => URL.revokeObjectURL(x.preview));
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function autoPrompt() {
    if (!idea.trim() || genPrompting) return;
    setGenPrompting(true);
    setError(null);
    setBlocked(null);
    try {
      const r = await fetch("/api/v1/images/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: idea.trim() }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        if (j?.error?.code === "content_blocked") {
          setBlocked(j.error.message || t("errors.blockedFallback"));
          return;
        }
        throw new Error(j?.error?.message || t("errors.generatePrompt"));
      }
      const { prompt: out } = await r.json();
      setPrompt(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.generic"));
    } finally {
      setGenPrompting(false);
    }
  }

  function poll(id: string) {
    setStep("polling");
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/v1/images/${id}`, { cache: "no-store" });
        if (!r.ok) return;
        const { image } = await r.json();
        setResult(image as ImageDto);
        if (image.status === "ready" || image.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setStep(image.status === "ready" ? "done" : "error");
          if (image.status === "failed") setError(image.error_message || t("errors.generationFailed"));
          onGenerated?.();
        }
      } catch {
        /* ignore */
      }
    }, 3000);
  }

  async function handleGenerate() {
    if (!canSubmit) return;
    setStep("submitting");
    setError(null);
    setBlocked(null);
    setNoCredits(false);
    try {
      const r = await fetch("/api/v1/images/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input_image_keys: readyKeys,
          prompt: prompt.trim(),
          idea: idea.trim() || undefined,
          aspect_ratio: aspect,
          resolution,
        }),
      });
      if (r.status === 402) {
        const j = await r.json().catch(() => ({}));
        setSubscribed(Boolean(j?.error?.details?.subscribed));
        setPaywallDetail(j?.error?.message ?? null);
        setNoCredits(true);
        setStep("form");
        return;
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        // Erros ACIONÁVEIS pelo usuário (moderação, proporção indisponível no
        // provedor) mostram a mensagem real no form — não o "Ops" genérico.
        if (j?.error?.code === "content_blocked" || j?.error?.code === "aspect_unavailable") {
          setBlocked(j.error.message || t("errors.blockedFallback"));
          setStep("form");
          return;
        }
        throw new Error(j?.error?.message || t("errors.generateImage"));
      }
      const { id } = await r.json();
      poll(id);
      onGenerated?.(); // já aparece como "na fila" no histórico
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.generic"));
      setStep("error");
    }
  }

  async function download(url: string) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `fastcloner-imagem-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  function reset() {
    // A referência FIXA fica (é o ponto do fluxo novo) — limpa só o resto.
    setStep("form");
    setResult(null);
    setError(null);
    setBlocked(null);
    setPrompt("");
    setIdea("");
    clearImages();
  }

  // ───── resultado ─────
  if (step === "done" && result?.image_url) {
    return (
      <section className="flex flex-col gap-5 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] p-6">
        <h2 className="text-xl font-semibold tracking-[-0.01em] text-[var(--ink)]">
          {t("result.title")}
        </h2>
        <div className="overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-card)]">
          {/* presigned R2 → <img> simples (sem config de domínio no next/image) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={result.image_url} alt={t("result.alt")} className="mx-auto max-h-[60vh] w-auto" />
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => download(result.image_url!)} className={PILL}>
            <Download className="h-4 w-4" />
            {t("result.download")}
          </button>
          {onAnimate && (
            <button type="button" onClick={() => onAnimate(result.id)} className={SECONDARY}>
              <Film className="h-4 w-4" />
              {t("result.animate")}
            </button>
          )}
          <button type="button" onClick={reset} className={SECONDARY}>
            {t("result.again")}
          </button>
        </div>
      </section>
    );
  }

  if (step === "submitting" || step === "polling") {
    return (
      <AudioGeneratingIndicator
        label={t("generating.label")}
        hint={t("generating.hint")}
      />
    );
  }

  // ───── formulário ─────
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Coluna 1 — referência FIXA (quadro principal) + fotos extras */}
      <div className="flex flex-col gap-2">
        <span className={LABEL}>
          {t("refs.fixedLabel")}
          <FieldHint text={t("refs.hint")} />
        </span>
        {/* input da FIXA (single) — troca a referência */}
        <input
          ref={replaceInputRef}
          type="file"
          accept={IMAGE_ACCEPT_WITH_HEIC}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFixed(f);
          }}
        />
        {/* input das EXTRAS (multiple) */}
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT_WITH_HEIC}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
          }}
        />

        {/* Quadro principal: a referência fixa mora aqui */}
        {fixedRef ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) void uploadFixed(f);
            }}
            className="relative flex min-h-[280px] items-center justify-center overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fixedRef.url}
              alt={t("refs.fixedBadge")}
              className="max-h-[360px] w-auto"
              onError={() => persistFixedRef(null)}
            />
            {fixedUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--canvas)]/60 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--silver)]" />
              </div>
            )}
            <span className="absolute left-2 top-2 rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)]/90 px-2 py-1 font-mono text-[10px] tracking-wide text-[var(--silver)]">
              {t("refs.fixedBadge")}
            </span>
            <button
              type="button"
              onClick={() => replaceInputRef.current?.click()}
              className="absolute bottom-2 right-2 inline-flex h-8 items-center gap-1.5 rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)]/90 px-3 font-mono text-[11px] tracking-wide text-[var(--ink)] transition-colors hover:border-[var(--hairline-bright)]"
            >
              <ImagePlus className="h-3.5 w-3.5" />
              {t("refs.replace")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
            }}
            className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--hairline-strong)] bg-[var(--surface-card)] p-8 text-center transition-colors hover:border-[var(--hairline-bright)] hover:bg-[var(--surface-elevated)]"
          >
            {fixedUploading ? (
              <Loader2 className="h-10 w-10 animate-spin text-[var(--silver)]" />
            ) : (
              <ImagePlus className="h-10 w-10 text-[var(--ash)]" />
            )}
            <span className="text-sm text-[var(--mute)]">
              {t("refs.dropzone")}
            </span>
            <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
              {t("refs.formats", { max: MAX_IMAGES })}
            </span>
          </button>
        )}

        <p className="text-[12px] leading-snug text-[var(--ash)]">
          {t("refs.historyTip")}
        </p>

        {/* Fotos extras (opcionais — melhoram a semelhança) */}
        <span className={`${LABEL} mt-2`}>{t("refs.extrasLabel")}</span>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
          }}
          className="grid grid-cols-3 gap-2 rounded-[var(--radius-lg)] border border-[var(--hairline-strong)] bg-[var(--surface-card)] p-3 sm:grid-cols-4"
        >
          {refs.map((r) => (
            <div
              key={r.id}
              className="relative aspect-square overflow-hidden rounded-[var(--radius)] border border-[var(--hairline)] bg-[var(--surface-deep)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.preview} alt="" className="h-full w-full object-cover" />
              {r.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--canvas)]/60 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--silver)]" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeRef(r.id)}
                aria-label={t("refs.remove")}
                className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--hairline-strong)] bg-[var(--surface-raised)]/90 text-[var(--mute)] transition-colors hover:text-[var(--ink)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              {r.key && !r.uploading && (
                <button
                  type="button"
                  onClick={() => promoteRef(r.id)}
                  className="absolute inset-x-0 bottom-0 bg-[var(--canvas)]/85 px-1 py-1 text-center font-mono text-[9px] tracking-wide text-[var(--silver)] backdrop-blur-sm transition-colors hover:text-[var(--ink)]"
                >
                  {t("refs.promote")}
                </button>
              )}
            </div>
          ))}
          {refs.length < MAX_EXTRAS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t("refs.addMore")}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius)] border border-dashed border-[var(--hairline-strong)] text-[var(--ash)] transition-colors hover:border-[var(--hairline-bright)] hover:text-[var(--silver)]"
            >
              <ImagePlus className="h-5 w-5" />
              <span className="font-mono text-[9px]">
                {refs.length + (fixedRef ? 1 : 0)}/{MAX_IMAGES}
              </span>
            </button>
          )}
        </div>

        {/* Upload em lote vai pro BANCO — aqui só o andamento e o aviso. */}
        {bankUpload && (
          <div className="flex items-center gap-2 text-[var(--mute)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="font-mono text-[11px]">
              {t("refs.bankUploading", {
                done: Math.min(bankUpload.done + 1, bankUpload.total),
                total: bankUpload.total,
              })}
            </span>
          </div>
        )}
        {!bankUpload && bankSaved > 0 && (
          <p className="text-[12px] leading-snug text-[var(--silver)]">
            {t("refs.bankSaved", { count: bankSaved })}
          </p>
        )}
      </div>

      {/* Coluna 2 — prompt + opções */}
      <div className="flex flex-col gap-5">
        {/* Ideia → prompt automático */}
        <div className="flex flex-col gap-2">
          <span className={LABEL}>
            {t("idea.label")}
            <FieldHint text={t("idea.hint")} />
          </span>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            maxLength={IDEA_MAX}
            rows={2}
            placeholder={t("idea.placeholder")}
            className="resize-none rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
          />
          <button
            type="button"
            onClick={autoPrompt}
            disabled={!idea.trim() || genPrompting}
            className={`${SECONDARY} w-fit`}
          >
            {genPrompting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {genPrompting ? t("idea.generatingBtn") : t("idea.generateBtn")}
          </button>
        </div>

        {/* Prompt final */}
        <div className="flex flex-col gap-2">
          <span className={LABEL}>
            {t("prompt.label")}
            <FieldHint text={t("prompt.hint")} />
          </span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            maxLength={PROMPT_MAX}
            rows={4}
            placeholder={t("prompt.placeholder")}
            className="resize-none rounded-[var(--radius)] border border-[var(--hairline-strong)] bg-[var(--surface-deep)] px-3 py-3 text-sm text-[var(--ink)] placeholder:text-[var(--ash)] focus-visible:border-[var(--hairline-bright)] focus-visible:outline-none"
          />
          <span className="self-end font-mono text-[10px] tabular-nums text-[var(--ash)]">
            {prompt.length} / {PROMPT_MAX}
          </span>
        </div>

        {/* Proporção */}
        <div className="flex flex-col gap-2">
          <span className={LABEL}>
            {t("aspect.label")}
            <FieldHint text={t("aspect.hint")} />
          </span>
          <div className="flex flex-wrap gap-2">
            {ASPECT_RATIOS.map((a) => (
              <button
                key={a.value}
                type="button"
                title={t(`aspect.hints.${a.value.replace(":", "x")}`)}
                onClick={() => setAspect(a.value)}
                className={[
                  "rounded-[var(--radius)] border px-3 py-2 text-[13px] font-medium transition-colors",
                  aspect === a.value
                    ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                    : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--mute)] hover:border-[var(--hairline-bright)] hover:text-[var(--ink)]",
                ].join(" ")}
              >
                {t(`aspect.options.${a.value.replace(":", "x")}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Resolução */}
        <div className="flex flex-col gap-2">
          <span className={LABEL}>
            {t("resolution.label")}
            <FieldHint text={t("resolution.hint")} />
          </span>
          <div className="flex flex-wrap gap-2">
            {RESOLUTIONS.map((r) => {
              const allowedByAspect = allowedResolutions(aspect).includes(r.value);
              const affordable = affordableResolution(r.value);
              const allowed = allowedByAspect && affordable;
              const selected = resolution === r.value;
              const title = !allowedByAspect
                ? t("resolution.unavailable")
                : !affordable
                  ? t("resolution.needCredits", { credits: r.credits, resolution: r.value })
                  : t(`resolution.hints.${r.value}`);
              return (
                <button
                  key={r.value}
                  type="button"
                  disabled={!allowed}
                  title={title}
                  onClick={() => setResolution(r.value)}
                  className={[
                    "flex items-center gap-2 rounded-[var(--radius)] border px-3 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    selected
                      ? "border-[var(--hairline-bright)] bg-[var(--surface-elevated)] text-[var(--ink)]"
                      : "border-[var(--hairline-strong)] bg-[var(--surface-card)] text-[var(--mute)] hover:border-[var(--hairline-bright)] hover:text-[var(--ink)]",
                  ].join(" ")}
                >
                  {r.label}
                  <span className="font-mono text-[10px] text-[var(--ash)]">
                    {r.credits} cr
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {blocked && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-[var(--radius)] border border-[var(--status-error)]/40 bg-[var(--surface-card)] px-3.5 py-3"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-error)]" />
            <p className="text-[13px] leading-snug text-[var(--body)]">{blocked}</p>
          </div>
        )}

        {error && <SupportError action={t("supportAction")} message={error} />}

        <PaywallModal
          open={noCredits}
          onClose={() => setNoCredits(false)}
          subscribed={subscribed}
          action={t("paywallAction")}
          detail={paywallDetail}
        />

        {/* Gerar */}
        <div className="flex flex-col gap-2">
          {/* Aviso PERSISTENTE (não é toast): a pessoa subiu foto pro banco
              nesta sessão e ela NÃO está no quadro — a geração sai sem ela.
              Some sozinho quando a foto entra no quadro (principal ou extra). */}
          {bankPendingCount > 0 && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-[var(--radius)] border border-[var(--status-warn)]/40 bg-[var(--surface-card)] px-3.5 py-3"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warn)]" />
              <p className="text-[13px] leading-snug text-[var(--body)]">
                {fixedRef && <>{t("refs.usingNow", { extras: extrasCount })} </>}
                {t("refs.savedNotInBoard", { pending: bankPendingCount })}
              </p>
            </div>
          )}
          <button type="button" onClick={handleGenerate} disabled={!canSubmit} className={PILL}>
            <Wand2 className="h-4 w-4" />
            {hasMinCredits ? t("submit.generate", { cost }) : t("submit.insufficient")}
          </button>
          {!unlimited &&
            (hasMinCredits ? (
              <span className="font-mono text-[10px] tracking-wide text-[var(--ash)]">
                {t("submit.balance", { credits: creditsTotal.toLocaleString("pt-BR"), cost })}
              </span>
            ) : (
              <span className="text-[12px] leading-snug text-[var(--mute)]">
                {t("submit.minNotice", {
                  credits: creditsTotal.toLocaleString("pt-BR"),
                  min: IMAGE_MIN_CREDITS,
                })}{" "}
                <Link
                  href="/app/credits"
                  className="font-medium text-[var(--ink)] underline underline-offset-2 hover:text-white"
                >
                  {t("submit.buyCredits")}
                </Link>
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}
