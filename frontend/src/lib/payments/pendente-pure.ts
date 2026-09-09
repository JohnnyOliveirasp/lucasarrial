/**
 * A regra ÚNICA do aviso de "pagamento assíncrono pendente" (Pix/boleto).
 *
 * MÓDULO PURO, SEM NENHUM IMPORT, de propósito: roda em `node --test` sem
 * bundler e sem resolver o alias `@/` (mesmo motivo de `access-window.ts` e
 * `garantia.ts`).
 *
 * ── POR QUE ESTE ARQUIVO NASCEU (incidente #319, 09/09/2026) ───────────────
 * A MESMA regra de negócio existia em DOIS lugares e as duas cópias
 * divergiram:
 *
 *   frontend/src/app/[locale]/app/layout.tsx  (a cópia CERTA)
 *       pendingRecent  = agora - pending_payment_at < 3 dias
 *       showPendingBanner = !!pendingAt && pendingRecent && !subscribed && !unlimited
 *
 *   frontend/src/lib/agent/account.ts:271     (a cópia ERRADA)
 *       profile.pending_payment_at ? ' · ⚠️ Pix/boleto PENDENTE...' : ''
 *       -> null check CRU: sem janela de recência e sem checar acesso.
 *
 * O /app escondia o banner e a Fast, lendo o MESMO perfil, seguia afirmando
 * que havia um Pix a pagar. Ou seja: o aluno era mandado pagar um código que
 * já tinha morrido.
 *
 * MEDIDO NO BANCO em 09/09/2026 rodando ESTA função (mais o `hasActiveAccess`
 * e o `bypassesBilling` de verdade) contra `profiles` paginado até o fim, não
 * estimado. 129 perfis têm `pending_payment_at`, e o null check cru afirmava
 * "PENDENTE aguardando pagamento" pros 129. Com a regra certa:
 *      23  ativo    → cobrança viva, dentro da janela: avisa, e está certo
 *     100  vencido  → o código morreu; a Fast passa a dizer VENCIDO em vez de
 *                     mandar pagar (o mais antigo é de 14/07, 56 dias)
 *       5  nenhum   → JÁ com acesso ativo: pagaram. Mencionar cobrança pra
 *                     quem pagou é o pior caso dos três
 *       1  nenhum   → equipe (`lucas.m.arrial@gmail.com`, o próprio sócio, que
 *                     nunca deveria ver cobrança nenhuma)
 * 106 dos 129 (82%) deixam de receber instrução errada.
 *
 * ⚠️ O chamado #319 falava em "12 atingidos". Esse número era um piso, não o
 * alcance: ele saiu de uma varredura que considerava "sem acesso" só quem
 * tinha `access_until` E `access_source` NULOS. A regra real (`hasActiveAccess`)
 * lê `access_until` VENCIDO como sem acesso também — e é por isso que o total
 * verdadeiro é 100. `aneto2@gmail.com` é o exemplo: `access_source='hotmart'`
 * com `access_until` em 28/08 (vencido), invisível na varredura antiga, e
 * ainda por cima cobrado em EUR.
 *
 * ⚠️ O `pending_payment_at` do Duarte (`duartesoaresconsultor@gmail.com`), o
 * caso que abriu o chamado, foi ZERADO entre a abertura do card e este commit
 * — hoje ele é `plan=pro` e cai em "nenhum". Por isso o total saiu de 130 pra
 * 129. A data dele continua nos testes como valor LITERAL congelado: o teste
 * trava a regra, não o estado de hoje de um perfil que qualquer webhook muda.
 *
 * Por isso a regra mora AQUI, e só aqui. Os dois chamadores importam esta
 * função. Se a janela mudar amanhã, muda num lugar só — duplicar a condição
 * de novo é literalmente o defeito que este arquivo existe pra impedir.
 *
 * ── POR QUE SÃO TRÊS ESTADOS E NÃO UM BOOLEANO ────────────────────────────
 * A primeira versão deste arquivo devolvia `boolean`, e com isso a linha de
 * pendência SUMIA quando o código vencia — porque foi assim que copiei o
 * comportamento do banner do /app. Estava errado, e o PR #218 (aberto no
 * mesmo incidente, 50min antes) tinha razão no ponto: o /app fala com o
 * ALUNO, que não pode fazer nada com um código morto, então calar é gentileza;
 * a Fast é ATENDENTE, e a existência de uma cobrança morta é justamente o
 * contexto que EXPLICA a falta de acesso. Calar com ela é devolver a agente ao
 * escuro que produziu o #198.
 *
 * O erro não estava em nenhuma das duas motivações — estava em eu ter herdado
 * do banner a REGRA e a APRESENTAÇÃO de uma vez só. São coisas separadas:
 *
 *     esta função        decide o ESTADO   (nenhum | ativo | vencido)
 *     cada chamador      decide o TEXTO    (o banner só desenha "ativo";
 *                                           a Fast desenha "ativo" e "vencido")
 *
 * O #319 nunca foi "a Fast não podia saber da cobrança". Foi "a Fast afirmava
 * `PENDENTE aguardando pagamento`" — uma frase que significa *ainda dá pra
 * pagar, vai lá pagar*. O conserto honesto é dizer a verdade sobre o estado,
 * não apagar o fato. Divergir de novo continua impossível: o estado é UM só,
 * calculado aqui; o que muda é só como cada tela o escreve.
 *
 * ⚠️ PARIDADE COM A CÓPIA CERTA É INTENCIONAL, inclusive nos cantos:
 *  - data ILEGÍVEL não vira aviso (o `NaN < janela` do layout já dava false;
 *    aqui está explícito em vez de acidental);
 *  - data no FUTURO (relógio adiantado / skew de alguns segundos entre o
 *    Postgres e o Node) CONTINUA valendo como aviso ativo, igual antes. Um
 *    guard de "idade negativa" pareceria mais correto e esconderia o banner
 *    de quem acabou de gerar o Pix — que é o único momento em que ele
 *    realmente importa.
 */

