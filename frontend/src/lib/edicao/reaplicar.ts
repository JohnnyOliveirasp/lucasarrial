/**
 * Vídeo Edição 2.0 — decisões PURAS do "reaplicar" e do "voltar ao original".
 *
 * ⚠️ MÓDULO PURO DE PROPÓSITO: zero imports, zero I/O, zero React. Quem lê o
 * R2 / o banco / a tela é a rota e o componente; aqui mora só a decisão, que é
 * o que precisa de teste.
 *
 * ── POR QUE ISTO EXISTE (medido pelo Frank em 19/09) ──
 * A chave de saída da edição é DETERMINÍSTICA por vídeo:
 *   `${user_id}/edicao/broll/${kind}-${id}.mp4`      (broll/route.ts)
 *   `${user_id}/edicao/captions/${kind}-${id}.mp4`   (captions/route.ts)
 * Aplicar de novo SOBRESCREVE o arquivo anterior. Na aluna
 * leonicemleandrosociedadeadvoca@gmail.com isso custou dinheiro de verdade:
 * QUATRO débitos de 200 cr entre 20:51:10Z e 20:54:26Z (800 cr) e UM único
 * arquivo em `edicao/broll/` (7,52 MB, 20:54:31Z). Ela pagou 4 e ficou com 1;
 * os outros 3 não existem em lugar nenhum. 600 cr foram estornados na mão.
 *
 * E a razão de ela ter aplicado 4x é o defeito irmão: a tela não tinha
 * "voltar ao original". Quem aplicava e se arrependia só tinha uma alavanca —
 * aplicar de novo.
 *
 * ── O QUE ESTE MÓDULO GARANTE E O QUE NÃO GARANTE ──
 * GARANTE: quando a saída JÁ EXISTE no R2, a segunda aplicação é recusada
 * ANTES do gate de crédito, até a pessoa confirmar por escrito que quer
 * substituir. Cobre o caso "apliquei, vi o resultado, apliquei de novo".
 *
 * NÃO GARANTE: dois cliques enquanto o PRIMEIRO job ainda está no ar. Nesse
 * intervalo o arquivo de saída ainda não existe, então `saidaJaExiste` é falso
 * e a segunda aplicação passa. Fechar essa janela exige guardar o job em voo do
 * lado do servidor (hoje ele só mora no localStorage do rascunho) — proposta no
 * relatório, NÃO implementada aqui.
 */

/** Código de erro da recusa — o cliente reconhece por ele pra abrir o diálogo. */
export const CODIGO_SUBSTITUICAO = "substituicao_requer_confirmacao";

/** Qual saída de edição está prestes a ser sobrescrita. */
export type AlvoDeSubstituicao = "broll" | "captions";

export type DecisaoDeAplicacao =
  | { pode: true; motivo: "primeira_aplicacao" | "substituicao_confirmada" }
  | { pode: false; motivo: "substituicao_nao_confirmada"; mensagem: string };

const O_QUE_SE_PERDE: Record<AlvoDeSubstituicao, string> = {
  broll: "uma versão deste vídeo com o b-roll aplicado",
  captions: "uma versão legendada deste vídeo",
};

/**
 * Decide se a aplicação pode seguir.
 *
 * O texto é deliberadamente SEM promessa de desfazer: o arquivo antigo some de
 * verdade quando o novo sobe por cima. Prometer "dá pra voltar" aqui seria
 * mentira — versionar a chave é decisão do Johnny, não deste módulo.
 */
export function decidirAplicacao(args: {
  saidaJaExiste: boolean;
  confirmou: boolean;
  custo: number;
  alvo: AlvoDeSubstituicao;
}): DecisaoDeAplicacao {
  if (!args.saidaJaExiste) return { pode: true, motivo: "primeira_aplicacao" };
  if (args.confirmou) return { pode: true, motivo: "substituicao_confirmada" };
  return {
    pode: false,
    motivo: "substituicao_nao_confirmada",
    mensagem:
      `Você já tem ${O_QUE_SE_PERDE[args.alvo]}. Aplicar de novo SUBSTITUI esse arquivo: ` +
      `a versão atual se perde e não tem como voltar nela. ` +
      `Vão ser cobrados mais ${args.custo} créditos. Confirme só se quiser mesmo refazer.`,
  };
}

/**
 * Patch do rascunho pro "voltar ao original".
 *
 * ⚠️ O ORIGINAL NUNCA FOI DESTRUÍDO — medido no R2 nos 7 clones da aluna: o
 * arquivo de 7,20 MB em `video_clones.video_path` está intacto. A edição vai
 * pra uma chave NOVA. Então "voltar ao original" é só a tela parar de apontar
 * pra saída de edição: nada é apagado do R2, nenhum job é disparado, nenhum
 * crédito é cobrado.
 *
 * O patch mexe em UM campo só, e o teste trava isso: qualquer campo de job
 * (`brollJob`/`captionJob`) ou de projeto (`brollProjectId`) que aparecesse
 * aqui poderia disparar poll, job novo e portanto débito.
 */
export function voltarAoOriginal(): { videoEditadoKey: null } {
  return { videoEditadoKey: null };
}

/** O botão só aparece quando há edição em uso e nenhum job no ar. */
export function podeVoltarAoOriginal(estado: {
  videoEditadoKey: string | null;
  jobEmVoo: boolean;
}): boolean {
  if (estado.jobEmVoo) return false;
  return typeof estado.videoEditadoKey === "string" && estado.videoEditadoKey.length > 0;
}

/**
 * Encadeamento W5: com b-roll aplicado antes, a legenda queima POR CIMA do
 * resultado do b-roll (senão a cena cobriria a legenda). Só a saída de b-roll
 * serve de fonte — a saída de captions não se re-legenda em cima de si mesma,
 * e depois do "voltar ao original" (key null) a legenda volta pro clone cru.
 */
export function sourceKeyParaLegenda(videoEditadoKey: string | null): string | null {
  if (typeof videoEditadoKey !== "string") return null;
  return videoEditadoKey.includes("/edicao/broll/") ? videoEditadoKey : null;
}
