/**
 * SGP — a perna do FRACASSO: quem é avisado quando o pedido morre.
 *
 * 12/09 (#364). As duas pernas de SUCESSO avisavam o aluno (`avisoFotoPronta`,
 * `avisoVozPronta`) e a de FRACASSO não avisava NINGUÉM: `etapas.ts` gravava
 * `status='falhou'` no banco e acabava ali. O PR #246 consertou o ESTADO
 * TERMINAL (passou a carimbar o motivo em `erro`), mas deixou o aviso sem dono
 * — objeção do Vigia na nota do #364.
 *
 * O custo medido, não projetado: o pedido fe00d4e2 (comprador do SGP que pagou
 * R$ 894) morreu em 11/09 17:37Z e ficou 19h sem NENHUM contato nosso. A caixa
 * do suporte estava com 0 não-lidos — ninguém ia tropeçar nele por acaso.
 *
 * ⚠️ POR QUE ESTE ARQUIVO É PURO (deps injetadas, sem SMTP/WhatsApp/Supabase):
 * a garantia que importa aqui é "UMA vez por pedido, nunca a cada render", e
 * garantia sem teste é promessa. `avisos.ts` importa SMTP + WhatsApp + Resend e
 * `etapas.ts` importa `@/…`, então nenhum dos dois roda sob `node --test`. Com
 * as deps injetadas o protocolo do cadeado é exercitável de verdade — mesma
 * razão que tirou `erro-dono.ts` de dentro do `avisos.ts`.
 */
import { classificarErro, type DonoDoErro } from "../onboarding/erro-dono.ts";
import { WHATSAPP_SUPORTE_CURSO } from "../payments/sgp-boas-vindas.ts";
import type { ErroOnboarding } from "../onboarding/avisos.ts";
import type { SgpStatus } from "./types.ts";

/** Link de um toque — o aluno não digita número nenhum. */
const WHATSAPP_LINK = "https://wa.me/5541991481573";

/**
 * O bloco do canal humano, com o texto do Lucas (regra dele, 10/09): todo
 * e-mail de aluno do SGP oferece o WhatsApp do suporte. É seguro pela
 * estratégia anti-banimento porque quem inicia a conversa é o ALUNO.
 */
const BLOCO_SUPORTE =
  `Pode chamar nosso time de suporte no WhatsApp: ${WHATSAPP_SUPORTE_CURSO}. ` +
  `Eles vão te dar toda a ajuda necessária e resolver isso com você. ` +
  `É só mandar mensagem que já te atendem.\n${WHATSAPP_LINK}`;

/** O mínimo do pedido que esta régua precisa. */
export type PedidoFracassado = {
  id: string;
  nome: string | null;
  email: string | null;
  /** Motivo já gravado por outro caminho — nunca é sobrescrito. */
  erro: string | null;
  status: SgpStatus;
};

/** A linha devolvida pelo carimbo atômico (o `.select()` do update). */
export type LinhaCarimbada = { email: string | null; nome: string | null };

export type AvisoAoAluno = { assunto: string; texto: string; dono: DonoDoErro };

/**
 * O e-mail do aluno, por DONO do erro (régua 1 do `avisos.ts`, adaptada).
 *
 * ⚠️ DESVIO CONSCIENTE da régua 1, e é o ponto a discutir se alguém discordar:
 * no onboarding da planilha, erro NOSSO passa calado pro aluno porque ele não
 * está olhando nada — avisar só geraria chamado e desconfiança. No SGP a
 * situação se INVERTE: o aluno tem uma tela de acompanhamento estilo iFood
 * (/sgp/acompanhar) que já está escrita "falhou" na cara dele, e ele pagou.
 * Aqui o silêncio é que gera o chamado (e 19h de um comprador de R$ 894
 * esperando). Então o aluno é avisado nos DOIS casos — o que muda é o texto:
 * erro dele diz o que fazer, erro nosso diz explicitamente "não é você, já
 * estamos nisso, não faça nada".
 */
export function montarAvisoAoAluno(
  pedido: Pick<PedidoFracassado, "nome">,
  motivo: string | null,
): AvisoAoAluno {
  const dono = classificarErro(motivo ?? "");
  const oi = `Oi${pedido.nome ? `, ${pedido.nome}` : ""}!`;
  // `mandar()` já assina "— Equipe FastCloner": não repetir aqui.
  if (dono === "aluno") {
    return {
      dono,
      assunto: "Não conseguimos finalizar o seu clone — precisamos de você",
      texto: [
        oi,
        "",
        "O preparo da sua plataforma parou e não conseguimos concluir.",
        "",
        "O que aconteceu:",
        motivo ?? "Não conseguimos processar o material que você enviou.",
        "",
        "O que precisamos de você:",
        "Confira as fotos e o áudio que você enviou e responda este e-mail que " +
          "a gente retoma de onde parou. O que já deu certo está guardado — " +
          "você não vai precisar refazer tudo.",
        "",
        BLOCO_SUPORTE,
      ].join("\n"),
    };
  }
  return {
    dono,
    assunto: "Estamos resolvendo um problema no seu clone",
    texto: [
      oi,
      "",
      "O preparo da sua plataforma travou por um problema NOSSO — não foi o " +
        "material que você enviou.",
      "",
      "A nossa equipe já foi avisada e vai retomar o seu pedido. Você não " +
        "precisa fazer nada, e o que já deu certo está guardado.",
      "",
      BLOCO_SUPORTE,
    ].join("\n"),
  };
}

