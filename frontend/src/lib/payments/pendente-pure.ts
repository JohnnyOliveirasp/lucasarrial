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
 * MEDIDO NO BANCO em 09/09/2026 rodando ESTA função contra `profiles`, não
 * estimado. 130 perfis têm `pending_payment_at`, e o null check cru afirmava
 * a pendência pros 130. Com a regra certa sobram 23. Os 107 silenciados:
 *     101  fora da janela de 3 dias e sem acesso  → o Pix já tinha morrido
 *       5  JÁ com acesso ativo                    → pagaram; mandar pagar de
 *          novo é o pior caso dos três
 *       1  equipe (`lucas.m.arrial@gmail.com`, o próprio sócio, que nunca
 *          deveria ver cobrança nenhuma)
 *
 * ⚠️ O chamado #319 falava em "12 atingidos". Esse número era um piso, não o
 * alcance: ele saiu de uma varredura que considerava "sem acesso" só quem
 * tinha `access_until` E `access_source` NULOS. A regra real (`hasActiveAccess`)
 * lê `access_until` VENCIDO como sem acesso também — e é por isso que o total
 * verdadeiro é 101. `aneto2@gmail.com` é o exemplo: `access_source='hotmart'`
 * com `access_until` em 28/08 (vencido), invisível na varredura antiga, e
 * ainda por cima cobrado em EUR.
 *
 * Por isso a regra mora AQUI, e só aqui. Os dois chamadores importam esta
 * função. Se a janela mudar amanhã, muda num lugar só — duplicar a condição
 * de novo é literalmente o defeito que este arquivo existe pra impedir.
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
 * Existe pagamento assíncrono pendente que ainda vale a pena mencionar?
 *
 * É a fonte de verdade do banner do /app E da linha do contexto da Fast.
 * `false` significa "não fale de pagamento pendente" — nem banner, nem texto.
 */
export function avisoPagamentoPendenteAtivo({
  pendingPaymentAt,
  temAcesso,
  bypassaCobranca,
  agora = Date.now(),
}: EntradaAvisoPendente): boolean {
  // Pagou (ou é da casa): não há o que cobrar. Vem antes da data de propósito —
  // é a checagem que a cópia do account.ts não fazia.
  if (temAcesso || bypassaCobranca) return false;

  if (pendingPaymentAt == null || String(pendingPaymentAt).trim() === "") return false;

  const marcado = new Date(pendingPaymentAt).getTime();
  if (!Number.isFinite(marcado)) return false;

  return agora - marcado < JANELA_AVISO_PENDENTE_MS;
}
