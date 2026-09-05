/**
 * Fase corrente do worker → banco (incidente d3d8d1b2, chamado #15). Server-only.
 *
 * O problema: jobs de geração que estouram o executionTimeout morrem por
 * SIGKILL. O heartbeat do worker (e91b7ce) nomeia a fase pendurada no STDOUT,
 * mas esse log só existe no console da RunPod e o status do job devolve 404
 * minutos depois do fim — quando alguém investiga, a fase já se perdeu.
 *
 * A solução: o app injeta `fase_url` + `fase_token` + `fase_ref` no INPUT do
 * job de inferência; a thread de heartbeat do worker POSTa a fase corrente pra
 * /api/v1/webhooks/runpod-fase a cada ~30s e a rota grava em
 * generations.qa.fase_corrente (jsonb existente — SEM migration). Na próxima
 * falha por timeout, a row da geração diz qual fase pendurou.
 *
 * Segurança: o token é HMAC-SHA256(FASE_TELEMETRIA_SECRET, generationId) —
 * por-job, mesmo modelo de confiança das presigned URLs que já viajam no
 * input.
 *
 * ⚠️ O SILÊNCIO JÁ CUSTOU UMA RONDA (28/08, chamado #15). Sem a env
 * FASE_TELEMETRIA_SECRET a feature fica desligada, e até aqui ela ficava
 * desligada SEM DIZER NADA: o código foi mergeado em 25/08 (b9bc646/1c72d77),
 * ninguém setou a env, e durante 4 dias o app seguiu injetando `{}` no input
 * enquanto todo mundo achava que a instrumentação estava no ar. Medido em
 * 28/08: `qa.fase_corrente` presente em **0 de 322** gerações de 3 dias
 * (a coluna `qa` em si estava preenchida em 259 — não era a coluna, era a
 * fase que nunca chegava). Uma falha por timeout do Victor às 18:16Z passou
 * por aqui e morreu sem dizer a fase, que é exatamente o que esta feature
 * existe pra evitar.
 *
 * Por isso `faseTelemetriaMotivoDesligada()` existe: desligado continua sendo
 * o default seguro, mas agora ele é AUDÍVEL — quem chama loga o motivo com o
 * nome da env que falta, uma vez por processo. Feature de telemetria que
 * falha em silêncio não é telemetria, é a ilusão dela.
 *
 * Tudo aqui é telemetria: nenhum caminho pode derrubar submit, webhook ou
 * estorno.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function secret(): string | null {
  const s = process.env.FASE_TELEMETRIA_SECRET;
  return s && s.length >= 16 ? s : null;
}

/** Token por-geração. null = feature desligada (env ausente/curta demais). */
export function faseTelemetriaToken(generationId: string): string | null {
  const s = secret();
  if (!s) return null;
  return createHmac("sha256", s).update(generationId).digest("hex");
}

/** Base pública do app, ou null. Mesma precedência do `webhookUrlFor` do
 * RunPod (`lib/runpod/client.ts:183`) — de propósito: o webhook de conclusão
 * comprovadamente chega em produção (medido 28/08: 28 de 32 falhas em 10 dias
 * entraram pelo webhook cru, só 4 pelo poll), então essa precedência resolve
 * pra uma URL alcançável no ambiente real. Não mexer nela aqui sem mexer lá. */
function baseUrl(): string | null {
  return process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || null;
}

/**
 * Por que a telemetria de fase está desligada, ou `null` quando está ligada.
 *
 * Existe para que o estado OFF seja audível (ver o cabeçalho do arquivo).
 * É pura e sem dependência de logger de propósito: o arquivo roda sob
 * `node --test` com type-stripping, e importar `@/lib/logger/server` aqui
 * quebraria o teste pelo alias `@/`. Quem chama é que loga.
 *
 * O motivo nomeia a ENV que falta, porque "telemetria desligada" sem o nome
 * da variável obriga quem lê o log a vir ler este arquivo pra agir.
 */
export function faseTelemetriaMotivoDesligada(): string | null {
  try {
    const temSecret = !!secret();
    const temBase = !!baseUrl();
    if (temSecret && temBase) return null;
    if (!temSecret && !temBase) {
      return "FASE_TELEMETRIA_SECRET (ausente ou <16 chars) e NEXT_PUBLIC_SITE_URL/SITE_URL ausentes";
    }
    if (!temSecret) return "FASE_TELEMETRIA_SECRET ausente ou com menos de 16 chars";
    return "NEXT_PUBLIC_SITE_URL/SITE_URL ausentes — sem destino pro heartbeat";
  } catch {
    return "erro ao ler as envs da telemetria de fase";
  }
}

