/**
 * SGP — registra POR QUE a compra do aluno não entrou na conta (incidente #282).
 *
 * A decisão (o que é falha, o que escrever) mora em `reconciliacao-pure.ts`.
 * Aqui fica só o I/O: ler as órfãs que sobraram e abrir o chamado pelo caminho
 * que o projeto já usa (`abrirChamadoReportado`).
 *
 * ⚠️ CONTRATO DESTE ARQUIVO: **nunca lança e nunca escreve nada além do
 * chamado**. Criar a conta do aluno não pode passar a falhar porque o registro
 * de uma falha falhou — seria trocar um silêncio por um estrago. Também não
 * vincula compra, não dá crédito e não mexe em acesso: isso é conserto, e
 * conserto é decisão de gente.
 */
import { getAdmin } from "@/lib/db/admin";
import { abrirChamadoReportado } from "@/lib/incidents/reportar";
import { entitlementValeAcesso } from "@/lib/payments/entitlements";
import { entitlementDaPlataforma, produtosDeCurso } from "@/lib/payments/acesso-regra";
import { diagnosticarClaim, type EntitlementOrfa } from "./reconciliacao-pure";

export type EntradaRegistro = {
  userId: string;
  /** E-mail da conta, em minúsculas — o mesmo que foi ao resgate. */
  email: string;
  contaCriada: boolean;
  /** O que `claimPurchasesOnLogin` lançou, ou null se não lançou. */
  erro: unknown;
};

/**
 * Órfãs (`user_id IS NULL`) deste e-mail que ainda dão acesso.
 *
 * O casamento é o MESMO `ilike` do `reconcileUserEntitlements` de propósito: se
 * a checagem casasse mais (ou menos) que o reconcile, ela acusaria falha em
 * linha que o reconcile nunca quis ligar — ou deixaria passar a que ele quis e
 * não conseguiu. Detector e conserto têm que enxergar o mesmo conjunto.
 */
async function orfasQueSobraram(email: string): Promise<EntitlementOrfa[]> {
  const { data, error } = await getAdmin()
    .from("entitlements")
    .select("external_id, status, access_until, buyer_email, raw_event, product_code")
    .is("user_id", null)
    .ilike("buyer_email", email);
  if (error) throw error;

  const agoraIso = new Date().toISOString();
  // A lista de produto vem do MESMO `produtosDeCurso()` do reconcile (que lê o
  // `HOTMART_SGP_PRODUCT_ID`), não do padrão: com o padrão, um SGP novo em
  // ambiente faria este detector contar como plataforma a órfã que o reconcile
  // pula por ser curso — e abriria chamado falso exatamente nela.
  const cursos = produtosDeCurso();
  return ((data ?? []) as EntitlementOrfa[]).filter(
    (o) =>
      // Régua compartilhada (payments/entitlements.ts): refunded/chargeback/
      // expired e cancelamento sem período restante NÃO são vítima — o dinheiro
      // voltou ou o acesso acabou. Copiar essa regra aqui seria criar a segunda
      // versão dela, que é como ela volta a divergir.
      entitlementValeAcesso({ status: o.status ?? "", access_until: o.access_until }, agoraIso) &&
      // ...e a MESMA régua de produto do reconcile (#2d0509b4). Órfã de CURSO
      // deixou de ser adotada de propósito; sem este filtro o detector passaria
      // a acusar "sobrou compra paga sem dono" justamente nas linhas que o
      // conserto decidiu NÃO ligar — o "casa mais que o reconcile" que o
      // comentário acima existe para impedir.
      entitlementDaPlataforma(o.product_code, cursos),
  );
}

/**
 * Olha o que o resgate REALMENTE conseguiu e abre chamado se sobrou compra paga
 * sem dono (ou se o resgate explodiu). Devolve o número do chamado, ou null
 * quando não havia nada a relatar — que é o caso normal.
 */
export async function registrarFalhaDeClaim(e: EntradaRegistro): Promise<number | null> {
  try {
    const orfas = await orfasQueSobraram(e.email);
    const diag = diagnosticarClaim({ ...e, orfas });
    if (!diag) return null;

    // Log além do chamado: se a gravação do chamado falhar, o motivo ainda
    // aparece no log do deploy em vez de sumir de novo.
    console.error(`[sgp/reconciliacao] ${diag.title} — ${diag.sampleError ?? "sem detalhe"}`);
    return await abrirChamadoReportado({ ...diag, reportedBy: "sgp-lote" });
  } catch (err) {
    // Última linha: nem o registro da falha pode derrubar o envio do aluno.
    console.error(
      `[sgp/reconciliacao] não consegui registrar a falha de claim de ${e.email}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
