/**
 * A DECISÃO "o que gravar no cache de acesso do perfil", PURA e testável —
 * incidente #282.
 *
 * POR QUE ESTE ARQUIVO EXISTE. `recomputeProfileAccess` (entitlements.ts) lia os
 * entitlements do usuário e gravava `profiles.plan/access_source/access_until`
 * assim:
 *
 *     const { data: ents } = await admin.from("entitlements").select(...)
 *     const active = (ents ?? []).filter(valeAcesso).sort(...)[0]
 *     await admin.from("profiles").update(active ? {pro...} : {free...})
 *
 * O `error` do SELECT era descartado. No supabase-js, consulta que ERRA volta
 * com `data: null` — então RLS, queda de rede ou coluna inexistente produziam
 * `ents = null`, `active = undefined` e a função gravava, na hora,
 * `plan: "free", access_source: null, access_until: null` no perfil de quem
 * PAGOU. Erro de LEITURA revogava acesso de pagante, em silêncio, e o webhook
 * seguinte registrava sucesso limpo.
 *
 * É a armadilha que a casa já documentou em `vinculo.ts` (#222) e em
 * `acesso-regra.ts` (#2d0509b4): **ausência de informação não é a informação
 * "esta pessoa não tem nada"**. Na dúvida, não se retira nada.
 *
 * A decisão mora aqui, separada do I/O, pelo mesmo motivo de
 * `sgp/reconciliacao-pure.ts`: `entitlements.ts` importa `@/lib/db/admin` e não
 * dá pra tocá-lo com `node --test`. Aqui o único import é `./acesso-regra.ts`,
 * que tem ZERO import — então a regra mais cara da casa fica sob teste.
 *
 * A REGRA DE NEGÓCIO NÃO MUDOU: filtro, ordenação e desempate são byte a byte
 * os de antes (quem vale acesso vem de `entitlementValeAcesso`; "active" ganha
 * de "canceled"; empatado, a data mais longe). O que mudou é só o que fazer
 * quando a leitura FALHA.
 *
 * Testes: `node --test src/lib/payments/entitlements-pure.test.ts`
 */
import { entitlementValeAcesso } from "./acesso-regra.ts";

/** A linha de entitlement como ela chega do SELECT do recompute. */
export type LinhaDeAcesso<P extends string = string> = {
  provider: P;
  status: string;
  access_until: string | null;
};

/**
 * O retorno CRU do supabase-js: `{ data, error }`. A função recebe os dois de
 * propósito — é justamente o `error` descartado que causou o #282, então ele
 * entra na assinatura e não tem como ser esquecido de novo.
 */
export type ConsultaDeAcesso<P extends string = string> = {
  data: LinhaDeAcesso<P>[] | null;
  error: { message?: string | null } | null;
};

export type PatchDeAcesso<P extends string = string> = {
  plan: "free" | "pro";
  access_source: P | null;
  access_until: string | null;
};

export type DecisaoDeAcesso<P extends string = string> =
  /** NÃO escreva nada em `profiles`: não sabemos o que esta pessoa tem. */
  | { escrever: false; motivo: "erro_de_leitura" | "sem_dados_e_sem_erro" }
  | { escrever: true; patch: PatchDeAcesso<P> };

/**
 * Entre vários entitlements, o MELHOR: "active" ganha de "canceled"; empatado, a
 * data mais longe (vitalício = infinito). Sem isto, um entitlement velho podia
 * encurtar o acesso de quem tem outro mais novo. Cópia literal do que estava em
 * `recomputeProfileAccess` — não é para mudar aqui.
 */
function melhorAcesso<P extends string>(
  linhas: readonly LinhaDeAcesso<P>[],
  agoraIso: string,
): LinhaDeAcesso<P> | undefined {
  return linhas
    .filter((e) => entitlementValeAcesso(e, agoraIso))
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      const va = a.access_until === null ? Infinity : new Date(a.access_until).getTime();
      const vb = b.access_until === null ? Infinity : new Date(b.access_until).getTime();
      return vb - va;
    })[0];
}

/**
 * "O que gravar no perfil?" — a única saída possível para leitura que falhou é
 * `escrever: false`.
 *
 * ⚠️ `data: null` SEM `error` também aborta. Hoje o supabase-js não produz esse
 * par, mas se produzir ele é indistinguível de "nenhum entitlement", e a
 * diferença entre os dois é o acesso de um pagante. Ausência de resposta não é
 * resposta.
 *
 * Lista VAZIA (`data: []`) é diferente: é resposta de verdade, a pessoa não tem
 * entitlement nenhum, e `free` é o correto.
 */
export function decidirAcessoDoPerfil<P extends string>(
  consulta: ConsultaDeAcesso<P>,
  agoraIso: string,
): DecisaoDeAcesso<P> {
  if (consulta.error) return { escrever: false, motivo: "erro_de_leitura" };
  if (!consulta.data) return { escrever: false, motivo: "sem_dados_e_sem_erro" };

  const melhor = melhorAcesso(consulta.data, agoraIso);
  return melhor
    ? {
        escrever: true,
        patch: {
          plan: "pro",
          access_source: melhor.provider,
          access_until: melhor.access_until,
        },
      }
    : {
        escrever: true,
        patch: { plan: "free", access_source: null, access_until: null },
      };
}
