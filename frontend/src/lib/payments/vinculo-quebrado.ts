/**
 * Detector de VÍNCULO QUEBRADO — a compra paga cuja conta JÁ EXISTE e mesmo
 * assim continua órfã (`entitlements.user_id` NULL).
 *
 * POR QUE ESTE ARQUIVO EXISTE (medição de 06/09/2026)
 * ---------------------------------------------------
 * O sweeper `orphan-outreach.ts` pula, de propósito, quem tem conta:
 *
 *     if (hasAccount.has(email)) continue; // criou conta — claim do login resolve
 *                                             ^ orphan-outreach.ts:183
 *
 * A premissa desse comentário é FALSA quando a conta não nasceu de um login.
 * Em 04/09 uma carga criou 349 contas (`user_metadata.origem = "sgp_hotmart"`,
 * valor que só aparece nesse único dia em toda a base) chamando
 * `auth.admin.createUser` direto, SEM passar por `claimPurchasesOnLogin`. Todo
 * outro caminho que cria conta no repo chama o claim — este não chamou:
 *   - onboarding/import/route.ts:206  → chama
 *   - sgp/processar.ts:94             → chama
 *   - auth/callback/route.ts:50       → chama
 *   - app/[locale]/app/layout.tsx:44  → chama
 *   - a carga de 04/09                → NÃO chama (e nem está versionada)
 *
 * Resultado medido: 8 pessoas com conta + entitlement `active` com data futura
 * + `user_id` NULL → `profiles.access_until` NULL, plano free, ZERO créditos.
 * 7 delas nunca logaram, então nenhum dos caminhos de cura (que só rodam a
 * pedido do usuário) jamais rodou. O `aluno.cjs` responde "SEM ACESSO, compras
 * NENHUMA" porque sem o vínculo ele nem enxerga a compra.
 *
 * O ponto cego é estrutural, não é um bug de digitação: a reconciliação inteira
 * é disparada por AÇÃO DO USUÁRIO (login/render). Quem tem conta criada POR
 * NÓS e não volta sozinho fica quebrado para sempre, e o detector que existia
 * olhava só "compra recente sem conta" — barulho onde não há problema, silêncio
 * onde há.
 *
 * O QUE ESTE MÓDULO NÃO FAZ, de propósito: não vincula e não credita. São
 * ~800 mil créditos e a decisão é do Johnny/Lucas. Aqui a máquina só AVISA —
 * o backfill mora em `scripts/backfill-vinculo-orfao.mjs`, que não roda sozinho.
 *
 * PURO de propósito: sem `@/`, sem Next e sem Supabase, para rodar em
 * `node --test` (a parte suja está em `vinculo-quebrado-canal.ts`).
 */

/** Um entitlement órfão candidato a exame. */
export type OrfaoAtivo = {
  /** chave do entitlement (código do assinante / transação) */
  externalId: string;
  buyerEmail: string;
  status: string;
  /** ISO; null = vitalício */
  accessUntil: string | null;
  /** ISO — quando a COMPRA entrou */
  createdAt: string;
};

/** Conta encontrada para aquele e-mail (null = não existe conta). */
export type ContaDoEmail = { criadaEm: string } | null;

export type Veredito =
  /** conta existe e o vínculo não aconteceu → BUG REAL, dinheiro pago sem entrega */
  | "vinculo_quebrado"
  /** ninguém se cadastrou ainda → fluxo normal, é o convite que cuida */
  | "sem_conta"
  /** cancelado/expirado: não há acesso vigente a entregar hoje */
  | "sem_acesso_vigente"
  /** o par (compra, conta) é recente demais — o claim ainda pode rodar */
  | "dentro_da_carencia";

/**
 * Carência do vínculo. É CURTA e o relógio é OUTRO: aqui a conta já existe,
 * então não estamos esperando a pessoa se cadastrar — estamos só evitando
 * gritar no meio do cadastro dela, enquanto o claim do login ainda pode rodar.
 *
 * Compare com a carência da compra órfã (6 h, contada da 1ª compra): lá o que
 * se espera é um cadastro que pode nem vir. Misturar os dois relógios foi o que
 * produziu alarme em compra de 50 segundos e silêncio em caso de 24 dias.
 */
export const CARENCIA_VINCULO_MS = 30 * 60 * 1000;

