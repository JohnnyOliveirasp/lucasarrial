/**
 * QUAL PRODUTO a pessoa comprou na Hotmart — a decisão, separada da consulta e
 * da injeção no prompt (que ficam em `account.ts` e `mail-respond.ts`).
 *
 * MORA NUM ARQUIVO PRÓPRIO, SEM NENHUM IMPORT, pelo mesmo motivo do
 * `garantia.ts`: é uma linha que a Fast é mandada OBEDECER, e precisa ser
 * testável com `node --test` sem subir banco, sem alias `@/` e sem bundler.
 * As constantes canônicas (id do SGP, portal, WhatsApp do curso) entram por
 * PARÂMETRO — quem injeta é o chamador, importando de
 * `lib/payments/sgp-boas-vindas.ts`, que é a cópia canônica. Aqui não se
 * escreve URL nem número de telefone: duas cópias de um link é como um deles
 * envelhece em silêncio.
 *
 * ── O DEFEITO QUE ISTO CONSERTA (caso Hugo Correa, 08/09/2026) ──────────────
 * Hugo comprou o Sistema de Geração Pronto (7283229) por R$ 597 e escreveu ao
 * suporte@ dizendo que não conseguia acessar. Às 19h50Z a Fast respondeu, de
 * moto próprio, que "se você entrar em fastcloner.com/app com este e-mail e
 * criar a conta, os créditos devem aparecer no primeiro login".
 *
 * ISSO É FALSO, e é falso POR REGRA COMERCIAL, não por defeito: compra de SGP
 * cria conta SEM assinatura, SEM `access_until` e SEM crédito (ordem do Lucas,
 * 31/08 — o desenho que garante isso está documentado no cabeçalho de
 * `sgp-boas-vindas.ts`). Ele ia entrar, ver saldo zero, e confirmar a
 * impressão de que tinha sido enganado — depois de já ter esperado 30 minutos
 * no atendimento e pedido reembolso.
 *
 * ⚠️ POR QUE O MODELO ERRA, e por que instrução sozinha não resolvia: a
 * resposta é GERADA, e a instrução de crédito em `mail-respond.ts` era
 * incondicional ("os créditos aparecem no primeiro login"). O bloco CONTA DO
 * ALUNO é declaradamente CEGO pra compra de curso (`manual.ts`), então o
 * modelo não tinha como saber que aquele comprador era de curso — e crédito é
 * a resposta CERTA pro caso mais comum (7851642, 1.145 compradores contra 103
 * do SGP na medição de 08/09). Sem o produto no contexto, o palpite mais
 * provável é justamente o errado pra este aluno. É o mesmo formato do #198: a
 * Fast não estava desobedecendo, estava adivinhando um dado que ninguém tinha
 * colocado na frente dela.
 *
 * CONSERVADORA NAS TRÊS PONTAS, e as três direções importam:
 *  - sem evento, com erro de consulta, ou com o id da plataforma desconhecido
 *    → `sem_compra`, que manda ESCALAR. NUNCA `so_curso`: classificar um
 *    comprador legítimo do FastCloner como "só curso" faria a Fast parar de
 *    dizer a quem pagou a plataforma que o crédito dele está vindo. É a mesma
 *    escolha do `roteamentoDoProduto` no webhook — errar pro lado de continuar
 *    reconhecendo a compra paga é muito mais barato que o contrário;
 *  - `so_curso` NÃO autoriza dizer "você não comprou nada". A pessoa pagou; o
 *    que ela não tem é a assinatura. Negar a compra é o defeito de 31/08
 *    (R$ 2.391 negados a um aluno), e o texto daqui diz isso com todas as
 *    letras pra não trocar um defeito pelo outro;
 *  - produto DESCONHECIDO (nem plataforma, nem SGP: Comunidade Presença
 *    Lucrativa, Gerador de Ganchos, AI Content…) conta como curso. Só o id da
 *    plataforma libera a fala de crédito — lista de permissão, não de bloqueio,
 *    senão todo produto novo do Lucas nasce prometendo crédito.
 *
 * SÓ `PURCHASE_APPROVED` conta. Em particular NÃO o `PURCHASE_COMPLETE`, que a
 * Hotmart remanda pela MESMA compra ~7,8 dias depois — a mesma armadilha que
 * já duplicou crédito em 10/08 e que faria a mesma compra ser contada duas
 * vezes aqui. O filtro é repetido nesta função de propósito, mesmo com a
 * consulta já filtrando: é a diferença entre uma garantia e uma convenção.
 */

