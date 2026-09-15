/**
 * SGP — o painel "o que já foi gerado" de UM aluno, pro time de suporte
 * (/admin/sgp, linha expandida). Aqui é só a ida ao banco e ao R2: quem decide
 * O QUE pode aparecer é `geracoes-pure.ts`, que é onde moram os testes.
 *
 * ⚠️ SOMENTE LEITURA, igual às duas rotas irmãs do painel. Em particular NÃO
 * chama `estadoDasEtapas`, que GRAVA na linha e dispara e-mail pro aluno (ver o
 * comentário em lib/sgp/painel.ts). O painel é aberto por curiosidade do
 * atendente, várias vezes por dia — um efeito colateral aqui viraria enxurrada
 * de e-mail em cima de quem já está reclamando.
 *
 * ⚠️ SÓ SOB CLIQUE, nunca junto da lista. São 5 consultas + assinatura de URL
 * por aluno; pendurar isso nas 27 linhas a cada tick de 30s do refresh seria
 * ~135 consultas por meio minuto pra mostrar o que ninguém pediu pra ver.
 *
 * ⚠️ CADA SEÇÃO CAI SOZINHA. Se a consulta de vídeos falhar, a voz e as imagens
 * continuam aparecendo e a tela DIZ que não conseguiu ler os vídeos — em vez de
 * mostrar "nenhum vídeo", que o atendente leria como "o aluno não tem vídeo" e
 * repassaria pro aluno como fato.
 */
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import {
  amostraDaVoz,
  imagensDoPedido,
  videosDoAluno,
  vozDoPedido,
  MAX_IMAGENS,
  MAX_VIDEOS,
  SGP_IDEA_AVATAR,
  SGP_NOME_AMOSTRA,
  type LinhaAudioGerado,
  type LinhaImagemGerada,
  type LinhaVideoClone,
  type LinhaVideoHeygen,
  type LinhaVoz,
  type OrigemVideo,
} from "./geracoes-pure.ts";
import type { SgpPedidoRow } from "./types.ts";

/**
 * 1h — o MESMO TTL do resto do app (/api/v1/images, /api/v1/generations,
 * /api/v1/videos e a prévia do aluno em lib/sgp/previa.ts). O atendente deixa a
 * linha aberta enquanto conversa no WhatsApp; URL curta demais 403-aria no meio
 * do atendimento.
 */
const TTL_SEGUNDOS = 60 * 60;

export type VozGerada = {
  status: string;
  data: string | null;
  erro: string | null;
  /** Player da voz clonada. `null` = a amostra ainda não existe. */
  amostraUrl: string | null;
  amostraSegundos: number | null;
};

export type ImagemGerada = { id: string | null; url: string; criadoEm: string | null };

export type VideoGerado = {
  id: string | null;
  origem: OrigemVideo;
  nome: string | null;
  status: string;
  criadoEm: string | null;
  /** `null` quando não está pronto — ou quando a assinatura da URL falhou. */
  url: string | null;
};

export type SgpGeracoes = {
  voz: VozGerada | null;
  imagens: ImagemGerada[];
  /** Quantas existem ao todo. Maior que `imagens.length` = teto cortou. */
  imagensTotal: number;
  videos: VideoGerado[];
  videosTotal: number;
  /**
   * Por que não há nada pra mostrar, quando não há. `null` = o aluno tem conta e
   * a consulta rodou; lista vazia aí significa vazio de verdade.
   */
  motivo: string | null;
  /**
   * O que NÃO deu pra ler. Escrito pro atendente, não pro programador. Vazio =
   * tudo foi lido; então "nenhuma imagem" pode ser afirmado com segurança.
   */
  falhas: string[];
};

export const GERACOES_VAZIAS: SgpGeracoes = {
  voz: null,
  imagens: [],
  imagensTotal: 0,
  videos: [],
  videosTotal: 0,
  motivo: null,
  falhas: [],
};

type Admin = ReturnType<typeof getAdmin>;

/**
 * Roda uma consulta e, se ela cair, devolve `null` com o recado escrito pro
 * atendente. É o que faz cada seção cair sozinha (ver o ⚠️ do cabeçalho).
 */