/** Enquanto continuar quebrado, reavisa: um alerta único vira silêncio. */
export const REAVISO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * O relógio começa quando o par (compra, conta) passou a EXISTIR — ou seja, no
 * MAIS RECENTE dos dois. Medir pela compra faria uma conta criada agora, sobre
 * uma compra de agosto, parecer 24 dias atrasada e disparar no ato; medir pela
 * conta faria uma compra nova numa conta velha nunca esperar.
 */
export function inicioDoRelogio(orfao: OrfaoAtivo, conta: ContaDoEmail): string {
  if (!conta) return orfao.createdAt;
  return orfao.createdAt > conta.criadaEm ? orfao.createdAt : conta.criadaEm;
}

/** Tem acesso vigente a entregar? (mesma régua do recomputeProfileAccess) */
export function temAcessoVigente(orfao: OrfaoAtivo, agoraIso: string): boolean {
  if (orfao.status !== "active") return false;
  return orfao.accessUntil === null || orfao.accessUntil > agoraIso;
}

/**
 * Classifica UM órfão. A ordem importa: primeiro descarta o que não é dinheiro
 * preso hoje (status/expirado), depois separa "não tem conta" (fluxo normal)
 * de "tem conta e não vinculou" (bug), e só então aplica a carência curta.
 */
export function classificar(
  orfao: OrfaoAtivo,
  conta: ContaDoEmail,
  agoraIso: string,
  carenciaMs: number = CARENCIA_VINCULO_MS,
): Veredito {
  if (!temAcessoVigente(orfao, agoraIso)) return "sem_acesso_vigente";
  if (!conta) return "sem_conta";
  const inicio = new Date(inicioDoRelogio(orfao, conta)).getTime();
  if (new Date(agoraIso).getTime() - inicio < carenciaMs) return "dentro_da_carencia";
  return "vinculo_quebrado";
}

export type Quebrado = {
  externalId: string;
  buyerEmail: string;
  /**
   * Dois relógios, porque eles contam coisas diferentes e os dois importam:
   *  - `diasQuebrado`: desde que o par (compra, conta) existe. É a idade do
   *    DEFEITO, e é o que o técnico usa pra saber quando isso começou.
   *  - `diasPagando`: desde a compra. É a idade do PREJUÍZO — max@md2net pagou
   *    R$1.154,88 em 13/08 e a conta dele só nasceu em 04/09, então o defeito
   *    tem 1 dia mas o dinheiro está parado há 24. Reportar só o primeiro faria
   *    um caso de R$1.154 parecer coisa de ontem.
   */
  diasQuebrado: number;
  diasPagando: number;
  compraEm: string;
  contaEm: string;
};

/** Normaliza e-mail do jeito que o resto da casa normaliza (grantAccess). */
export const normalizarEmail = (e: string): string => e.trim().toLowerCase();

/**
 * Separa a lista inteira. `contas` é um mapa e-mail→conta já consultado pelo
 * chamador (nunca puxar `profiles` inteiro: o teto de 1000 do PostgREST foi o
 * que mandou "crie sua conta" pra 105 clientes ativos no incidente 72a4c9db).
 */
export function separar(
  orfaos: OrfaoAtivo[],
  contas: Map<string, ContaDoEmail>,
  agoraIso: string,
  carenciaMs: number = CARENCIA_VINCULO_MS,
): { quebrados: Quebrado[]; contagem: Record<Veredito, number> } {
  const contagem: Record<Veredito, number> = {
    vinculo_quebrado: 0,
    sem_conta: 0,
    sem_acesso_vigente: 0,
    dentro_da_carencia: 0,
  };
  const quebrados: Quebrado[] = [];
  const agoraMs = new Date(agoraIso).getTime();

  for (const o of orfaos) {
    const email = normalizarEmail(o.buyerEmail);
    const conta = contas.get(email) ?? null;
    const v = classificar(o, conta, agoraIso, carenciaMs);
    contagem[v] += 1;
    if (v !== "vinculo_quebrado" || !conta) continue;
    const inicio = new Date(inicioDoRelogio(o, conta)).getTime();
    quebrados.push({
      externalId: o.externalId,
      buyerEmail: email,
      diasQuebrado: Math.floor((agoraMs - inicio) / 86_400_000),
      diasPagando: Math.floor((agoraMs - new Date(o.createdAt).getTime()) / 86_400_000),
      compraEm: o.createdAt,
      contaEm: conta.criadaEm,
    });
  }
  // Ordena por quem PAGOU há mais tempo, não por quem quebrou há mais tempo:
  // a fila da casa é a do dinheiro parado. Numa carga, todo mundo quebra no
  // mesmo dia e ordenar pelo defeito embaralharia justamente os mais antigos.
  quebrados.sort((a, b) => b.diasPagando - a.diasPagando);
  return { quebrados, contagem };
}

