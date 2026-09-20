/**
 * ESTORNO do clipe de cena que falhou — perna do REGERAR (`video_clip_regen`).
 *
 * POR QUE EXISTE (medido no banco em 20/09, chamado #485): a perna de cena
 * NUNCA estornou. Desde 07/07:
 *   video_clips        238 débitos  −4.678.938 cr   estornos: ZERO
 *   video_clip_regen   301 débitos    −781.180 cr   estornos: ZERO
 * O irmão `lib/images/video-sync.ts` (Animar Imagem) estorna desde 11/07 —
 * 87 estornos / +165.300 cr em 2.379 débitos. A cena ficou pra trás, e o
 * `grep refund|estorn|addCredits` em `lib/video/video-sync.ts` voltava vazio.
 * Caso vivo: hercules.contador@gmail.com, 19/09 23h, 22.440 cr em 5 cenas
 * `failed` sem um estorno sequer.
 *
 * POR QUE SÓ A PERNA DO REGEN: no `video_clip_regen` o `ref_id` do débito JÁ É
 * a CENA (regenerate/route.ts:131 e wand/route.ts:129 gravam `refId: sceneId`),
 * então a atribuição débito↔falha é 1:1 e o estorno é exato. O `video_clips`
 * é AGREGADO por projeto (`refId: id` do projeto, videos/route.ts:216, bloco 211-220, com
 * `amount = started * costPer`): estornar UMA cena a partir dele exigiria
 * mudar a granularidade do débito, que é decisão de produto/dinheiro e está
 * fora deste módulo de propósito.
 *
 * REGRA DO ESTORNO — SALDO PENDENTE, não "existe débito":
 * a mesma cena pode ser regerada e falhar N vezes, então o par (ref_type,
 * ref_id) acumula várias linhas dos dois lados. Decidir por "tem débito" é
 * exatamente o defeito do #469/b706b32e ("cada falha da mesma voz gerando um
 * estorno novo contra um único débito"): aluno debitado 1× e estornado 2×.
 * Aqui a conta é sempre a mesma: devolve no MÁXIMO o que ainda está pendente
 * para aquele `ref_id` (cobrado − já devolvido), nunca mais.
 *
 * ⚠️ O casamento é por `ref_type` + `ref_id`, NUNCA por `kind`: o estorno é
 * gravado pelo `add_extra_credits` com `kind='extra_purchase'`, igual a uma
 * recarga comprada. Filtrar por `kind` devolveria dinheiro de compra como se
 * fosse estorno e a conta do pendente sairia errada nos dois sentidos.
 *
 * Este módulo NÃO engole erro: leitura do extrato que falha e crédito que volta
 * `ok:false` viram exceção pro chamador. Dinheiro sumindo em silêncio é o pior
 * desfecho possível aqui — pior, inclusive, que a cena ficar sem marcar.
 *
 * Server-only na prática (o `admin` é service_role), mas sem import de runtime
 * de propósito: a decisão é testável sem subir banco nem Next.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/** `ref_type` do débito de UMA regeração de clipe de cena (o débito 1:1). */
export const REF_TYPE_DEBITO_REGEN = "video_clip_regen";
/** `ref_type` do estorno correspondente — é também a chave de idempotência. */
export const REF_TYPE_ESTORNO_REGEN = "video_clip_regen_refund";

/** Uma linha do extrato como este módulo precisa dela: só o valor. */
export type LinhaDeExtrato = { amount: number };

export type DecisaoDeEstorno = {
  /** true = tem dinheiro pendente pra devolver nesta falha. */
  estornar: boolean;
  /** Quanto devolver (0 quando `estornar` é false). Sempre > 0 quando true. */
  valor: number;
  /** Soma dos débitos de regen desta cena (positivo). */
  cobrado: number;
  /** Soma do que já foi estornado desta cena (positivo). */
  devolvido: number;
  /** Frase curta pro log/relatório — é o que explica um "não estornei". */
  motivo: string;
};

/**
 * A DECISÃO, pura: dado o extrato daquela cena, devolver quanto?
 *
 * `debitos` vem ordenado por `created_at` DESC — o índice 0 é a tentativa que
 * acabou de falhar, e o valor dela é o teto natural de uma devolução. O outro
 * teto é o saldo pendente. Os dois tetos existem porque o preço por clipe
 * MUDA com o tier do projeto (`tiers.creditsPerClip`): um aluno que regerou no
 * tier caro, foi estornado, trocou pro barato e falhou de novo não pode
 * receber o valor do clipe caro.
 */