/**
 * Chaves extras pro input do job de inferência. `{}` quando a feature está
 * desligada — o input fica idêntico ao de hoje e o worker não posta nada.
 *
 * ⚠️ O worker DESCARTA a config se a url não começar com `https://`
 * (`runpod-worker/worker_log.py:_fase_cfg_from_input`), e descarta em
 * silêncio. Logo: `{}` aqui e uma base `http://` lá dão no mesmo resultado
 * (zero fase gravada) por dois motivos diferentes. `faseTelemetriaMotivoDesligada`
 * cobre o primeiro; o segundo está anotado aqui pra ninguém perder a próxima
 * meia-hora com ele.
 */
export function faseTelemetriaInput(generationId: string): Record<string, string> {
  try {
    const token = faseTelemetriaToken(generationId);
    const base = baseUrl();
    if (!token || !base) return {};
    return {
      fase_url: `${base.replace(/\/$/, "")}/api/v1/webhooks/runpod-fase`,
      fase_token: token,
      fase_ref: generationId,
    };
  } catch {
    return {}; // telemetria nunca derruba o submit
  }
}

/** Validação timing-safe do token que o worker devolve no POST. */
export function faseTokenValido(generationId: string, token: unknown): boolean {
  try {
    const esperado = faseTelemetriaToken(generationId);
    if (!esperado || typeof token !== "string") return false;
    const a = Buffer.from(esperado, "utf-8");
    const b = Buffer.from(token, "utf-8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export type FaseCorrente = {
  fase: string;
  running_s: number | null;
  job_type: string | null;
  visto_em: string; // ISO — quando o app RECEBEU o heartbeat
};

/** Merge puro: qa com fase_corrente atualizada, sem perder as outras chaves. */
export function qaComFase(
  qaAtual: Record<string, unknown> | null,
  fase: FaseCorrente,
): Record<string, unknown> {
  return { ...(qaAtual ?? {}), fase_corrente: fase };
}

/**
 * Preserva qa.fase_corrente quando o caminho de falha REESCREVE a coluna qa
 * (handleGenerationWebhook grava `qa: qaTelemetria(out)`, e num timeout o
 * `out` vem vazio — sem isto, a falha apagaria exatamente a fase que a
 * telemetria existe pra guardar). Sem fase gravada, devolve `qaNovo` intacto:
 * comportamento idêntico ao de hoje.
 */
export function preservaFaseCorrente(
  qaNovo: Record<string, unknown> | null,
  qaAtual: unknown,
): Record<string, unknown> | null {
  const fase =
    qaAtual && typeof qaAtual === "object" && !Array.isArray(qaAtual)
      ? (qaAtual as Record<string, unknown>).fase_corrente
      : undefined;
  if (fase === undefined) return qaNovo;
  return { ...(qaNovo ?? {}), fase_corrente: fase };
}

/** Falha de timeout: cobre o erro cru do webhook ("executionTimeout exceeded")
 * e o embrulhado do poll ("RunPod TIMED_OUT: ..."). */
const TIMEOUT_RE = /executiontimeout|timed_out/i;

/**
 * error_message da falha com a última fase conhecida NO TEXTO, pro humano que
 * abre a row (ex.: "executionTimeout exceeded [fase: geracao.chunk running_s=430]").
 *
 * REGRA que torna isto seguro: a assinatura de incidente
 * (lib/incidents/classify.ts) REMOVE o sufixo "[fase: ...]" antes de assinar —
 * sem isso, fases diferentes estilhaçariam o d3d8d1b2 em N incidentes (a
 * patologia do "detector cego" medida em 24/08). Qualquer mudança no FORMATO
 * do sufixo aqui exige a mudança gêmea no stripFaseSuffix de lá.
 *
 * Só decora timeout (a fase pendurada é a informação); nos demais erros o
 * worker já disse o que quebrou. Sem fase gravada, devolve o texto de hoje.
 */
export function errorMessageComFase(rawError: string, qaAtual: unknown): string {
  const base = (rawError || "").slice(0, 500);
  try {
    if (!TIMEOUT_RE.test(base)) return base;
    const fase =
      qaAtual && typeof qaAtual === "object" && !Array.isArray(qaAtual)
        ? ((qaAtual as Record<string, unknown>).fase_corrente as FaseCorrente | undefined)
        : undefined;
    if (!fase || typeof fase.fase !== "string" || !fase.fase) return base;
    // Sem "[" nem "]" dentro do sufixo: o strip da assinatura casa até o 1º "]".
    const nome = fase.fase.replace(/[[\]]/g, "").slice(0, 80);
    const running =
      typeof fase.running_s === "number" && Number.isFinite(fase.running_s)
        ? ` running_s=${Math.round(fase.running_s)}`
        : "";
    return `${base} [fase: ${nome}${running}]`;
  } catch {
    return base; // telemetria nunca derruba o caminho de falha/estorno
  }
}
