/**
 * SGP — "refazer a entrega": quando o time PODE remandar o treino de voz de um
 * pedido, e o que ele lê quando não pode. DECISÃO PURA, sem I/O.
 *
 * ── O vão que isto fecha (conferido em código, 15/09) ──────────────────────
 * Quando a entrega do SGP morre por falha NOSSA, não havia caminho nenhum de
 * volta. Os três possíveis estão fechados para o comprador do SGP:
 *
 *   1. `POST /api/v1/sgp/enviar` exige `status === "revisao"`; o pedido está
 *      `falhou`. (E a mensagem que ele levava mandava "completar as etapas" —
 *      ver `porta-envio.ts`, consertado no mesmo PR.)
 *   2. `POST /api/v1/voices/[id]/start-training` exige saldo de 10.000
 *      créditos. O comprador do SGP tem 0 POR DESENHO — comprar o SGP não
 *      concede crédito (`lib/credits/onboarding-cobranca.ts`). Ele leva `402`.
 *      E mesmo que passasse, COBRAR seria errado: o clone é entrega do produto
 *      que ele já pagou.
 *   3. `/admin/sgp/[id]/erro` e `/conclusao` dizem, no próprio cabeçalho, que
 *      NÃO mexem no `status`. São anotação de suporte, por decisão, e continuam
 *      sendo — esta rota é a primeira do `/admin/sgp` que AGE.
 *
 * O caso real: pedido do ricardoolito, voz `f58a158a`, morta por CUDA out of
 * memory em 15/09 — disputa de GPU, transitória, nada a ver com o áudio dele.
 * Foi destravado por ferramenta de linha de comando (`_frank/ferramentas/
 * 2026-09-15_retreinar_sgp.cjs`, commit e4b8f05), que funcionou: a voz ficou
 * `ready` às 22:53:07Z. Esta rota é aquela ferramenta com porta HTTP, para o
 * atendente não depender de alguém com acesso ao servidor.
 *
 * ── Quem paga ──────────────────────────────────────────────────────────────
 * `origem: "sgp"` ⇒ `deveCobrarOnboarding` é `false` ⇒ NENHUM débito. Nem
 * dívida, nem crédito concedido: o saldo do aluno não se move. A GPU é da casa,
 * que é o certo quando a falha foi nossa. Também é o que impede o defeito de
 * 09/09 de voltar por um caminho novo (12 perfis a -10.525 cada).
 *
 * ── O que esta régua NÃO decide ────────────────────────────────────────────
 * Ela não toca no `status` do PEDIDO. A máquina de estados do pedido é da
 * produção (`lib/sgp/etapas.ts` + `fracasso.ts`), e ela se atualiza sozinha na
 * próxima leitura quando a voz voltar a treinar. Mexer nela aqui dispararia
 * e-mail pro aluno a partir de um clique de atendente — que é exatamente o que
 * as rotas irmãs se proibiram de fazer.
 */
import type { VoiceStatus } from "../db/types.ts";
import type { SgpStatus } from "./types.ts";

/**
 * A TELA oferece o "Refazer entrega"? DECISÃO PURA, separada de
 * `decidirRefazer` de propósito.
 *
 * ── Por que existe (medido em 25/09, 9,8 dias depois do conserto) ──────────
 * A rota nasceu em 15/09 (commit 5d409805) e o próprio commit registrou que
 * NÃO ligou a UI: *"NAO INCLUI o botao na tela /admin/sgp: aquele arquivo esta
 * sendo editado por outro agente agora"*. A ligação virou "cartão separado" e
 * o cartão nunca veio. Conferido hoje: `refazer` não aparece na tela do
 * `/admin/sgp` nem em nenhum componente de `admin/sgp`, a rota tem ZERO
 * consumidor em todo o `src`, e nenhum dos branches do origin menciona
 * `refazer` naquele arquivo.
 * Ou seja: a queixa literal do chamado — *"nem o aluno, nem o suporte, nem o
 * admin"* consegue refazer — seguia VERDADEIRA para o suporte, porque a única
 * porta era um `curl` de quem tem acesso ao servidor. Rota sem botão conserta
 * o sistema e não conserta o atendente.
 *
 * ── A régua, e por que é só `falhou` ──────────────────────────────────────
 * `falhou` é o beco sem saída que o chamado descreve: o aluno completou tudo e
 * fomos NÓS que quebramos. Os outros ficam de fora pra não gastar o clique do
 * atendente num "não":
 *   • `pronto`/`enviado` — a voz está `ready`; a rota recusa com "já pronta";
 *   • `dados`/`foto`/`audio`/`revisao` — falta material DO ALUNO, não há treino
 *     pra refazer (a rota recusa com `sem_voz`);
 *   • `processando` — o treino roda AGORA; é o caso em que clicar é mais
 *     tentador e mais inútil (a rota recusa com "já treinando").
 *
 * ⚠️ Isto NÃO é a autoridade. Quem decide é `decidirRefazer`, que lê o status
 * da VOZ — dado que esta tela não carrega. Esta função só escolhe o que
 * MOSTRAR; se as duas discordarem, a rota recusa com mensagem escrita pro
 * atendente e a tela a exibe. Falso positivo aqui custa um clique e uma frase;
 * falso negativo esconde a única saída que existe.
 *
 * ⚠️ `naoIniciou` sai fora sempre: essas linhas não são pedidos (`id` não é id
 * de `sgp_pedidos`), então o clique daria 404. Mesma trava que a tela já aplica
 * em cobrança, marcar-erro e concluir.
 */
