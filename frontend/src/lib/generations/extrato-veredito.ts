/**
 * Veredito de DINHEIRO de UM trabalho, lido do extrato e casado por `ref_id`
 * (incidente 70633cab / cartão #473).
 *
 * O QUE ESTE ARQUIVO RESOLVE. Em 17/09 08:50Z (Enviados uid 2606) a casa
 * escreveu à aluna katiasalvador32@gmail.com, palavra por palavra: "Os 400
 * créditos que foram cobrados já voltaram automaticamente pra sua conta." Era
 * FALSO. Medido em 19/09 no ledger: a geração `019c58d1-5eb9-410f-aa0a-66b4dcc399d8`
 * tinha UMA linha, `-400` em 16/09 15:08, e estorno nenhum. A aluna passou 3
 * dias 400 créditos no negativo acreditando que não estava, porque a casa
 * disse que não estava.
 *
 * ⚠️ A ARMADILHA, e é ela que faz isto ser REPETÍVEL: a conta dela TEM um
 * estorno de +400 — de 12/09, casado com OUTRA geração (`b6df1a7e`). Quem olha
 * o extrato por VALOR ("+400, o mesmo valor"), por DATA ("o estorno mais
 * recente") ou por `kind` vê uma devolução e conclui que esta geração foi
 * devolvida. As três leituras estão erradas pela mesma razão: nenhuma delas
 * casa o `ref_id`.
 *
 * O `kind` MENTE por construção: todo estorno é gravado com
 * `kind = 'extra_purchase'` (medido em 07/09: 668 linhas de estorno na base,
 * TODAS com esse kind). A ordem de 20/08 é literal — estorno se confere por
 * `ref_type` CASADO COM `ref_id`, NUNCA por `kind`. Filtrar por `kind` já quase
 * pagou 13 alunos em dobro.
 *
 * MESMO DESENHO de `qa-veredito.ts`, e pela mesma razão: o dado JÁ estava no
 * banco, faltava alguém LER e escrever a frase no contexto de quem atende.
 * Quando a Fast for falar de dinheiro, a frase certa já vem pronta daqui — ela
 * não precisa (nem deve) inferir de uma lista de movimentações.
 *
 * ⚠️ ESTE MÓDULO SÓ DESCREVE. Não estorna, não credita, não decide política de
 * reembolso, não toca em `credit_transactions`. É leitura e texto.
 *
 * ⚠️ O QUE ELE NÃO PROVA. "Cobrado e não devolvido" é uma afirmação sobre o
 * LEDGER, não sobre mérito: não diz que o trabalho saiu defeituoso nem que o
 * aluno tem direito a estorno (isso é decisão de produto do Johnny). E a
 * AUSÊNCIA desta linha num trabalho não significa "está tudo certo": significa
 * que não achamos linha de extrato casada com aquele `ref_id` — ver
 * `AVISO_ESTORNO_SO_CASADO`.
 *
 * ── SOBRE AS DUAS LISTAS ABAIXO (decisão consciente, não descuido) ───────────
 * A lista canônica de `ref_type` de estorno mora em
 * `_frank/ferramentas/_estornos.cjs` (chamado #113), que é CJS e vive FORA de
 * `frontend/` — importá-lo daqui arrastaria um require de fora da raiz do Next
 * para dentro do bundle de servidor, e quebraria a propriedade que faz
 * `qa-veredito.ts` funcionar: módulo PURO, sem import nenhum, testável isolado.
 *
 * Então as listas são espelhadas aqui, e o espelho é MECÂNICO, não confiança:
 * `extrato-veredito.test.ts` carrega o `_estornos.cjs` de verdade e exige
 * igualdade de conjunto nas DUAS listas. Somar um `ref_type` lá e esquecer aqui
 * QUEBRA O TESTE. Sem esse guarda isto seria "lista nova inventada", que é
 * exatamente o modo de falha do #185 (um tipo faltando por 6 dias) e do #342
 * (dois tipos faltando por 11 dias) — e o erro que uma lista velha produz é o
 * FALSO NEGATIVO, o que faz aluno já estornado parecer não estornado e paga em
 * dobro.
 */

