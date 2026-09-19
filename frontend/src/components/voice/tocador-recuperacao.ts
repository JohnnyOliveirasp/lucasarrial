/**
 * O que o card do histórico faz quando o `<audio>` não carrega.
 *
 * Está fora do componente pelo mesmo motivo do `progresso-envio.ts`: a regra
 * aqui é uma INVARIANTE ("o tocador não morre calado, e tenta se curar UMA
 * vez") e invariante sem teste volta.
 *
 * O buraco que isto fecha (19/09, aluna rendanova2023): o card tem o tocador e
 * o botão de baixar lado a lado, servindo a MESMA URL assinada, e cada um
 * tratava a expiração de um jeito. O download já se curava desde que virou um
 * "mp3" com XML de erro do R2 dentro (ver `download()` em
 * generations-history.tsx): se o fetch falha, ele pede URL fresca em
 * /api/v1/generations/<id> e tenta de novo. O `<audio>` não tinha nada disso —
 * sem `onError`, a URL de 1h (createPresignedGet(..., 60*60), generations/
 * route.ts:94) vencia com a aba aberta e o browser desenhava um controle
 * morto. O aluno via um tocador que não faz nada, sem mensagem, com o botão de
 * baixar AO LADO funcionando. E nós não ficávamos sabendo de nada.
 *
 * Medido no dia: não era objeto ausente, key errada nem assinatura quebrada —
 * os 3 objetos da aluna existiam no R2, com tamanho e content-type corretos, e
 * o GET assinado devolvia 206. Por isso o aviso desta tela NÃO afirma que o
 * arquivo está corrompido nem joga a culpa no aluno: ele diz o fato ("não
 * consegui tocar aqui") e aponta a saída que funciona (o botão de baixar, que
 * busca cópia nova).
 */

/**
 * Onde o tocador de UM card está.
 *
 * - `recuperando`: já pedimos a URL fresca. O src que está no ar agora é a
 *   segunda (e última) tentativa.
 * - `sem-tocador`: desistimos. O card mostra o aviso no lugar do controle.
 *
 * Ausente (`undefined`) = nunca falhou, está na URL que veio da listagem.
 */
export type EstadoTocador = "recuperando" | "sem-tocador";

/**
 * O que fazer no próximo `onError`.
 *
 * `ignorar` existe porque o elemento pode disparar erro mais de uma vez depois
 * de já termos desistido — e um `onError` que sempre re-assina é um laço de
 * requisição contra a nossa própria API. Uma tentativa, ponto.
 */
export type PassoDoTocador = "recuperar" | "desistir" | "ignorar";

export function proximoPassoDoTocador(estado: EstadoTocador | undefined): PassoDoTocador {
  if (estado === undefined) return "recuperar";
  if (estado === "recuperando") return "desistir";
  return "ignorar";
}

export type ResultadoRecuperacao =
  | { ok: true; url: string }
  /**
   * `motivo` não vai pra tela — o aviso é o mesmo em qualquer falha, porque em
   * nenhum destes casos nós sabemos dizer ao aluno o que houve. Está aqui pro
   * teste conseguir distinguir os caminhos.
   */
  | { ok: false; motivo: "http" | "sem_url" | "excecao" };

/** Assinatura mínima do `fetch` que esta função usa — pro teste injetar o dele. */
export type FetchLike = (
  input: string,
  init?: { cache?: RequestCacheLike },
) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

type RequestCacheLike = "no-store" | "default" | "reload" | "no-cache" | "force-cache";

/**
 * Pede ao backend uma URL assinada nova pra esta geração.
 *
 * Mesmo endpoint e mesmo formato de resposta que o `download()` já usa há
 * tempos: GET /api/v1/generations/<id> devolve
 * `jsonOk({ generation: { ...row, audio_url } })` ([id]/route.ts:203). Se o
 * áudio não estiver `ready`, `audio_url` vem `null` — e aí não há o que tocar.
 */
export async function buscarUrlFresca(
  generationId: string,
  fetchImpl: FetchLike,
): Promise<ResultadoRecuperacao> {
  try {
    const res = await fetchImpl(`/api/v1/generations/${generationId}`, { cache: "no-store" });
    if (!res.ok) return { ok: false, motivo: "http" };
    const json = (await res.json()) as { generation?: { audio_url?: string | null } } | null;
    const url = json?.generation?.audio_url ?? null;
    if (!url) return { ok: false, motivo: "sem_url" };
    return { ok: true, url };
  } catch {
    return { ok: false, motivo: "excecao" };
  }
}

/** O que o card tem que fazer depois de um `onError`. */
export type AcaoDeFalha =
  /** Já desistimos antes; o elemento só está repetindo o erro. */
  | { tipo: "nada" }
  /** Segunda e última tentativa: o card troca o src por esta URL. */
  | { tipo: "trocar-src"; url: string }
  /** Acabou a corda: o controle sai da tela e entra o aviso. */
  | { tipo: "mostrar-aviso" };

/**
 * A reação inteira a um `onError` do `<audio>`, num lugar só, pra que o
 * componente seja fiação e o teste exercite o código que roda de verdade.
 *
 * `estados` é o mapa MUTÁVEL de guarda do card (no componente é um `useRef`,
 * não `useState`, de propósito): a marca de "já estou tentando" é gravada
 * ANTES do `await`, de forma síncrona. Com `useState` dois eventos de erro no
 * mesmo tick leriam o valor velho do closure e disparariam duas buscas.
 */
export async function aoFalharOTocador(
  generationId: string,
  estados: Map<string, EstadoTocador>,
  fetchImpl: FetchLike,
): Promise<AcaoDeFalha> {
  const passo = proximoPassoDoTocador(estados.get(generationId));
  if (passo === "ignorar") return { tipo: "nada" };
  if (passo === "desistir") {
    estados.set(generationId, "sem-tocador");
    return { tipo: "mostrar-aviso" };
  }
  estados.set(generationId, "recuperando"); // fecha a porta antes do await
  const fresca = await buscarUrlFresca(generationId, fetchImpl);
  if (!fresca.ok) {
    // Nem chegou a haver segunda tentativa de tocar: o backend não deu URL.
    estados.set(generationId, "sem-tocador");
    return { tipo: "mostrar-aviso" };
  }
  return { tipo: "trocar-src", url: fresca.url };
}
