/**
 * Registro de CADA e-mail de aviso do onboarding/SGP — tabela `avisos_enviados`.
 * Server-only.
 *
 * 03/09 (Lucas perguntou "o sistema manda e-mail quando o clone fica pronto?"):
 * a resposta era "manda", mas NÃO DAVA PRA PROVAR. `sendSupportMail` não grava
 * linha nenhuma; a única pista era um `console.log` em `pronto.ts` — e o
 * FrontendServer.log do servidor só captura evento de navegador (scope:client),
 * então nem esse console sobrevive. Resultado prático: quando um aluno dizia
 * "nunca me avisaram", não tínhamos como saber se avisamos.
 *
 * Caso que motivou: Celso Slompo (celsoslompo@gmail.com) — voz `ready` e 5
 * avatares `ready` desde 29/08, nenhuma assinatura, logo deveria ter recebido
 * o `avisoOkMasAssine` naquele dia. Em 02/09 ele perguntou na área de membros
 * "qual a data para receber o clone pronto?". Ou não recebeu, ou caiu no spam,
 * ou não entendeu — e não havia como saber qual dos três.
 *
 * A cópia na pasta Sent (via `appendToSentFolder`) existe, mas é best-effort e
 * não é consultável por SQL: serve pra ler o e-mail, não pra responder "quantos
 * avisos falharam esta semana". Por isso a tabela.
 *
 * Best-effort SEMPRE: registro NUNCA derruba o envio — o aluno ser avisado
 * importa mais que o registro do aviso. Mesma regra do `registrar-run.ts`.
 *
 * ⚠️ A migration `scripts/104_avisos_enviados.sql` NÃO foi aplicada (decisão do
 * Johnny). Enquanto a tabela não existir, o insert falha, é logado e a vida
 * segue — nenhum e-mail deixa de sair por causa disto.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Chave estável do aviso — é por ela que se consulta "o Celso recebeu o
 * ok_mas_assine?". NÃO reaproveitar chave entre textos diferentes: o `_sem_imagem`
 * existe porque o texto do #189 é outro e-mail, não uma variação cosmética.
 */
export type ChaveAviso =
  | "onboarding_comecamos"
  | "onboarding_processando_imagens"
  | "onboarding_processando_audio"
  | "onboarding_precisamos_de_voce"
  | "onboarding_pronto"
  | "onboarding_pronto_sem_imagem"
  | "onboarding_ok_mas_assine"
  | "onboarding_ok_mas_assine_sem_imagem"
  | "sgp_foto_pronta"
  | "sgp_voz_pronta"
  /** boas-vindas da COMPRA do SGP na Hotmart, mandando preencher o /sgp */
  | "sgp_compra_boas_vindas";

export type AvisoRegistro = {
  email: string;
  /** Conta do aluno, quando o caller sabe qual é. */
  userId?: string | null;
  aviso: ChaveAviso;
  assunto: string;
  /**
   * A que evento o aviso se refere — o gatilho, em texto curto: "voz ready +
   * 5 avatares ready", "webhook kie", "etapa foto do pedido <id>". É o que
   * explica POR QUE o e-mail saiu naquele instante.
   */
  referencia?: string | null;
  ok: boolean;
  /** Mensagem do erro quando `ok` é false. */
  erro?: string | null;
};

/** A linha exatamente como vai pro banco. Separada pra ser testável sem cliente. */
export function linhaDoAviso(r: AvisoRegistro): Record<string, unknown> {
  return {
    email: r.email,
    user_id: r.userId ?? null,
    aviso: r.aviso,
    assunto: r.assunto,
    referencia: r.referencia ?? null,
    ok: r.ok,
    // Erro só faz sentido em falha, e mensagem gigante não ajuda a ler a tabela.
    erro: r.ok ? null : (r.erro ?? "").slice(0, 500) || null,
  };
}

/**
 * Grava o registro. NUNCA lança e NUNCA propaga erro de banco — o caller já
 * mandou (ou tentou mandar) o e-mail antes de chegar aqui.
 */
export async function registrarAviso(
  admin: SupabaseClient,
  r: AvisoRegistro,
): Promise<void> {
  try {
    // `as never`: a tabela é nova e ainda não está nos tipos gerados do
    // Supabase. Mesmo padrão já usado com `sgp_pedidos` em lib/sgp/etapas.ts.
    const { error } = await admin
      .from("avisos_enviados" as never)
      .insert(linhaDoAviso(r) as never);
    if (error) {
      // Tabela ausente (migration não aplicada) cai aqui: log e segue.
      console.error(`[onboarding/aviso] não registrou "${r.aviso}" → ${r.email}:`, error.message);
    }
  } catch (e) {
    console.error(
      `[onboarding/aviso] não registrou "${r.aviso}" → ${r.email}:`,
      e instanceof Error ? e.message : e,
    );
  }
}