/** Todos os `ref_type` que significam "devolvemos crédito". Espelho de `_estornos.cjs:27`. */
export const REF_TYPES_ESTORNO = [
  "image_refund",
  "video_clone_refund",
  "image_video_refund",
  "voice_train_refund",
  "generation_refund",
  "studio_scene_refund",
  "support_refund",
  "studio_audio_refund",
  // Os dois que NÃO terminam em "_refund" — quem "consertar" isto com
  // LIKE '%_refund' continua cego pra eles:
  "estorno_de_engano",
  "estorno",
  "perdao_negativo_onboarding",
  "reparo_falha_operacional",
  // Parece bônus pelo nome, mas casa `ref_id` com o débito e zera (medido no
  // #113): é estorno de geração de áudio com outro nome.
  "compensation",
];

/**
 * O que entra com `amount > 0` e NÃO é devolução. Espelho de `_estornos.cjs:87`.
 *
 * Existe pelo mesmo motivo que existe lá: com as duas listas explícitas, um
 * `ref_type` NOVO nasce ACUSANDO em vez de nascer invisível. Aqui isso importa
 * duas vezes, porque um crédito de cortesia que caia no mesmo `ref_id` de um
 * trabalho cobrado pode ser lido como "já devolveram" por quem olha só o sinal.
 */
export const NAO_SAO_DEVOLUCAO = [
  "payment_event",
  "stripe_session",
  "winback",
  "courtesy_grant",
  "courtesy_test_access",
  "courtesy_video_clone",
  "bonus_cortesia",
  "admin_grant",
  "credit_campaign",
  "stock_seed",
  "incident_apology",
  "incident_apology_bonus",
  "backlog_apology_bonus",
];

/**
 * Aviso que acompanha QUALQUER contexto que traga linha de dinheiro. Existe
 * para a leitura não escorregar de "a conta tem um estorno" para "este trabalho
 * foi estornado" — que é literalmente o erro de 17/09.
 */
export const AVISO_ESTORNO_SO_CASADO =
  "Sobre as linhas de CRÉDITOS acima: cada uma foi conferida casando o ref_id do próprio trabalho " +
  "com o extrato. Estorno de OUTRO trabalho da MESMA conta NÃO conta como estorno deste — em 17/09 a " +
  "casa afirmou a uma aluna que 400 créditos 'já voltaram' porque havia um +400 no extrato, e aquele " +
  "estorno era de outra geração; ela ficou 3 dias no negativo acreditando que não estava. Nunca case " +
  "estorno por VALOR igual, por DATA próxima, nem por kind (todo estorno é gravado com " +
  "kind='extra_purchase', então kind não distingue estorno de compra de crédito). AUSÊNCIA de estorno " +
  "casado significa NÃO ESTORNADO, sem exceção: se a linha não diz DEVOLVIDO, não afirme que voltou. " +
  "E trabalho SEM linha de créditos aqui é trabalho para o qual não achamos extrato casado — isso não " +
  "é prova de nada nas duas direções; nesse caso escale em vez de afirmar.";

export type LinhaExtrato = {
  ref_id?: string | null;
  ref_type?: string | null;
  kind?: string | null;
  amount?: number | null;
  created_at?: string | null;
};

export type ExtratoVeredito = {
  /** Total DEBITADO deste ref_id, em créditos positivos (0 = nunca cobrado). */
  cobrado: number;
  /** Total DEVOLVIDO casado com este ref_id (só `ref_type` de estorno). */
  estornado: number;
  /** `true` só quando existe estorno CASADO com este ref_id. */
  foiEstornado: boolean;
  /** `cobrado - estornado`. > 0 = o aluno pagou e não recebeu de volta. */
  pendente: number;
  /** Quais `ref_type` de estorno apareceram casados (ordem do extrato). */
  refTypesEstorno: string[];
  /** Data (dd/mm) do estorno casado mais recente, ou null. */
  estornoEm: string | null;
  /** Data (dd/mm) do primeiro débito casado, ou null. */
  cobradoEm: string | null;
  /** Créditos positivos casados que NÃO são devolução (cortesia, compra…). */
  positivosNaoDevolucao: string[];
  /** `ref_type` positivos que nenhuma das duas listas conhece — ACUSAM. */
  refTypesDesconhecidos: string[];
  /** Linha curta, pronta pro contexto da Fast. */
  linha: string;
};