/** Linha crua do `payment_events` — só os campos que esta decisão lê. */
export type EventoProduto = {
  event_type?: unknown;
  payload?: { data?: { product?: { id?: unknown; name?: unknown } } };
};

/**
 * Os ids e os textos canônicos, INJETADOS pelo chamador.
 *
 * `plataforma` é `HOTMART_PRODUCT_ID`. Ele pode ser `null` (env não
 * configurado) e esse caso é tratado como "não sei", nunca como "não tem".
 */
export type CatalogoHotmart = {
  /** id do FastCloner — a assinatura da plataforma. `null` = desconhecido. */
  plataforma: string | null;
  /** id do Sistema de Geração Pronto. */
  sgp: string;
  /** portal onde o aluno de SGP envia fotos e áudio (SGP_PORTAL_URL). */
  portalSgp: string;
  /** WhatsApp do suporte de CURSO — o canal do Lucas, não o nosso. */
  whatsappCurso: string;
};

export type ClasseDeCompra =
  /** tem compra da plataforma FastCloner (podendo ter curso junto) */
  | "plataforma"
  /** só produto que NÃO é a plataforma — curso. Não dá acesso nem crédito. */
  | "so_curso"
  /** não deu pra saber: sem evento, erro, ou id da plataforma desconhecido */
  | "sem_compra";

export type Compras = {
  classe: ClasseDeCompra;
  /** comprou o SGP? (pode ser junto da plataforma — é order bump do mesmo checkout) */
  temSgp: boolean;
  /** nomes dos produtos de curso, como a Hotmart mandou, pra citar ao aluno */
  nomesDeCurso: string[];
};

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

/**
 * Classifica as compras de UM e-mail.
 *
 * ⚠️ NÃO filtra por `price.value > 0`, e isso é deliberado: aqui a pergunta é
 * QUAL produto, não SE pagou. A adesão de R$ 0 do FastCloner é trial de
 * verdade e dá crédito de teste — descartá-la faria a Fast calar justamente
 * pra quem tem crédito pra usar. Quem decide "pagou de verdade" é a
 * `janelaGarantia` (dinheiro) e o `pagou_de_verdade.cjs`, não esta função.
 */
export function classificarCompras(linhas: EventoProduto[], catalogo: CatalogoHotmart): Compras {
  const aprovadas = linhas.filter((e) => {
    const t = texto(e.event_type).toUpperCase();
    // Sem `event_type` no objeto, confia na consulta (que já filtrou).
    return t === "" || t === "PURCHASE_APPROVED";
  });

  const plataformaId = texto(catalogo.plataforma);
  // Id da plataforma desconhecido: não dá pra distinguir plataforma de curso.
  // "Não sei" é a única resposta honesta — e a única segura nas duas direções.
  if (!plataformaId) return { classe: "sem_compra", temSgp: false, nomesDeCurso: [] };

  let temPlataforma = false;
  let temSgp = false;
  const nomes = new Set<string>();

  for (const e of aprovadas) {
    const produto = e.payload?.data?.product;
    const id = texto(produto?.id);
    if (!id) continue;
    if (id === plataformaId) {
      temPlataforma = true;
      continue;
    }
    // Tudo que não é a plataforma é curso — lista de PERMISSÃO.
    if (id === texto(catalogo.sgp)) temSgp = true;
    const nome = texto(produto?.name);
    nomes.add(nome || `produto ${id}`);
  }

  if (temPlataforma) return { classe: "plataforma", temSgp, nomesDeCurso: [...nomes] };
  if (nomes.size > 0 || temSgp) return { classe: "so_curso", temSgp, nomesDeCurso: [...nomes] };
  return { classe: "sem_compra", temSgp: false, nomesDeCurso: [] };
}

