/**
 * /admin/sgp — QUAL material entra no painel "o que já foi gerado" de um aluno.
 *
 * Pedido do Lucas (recado 5): hoje, pra saber se a voz da pessoa saiu e como
 * ficou a foto, o atendente sai da tela e vai perguntar pra alguém. O painel
 * abre embaixo da linha e responde ali.
 *
 * ⚠️ MÓDULO PURO E SEPARADO pelo mesmo motivo de `previa-pure.ts`: "qual linha
 * pode aparecer" é a parte que erra feio e caro, e o resto (`geracoes.ts`)
 * importa Supabase e R2, que não sobem num `node --test`.
 *
 * ⚠️ A ARMADILHA, e ela é REAL — está medida no cabeçalho de `previa-pure.ts`:
 * filtrar só por `user_id` mistura o material DO PEDIDO com o que o aluno gerou
 * por conta própria depois. Num painel de suporte isso não vaza pra ninguém de
 * fora (a rota é `gateAdmin`), mas MENTE: o atendente leria "a voz do SGP ficou
 * pronta" olhando uma voz pessoal que o aluno treinou sozinho, e diria isso pro
 * aluno. Por isso a voz é presa ao `voice_id` DO PEDIDO e a imagem à marca do
 * avatar do onboarding — as mesmas duas travas da prévia do aluno.
 *
 * ⚠️ VÍDEO NÃO É ENTREGA DO SGP, e o painel precisa dizer isso. As etapas do SGP
 * são `recebido → foto → voz → pronto` (lib/sgp/etapas.ts): não existe passo de
 * vídeo. O que aparece na seção de vídeo é o que a pessoa fez na PLATAFORMA
 * depois de entrar — informação útil pro time ("ela já está usando o produto?"),
 * mas rotulada como tal. Chamar isso de "vídeo do SGP" seria inventar entrega.
 */

import { SGP_IDEA_AVATAR, SGP_NOME_AMOSTRA } from "./previa-pure.ts";

export { SGP_IDEA_AVATAR, SGP_NOME_AMOSTRA };

/** Teto do que o painel mostra. Quem for além é CONTADO, nunca sumido calado. */
export const MAX_IMAGENS = 12;
export const MAX_VIDEOS = 6;

function vazio(s: string | null | undefined): boolean {
  return typeof s !== "string" || s.trim() === "";
}

/** Mais recente primeiro, por data ISO. Sem data vai pro fim, nunca pro topo. */
function maisRecentePrimeiro(a: string | null | undefined, b: string | null | undefined): number {
  return (b ?? "").localeCompare(a ?? "");
}

// ──────────────────────── O STATUS EM LÍNGUA DE GENTE ────────────────────────
/**
 * Quem lê esta tela é o TIME DE SUPORTE, que não tem acesso ao código e vai
 * REPETIR pro aluno o que está escrito aqui. "awaiting_training" e "failed" não
 * são resposta pra dar pra ninguém — então o enum cru nunca chega na tela.
 *
 * Status desconhecido cai no próprio texto cru de propósito: inventar uma
 * tradução pra um estado que o sistema passou a emitir seria pior do que o
 * atendente ver algo estranho e perguntar.
 */
const VOZ_HUMANA: Record<string, string> = {
  uploading: "recebendo o áudio",
  validating: "conferindo o áudio",
  awaiting_training: "na fila pra treinar",
  rejected_too_short: "áudio curto demais — recusado",
  training: "treinando a voz",
  ready: "voz pronta",
  failed: "o treino falhou",
};

const VIDEO_HUMANO: Record<string, string> = {
  pending: "na fila",
  generating: "gerando",
  processing: "gerando",
  ready: "pronto",
  failed: "falhou",
};

export function vozLegivel(status: string | null | undefined): string {
  if (vazio(status)) return "desconhecido";
  return VOZ_HUMANA[status as string] ?? (status as string);
}

