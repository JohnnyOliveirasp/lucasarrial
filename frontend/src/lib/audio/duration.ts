/**
 * Mede duração de arquivo de áudio no browser. Roda só no client.
 *
 * Ordem (caso duoclinicsalto 06/08): 1º metadados via <audio> — lê só o
 * cabeçalho, instantâneo e sem custo de memória. decodeAudioData ficava com
 * o arquivo INTEIRO decodificado em PCM na RAM (~300-600MB pra 30min de
 * m4a) e falhava/travava → total 00:00 e botão Treinar nunca habilitava.
 * O decode completo fica só de fallback (webm/opus do MediaRecorder não
 * informa duração no cabeçalho e reporta Infinity no <audio>).
 * ESSA ORDEM NÃO MUDOU e não deve mudar.
 *
 * O que mudou (incidente #203, Jussara, 31/08): a falha agora DIZ POR QUÊ.
 * Antes toda falha virava `null` — timeout, codec que o navegador não abre e
 * decode estourado eram indistinguíveis, e a tela renderizava esse null como
 * "medindo…" pra sempre. O aluno ficava num beco sem saída: sem erro, sem
 * total e com o botão Treinar morto. `medirDuracao` devolve o motivo; quem
 * chama decide o que mostrar e o que registrar.
 */

/** Por que a medição não deu certo. Vai pra tela e pra telemetria. */
export type MotivoFalhaMedicao =
  /** `preload="metadata"` não respondeu dentro de METADATA_TIMEOUT_MS. */
  | "timeout"
  /** O <audio> disparou onerror: container/codec que este navegador não abre. */
  | "erro-do-audio"
  /** Metadados carregaram, mas a duração veio 0/NaN/Infinity. */
  | "sem-duracao"
  /** O fallback decodeAudioData rejeitou (arquivo corrompido ou grande demais). */
  | "decode-falhou"
  /** Navegador sem AudioContext (nem o fallback existe). */
  | "sem-audiocontext"
  /** Chamado fora do browser (SSR) — não é falha do arquivo. */
  | "fora-do-browser"
  /** Exceção inesperada em quem chamou. Existe pra que NENHUM caminho volte
   *  ao limbo de "medindo…" — todo tropeço tem que ter um desfecho nomeado. */
  | "excecao";

export type MedicaoAudio =
  | { ok: true; segundos: number; via: "metadata" | "decode" }
  | {
      ok: false;
      motivo: MotivoFalhaMedicao;
      /** Motivo da 1ª tentativa (metadados), quando o decode também falhou. */
      motivoMetadata?: MotivoFalhaMedicao;
    };

/**
 * 8s. Mantido igual ao original de propósito: mexer nesse número sem medir a
 * causa real só troca um sintoma por outro. Quem estoura o prazo agora aparece
 * como "timeout" na telemetria — é assim que a gente vai descobrir se ele é
 * curto demais, em vez de chutar.
 */
const METADATA_TIMEOUT_MS = 8000;

/** Mede a duração dizendo, quando falha, POR QUÊ falhou. */
export async function medirDuracao(file: File): Promise<MedicaoAudio> {
  if (typeof window === "undefined") return { ok: false, motivo: "fora-do-browser" };

  const viaMetadata = await metadataDuration(file);
  if (viaMetadata.ok) return viaMetadata;

  // Fallback: decode completo. Só chega aqui quem não tem duração no
  // cabeçalho (webm/opus do MediaRecorder é o caso legítimo).
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) {
    return {
      ok: false,
      motivo: "sem-audiocontext",
      motivoMetadata: viaMetadata.motivo,
    };
  }

  try {
    const buffer = await file.arrayBuffer();
    const ctx = new AudioCtx();
    try {
      const decoded = await ctx.decodeAudioData(buffer.slice(0));
      if (!Number.isFinite(decoded.duration) || decoded.duration <= 0) {
        return {
          ok: false,
          motivo: "sem-duracao",
          motivoMetadata: viaMetadata.motivo,
        };
      }
      return { ok: true, segundos: decoded.duration, via: "decode" };
    } finally {
      // Best-effort close — Safari não suporta close em alguns casos
      try {
        await ctx.close();
      } catch {
        /* ignore */
      }
    }
  } catch {
    return {
      ok: false,
      motivo: "decode-falhou",
      motivoMetadata: viaMetadata.motivo,
    };
  }
}

/**
 * Compatibilidade: `null` em qualquer falha.
 *
 * Continua existindo para o fluxo do SGP (step-audio-form), onde o servidor
 * mede com ffmpeg e a medição do browser é só atalho de UX — lá o `null`
 * SOBE e quem julga é o servidor, então o motivo não muda decisão nenhuma.
 * No treino de voz (voice-creator) NÃO use esta: o servidor daquele fluxo
 * não mede nada, o `null` é load-bearing e precisa do motivo.
 */
export async function measureAudioDuration(file: File): Promise<number | null> {
  const r = await medirDuracao(file);
  return r.ok ? r.segundos : null;
}

/** Duração pelos metadados (preload="metadata"), com o motivo em caso de falha. */
function metadataDuration(file: File): Promise<MedicaoAudio> {
  return new Promise((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    let settled = false;
    const done = (r: MedicaoAudio) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      resolve(r);
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () =>
      done(
        Number.isFinite(audio.duration) && audio.duration > 0
          ? { ok: true, segundos: audio.duration, via: "metadata" }
          : { ok: false, motivo: "sem-duracao" },
      );
    audio.onerror = () => done({ ok: false, motivo: "erro-do-audio" });
    // Declarado depois de `done` (que o usa) mas ANTES de `audio.src`: nenhum
    // handler pode disparar antes daqui, então não há uso antes da atribuição.
    const timer = setTimeout(() => done({ ok: false, motivo: "timeout" }), METADATA_TIMEOUT_MS);
    audio.src = url;
  });
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
