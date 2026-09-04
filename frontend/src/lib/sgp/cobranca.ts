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

/**
 * O erro do Postgres é "coluna não existe"?
 *
 * `42703` é o SQLSTATE de `undefined_column` — é por ele que decidimos, não por
 * texto. O casamento por mensagem é só rede de segurança pra quando o PostgREST
 * engole o código (acontece em erro de schema cache), e é ANCORADO nos nossos
 * dois nomes de coluna de propósito: um "column does not exist" genérico é bug
 * de verdade e TEM que estourar, não virar degradação silenciosa.
 */
export function colunaCobrancaAusente(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  if (e.code === "42703") return true;
  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  if (!msg.includes("does not exist") && !msg.includes("não existe")) return false;
  return COLUNAS_COBRANCA.some((c) => msg.includes(c));
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
export type ResultadoFila<T> = Consulta<T> & { cobrancaDisponivel: boolean };

/**
 * Consulta a fila pedindo as colunas de cobrança e, se elas ainda não existirem,
 * repete SEM elas. Fica aqui (e não solto na rota) porque a máquina de estados
 * do memo é a parte que dá pra errar em silêncio — e o preço de errar é a tela
 * do time de suporte fora do ar.
 *
 * O memo guarda SÓ o "sim". O "não" é re-testado a cada chamada de propósito:
 * é assim que o botão aparece sozinho no minuto em que o Johnny aplicar a
 * migration 106, sem deploy e sem restart. O custo do estado degradado é uma
 * consulta extra por request, num painel com dois pedidos: irrelevante.
 *
 * Erro que NÃO é coluna ausente passa reto, com `cobrancaDisponivel: true` —
 * a rota devolve 500 e ninguém confunde uma falha real com "recurso desligado".
 */
export function criarFilaComFallback<T>(
  consultar: (colunas: string) => Promise<Consulta<T>>,
  comCobranca: string,
  semCobranca: string,
): () => Promise<ResultadoFila<T>> {
  let temColunas: boolean | null = null;

  return async () => {
    if (temColunas !== false) {
      const r = await consultar(comCobranca);
      if (!r.error) {
        temColunas = true;
        return { ...r, cobrancaDisponivel: true };
      }
      if (!colunaCobrancaAusente(r.error)) return { ...r, cobrancaDisponivel: true };
      temColunas = false;
    }
    return { ...(await consultar(semCobranca)), cobrancaDisponivel: false };
  };
}
