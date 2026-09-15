/**
 * Rastro do GATE DE ROSTO FRONTAL do Vídeo Clone — tabela `face_gate_recusas`.
 * Server-only.
 *
 * #372 (13/09): quando o gate barra o aluno, o sistema não grava NADA. A rota
 * fazia um `console.log` e devolvia `face_not_frontal`. Não nasce linha, não
 * sobe contador, não há assinatura. Uma consulta ao banco não responde
 * "quantos alunos o gate barrou hoje" nem "quantas vezes o mesmo aluno bateu
 * na mesma parede". O único registro do caso da Alice (#371) foi o chamado que
 * ELA abriu na mão, depois de desistir na sexta tentativa.
 *
 * POR QUE NÃO GRAVA EM `video_clones` (decisão medida, não preferência):
 *   1. `video_clones` tem NOT NULL em audio_path, duration_seconds, num_frames,
 *      tier e credits_cost. O gate roda ANTES de resolver o áudio — nesse ponto
 *      esses cinco valores não existem. Gravar ali exigiria inventar dado falso
 *      ou afrouxar NOT NULL numa tabela viva de 3.109 linhas.
 *   2. Mais de 12 lugares leem `video_clones`, e um deles é o sweeper em
 *      `api/v1/agent/sweep-clones/route.ts:36`, que seleciona linhas e as vira
 *      `generating`. Uma linha de auditoria ali dentro corre o risco de ser
 *      varrida e PROCESSADA como trabalho real. Rastro não pode ter efeito
 *      colateral em fluxo de produção.
 *
 * AS DUAS PONTAS DA CEGUEIRA. O gate é FAIL-OPEN de propósito (o produto não
 * pode parar porque o detector caiu). Consequência: AUSÊNCIA DE RECUSA NÃO
 * PROVA APROVAÇÃO. Se só gravássemos a recusa, continuaríamos cegos pelo outro
 * lado — cobrando um clone que teria sido barrado, sem saber que isso
 * aconteceu. Por isso o `resultado` tem dois valores e `avaliacao_impossivel`
 * também vira linha.
 *
 * NÃO HÁ ALARME AQUI, DE PROPÓSITO. O recado original pedia "2+ recusas do
 * mesmo aluno em janela curta abre cartão sozinha". Não foi implementado: a
 * Alice sozinha bateu 6 vezes em 6 horas. Se esse for o comportamento normal
 * de quem está tentando enquadrar a foto, limiar 2 inunda a fila de cartão e
 * vira ruído que ninguém lê. Primeiro grava, depois mede a taxa real por aluno
 * e por dia, e SÓ ENTÃO escolhe o limiar com número na mão.
 *
 * Best-effort SEMPRE: o registro NUNCA derruba o pedido. Rastro que derruba
 * pedido é pior que não ter rastro. Mesma regra do `registrar-aviso.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkFrontalFace, type FaceGateResult } from "./face-gate.ts";

/**
 * O que aconteceu com a imagem no gate. Só existem estes dois — aprovação NÃO
 * grava linha (seria uma linha por clone gerado, e isso `video_clones` já
 * responde).
 */
export type ResultadoFaceGate =
  /** A visão avaliou e REPROVOU. O aluno levou `face_not_frontal` na tela. */
  | "recusa"
  /**
   * A visão NÃO CONSEGUIU avaliar e o fail-open deixou passar. A imagem seguiu
   * pro fluxo pago SEM ter sido olhada.
   */
  | "avaliacao_impossivel";

export type RegistroFaceGate = {
  /** Conta do aluno. Sempre conhecida: o gate roda depois do `authenticate`. */
  userId: string;
  /** Bucket R2 onde a imagem mora (generations pra upload, imagens pro histórico). */
  bucket: string;
  /** Chave da imagem dentro do bucket. Junto com o bucket, acha o arquivo. */
  imageKey: string;
  resultado: ResultadoFaceGate;
  /**
   * O motivo CRU, como veio. Em `recusa` é o texto que o modelo devolveu (o
   * mesmo que o aluno viu, antes de virar mensagem). Em
   * `avaliacao_impossivel` é a causa técnica. Cru de propósito: é lendo o
   * texto repetido que se descobre que o gate confunde queixo recolhido com
   * olhar pra baixo (#371).
   */
  motivo: string;
};

/** A linha exatamente como vai pro banco. Separada pra ser testável sem cliente. */
export function linhaDoFaceGate(r: RegistroFaceGate): Record<string, unknown> {
  return {
    user_id: r.userId,
    bucket: r.bucket,
    image_key: r.imageKey,
    resultado: r.resultado,
    // Motivo é texto de modelo: pode vir vazio, pode vir gigante. Vazio vira
    // null (mentira nenhuma), e o teto evita linha impagável de ler.
    motivo: (r.motivo ?? "").trim().slice(0, 500) || null,
  };
}