/**
 * O que o grupo recebe. `linha: null` de propósito: pedido do SGP não vem de
 * planilha nenhuma — quem acha o pedido é o ID, então ele vai na etapa.
 */
export function montarErroDoGrupo(
  pedido: Pick<PedidoFracassado, "id" | "email">,
  motivo: string | null,
  dono: DonoDoErro,
): ErroOnboarding {
  return {
    linha: null,
    email: pedido.email ?? "(pedido sem e-mail)",
    etapa: `SGP — pedido ${pedido.id}`,
    motivo: motivo ?? "sem motivo registrado",
    dependeDoAluno: dono === "aluno",
  };
}

export type DepsTransicao = {
  /**
   * O CADEADO. Deve rodar `update(...).eq('id').neq('status','falhou').select()`:
   * devolve a linha só pra chamada que REALMENTE virou o pedido, e `null` pra
   * quem chegou depois. É o mesmo carimbo condicional das pernas de sucesso
   * (`.is('foto_pronta_em', null).select()`), só que a coluna que serve de
   * cadeado é o próprio `status`.
   */
  carimbarFracasso: (patch: { status: "falhou"; erro?: string }) => Promise<LinhaCarimbada | null>;
  /** Update simples de status, pros desfechos que não são fracasso. */
  carimbarStatus: (status: SgpStatus) => Promise<void>;
  avisarAluno: (email: string, assunto: string, texto: string, ref: string) => Promise<void>;
  escalar: (erro: ErroOnboarding) => Promise<void>;
};

/**
 * O que esta chamada fez — existe pra o teste conseguir afirmar "avisou UMA
 * vez" sem depender de contar e-mail.
 */
export type ResultadoTransicao = "avisou" | "ja_avisado" | "status_atualizado" | "sem_mudanca";

/**
 * A transição de status do pedido, com o aviso do fracasso pendurado nela.
 *
 * ⚠️ POR QUE O CADEADO É O PRÓPRIO `status`, e não uma coluna nova:
 *   • `avisos_enviados` (a sugestão óbvia, e o registro canônico de "esse aviso
 *     saiu") NÃO serve de cadeado: a migration `104_avisos_enviados.sql` nunca
 *     foi aplicada — `registrarAviso` loga o erro e segue. Um cadeado numa
 *     tabela que não existe é cadeado que nunca tranca: o aluno levaria um
 *     e-mail A CADA F5 da tela de acompanhamento.
 *   • Coluna nova (`falhou_avisado_em`) exigiria DDL, que por decisão do Johnny
 *     não é aplicado pelo agente — o aviso ficaria morto até alguém rodar a
 *     migration, que é exatamente o buraco que este cartão veio fechar.
 *   • `status` já existe, já é escrito aqui e — conferido em 12/09 — `etapas.ts`
 *     é o ÚNICO lugar do repo que escreve 'falhou' em `sgp_pedidos`. Então
 *     `.neq('status','falhou')` é atômico no banco e não tem concorrente.
 * Resultado: zero DDL e o cadeado vale HOJE, sem depender de migration.
 */
export async function processarTransicao(
  pedido: PedidoFracassado,
  statusNovo: SgpStatus,
  motivoNovo: string | null,
  deps: DepsTransicao,
): Promise<ResultadoTransicao> {
  if (statusNovo !== "falhou") {
    if (statusNovo === pedido.status) return "sem_mudanca";
    await deps.carimbarStatus(statusNovo);
    return "status_atualizado";
  }

  // Nunca sobrescreve um motivo que outro caminho já escreveu (regra do #246).
  const patch: { status: "falhou"; erro?: string } = { status: "falhou" };
  if (!pedido.erro && motivoNovo) patch.erro = motivoNovo;

  const linha = await deps.carimbarFracasso(patch);
  if (!linha) return "ja_avisado"; // outra chamada ganhou a corrida

  const motivo = pedido.erro ?? motivoNovo;
  const aviso = montarAvisoAoAluno({ nome: linha.nome ?? pedido.nome }, motivo);
  const email = linha.email ?? pedido.email;

  // Best-effort em CADA perna: e-mail que falha não pode engolir a escalação —
  // o humano avisado é a última rede, e é justamente ela que faltava.
  if (email) {
    try {
      await deps.avisarAluno(email, aviso.assunto, aviso.texto, `fracasso do pedido ${pedido.id}`);
    } catch (e) {
      console.error("[sgp/fracasso] e-mail ao aluno:", e instanceof Error ? e.message : e);
    }
  }
  try {
    await deps.escalar(montarErroDoGrupo(pedido, motivo, aviso.dono));
  } catch (e) {
    console.error("[sgp/fracasso] escalar no grupo:", e instanceof Error ? e.message : e);
  }
  return "avisou";
}