export function ofereceRefazerNaTela(linha: {
  status: string;
  naoIniciou: boolean;
}): boolean {
  if (linha.naoIniciou) return false;
  return linha.status === "falhou";
}

/** O mínimo do pedido que esta régua precisa. */
export type PedidoParaRefazer = {
  user_id: string | null;
  voice_id: string | null;
  status: SgpStatus;
};

export type DecisaoRefazer =
  | {
      acao: "disparar";
      userId: string;
      voiceId: string;
      /**
       * A voz está `failed` e precisa voltar pra `awaiting_training` antes do
       * disparo — `dispararTreinoOnboarding` recusa qualquer outro status
       * (treino.ts:85). É a mesma devolução que o `start-training` já faz
       * quando algo quebra depois da reserva, e ela NÃO apaga os áudios.
       */
      devolverPraFila: boolean;
    }
  | { acao: "recusar"; codigo: string; mensagem: string; http: number };

/**
 * As mensagens são escritas PRO ATENDENTE — ele não tem acesso ao código e
 * precisa saber (a) não adiantou clicar, (b) o que está acontecendo de fato,
 * (c) se tem algo a fazer. Mesma régua do `SEM_COLUNA` da rota de erro manual.
 */
export function decidirRefazer(
  pedido: PedidoParaRefazer,
  voz: { status: VoiceStatus } | null,
): DecisaoRefazer {
  if (!pedido.user_id || !pedido.voice_id) {
    return {
      acao: "recusar",
      codigo: "sem_voz",
      http: 409,
      mensagem:
        "Este pedido ainda não chegou a criar a voz do aluno, então não há treino para refazer. " +
        "Ele parou antes disso — veja em que etapa na própria linha.",
    };
  }
  if (!voz) {
    return {
      acao: "recusar",
      codigo: "voz_sumiu",
      http: 409,
      mensagem:
        "O pedido aponta para uma voz que não existe mais no sistema. " +
        "Isso é caso para o time técnico — avise pelo canal de sempre.",
    };
  }

  switch (voz.status) {
    // O caminho limpo: a voz já está na fila, é só despachar.
    case "awaiting_training":
      return {
        acao: "disparar",
        userId: pedido.user_id,
        voiceId: pedido.voice_id,
        devolverPraFila: false,
      };

    // O caso que motivou a rota. Devolve pra fila e dispara, na mesma chamada.
    // Não há risco de débito em dobro porque no SGP não há débito nenhum.
    case "failed":
      return {
        acao: "disparar",
        userId: pedido.user_id,
        voiceId: pedido.voice_id,
        devolverPraFila: true,
      };

    case "training":
      return {
        acao: "recusar",
        codigo: "ja_treinando",
        http: 409,
        mensagem:
          "O treino desta voz já está rodando agora. Espere ele terminar — " +
          "disparar outro em cima só desperdiçaria a máquina.",
      };

    case "ready":
      return {
        acao: "recusar",
        codigo: "ja_pronta",
        http: 409,
        mensagem:
          "A voz deste aluno já está pronta. Se o que saiu ficou ruim, isso não é " +
          "retreino automático: fale com o time técnico.",
      };

    // ⚠️ Terminal DE PROPÓSITO. Aqui o áudio do aluno é curto demais para
    // treinar: remandar o mesmo material falharia de novo, igual, gastando GPU
    // e o tempo do atendente. Falha de DADO não se resolve repetindo — quem
    // resolve é o aluno mandando mais áudio.
    case "rejected_too_short":
      return {
        acao: "recusar",
        codigo: "audio_curto",
        http: 409,
        mensagem:
          "O áudio deste aluno é curto demais para treinar, então refazer daria o mesmo " +
          "resultado. O que destrava é ele enviar mais tempo de fala.",
      };

    // uploading | validating — ainda está chegando material.
    default:
      return {
        acao: "recusar",
        codigo: "voz_em_preparo",
        http: 409,
        mensagem:
          `A voz deste aluno ainda está em preparo (situação: ${voz.status}). ` +
          "Não há treino para refazer agora — atualize a tela daqui a pouco.",
      };
  }
}
