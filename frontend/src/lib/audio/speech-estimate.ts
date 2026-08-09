/**
 * Estimativa de FALA APROVEITÁVEL num áudio, via ffmpeg `silencedetect`.
 * Server-only.
 *
 * Por quê (bug 08/08): a tela exige 20min BRUTOS, mas o worker exige 10min de
 * fala LIMPA (pós Demucs+VAD, TRAIN_MIN_USEFUL_SECONDS). Quem manda 25min com
 * muita pausa/ruído rendia ~5min úteis e só descobria DEPOIS da fila + GPU —
 * prof.pinheirofilho falhou 3× e desistiu; ivanildezuca 2× e desistiu (42% dos
 * treinos do dia reprovaram assim). Aqui medimos ANTES de cobrar e despachar.
 *
 * A conta é energia (não-silêncio), então é um TETO: o VAD do worker só pode
 * descartar MAIS que isso. Logo, estimativa < mínimo ⇒ reprovação garantida —
 * seguro pra bloquear. Perto do limite a gente só avisa, nunca bloqueia.
 *
 * ffmpeg lê a URL presignada direto (sem baixar pro disco) e o parse é do
 * stderr: linhas `silence_duration: N` + o `Duration:` do cabeçalho.
 */
import { spawn } from "node:child_process";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
/** Silêncio = abaixo disso por >= 0,4s. -35dB pega pausa real sem cortar fala baixa. */
const NOISE_DB = "-35dB";
const MIN_SILENCE_S = "0.4";
/** Teto de tempo por arquivo e no total — a checagem nunca pode travar o aluno. */
const PER_FILE_TIMEOUT_MS = 45_000;
const TOTAL_TIMEOUT_MS = 90_000;
/** Não analisa a lista inteira se a pessoa mandou dezenas de takes. */
const MAX_FILES = 12;

export type SpeechEstimate = {
  /** Segundos de fala estimados (soma dos arquivos analisados). */
  speechSeconds: number;
  /** Segundos totais de áudio analisado. */
  totalSeconds: number;
  /** false = a medição falhou/expirou; NÃO usar pra bloquear ninguém. */
  reliable: boolean;
};

function parseDurationLine(stderr: string): number {
  // "  Duration: 00:24:31.20, start: ..."
  const m = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

function sumSilence(stderr: string): number {
  let total = 0;
  for (const m of stderr.matchAll(/silence_duration:\s*(\d+(?:\.\d+)?)/g)) {
    total += Number(m[1]);
  }
  return total;
}

/** Roda o silencedetect num arquivo. Retorna null se falhar/expirar. */
function analyzeOne(url: string, timeoutMs: number): Promise<{ speech: number; total: number } | null> {
  return new Promise((resolve) => {
    const proc = spawn(FFMPEG, [
      "-hide_banner",
      "-nostdin",
      "-i", url,
      "-map", "0:a:0",
      "-af", `silencedetect=noise=${NOISE_DB}:d=${MIN_SILENCE_S}`,
      "-f", "null",
      "-",
    ]);
    let stderr = "";
    let done = false;
    const finish = (v: { speech: number; total: number } | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        proc.kill("SIGKILL");
      } catch {
        /* já morreu */
      }
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    proc.stderr.on("data", (d) => {
      stderr += String(d);
      // Cabeçalho + linhas de silêncio bastam; evita segurar log gigante.
      if (stderr.length > 2_000_000) stderr = stderr.slice(-1_000_000);
    });
    proc.on("error", () => finish(null));
    proc.on("close", (code) => {
      if (code !== 0) return finish(null);
      const total = parseDurationLine(stderr);
      if (!(total > 0)) return finish(null);
      const speech = Math.max(0, total - sumSilence(stderr));
      finish({ speech, total });
    });
  });
}

/**
 * Estima a fala aproveitável somando os arquivos (URLs presignadas).
 * Qualquer falha derruba `reliable` — quem chama deve liberar em caso de dúvida.
 */
export async function estimateSpeechSeconds(urls: string[]): Promise<SpeechEstimate> {
  const list = urls.slice(0, MAX_FILES);
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let speechSeconds = 0;
  let totalSeconds = 0;
  let reliable = list.length > 0 && list.length === urls.length;

  for (const url of list) {
    const left = deadline - Date.now();
    if (left <= 1000) {
      reliable = false;
      break;
    }
    const r = await analyzeOne(url, Math.min(PER_FILE_TIMEOUT_MS, left));
    if (!r) {
      reliable = false;
      break;
    }
    speechSeconds += r.speech;
    totalSeconds += r.total;
  }

  return {
    speechSeconds: Math.round(speechSeconds),
    totalSeconds: Math.round(totalSeconds),
    reliable,
  };
}