/** Estado de dedupe, chaveado por entitlement (agent_state, sem migration). */
export type EstadoVinculo = Record<string, { primeiro: string; ultimo: string }>;

/**
 * Quem merece aviso AGORA: o que nunca foi avisado, e o que continua quebrado
 * desde o último aviso há mais de `REAVISO_MS`. Dedupe eterno transformaria
 * este detector no mesmo silêncio que ele veio consertar.
 */
export function aAvisar(
  quebrados: Quebrado[],
  estado: EstadoVinculo,
  agoraIso: string,
  reavisoMs: number = REAVISO_MS,
): { novos: Quebrado[]; lembretes: Quebrado[] } {
  const agoraMs = new Date(agoraIso).getTime();
  const novos: Quebrado[] = [];
  const lembretes: Quebrado[] = [];
  for (const q of quebrados) {
    const r = estado[q.externalId];
    if (!r) novos.push(q);
    else if (agoraMs - new Date(r.ultimo).getTime() >= reavisoMs) lembretes.push(q);
  }
  return { novos, lembretes };
}

/** Marca os avisados (mutação explícita, o chamador grava). */
export function marcarAvisados(
  estado: EstadoVinculo,
  avisados: Quebrado[],
  agoraIso: string,
): EstadoVinculo {
  for (const q of avisados) {
    const r = estado[q.externalId];
    estado[q.externalId] = { primeiro: r?.primeiro ?? agoraIso, ultimo: agoraIso };
  }
  return estado;
}

export type TextoVinculo = { assunto: string; texto: string };

/**
 * O texto é para o TIME DE SUPORTE, que não lê código (ordem de 01/09): diz o
 * que fazer, em português de gente, e só depois o detalhe técnico.
 */
export function textoDoAviso(
  novos: Quebrado[],
  lembretes: Quebrado[],
  contagem: Record<Veredito, number>,
): TextoVinculo {
  const total = novos.length + lembretes.length;
  const linha = (q: Quebrado, tag: string) =>
    `- ${q.buyerEmail} — PAGOU há ${q.diasPagando} dia(s) e nunca teve acesso` +
    ` (a conta existe há ${q.diasQuebrado} dia(s))${tag} — compra ${q.externalId}`;

  const corpo = [
    "O QUE FAZER",
    "",
    `${total} pessoa(s) PAGARAM, têm conta na plataforma e mesmo assim estão sem acesso`,
    "e com zero créditos. A compra existe, só não ficou ligada na conta delas.",
    "",
    "NÃO prometa prazo e NÃO libere nada por conta própria: a religação depende do",
    "Johnny/Lucas autorizarem (é crédito de assinatura). Registre o chamado e escale.",
    "Se a pessoa procurar a casa, ela está certa: o dinheiro entrou e o produto não.",
    "",
    ...novos.map((q) => linha(q, "")),
    ...lembretes.map((q) => linha(q, " [JÁ AVISADO ANTES, CONTINUA QUEBRADO]")),
    "",
    "TÉCNICO",
    "",
    "entitlements.user_id NULL + profiles com o MESMO e-mail existindo = vínculo",
    "que nunca aconteceu. O claim (claimPurchasesOnLogin) só roda a pedido do",
    "usuário (login/render de /app); conta criada por carga nunca passa por ele.",
    `Varredura: quebrados=${contagem.vinculo_quebrado} sem_conta=${contagem.sem_conta} ` +
      `carencia=${contagem.dentro_da_carencia} sem_acesso=${contagem.sem_acesso_vigente}`,
    "Religação manual: scripts/backfill-vinculo-orfao.mjs (não roda sozinho).",
  ].join("\n");

  return {
    assunto: `[FastCloner] ${total} pagante(s) com conta e SEM vínculo — dinheiro sem entrega`,
    texto: corpo,
  };
}
