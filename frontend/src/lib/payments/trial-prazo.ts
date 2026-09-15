/**
 * PRAZO DO TRIAL POR PRODUTO — regra do dono (weekly 14/09).
 *
 * "O trial da FastCloner passa a depender do produto comprado":
 *   FCI = 7 dias · SGP = 30 · CPL = 30 · AI Content = 90
 *   Quem tem MAIS DE UM produto recebe o MAIOR prazo. **NÃO SOMA.**
 *   Já em trial  -> ESTENDE a data-fim pro máximo.
 *   Já pagante   -> NÃO MUDA NADA, só registra no histórico.
 *
 * Módulo PURO, ZERO import — mesmo motivo de `acesso-regra.ts`: é o que permite
 * rodar em `node --test` sem arrastar Supabase atrás. Quem escreve no banco
 * (webhook//sweep) chama daqui; a decisão nunca é recalculada em dois lugares.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ MECANISMO NOVO, NÃO É AJUSTE. Hoje o trial NÃO É CONCEDIDO por nós: ele é
 * DEDUZIDO retroativamente do Hotmart, em SQL, como "PURCHASE_APPROVED com
 * recurrence_number = 1 e price.value = 0", com `trial_start = min(received_at)`
 * (mig 63 `admin_trial_stats`, mig 80/85 `expire_trial_credits`). Não existe
 * hoje NENHUMA data-fim de trial gravada em lugar nenhum — ela é calculada na
 * hora, como `trial_start + p_grace_days`.
 *
 * A PARTIR DAQUI A DATA-FIM PASSA A MORAR NUMA LINHA PRÓPRIA: a tabela
 * `trial_periods` (mig 115, escrita e NÃO aplicada). É ela a fonte única do
 * "até quando vale este trial", e é ela que as telas e a varredura leem.
 * Ver o cabeçalho da 115 para o porquê de ser tabela nova e não coluna em
 * `profiles`.
 * ────────────────────────────────────────────────────────────────────────────
 */

/** Um dia em ms. Datas são timestamptz (UTC), então aritmética em ms é exata. */
const DIA_MS = 86_400_000;

/**
 * Tabela de prazos, como CONFIGURAÇÃO — não espalhada em `if`.
 *
 * ⚠️ SÓ ENTRAM CÓDIGOS QUE EU CONFERI NO REPO. Os dois que existem hoje são os
 * mesmos que `acesso-regra.ts::PRODUTOS_DE_CURSO_PADRAO` já conhece:
 *   7283335 — Fábrica de Conteúdo Invisível (FCI)  -> 7 dias
 *   7283229 — Sistema de Geração Pronto (SGP)      -> 30 dias
 *
 * CPL e AI Content NÃO TÊM CÓDIGO NESTE REPO (procurei: os únicos product_codes
 * que o código conhece são 7283229, 7283335 e 7851642). O dono disse que o Edu
 * passa os dois. Eles estão em `TRIAL_PRODUTOS_PENDENTES` com o prazo já
 * decidido — falta só o código. NÃO INVENTAR: produto sem código configurado
 * cai no padrão explícito abaixo e é LOGADO.
 */
export const TRIAL_DIAS_POR_PRODUTO: Readonly<Record<string, number>> = Object.freeze({
  "7283335": 7,
  "7283229": 30,
});

/**
 * O que falta pra tabela ficar completa. Fica AQUI, versionado e visível, em vez
 * de virar bilhete solto: quando o Edu passar o código, é uma linha em
 * `TRIAL_DIAS_POR_PRODUTO` e uma a menos aqui.
 */
export const TRIAL_PRODUTOS_PENDENTES: ReadonlyArray<{ nome: string; dias: number }> =
  Object.freeze([
    Object.freeze({ nome: "CPL", dias: 30 }),
    Object.freeze({ nome: "AI Content", dias: 90 }),
  ]);

/**
 * Prazo de produto SEM configuração — padrão EXPLÍCITO, nunca silencioso.
 *
 * É o MENOR prazo da tabela (7), de propósito: errar pra menos é reversível
 * (o próprio "já em trial -> estende" conserta sozinho no dia em que o código
 * do CPL/AI Content entrar na tabela), enquanto errar pra mais é entregar 90
 * dias de produto de graça e não tem como tirar de volta sem tirar do aluno
 * algo que ele já viu na tela.
 */
export const TRIAL_DIAS_PRODUTO_DESCONHECIDO = 7;

/** Motivo de log quando cai no padrão — string única, pra poder ser grepada. */
export const LOG_PRODUTO_SEM_PRAZO = "produto sem prazo configurado";

export type PrazoDeProduto = {
  productCode: string;
  dias: number;
  /** false = caiu no padrão; quem chama DEVE logar `LOG_PRODUTO_SEM_PRAZO`. */
  conhecido: boolean;
};

/** Prazo de UM produto. Desconhecido não lança: cai no padrão e se declara. */
export function prazoDoProduto(
  productCode: string | null | undefined,
  tabela: Readonly<Record<string, number>> = TRIAL_DIAS_POR_PRODUTO,
): PrazoDeProduto {
  const code = String(productCode ?? "").trim();
  const dias = tabela[code];
  if (typeof dias === "number" && Number.isFinite(dias) && dias > 0) {
    return { productCode: code, dias, conhecido: true };
  }
  return { productCode: code, dias: TRIAL_DIAS_PRODUTO_DESCONHECIDO, conhecido: false };
}

