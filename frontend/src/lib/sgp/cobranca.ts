/**
 * SGP — o "já cobrei" do time, do lado do servidor.
 *
 * Duas coisas moram aqui, as duas por um motivo só: a migration 106 NÃO está
 * aplicada e ninguém sabe quando vai estar (quem aplica é o Johnny). Então o
 * painel precisa rodar nos dois mundos — com e sem as colunas — sem quebrar a
 * tela do time de suporte, que é a tela que eles usam pra trabalhar todo dia.
 *
 * A régua de negócio (o que silencia, por quanto tempo, quando volta a alertar)
 * NÃO está aqui: está em painel.ts, que é puro e testável. Aqui é só banco e env.
 */

import { SGP_COBRANCA_SILENCIO_HORAS } from "./painel.ts";

/** As colunas da migration 106. Ausentes até ela ser aplicada. */
export const COLUNAS_COBRANCA = ["cobrado_em", "cobrado_por"] as const;

/** As colunas da migration 109 ("marcar erro"). Mesmo regime: opcionais. */
export const COLUNAS_ERRO_MANUAL = ["erro_manual_em", "erro_manual_por", "erro_manual_motivo"] as const;

/** Todas as colunas que podem não existir ainda, pra decidir se um erro é disso. */
const COLUNAS_OPCIONAIS = [...COLUNAS_COBRANCA, ...COLUNAS_ERRO_MANUAL];

/**
 * O erro do Postgres é "coluna não existe"?
 *
 * `42703` é o SQLSTATE de `undefined_column` — é por ele que decidimos, não por
 * texto. O casamento por mensagem é só rede de segurança pra quando o PostgREST
 * engole o código (acontece em erro de schema cache), e é ANCORADO nos nossos
 * nomes de coluna de propósito: um "column does not exist" genérico é bug de
 * verdade e TEM que estourar, não virar degradação silenciosa.
 */
export function colunaAusente(
  error: unknown,
  colunas: readonly string[] = COLUNAS_OPCIONAIS,
): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === "42703") return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  if (!msg.includes("does not exist") && !msg.includes("não existe")) return false;
  return colunas.some((c) => msg.includes(c));
}

/** Atalhos por grupo, pras rotas de escrita que só falam de um deles. */
export function colunaCobrancaAusente(error: unknown): boolean {
  return colunaAusente(error, COLUNAS_COBRANCA);
}

export function colunaErroManualAusente(error: unknown): boolean {
  return colunaAusente(error, COLUNAS_ERRO_MANUAL);
}

/**
 * Janela de silêncio configurável (`SGP_COBRANCA_SILENCIO_HORAS`), em ms.
 *
 * Lida AQUI e não em painel.ts porque painel.ts também é importado pela página
 * (client component): lá `process.env` some no bundle e o servidor e a tela
 * passariam a usar números diferentes, o que é pior que não ser configurável.
 * Valor inválido, zero ou negativo cai no padrão — configuração torta não pode
 * calar alerta pra sempre (0 seria "silencia até o fim dos tempos" se `<=`).
 */
export function silencioHorasConfigurado(): number {
  const bruto = Number(process.env.SGP_COBRANCA_SILENCIO_HORAS);
  if (!Number.isFinite(bruto) || bruto <= 0) return SGP_COBRANCA_SILENCIO_HORAS;
  return bruto;
}

export function silencioMsConfigurado(): number {
  return silencioHorasConfigurado() * 60 * 60 * 1000;
}

export type Consulta<T> = { data: T[] | null; error: unknown };

/** Um bloco de colunas que pode não existir ainda, com o nome que a tela usa. */
export type GrupoOpcional = { nome: string; colunas: readonly string[] };

export type ResultadoFila<T> = Consulta<T> & {
  /** `{ cobranca: true, erroManual: false }` — o que a tela pode oferecer hoje. */
  disponivel: Record<string, boolean>;
};

/**
 * Consulta a fila pedindo as colunas opcionais e, se alguma ainda não existir,
 * repete sem o GRUPO daquela coluna. Fica aqui (e não solto na rota) porque a
 * máquina de estados do memo é a parte que dá pra errar em silêncio — e o preço
 * de errar é a tela do time de suporte fora do ar.
 *
 * ⚠️ POR QUE OS GRUPOS SÃO INDEPENDENTES E NÃO UM BOOLEANO SÓ: são DUAS
 * migrations (106 = cobrança, 109 = marcar erro) e quem aplica é o Johnny, uma
 * de cada vez. Conferido em 14/09 com `_frank/ferramentas/ddl_aplicado.cjs`: a
 * 106 está commitada desde 04/09 e NÃO está aplicada. Um booleano único faria
 * aplicar só uma delas DESLIGAR a outra — recurso que já funciona morrendo por
 * causa de migration alheia.
 *
 * O memo guarda SÓ o "sim". O "não" é re-testado a cada chamada de propósito: é
 * assim que o botão aparece sozinho no minuto em que a migration entrar, sem
 * deploy e sem restart. O custo do estado degradado é uma consulta extra por
 * request, num painel com 236 pedidos: irrelevante.
 *
 * Erro que NÃO é coluna ausente passa reto, com tudo marcado como disponível —
 * a rota devolve 500 e ninguém confunde uma falha real com "recurso desligado".
 */
export function criarFilaComFallback<T>(
  consultar: (colunas: string) => Promise<Consulta<T>>,
  base: readonly string[],
  grupos: readonly GrupoOpcional[],
): () => Promise<ResultadoFila<T>> {
  /** `false` = já provado ausente. `null` = ainda não sabemos (vale tentar). */
  const conhecido = new Map<string, boolean | null>(grupos.map((g) => [g.nome, null]));

  const mapa = (ativos: readonly GrupoOpcional[]): Record<string, boolean> =>
    Object.fromEntries(grupos.map((g) => [g.nome, ativos.includes(g)]));

  return async () => {
    // No pior caso derruba um grupo por tentativa e ainda faz a consulta nua.
    for (let tentativa = 0; tentativa <= grupos.length; tentativa++) {
      const ativos = grupos.filter((g) => conhecido.get(g.nome) !== false);
      const colunas = [...base, ...ativos.flatMap((g) => g.colunas)].join(", ");
      const r = await consultar(colunas);

      if (!r.error) {
        for (const g of ativos) conhecido.set(g.nome, true);
        return { ...r, disponivel: mapa(ativos) };
      }
      if (!ativos.length || !colunaAusente(r.error)) {
        // Falha real (ou já estamos na consulta nua): sobe cru.
        return { ...r, disponivel: mapa(ativos) };
      }

      // Quais grupos o erro acusa? O PostgREST costuma nomear a coluna.
      const msg =
        typeof (r.error as { message?: unknown }).message === "string"
          ? ((r.error as { message: string }).message).toLowerCase()
          : "";
      const acusados = ativos.filter((g) => g.colunas.some((c) => msg.includes(c)));
      // Sem nome na mensagem (42703 pelado) não dá pra saber de quem é a culpa:
      // derruba UM grupo e tenta de novo, em vez de derrubar todos de uma vez.
      for (const g of acusados.length ? acusados : [ativos[ativos.length - 1]]) {
        conhecido.set(g.nome, false);
      }
    }
    // Inalcançável: o laço acima sempre retorna na consulta sem grupo algum.
    return { data: null, error: new Error("fallback do SGP não convergiu"), disponivel: mapa([]) };
  };
}