export function videoLegivel(status: string | null | undefined): string {
  if (vazio(status)) return "desconhecido";
  return VIDEO_HUMANO[status as string] ?? (status as string);
}

// ─────────────────────────────── A VOZ ───────────────────────────────

export type LinhaVoz = {
  id: string | null;
  user_id: string | null;
  status: string | null;
  trained_at?: string | null;
  created_at?: string | null;
  error_message?: string | null;
};

export type VozDoPedido = {
  status: string;
  /** `voices.trained_at`, ou a criação enquanto não treinou. Pode ser null. */
  data: string | null;
  /** O que o worker gravou quando falhou. `null` = não falhou (ou não disse). */
  erro: string | null;
};

/**
 * A voz DESTE pedido. `voiceId` é o `sgp_pedidos.voice_id` — sem ele não há voz
 * do pedido, e devolver "a voz mais recente do aluno" seria justamente a mentira
 * descrita no cabeçalho.
 *
 * A conferência de `user_id` é redundante com o `where` da consulta de propósito
 * (defesa em profundidade): se alguém afrouxar a query lá na frente, isto barra.
 */
export function vozDoPedido(
  userId: string | null,
  voiceId: string | null,
  linhas: readonly LinhaVoz[],
): VozDoPedido | null {
  if (vazio(userId) || vazio(voiceId)) return null;
  const achada = linhas.find((l) => l.user_id === userId && l.id === voiceId);
  if (!achada) return null;
  return {
    status: achada.status ?? "desconhecido",
    data: achada.trained_at ?? achada.created_at ?? null,
    erro: vazio(achada.error_message) ? null : (achada.error_message as string),
  };
}

// ────────────────────────────── AS IMAGENS ──────────────────────────────

export type LinhaImagemGerada = {
  id?: string | null;
  user_id: string | null;
  idea: string | null;
  status: string | null;
  image_path: string | null;
  created_at?: string | null;
};

export type ImagemDoPedido = { id: string | null; key: string; criadoEm: string | null };

/**
 * As imagens do clone deste aluno, da mais nova pra mais velha.
 *
 * É o `escolherImagem` da prévia com o plural que o painel pede: MESMO recorte
 * (avatar do onboarding, `ready`, do próprio aluno), várias linhas em vez de uma
 * — o time precisa ver as alternativas pra dizer ao aluno qual foi usada.
 *
 * Devolve também quantas existiam ao todo: teto que corta em silêncio faz o
 * atendente afirmar "só saíram 12" para quem tem 30.
 */
export function imagensDoPedido(
  userId: string | null,
  linhas: readonly LinhaImagemGerada[],
  max: number = MAX_IMAGENS,
): { itens: ImagemDoPedido[]; total: number } {
  if (vazio(userId)) return { itens: [], total: 0 };
  const validas = linhas.filter(
    (l) =>
      l.user_id === userId &&
      l.idea === SGP_IDEA_AVATAR &&
      l.status === "ready" &&
      !vazio(l.image_path),
  );
  const ordenadas = [...validas].sort((a, b) => maisRecentePrimeiro(a.created_at, b.created_at));
  return {
    total: ordenadas.length,
    itens: ordenadas.slice(0, Math.max(0, max)).map((l) => ({
      id: l.id ?? null,
      key: l.image_path as string,
      criadoEm: l.created_at ?? null,
    })),
  };
}

// ────────────────────────────── OS VÍDEOS ──────────────────────────────

/** De onde o vídeo veio. Decide o BUCKET, então não é enfeite de tela. */
export type OrigemVideo = "clone" | "heygen";

export type LinhaVideoClone = {
  id: string | null;
  user_id: string | null;
  name?: string | null;
  status: string | null;
  video_path: string | null;
  created_at?: string | null;
};

export type LinhaVideoHeygen = {
  id: string | null;
  user_id: string | null;
  title?: string | null;
  status: string | null;
  video_path: string | null;
  created_at?: string | null;
};

