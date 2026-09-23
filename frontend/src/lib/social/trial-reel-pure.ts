/**
 * Trial Reels do Instagram — validação e montagem do trial_params (22/09).
 *
 * PROVADO CONTRA A META EM PRODUÇÃO (22/09, conta @johnny.oliveira.ai), com
 * controle de três vias na v23.0 via graph.instagram.com — a MESMA versão e
 * host que já usamos (instagram.ts):
 *   trial_params={"graduation_strategy":"MANUAL"}  → HTTP 200
 *   graduation_strategy="BANANA_VOADORA"           → HTTP 400 "Unknown Trial
 *                                                    Reel Graduation Strategy"
 *   trial_params="isso-nao-e-json"                 → HTTP 400 "Param
 *                                                    trial_params must be a
 *                                                    JSON object."
 *   parâmetro INVENTADO qualquer                   → HTTP 200 (ignorado)
 * A terceira via é o que dá valor às outras: a Meta ignora parâmetro
 * desconhecido em silêncio, e mesmo assim VALIDOU trial_params — logo ele é
 * real e suportado na v23.0. NÃO subir a versão, NÃO migrar pra Facebook
 * Login.
 *
 * O parâmetro não está na documentação oficial: veio do fonte do Postiz
 * (gitroomhq/postiz-app, instagram.provider.ts:710-717), que já publica trial
 * reels em produção. Regras que o Postiz aplica e a Meta cobra:
 *   - trial reel exige UM único vídeo (.mp4) — nada de carrossel;
 *   - graduation_strategy só aceita MANUAL ou SS_PERFORMANCE;
 *   - vai na MESMA chamada POST /{ig-user-id}/media do container de REELS.
 *
 * Módulo PURO de propósito (zero imports, zero alias @/): roda direto no
 * `node --test` e é a única fonte das regras — rota, publisher e instagram.ts
 * consomem daqui, ninguém duplica a lista de estratégias.
 */

export const GRADUATION_STRATEGIES = ["MANUAL", "SS_PERFORMANCE"] as const;
export type GraduationStrategy = (typeof GRADUATION_STRATEGIES)[number];

/** Default do Postiz e o mais conservador: só sobe pro perfil quando a pessoa mandar. */
export const DEFAULT_GRADUATION_STRATEGY: GraduationStrategy = "MANUAL";

export type TrialOptions = { graduationStrategy: GraduationStrategy };

export const ERRO_ESTRATEGIA =
  "Estratégia de graduação inválida. Use MANUAL (você decide quando o Reel vai pro perfil) ou SS_PERFORMANCE (o Instagram promove sozinho se performar).";
export const ERRO_UMA_MIDIA =
  "Trial Reel exige UM único vídeo. Carrossel ou múltiplas mídias não são aceitos pelo Instagram.";
export const ERRO_VIDEO =
  "Trial Reel só aceita vídeo (.mp4). Escolha um vídeo ou publique como Reel normal.";
export const ERRO_TIPO =
  "Trial só existe para Reel. Story e imagem não podem ser publicados como teste.";

export function ehEstrategiaValida(v: unknown): v is GraduationStrategy {
  return (
    typeof v === "string" && (GRADUATION_STRATEGIES as readonly string[]).includes(v)
  );
}

/** URL/chave termina em .mp4 (ignora querystring de URL assinada). */
export function ehVideoMp4(mediaUrl: string): boolean {
  const semQuery = mediaUrl.split(/[?#]/, 1)[0];
  return /\.mp4$/i.test(semQuery);
}

export type TrialValidacao =
  | { ok: true; strategy: GraduationStrategy }
  | { ok: false; erro: string };

/**
 * Valida um pedido de Trial Reel ANTES de qualquer chamada à Meta — recusa
 * nossa (400) com frase em português, sem gastar chamada.
 *
 * `graduationStrategy` ausente/null → default MANUAL (item 5 do card).
 */
export function validarTrialReel(input: {
  kind: string;
  mediaUrls: string[];
  graduationStrategy?: string | null;
}): TrialValidacao {
  if (input.kind !== "reel") return { ok: false, erro: ERRO_TIPO };
  if (input.mediaUrls.length !== 1) return { ok: false, erro: ERRO_UMA_MIDIA };
  if (!ehVideoMp4(input.mediaUrls[0])) return { ok: false, erro: ERRO_VIDEO };
  const strategy = input.graduationStrategy ?? DEFAULT_GRADUATION_STRATEGY;
  if (!ehEstrategiaValida(strategy)) return { ok: false, erro: ERRO_ESTRATEGIA };
  return { ok: true, strategy };
}

/**
 * O VALOR do trial_params, byte a byte como o Postiz manda e a Meta aceitou
 * no teste de 22/09: {"graduation_strategy":"MANUAL"|"SS_PERFORMANCE"}.
 *
 * ⚠️ SEM validação AQUI, de propósito: esta função é só a montagem. Quem
 * barra valor inválido é a guarda em instagram.ts/na rota (validarTrialReel /
 * ehEstrategiaValida). O teste de MUTAÇÃO usa exatamente isso pra provar que,
 * sem a guarda, lixo chegaria na Meta — se alguém "simplificar" removendo a
 * guarda, o teste 7 acusa.
 */
export function montarTrialParams(strategy: string): string {
  return JSON.stringify({ graduation_strategy: strategy });
}