/**
 * Grava o registro. NUNCA lança e NUNCA propaga erro de banco — o caller já
 * decidiu o destino do pedido antes de chegar aqui.
 */
export async function registrarFaceGate(
  admin: SupabaseClient,
  r: RegistroFaceGate,
): Promise<void> {
  try {
    // `as never`: a tabela é nova e ainda não está nos tipos gerados do
    // Supabase. Mesmo padrão de `registrar-aviso.ts` e `lib/sgp/etapas.ts`.
    const { error } = await admin
      .from("face_gate_recusas" as never)
      .insert(linhaDoFaceGate(r) as never);
    if (error) {
      // Tabela ausente cai aqui: log e segue. O aluno recebe a recusa igual.
      console.error(
        `[video-clone/face-gate] não registrou "${r.resultado}" de ${r.userId}:`,
        error.message,
      );
    }
  } catch (e) {
    console.error(
      `[video-clone/face-gate] não registrou "${r.resultado}" de ${r.userId}:`,
      e instanceof Error ? e.message : e,
    );
  }
}

/** As duas dependências externas, injetáveis pra testar sem rede nem banco. */
export type DepsRastro = {
  checar: (imageUrl: string) => Promise<FaceGateResult>;
  registrar: (r: RegistroFaceGate) => Promise<void>;
};

export type ArgsRastro = {
  userId: string;
  bucket: string;
  imageKey: string;
  /**
   * URL assinada da imagem, ou `null` quando o presign falhou. `null` é a
   * TERCEIRA porta de fail-open, e é da rota, não do `face-gate.ts`: sem URL a
   * visão nunca é chamada e a imagem passa direto. Também vira linha.
   */
  imageUrl: string | null;
};

/**
 * Roda o gate e deixa o rastro. Devolve o veredito pra rota decidir — esta
 * função NÃO responde ao aluno e NÃO cobra nada.
 *
 * Contrato, nesta ordem de importância:
 *   1. o veredito devolvido é EXATAMENTE o do gate (o rastro não muda decisão);
 *   2. falha ao gravar não interrompe nada (`registrar` já é à prova de erro,
 *      e aqui há um try/catch de cinto e suspensório);
 *   3. aprovação limpa não grava.
 */
export async function checarRostoComRastro(
  deps: DepsRastro,
  args: ArgsRastro,
): Promise<FaceGateResult> {
  const grava = async (resultado: ResultadoFaceGate, motivo: string) => {
    try {
      await deps.registrar({
        userId: args.userId,
        bucket: args.bucket,
        imageKey: args.imageKey,
        resultado,
        motivo,
      });
    } catch (e) {
      // `registrar` já engole os próprios erros; este catch existe pro caso de
      // alguém injetar um `registrar` que lança. O pedido segue de qualquer jeito.
      console.error(
        "[video-clone/face-gate] rastro falhou (seguindo mesmo assim):",
        e instanceof Error ? e.message : e,
      );
    }
  };

  if (!args.imageUrl) {
    await grava("avaliacao_impossivel", "presign_falhou: não geramos a URL assinada da imagem; o gate não rodou");
    return { ok: true, skipped: "presign_falhou" };
  }

  const veredito = await deps.checar(args.imageUrl);

  if (!veredito.ok) {
    await grava("recusa", veredito.reason);
    return veredito;
  }

  // Passou. Duas passagens muito diferentes moram aqui:
  //   - `skipped` ausente  → a visão OLHOU e aprovou. Nada a registrar.
  //   - `skipped` presente → ninguém olhou. É o fail-open, e é o que precisa
  //     de linha, senão a gente só enxerga metade do problema.
  if (veredito.skipped && veredito.skipped !== "desligado") {
    const motivo = veredito.erro ? `${veredito.skipped}: ${veredito.erro}` : veredito.skipped;
    await grava("avaliacao_impossivel", motivo);
  }
  // `desligado` (VIDEO_CLONE_FACE_GATE=0) é escolha nossa, não cegueira
  // acidental: gravaria uma linha por pedido e afogaria o sinal que a tabela
  // existe pra dar. Fica de fora de propósito.

  return veredito;
}

/** As dependências REAIS, pra rota usar. */
export function depsRastroPadrao(admin: SupabaseClient): DepsRastro {
  return {
    checar: checkFrontalFace,
    registrar: (r) => registrarFaceGate(admin, r),
  };
}