async function tentar<T>(
  rotulo: string,
  falhas: string[],
  fn: () => Promise<T>,
): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[sgp/geracoes] ${rotulo}:`, e instanceof Error ? e.message : e);
    falhas.push(`Não consegui carregar ${rotulo} deste aluno.`);
    return null;
  }
}

/** Assinar URL é best-effort: uma que falha vira `null`, não derruba o painel. */
async function assinar(bucket: string, key: string, rotulo: string, falhas: string[]) {
  return tentar(rotulo, falhas, () => createPresignedGet(bucket, key, TTL_SEGUNDOS));
}

export async function geracoesDoPedido(
  pedido: Pick<SgpPedidoRow, "user_id" | "voice_id">,
): Promise<SgpGeracoes> {
  const userId = pedido.user_id;
  if (!userId) {
    return {
      ...GERACOES_VAZIAS,
      motivo:
        "Este aluno ainda não terminou o envio no portal, então ainda não existe conta ligada ao " +
        "pedido — não há nada gerado para mostrar.",
    };
  }

  const admin = getAdmin();
  const voiceId = pedido.voice_id;
  const falhas: string[] = [];

  const [voz, imagens, videos] = await Promise.all([
    carregarVoz(admin, userId, voiceId, falhas),
    carregarImagens(admin, userId, falhas),
    carregarVideos(admin, userId, falhas),
  ]);

  return {
    voz,
    imagens: imagens?.itens ?? [],
    imagensTotal: imagens?.total ?? 0,
    videos: videos?.itens ?? [],
    videosTotal: videos?.total ?? 0,
    motivo: null,
    falhas,
  };
}

// ─────────────────────────────── A VOZ ───────────────────────────────

async function carregarVoz(
  admin: Admin,
  userId: string,
  voiceId: string | null,
  falhas: string[],
): Promise<VozGerada | null> {
  // Sem `voice_id` no pedido não há voz DO PEDIDO. Mostrar "a voz mais recente
  // do aluno" seria afirmar uma entrega que pode não ter acontecido.
  if (!voiceId) return null;

  const linha = await tentar("a voz", falhas, async () => {
    const { data, error } = await admin
      .from("voices")
      .select("id, user_id, status, trained_at, created_at, error_message")
      .eq("user_id", userId)
      .eq("id", voiceId);
    if (error) throw new Error(error.message);
    return vozDoPedido(userId, voiceId, (data ?? []) as LinhaVoz[]);
  });
  if (!linha) return null;

  const amostra = await tentar("a amostra da voz", falhas, async () => {
    const { data, error } = await admin
      .from("generations")
      .select("user_id, voice_id, name, status, audio_path, duration_seconds, created_at")
      .eq("user_id", userId)
      .eq("voice_id", voiceId)
      .eq("name", SGP_NOME_AMOSTRA)
      .eq("status", "ready");
    if (error) throw new Error(error.message);
    return amostraDaVoz(userId, voiceId, (data ?? []) as LinhaAudioGerado[]);
  });

  // A amostra vive no bucket de `generations` — o mesmo de onde o player do
  // histórico lê (start-training sobe o sample.wav lá).
  const amostraUrl = amostra
    ? await assinar(R2_BUCKETS.generations, amostra.key, "o áudio da voz", falhas)
    : null;

  return {
    status: linha.status,
    data: linha.data,
    erro: linha.erro,
    amostraUrl,
    amostraSegundos: amostra?.segundos ?? null,
  };
}

// ────────────────────────────── AS IMAGENS ──────────────────────────────

async function carregarImagens(admin: Admin, userId: string, falhas: string[]) {
  const escolhidas = await tentar("as imagens", falhas, async () => {
    const { data, error } = await admin
      .from("image_generations")
      .select("id, user_id, idea, status, image_path, created_at")
      .eq("user_id", userId)
      .eq("idea", SGP_IDEA_AVATAR)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      // O teto do banco é folgado de propósito: quem corta em `MAX_IMAGENS` é a
      // régua pura, que também CONTA o que sobrou pra tela poder dizer.
      .limit(100);
    if (error) throw new Error(error.message);
    return imagensDoPedido(userId, (data ?? []) as LinhaImagemGerada[], MAX_IMAGENS);
  });
  if (!escolhidas) return null;

  const bucket = imagesBucket();
  const itens = await Promise.all(
    escolhidas.itens.map(async (i) => ({
      id: i.id,
      url: await assinar(bucket, i.key, "uma das imagens", falhas),
      criadoEm: i.criadoEm,
    })),
  );
  // Imagem sem URL não vira miniatura quebrada na tela: sai da lista, e a falha
  // já foi registrada em `falhas` por `assinar`.
  return {
    itens: itens.filter((i): i is ImagemGerada => typeof i.url === "string"),
    total: escolhidas.total,
  };
}

// ────────────────────────────── OS VÍDEOS ──────────────────────────────

async function carregarVideos(admin: Admin, userId: string, falhas: string[]) {
  const escolhidos = await tentar("os vídeos", falhas, async () => {
    const [clones, heygen] = await Promise.all([
      admin
        .from("video_clones")
        .select("id, user_id, name, status, video_path, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      admin
        .from("heygen_videos")
        .select("id, user_id, title, status, video_path, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    if (clones.error) throw new Error(clones.error.message);
    if (heygen.error) throw new Error(heygen.error.message);
    return videosDoAluno(
      userId,
      (clones.data ?? []) as LinhaVideoClone[],
      (heygen.data ?? []) as LinhaVideoHeygen[],
      MAX_VIDEOS,
    );
  });
  if (!escolhidos) return null;

  const itens = await Promise.all(
    escolhidos.itens.map(async (v) => ({
      id: v.id,
      origem: v.origem,
      nome: v.nome,
      status: v.status,
      criadoEm: v.criadoEm,
      // Os dois vivem em buckets DIFERENTES — o mesmo par que
      // lib/social/media-sources.ts já resolve, e errar isto dá 404 calado.
      url: v.key
        ? await assinar(
            v.origem === "clone" ? imagesBucket() : R2_BUCKETS.generations,
            v.key,
            "um dos vídeos",
            falhas,
          )
        : null,
    })),
  );
  return { itens, total: escolhidos.total };
}