export type VideoDoAluno = {
  id: string | null;
  origem: OrigemVideo;
  nome: string | null;
  status: string;
  /** `null` quando não está `ready`: não há arquivo, e o painel diz o porquê. */
  key: string | null;
  criadoEm: string | null;
};

/**
 * Os vídeos que a pessoa tem NA PLATAFORMA (ver o ⚠️ do cabeçalho: isto não é
 * entrega do SGP).
 *
 * Os que FALHARAM entram na lista de propósito — sem link, com o status escrito.
 * Um vídeo que quebrou é exatamente o motivo de o aluno estar chamando o
 * suporte; escondê-lo deixaria o atendente com a tela dizendo "nada aqui"
 * enquanto o aluno reclama de um vídeo que ele viu quebrar.
 */
export function videosDoAluno(
  userId: string | null,
  clones: readonly LinhaVideoClone[],
  heygen: readonly LinhaVideoHeygen[],
  max: number = MAX_VIDEOS,
): { itens: VideoDoAluno[]; total: number } {
  if (vazio(userId)) return { itens: [], total: 0 };

  const todos: VideoDoAluno[] = [
    ...clones
      .filter((l) => l.user_id === userId)
      .map((l) => ({
        id: l.id ?? null,
        origem: "clone" as const,
        nome: vazio(l.name) ? null : (l.name as string),
        status: l.status ?? "desconhecido",
        key: l.status === "ready" && !vazio(l.video_path) ? (l.video_path as string) : null,
        criadoEm: l.created_at ?? null,
      })),
    ...heygen
      .filter((l) => l.user_id === userId)
      .map((l) => ({
        id: l.id ?? null,
        origem: "heygen" as const,
        nome: vazio(l.title) ? null : (l.title as string),
        status: l.status ?? "desconhecido",
        key: l.status === "ready" && !vazio(l.video_path) ? (l.video_path as string) : null,
        criadoEm: l.created_at ?? null,
      })),
  ].sort((a, b) => maisRecentePrimeiro(a.criadoEm, b.criadoEm));

  return { total: todos.length, itens: todos.slice(0, Math.max(0, max)) };
}

// ───────────────────────────── A AMOSTRA DA VOZ ─────────────────────────────

export type LinhaAudioGerado = {
  user_id: string | null;
  voice_id: string | null;
  name: string | null;
  status: string | null;
  audio_path: string | null;
  duration_seconds?: number | null;
  created_at?: string | null;
};

export type AmostraDaVoz = { key: string; segundos: number | null; criadoEm: string | null };

/**
 * A amostra que o worker gera com a voz nova no fim do treino — é ela que vira o
 * player do painel. Mesmo par obrigatório da prévia do aluno (`user_id` +
 * `voice_id` DO PEDIDO + nome da amostra), pelo mesmo motivo: com uma trava a
 * menos o painel tocaria a voz errada pro atendente, que repassaria pro aluno.
 *
 * Mais recente primeiro: re-treino gera amostra nova, e é ela que vale.
 */
export function amostraDaVoz(
  userId: string | null,
  voiceId: string | null,
  linhas: readonly LinhaAudioGerado[],
): AmostraDaVoz | null {
  if (vazio(userId) || vazio(voiceId)) return null;
  const validas = linhas.filter(
    (l) =>
      l.user_id === userId &&
      l.voice_id === voiceId &&
      l.name === SGP_NOME_AMOSTRA &&
      l.status === "ready" &&
      !vazio(l.audio_path),
  );
  if (validas.length === 0) return null;
  const [maisNova] = [...validas].sort((a, b) => maisRecentePrimeiro(a.created_at, b.created_at));
  return {
    key: maisNova.audio_path as string,
    segundos: maisNova.duration_seconds ?? null,
    criadoEm: maisNova.created_at ?? null,
  };
}