/**
 * A linha que vai pro contexto da Fast — pronta, não o dado cru.
 *
 * ENTREGAR O ID CRU NÃO BASTARIA, e isso já foi medido no #198: o contexto
 * trazia "Cadastro em: 18/08" e a Fast ainda assim afirmou "dentro dos 7 dias".
 * Modelo não é confiável pra transformar um número de produto numa regra
 * comercial no meio de uma conversa sobre dinheiro. Então a CONCLUSÃO vem
 * pronta daqui, no mesmo formato que já funcionou pra garantia
 * ("calculado pelo sistema — obedeça esta linha").
 */
export function linhaDasCompras(linhas: EventoProduto[], catalogo: CatalogoHotmart): string {
  const c = classificarCompras(linhas, catalogo);
  const cabeca = "COMPRAS NA HOTMART (calculado pelo sistema — obedeça esta linha): ";

  if (c.classe === "sem_compra") return COMPRAS_ESCALAR;

  const blocoSgp = c.temSgp
    ? ` Ela comprou o Sistema de Geração Pronto, que é a NOSSA EQUIPE montar o clone dela (rosto e voz) — o portal onde ela envia as fotos e o áudio é ${catalogo.portalSgp}.`
    : "";

  if (c.classe === "plataforma") {
    return (
      cabeca +
      "esta pessoa TEM compra da plataforma FastCloner — as regras normais de acesso e crédito valem pra ela." +
      blocoSgp
    );
  }

  const quais = c.nomesDeCurso.length ? ` (${c.nomesDeCurso.join(", ")})` : "";
  return (
    cabeca +
    `esta pessoa comprou SÓ CURSO${quais} e NÃO tem compra da plataforma FastCloner. ` +
    // ⚠️ A PROIBIÇÃO NÃO CITA A FRASE PROIBIDA, e isso é regra da casa aprendida
    // duas vezes: no #198 o parêntese "(a garantia Hotmart de 7 dias é
    // respeitada)" foi lido como PERMISSÃO pra afirmar, e no #265 repetir o "7"
    // dentro da instrução reintroduziu o número que a conta tinha parado de
    // usar. Escrever aqui a formulação a ser evitada seria entregar ao modelo a
    // sentença pronta pra copiar — o contrário do que esta linha existe pra
    // fazer. Diz-se o que É verdade, não o que não se deve dizer.
    "⚠️ NÃO PROMETA CRÉDITO NEM ACESSO À PLATAFORMA, em nenhuma formulação e nem como expectativa ou " +
    "possibilidade. Curso é produto SEPARADO e NÃO dá a plataforma (regra comercial): o saldo dela é ZERO e " +
    "criar conta não muda isso. Prometer o contrário faz a pessoa entrar, ver zero e concluir que foi enganada. " +
    "A compra dela é REAL e válida — NUNCA diga que ela não comprou nada nem peça comprovante. " +
    "Explique que a assinatura da plataforma é contratada à parte." +
    blocoSgp +
    ` Dúvida sobre o curso ou sobre a compra é o canal do suporte no WhatsApp ${catalogo.whatsappCurso}.`
  );
}

/**
 * O texto do "não sei". Nunca o silêncio: foi a AUSÊNCIA da informação que
 * deixou o palpite solto, exatamente como no #198.
 *
 * Fecha as DUAS saídas erradas de uma vez — não prometer crédito e não negar a
 * compra — porque quem cai aqui é justamente o caso em que não sabemos qual
 * das duas seria a mentira.
 */
export const COMPRAS_ESCALAR =
  "COMPRAS NA HOTMART: NÃO foi possível confirmar qual produto esta pessoa comprou. " +
  "NÃO afirme que crédito ou acesso vão aparecer, e NÃO diga que ela não comprou nada " +
  "(você é cego pra compra de curso) — diga que vai confirmar com a equipe e escale.";
