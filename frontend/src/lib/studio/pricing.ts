/**
 * Vídeo Estúdio F5 — preços em créditos (client-safe, sem deps de servidor).
 * Método Vídeo Clone: custo real medido × margem ~100% (2×).
 * Crédito da plataforma ≈ R$0,000539 (R$97/180.000).
 *
 * Custos medidos 2026-07-10:
 *   roteiro ~R$0,09 (Sonnet) · cena nova ~R$0,50 (Kie: still gpt-image-2 +
 *   grok 5s) · rosto Turbo R$0,0275/s de áudio · montagem ~R$0,05 (GPU vox).
 * A limpeza (F0) fica em STUDIO_CLEAN_COST no lib/credits/config.ts.
 */
import { cloneCreditsCost, getCloneTier } from "@/lib/video-clone/config";

/** Roteiro documentário viral (1 chamada Sonnet). R$0,09 × 2 ≈ 334 → 300. */
export const STUDIO_SCRIPT_COST = 300;

/** Cena NOVA de b-roll (still + animação). R$0,50 × 2 ≈ 1855 → 1800.
 *  Cena reusada do banco pessoal = GRÁTIS (promessa do produto). */
export const STUDIO_SCENE_COST = 1_800;

/** Montagem final (J-cut + legenda + música, GPU vox). R$0,05 × 2 → 200. */
export const STUDIO_MONTAGE_COST = 200;

/** Rosto: mesmo motor e MESMO preço/s do Vídeo Clone Turbo (105 cr/s). */
export const STUDIO_FACE_TIER_ID = "480p-v2";

export type StudioWord = { start: number; end: number; word: string };

/** Frases com timestamps — MESMA segmentação do worker (pontuação forte fecha). */
export function sentencesWithTimes(
  words: StudioWord[],
): { start: number; end: number; text: string }[] {
  const sents: { start: number; end: number; text: string }[] = [];
  let cur: StudioWord[] = [];
  for (const w of words) {
    cur.push(w);
    if (/[.!?…]$/.test(w.word.trim())) {
      sents.push({
        start: cur[0].start,
        end: cur[cur.length - 1].end,
        text: cur.map((x) => x.word.trim()).join(" "),
      });
      cur = [];
    }
  }
  if (cur.length) {
    sents.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text: cur.map((x) => x.word.trim()).join(" "),
    });
  }
  return sents;
}

/**
 * Custo do rosto (F4) pra ESTA transcrição: hook (1ª frase) + fechamento
 * (última), cobrados como no Vídeo Clone Turbo (por segundo, mínimo 5s).
 * Mesma conta no gate do servidor e na estimativa da UI — nunca diverge.
 */
export function studioFaceCost(words: StudioWord[]): number {
  const sents = sentencesWithTimes(words);
  if (sents.length === 0) return 0;
  const tier = getCloneTier(STUDIO_FACE_TIER_ID);
  if (!tier) return 0;
  const anchors = sents.length > 1 ? [sents[0], sents[sents.length - 1]] : [sents[0]];
  return anchors.reduce((sum, s) => sum + cloneCreditsCost(tier, s.end - s.start + 0.05), 0);
}