/** Janela típica de vida de um Pix/boleto. Fora dela, o código já morreu. */
export const JANELA_AVISO_PENDENTE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * O estado da cobrança assíncrona. `"vencido"` existe porque "não há cobrança"
 * e "há uma cobrança, morta" são fatos DIFERENTES para quem atende — ver o
 * bloco "POR QUE SÃO TRÊS ESTADOS" no cabeçalho.
 */
export type EstadoPendente = "nenhum" | "ativo" | "vencido";

export type EntradaAvisoPendente = {
  /** `profiles.pending_payment_at` (ISO). NULL/vazio = nada pendente. */
  pendingPaymentAt: string | null | undefined;
  /** Já tem acesso pago (`hasActiveAccess`)? Então o pagamento caiu: não avisa. */
  temAcesso: boolean;
  /** Equipe/admin (`bypassesBilling`)? Nunca vê cobrança. */
  bypassaCobranca: boolean;
  /** Injetável só pra teste determinístico (prazo com relógio real vira teste que quebra sozinho). */
  agora?: number;
};

/**
 * Em que estado está o pagamento assíncrono desta conta?
 *
 * - `"nenhum"`  — não há cobrança a mencionar. Ou nunca houve, ou a pessoa JÁ
 *                 tem acesso (o pagamento caiu), ou é da equipe. NINGUÉM fala
 *                 de cobrança neste estado: nem o banner, nem a Fast.
 * - `"ativo"`   — cobrança gerada dentro da janela: ainda é pagável.
 * - `"vencido"` — o código morreu. NÃO é "não existe": é um fato que a Fast
 *                 precisa pra explicar a falta de acesso (ver cabeçalho).
 *
 * Fonte de verdade única do banner do /app E da linha do contexto da Fast.
 */
export function estadoAvisoPendente({
  pendingPaymentAt,
  temAcesso,
  bypassaCobranca,
  agora = Date.now(),
}: EntradaAvisoPendente): EstadoPendente {
  // Pagou (ou é da casa): não há o que cobrar, nem vivo nem morto — não sobra
  // falta de acesso pra explicar. Vem antes da data de propósito: é a checagem
  // que a cópia do account.ts não fazia.
  if (temAcesso || bypassaCobranca) return "nenhum";

  if (pendingPaymentAt == null || String(pendingPaymentAt).trim() === "") return "nenhum";

  const marcado = new Date(pendingPaymentAt).getTime();
  // Data ilegível não vira cobrança: não afirmamos "venceu" a partir de lixo.
  if (!Number.isFinite(marcado)) return "nenhum";

  return agora - marcado < JANELA_AVISO_PENDENTE_MS ? "ativo" : "vencido";
}

/**
 * Existe cobrança pendente AINDA PAGÁVEL?
 *
 * É o que o banner do /app desenha — e só ele deve usar esta forma reduzida.
 * Quem ATENDE (a Fast) precisa distinguir "não existe" de "existe e venceu", e
 * para isso usa `estadoAvisoPendente`. Colapsar os dois casos aqui foi
 * exatamente o erro descrito no cabeçalho.
 */
export function avisoPagamentoPendenteAtivo(entrada: EntradaAvisoPendente): boolean {
  return estadoAvisoPendente(entrada) === "ativo";
}

/**
 * Há quantos dias inteiros a cobrança foi gerada? `null` se não dá pra saber.
 *
 * Serve pro atendimento: "venceu há 57 dias" comunica o tamanho do problema de
 * um jeito que a data sozinha não comunica — ainda mais porque `dtBR` imprime
 * dia/mês sem ano, e boa parte destas pendências é de meses atrás.
 */
export function diasDesde(
  pendingPaymentAt: string | null | undefined,
  agora: number = Date.now(),
): number | null {
  if (pendingPaymentAt == null || String(pendingPaymentAt).trim() === "") return null;
  const marcado = new Date(pendingPaymentAt).getTime();
  if (!Number.isFinite(marcado)) return null;
  return Math.floor((agora - marcado) / (24 * 60 * 60 * 1000));
}
