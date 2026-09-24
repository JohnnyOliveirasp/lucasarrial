/**
 * Hashes de CONTEÚDO do dedupe dos Trial Reels (regra 4 de
 * trial-guardrails-pure.ts). Ficam FORA do módulo puro porque precisam de
 * node:crypto e de rede — a decisão em si continua pura e só compara strings.
 *
 * Os dois hashes são gravados em publications.platform_options
 * (video_sha256 / caption_hash) pelo publisher, no MESMO patch que confirma
 * o envio (trial_sent_at) — sem migration.
 */
import { createHash } from "node:crypto";
// Import RELATIVO com extensão (não alias @/) de propósito: assim este módulo
// roda direto no `node --test` junto com o teste dos guardrails.
import { normalizarLegenda } from "./trial-guardrails-pure.ts";

/**
 * sha256 hex da legenda NORMALIZADA (regra 4b). Legenda vazia (ou que vira
 * vazia após a normalização) → null: sem legenda não há o que deduplicar.
 */
export function hashLegenda(caption: string | null | undefined): string | null {
  const normalizada = normalizarLegenda(caption);
  if (!normalizada) return null;
  return createHash("sha256").update(normalizada, "utf8").digest("hex");
}

/**
 * sha256 hex do ARQUIVO apontado pela URL (regra 4a), em STREAMING — o vídeo
 * é baixado UMA única vez e os bytes são descartados conforme entram no hash
 * (nada de carregar o arquivo inteiro em memória). O publisher chama isto com
 * a MESMA URL resolvida (presigned) que vai pro createContainer, então o
 * custo extra é um único GET nosso; a Meta baixa o dela por conta própria.
 *
 * FAIL-OPEN de propósito: qualquer falha (rede, 4xx/5xx, corpo ausente)
 * retorna null em vez de lançar — bloquear a publicação do aluno porque o
 * NOSSO hasher soluçou seria pior que pular a checagem por vídeo (legenda e
 * media_url continuam deduplicando).
 */
export async function sha256DeUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) return null;
    const hash = createHash("sha256");
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hash.update(value);
    }
    return hash.digest("hex");
  } catch {
    return null;
  }
}