export type PrazoResultante = {
  /** O MAIOR prazo entre os produtos. NUNCA a soma. */
  dias: number;
  /** Produtos que caíram no padrão — quem chama loga um `LOG_PRODUTO_SEM_PRAZO` por item. */
  desconhecidos: string[];
  /** Detalhe por produto, pra auditoria/histórico. */
  porProduto: PrazoDeProduto[];
};

/**
 * O prazo de uma PESSOA, dados todos os produtos dela: **o máximo, não a soma.**
 *
 * A regra é "recebe o MAIOR prazo", então comprar FCI (7) + SGP (30) dá 30,
 * jamais 37. Somar seria o defeito mais caro possível aqui, porque ninguém
 * reclama de trial comprido — ele só aparece na fatura do mês seguinte.
 */
export function prazoDoTrial(
  produtos: ReadonlyArray<string | null | undefined>,
  tabela: Readonly<Record<string, number>> = TRIAL_DIAS_POR_PRODUTO,
): PrazoResultante {
  const porProduto = produtos.map((p) => prazoDoProduto(p, tabela));
  const dias = porProduto.reduce((maior, p) => Math.max(maior, p.dias), 0);
  const desconhecidos = porProduto.filter((p) => !p.conhecido).map((p) => p.productCode);
  return { dias, desconhecidos, porProduto };
}

/** Data-fim a partir do INÍCIO do trial. Lança em data inválida (bug de quem chama). */
export function fimDoTrial(inicioIso: string, dias: number): string {
  const t = Date.parse(inicioIso);
  if (!Number.isFinite(t)) throw new Error(`fimDoTrial: início inválido: ${inicioIso}`);
  if (!Number.isFinite(dias) || dias <= 0) throw new Error(`fimDoTrial: dias inválido: ${dias}`);
  return new Date(t + dias * DIA_MS).toISOString();
}

/**
 * O estado da pessoa HOJE, como o banco conta.
 *  - `pagante`   -> tem (ou teve) pagamento de verdade da assinatura.
 *  - `em_trial`  -> já existe um `trial_periods` com início e fim.
 *  - `sem_trial` -> nunca teve.
 */
export type EstadoTrial =
  | { tipo: "sem_trial" }
  | { tipo: "em_trial"; inicio: string; fim: string; dias: number }
  | { tipo: "pagante" };

export type DecisaoTrial =
  | { acao: "criar"; dias: number; inicio: string; fim: string; desconhecidos: string[] }
  | { acao: "estender"; dias: number; de: string; para: string; desconhecidos: string[] }
  | { acao: "nada"; motivo: "pagante" | "ja_aplicado" | "prazo_nao_aumenta"; desconhecidos: string[] };

/**
 * A DECISÃO, num lugar só.
 *
 * @param estado        como a pessoa está hoje
 * @param produtos      TODOS os produtos dela (os antigos + o que acabou de chegar)
 * @param agoraIso      instante do evento (vira o início, quando é trial novo)
 * @param eventoId      chave de idempotência (transação da Hotmart); ver abaixo
 * @param jaAplicados   eventos que esta pessoa já teve aplicados
 *
 * ⚠️ IDEMPOTÊNCIA (o webhook da Hotmart REENTREGA): a mesma transação não pode
 * esticar o trial duas vezes. A trava é `eventoId ∈ jaAplicados` e é a PRIMEIRA
 * coisa checada — antes de qualquer cálculo. No banco ela é a unique
 * (email, evento_id) da mig 115; aqui ela é pura pra poder ser testada.
 *
 * ⚠️ "JÁ PAGANTE NÃO MUDA NADA" é a trava que protege DINHEIRO, e por isso vem
 * logo depois: um pagante não pode virar trial por reprocessamento de webhook
 * antigo. Ele devolve `nada`, e quem chama ainda assim grava o produto no
 * HISTÓRICO — a compra aconteceu, ela só não mexe no prazo.
 *
 * ⚠️ ESTENDER NUNCA ENCURTA: comprar FCI (7) durante um trial de SGP (30) não
 * pode puxar a data-fim pra trás. Por isso o `prazo_nao_aumenta`.
 */
export function decidirTrial(
  estado: EstadoTrial,
  produtos: ReadonlyArray<string | null | undefined>,
  agoraIso: string,
  eventoId: string,
  jaAplicados: ReadonlySet<string> = new Set(),
  tabela: Readonly<Record<string, number>> = TRIAL_DIAS_POR_PRODUTO,
): DecisaoTrial {
  // (1) idempotência primeiro: reentrega não calcula nada.
  if (jaAplicados.has(eventoId)) {
    return { acao: "nada", motivo: "ja_aplicado", desconhecidos: [] };
  }

  const { dias, desconhecidos } = prazoDoTrial(produtos, tabela);

  // (2) pagante é intocável.
  if (estado.tipo === "pagante") {
    return { acao: "nada", motivo: "pagante", desconhecidos };
  }

  // (3) trial novo: começa agora.
  if (estado.tipo === "sem_trial") {
    return { acao: "criar", dias, inicio: agoraIso, fim: fimDoTrial(agoraIso, dias), desconhecidos };
  }

  // (4) já em trial: a data-fim vai pro máximo, medida do INÍCIO — não do agora.
  // Medir do "agora" somaria na prática (trial de 30 comprado no dia 29 viraria
  // dia 59), que é exatamente o "NÃO SOMA" da regra.
  const novoFim = fimDoTrial(estado.inicio, Math.max(dias, estado.dias));
  if (novoFim <= estado.fim) {
    return { acao: "nada", motivo: "prazo_nao_aumenta", desconhecidos };
  }
  return {
    acao: "estender",
    dias: Math.max(dias, estado.dias),
    de: estado.fim,
    para: novoFim,
    desconhecidos,
  };
}