/** Number finito de verdade (descarta NaN, Infinity, booleano, string). */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** UUID é case-insensitive; normalizar evita falso negativo por caixa. */
function chave(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return t === "" ? null : t;
}

/** dd/mm no fuso da casa. Determinístico: o fuso é explícito. */
function diaBR(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
}

const cr = (n: number) => `${n.toLocaleString("pt-BR")} cr`;

const CABECA = "💰 CRÉDITOS deste trabalho (conferido por ref_id no extrato, nunca por kind): ";

/**
 * Lê as linhas de `credit_transactions` e devolve o veredito de dinheiro do
 * trabalho `refId`.
 *
 * Aceita o extrato INTEIRO da conta: o casamento por `ref_id` é feito aqui
 * dentro, de propósito. É esse filtro que impede o erro de 17/09, e ele tem que
 * morar num lugar só, testado, em vez de ser refeito por quem chama.
 *
 * Devolve `null` para: `refId` vazio/não-string, `linhas` que não é array, e
 * extrato SEM NENHUMA linha casada com o `ref_id`. Nunca inventa veredito a
 * partir de dado ausente — e nunca "conclui" estorno de dado que não casa.
 */
export function extratoVeredito(refId: unknown, linhas: unknown): ExtratoVeredito | null {
  const alvo = chave(refId);
  if (alvo === null) return null;
  // `typeof null === "object"` e array é objeto: sem este par de guardas,
  // `linhas.filter` explode ou some em silêncio.
  if (!Array.isArray(linhas)) return null;

  const minhas = linhas.filter((l): l is LinhaExtrato => {
    if (typeof l !== "object" || l === null || Array.isArray(l)) return false;
    return chave((l as LinhaExtrato).ref_id) === alvo;
  });
  if (!minhas.length) return null;

  let cobrado = 0;
  let estornado = 0;
  let ilegiveis = 0;
  const refTypesEstorno: string[] = [];
  const positivosNaoDevolucao: string[] = [];
  const refTypesDesconhecidos: string[] = [];
  let cobradoEmIso: string | null = null;
  let estornoEmIso: string | null = null;

  for (const l of minhas) {
    const a = num(l.amount);
    // Linha com amount ilegível NÃO pode ser descartada em silêncio: se ela era
    // um estorno, descartar produz "não devolvido" falso — o falso negativo que
    // paga em dobro. Conta e acusa.
    if (a === null) {
      ilegiveis++;
      continue;
    }
    if (a === 0) continue;

    const tipo = typeof l.ref_type === "string" ? l.ref_type : "";
    const quando = typeof l.created_at === "string" ? l.created_at : null;

    if (a < 0) {
      cobrado += -a;
      // Primeiro débito: o mais ANTIGO, que é a data que o aluno reconhece como
      // "o dia em que me cobraram".
      if (quando && (cobradoEmIso === null || quando < cobradoEmIso)) cobradoEmIso = quando;
      continue;
    }

    // a > 0. É devolução SÓ se o `ref_type` estiver na lista canônica.
    // `kind` não entra nesta decisão em nenhuma hipótese.
    if (REF_TYPES_ESTORNO.includes(tipo)) {
      estornado += a;
      if (!refTypesEstorno.includes(tipo)) refTypesEstorno.push(tipo);
      if (quando && (estornoEmIso === null || quando > estornoEmIso)) estornoEmIso = quando;
    } else if (NAO_SAO_DEVOLUCAO.includes(tipo)) {
      if (!positivosNaoDevolucao.includes(tipo)) positivosNaoDevolucao.push(tipo);
    } else {
      // Critério por EXCLUSÃO (igual `_estornos.cjs`): tipo que nenhuma lista
      // conhece nasce ACUSANDO. Não conto como estorno (não posso afirmar que
      // é) e não calo (não posso afirmar que não é).
      if (!refTypesDesconhecidos.includes(tipo)) refTypesDesconhecidos.push(tipo);
    }
  }

  const pendente = cobrado - estornado;
  const cobradoEm = diaBR(cobradoEmIso);
  const estornoEm = diaBR(estornoEmIso);
  const base: Omit<ExtratoVeredito, "linha"> = {
    cobrado,
    estornado,
    foiEstornado: estornado > 0,
    pendente,
    refTypesEstorno,
    estornoEm,
    cobradoEm,
    positivosNaoDevolucao,
    refTypesDesconhecidos,
  };

  // Extrato ilegível: não afirmo NADA sobre dinheiro. Um número errado aqui vai
  // pra dentro de uma frase sobre o saldo de um pagante.
  if (ilegiveis > 0) {
    return {
      ...base,
      linha:
        CABECA +
        `⚠️ ${ilegiveis} linha(s) do extrato deste trabalho vieram ilegíveis (valor não numérico). ` +
        `NÃO afirme nada sobre cobrança ou estorno deste trabalho — escale para conferência à mão.`,
    };
  }

  const partes: string[] = [];

  if (cobrado === 0) {
    // A lição do caso Kessuly (01/09): "nunca foi cobrado" e "não foi
    // ressarcido" são indistinguíveis para quem só olha estorno. Aqui se diz
    // qual dos dois é, com todas as letras.
    partes.push(
      "NÃO HOUVE COBRANÇA por este trabalho (nenhum débito casado com ele), então não há o que devolver. " +
        '"Não foi cobrado" NÃO é o mesmo que "não foi ressarcido": não prometa estorno de algo que ninguém pagou',
    );
  } else {
    partes.push(`cobrado ${cr(cobrado)}${cobradoEm ? ` em ${cobradoEm}` : ""}`);
  }

  if (cobrado > 0 && estornado === 0) {
    partes.push(
      `❌ SEM ESTORNO CASADO com este trabalho → NÃO FOI DEVOLVIDO. ` +
        `O aluno está ${cr(pendente)} no negativo por causa dele. ` +
        `NÃO diga que "já voltou" nem que "volta automaticamente"`,
    );
  } else if (estornado > 0) {
    const quem = refTypesEstorno.join(", ");
    const onde = `${quem}${estornoEm ? `, ${estornoEm}` : ""}`;
    if (pendente > 0) {
      partes.push(
        `⚠️ DEVOLVIDO EM PARTE: ${cr(estornado)} de ${cr(cobrado)} (${onde}) → ainda faltam ${cr(pendente)}. ` +
          `Não diga que voltou tudo`,
      );
    } else if (pendente < 0) {
      partes.push(
        `⚠️ DEVOLVIDO ${cr(estornado)} contra cobrança de ${cr(cobrado)} (${onde}) → devolução A MAIS ` +
          `de ${cr(-pendente)} neste trabalho. NÃO devolva de novo; escale`,
      );
    } else {
      partes.push(`✅ DEVOLVIDO ${cr(estornado)}${estornoEm ? ` em ${estornoEm}` : ""} (${quem}) → nada pendente`);
    }
  }

  if (positivosNaoDevolucao.length) {
    partes.push(
      `este trabalho também tem crédito positivo de ${positivosNaoDevolucao.join(", ")}, que NÃO é devolução ` +
        `(cortesia/compra) e NÃO foi contado como estorno`,
    );
  }

  if (refTypesDesconhecidos.length) {
    partes.push(
      `⚠️ ref_type positivo que a lista da casa não conhece: ${refTypesDesconhecidos.join(", ")} — ` +
        `NÃO contei como estorno e não afirmo que não seja. Escale para conferência`,
    );
  }

  return { ...base, linha: CABECA + partes.join(" · ") + "." };
}