export function decidirEstornoDeRegen(a: {
  debitos: readonly LinhaDeExtrato[];
  estornos: readonly LinhaDeExtrato[];
}): DecisaoDeEstorno {
  // Defensivo nos dois lados: débito é negativo, estorno é positivo. Linha com
  // sinal trocado (ou NaN) é ruído de dado e não pode virar dinheiro.
  const debitos = a.debitos.filter((l) => Number.isFinite(l.amount) && l.amount < 0);
  const estornos = a.estornos.filter((l) => Number.isFinite(l.amount) && l.amount > 0);

  const cobrado = debitos.reduce((s, l) => s + Math.abs(l.amount), 0);
  const devolvido = estornos.reduce((s, l) => s + l.amount, 0);

  if (debitos.length === 0) {
    // Quem não foi cobrado não tem o que receber: equipe/admin (bypassesBilling),
    // ou falha PRÉ-despacho — o débito do regen só é gravado DEPOIS que o Kie
    // aceita a tarefa (regenerate/route.ts:125-134), então falhar antes disso
    // não cobrou nada.
    return {
      estornar: false,
      valor: 0,
      cobrado: 0,
      devolvido,
      motivo: `nada cobrado (sem débito ${REF_TYPE_DEBITO_REGEN} nesta cena)`,
    };
  }

  const pendente = cobrado - devolvido;
  if (pendente <= 0) {
    // AQUI mora a trava do #469: a MESMA cena falhando de novo, já com estorno
    // casado, não gera um segundo crédito.
    return {
      estornar: false,
      valor: 0,
      cobrado,
      devolvido,
      motivo: `estorno já aplicado (cobrado ${cobrado}, devolvido ${devolvido})`,
    };
  }

  const tentativa = Math.abs(debitos[0].amount);
  const valor = Math.min(tentativa, pendente);
  return {
    estornar: true,
    valor,
    cobrado,
    devolvido,
    motivo:
      `devolver ${valor} (tentativa ${tentativa}, pendente ${pendente} = ` +
      `cobrado ${cobrado} − devolvido ${devolvido})`,
  };
}

/** Só o que este módulo usa do serviço de créditos — injetado pra ser testável. */
export type Creditar = (a: {
  userId: string;
  amount: number;
  refType?: string;
  refId?: string;
}) => Promise<{ ok: boolean }>;

export type ResultadoDoEstorno = DecisaoDeEstorno & { aplicado: boolean };

/**
 * Lê o extrato da cena, decide e credita. LANÇA se a leitura do extrato falhar
 * ou se o crédito não confirmar — quem chama precisa saber que o dinheiro NÃO
 * voltou.
 *
 * Chamar SÓ depois de vencer a transição idempotente da cena pra `failed`
 * (mesmo desenho de `lib/images/video-sync.ts:102-118`): é o claim que impede
 * a corrida webhook × poll de entrar aqui duas vezes ao mesmo tempo. A conta
 * de saldo pendente é a segunda trava, pro caso de falhas em momentos
 * diferentes.
 */
export async function estornarRegenDaCena(
  deps: { admin: SupabaseClient<Database>; creditar: Creditar },
  a: { userId: string; sceneId: string },
): Promise<ResultadoDoEstorno> {
  const { data: debitos, error: erroDebitos } = await deps.admin
    .from("credit_transactions")
    .select("amount")
    .eq("user_id", a.userId)
    .eq("ref_type", REF_TYPE_DEBITO_REGEN)
    .eq("ref_id", a.sceneId)
    .lt("amount", 0)
    .order("created_at", { ascending: false });
  if (erroDebitos) {
    throw new Error(`extrato (débitos) da cena ${a.sceneId}: ${erroDebitos.message}`);
  }

  const { data: estornos, error: erroEstornos } = await deps.admin
    .from("credit_transactions")
    .select("amount")
    // `ref_type` do ESTORNO, nunca `kind` — ver o cabeçalho.
    .eq("user_id", a.userId)
    .eq("ref_type", REF_TYPE_ESTORNO_REGEN)
    .eq("ref_id", a.sceneId);
  if (erroEstornos) {
    throw new Error(`extrato (estornos) da cena ${a.sceneId}: ${erroEstornos.message}`);
  }

  const decisao = decidirEstornoDeRegen({
    debitos: (debitos ?? []) as LinhaDeExtrato[],
    estornos: (estornos ?? []) as LinhaDeExtrato[],
  });
  if (!decisao.estornar) return { ...decisao, aplicado: false };

  const r = await deps.creditar({
    userId: a.userId,
    amount: decisao.valor,
    refType: REF_TYPE_ESTORNO_REGEN,
    refId: a.sceneId,
  });
  if (!r.ok) {
    // `addExtraCredits` não lança: erro de RPC volta como `ok:false`. Engolir
    // isso é justamente como 539 débitos passaram sem um estorno.
    throw new Error(
      `estorno de ${decisao.valor} créditos NÃO aplicado na cena ${a.sceneId} ` +
        `(aluno ${a.userId}) — add_extra_credits devolveu ok:false`,
    );
  }
  return { ...decisao, aplicado: true };
}
