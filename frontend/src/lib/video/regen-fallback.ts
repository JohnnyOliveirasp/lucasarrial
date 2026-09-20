/**
 * REGERAR do clipe de cena: qual modelo tentar e quem tem direito de disparar.
 * Perna (b) do #485 — módulo PURO (sem imports) pra ser testável sem banco.
 *
 * O DEFEITO QUE ISTO FECHA (medido pelo Frank em 20/09 01h30Z): o Regerar
 * redespachava no MESMO modelo titular do tier que acabara de falhar. No Bronze
 * o titular é `grok-imagine-video-1-5-preview` — um PREVIEW. O aluno clicava,
 * pagava, caía no motor que tinha acabado de falhar, e pagava de novo:
 *   · hercules.contador@  22.440 cr, 5 cenas failed, uma cena cobrada 3x
 *   · josimocerqueira@    10.560 cr, 3 cobranças seguidas das MESMAS 2 cenas
 * Nenhum dos dois recebeu vídeo, e esta perna nunca estornou.
 *
 * Os dois irmãos já faziam certo e são o modelo de leitura daqui:
 *   · `lib/images/video-sync.ts:159`  (claim em `image_generations.video_retry_count`, 0→1)
 *   · `lib/studio/scenes.ts:335`      (claim em `studio_scenes.anim_retried`, false→true)
 *
 * POR QUE AQUI O CLAIM NÃO É UMA COLUNA NOVA. `video_scenes` não tem flag de
 * trava nenhuma (migrations 17/19/20/83: nenhum `video_retry_count`, nenhum
 * `anim_retried`). Mas a corrida daqui é de OUTRA natureza e o próprio
 * `video_status` serve de token:
 *   · Nos irmãos a corrida é poll × webhook sobre uma linha que FICA em
 *     pending/generating — o status não muda entre os dois concorrentes, então
 *     eles precisam de um flag à parte.
 *   · Aqui a corrida é POST × POST do aluno sobre uma linha que PRECISA sair do
 *     estado atual pra ser despachada. O compare-and-swap `status atual → pending`
 *     é a trava natural: o segundo clique não acha mais o valor que leu e perde.
 * De quebra isso conserta a COBRANÇA EM DOBRO (o dano medido), que uma coluna
 * `video_retry_count` não consertaria — e evita depender de DDL não aplicado,
 * que é a mordida do #446.
 */

/** Só os campos do reserva que interessam aqui (espelha `VideoFallback` de
 *  `lib/video/tiers.ts` sem importar nada, pra manter o módulo puro). */
export type ReservaLike = {
  kieModel: string;
  durationSeconds: number;
  resolution: string;
};

/**
 * A cena já tem um despacho EM VOO? Regerar por cima de `pending`/`generating`
 * é cobrança pura sem benefício: o clipe que já está sendo gerado continua
 * vindo. É exatamente o furo da rota por cena, que hoje dispara sem olhar
 * status nenhum.
 */
export function estaEmVoo(status: string | null | undefined): boolean {
  return status === "pending" || status === "generating";
}

export type EscolhaDeModelo =
  /** Titular do tier: ou é a 1ª tentativa, ou não há reserva definido. */
  | { usaReserva: false; motivo: "primeira_tentativa" | "sem_reserva" }
  /** O titular já falhou nesta cena → vai no reserva do tier. */
  | { usaReserva: true; motivo: "titular_falhou"; reserva: ReservaLike };

/**
 * Qual modelo este despacho deve usar.
 *
 * Regra: o TITULAR continua sendo o primeiro a ser tentado. O reserva só entra
 * quando a cena está `failed`, isto é, quando o titular já teve a vez dele e
 * perdeu. Cena nunca tentada (`null`) e cena `ready` (aluno editou o prompt e
 * quer refazer) vão no titular.
 *
 * Tier sem reserva na tabela não quebra: cai no titular, que é o comportamento
 * de hoje.
 */
export function escolherModeloDoRegen(args: {
  status: string | null | undefined;
  reserva: ReservaLike | null | undefined;
}): EscolhaDeModelo {
  const { status, reserva } = args;
  if (status !== "failed") return { usaReserva: false, motivo: "primeira_tentativa" };
  if (!reserva) return { usaReserva: false, motivo: "sem_reserva" };
  return { usaReserva: true, motivo: "titular_falhou", reserva };
}

/**
 * Executor do compare-and-swap, injetado pela rota (no código real é o
 * `update(...).eq("video_status", de).select("id")` do Supabase). Devolve
 * QUANTAS linhas mudaram: 1 = ganhei a corrida, 0 = outra via já levou.
 *
 * `de === null` precisa virar `.is("video_status", null)` no PostgREST — `.eq`
 * com null não casa. Quem implementa o executor cuida disso.
 */
export type ExecutorDeClaim = (args: {
  sceneId: string;
  de: string | null;
  para: string;
}) => Promise<number>;

export type ResultadoDoClaim =
  | { ok: true }
  | { ok: false; motivo: "em_voo" | "perdeu_corrida" };

/**
 * Tenta tomar a cena pra si ANTES de chamar o Kie e ANTES de debitar.
 *
 * Ordem que importa: claim → Kie → débito. Se o claim vier depois do débito (ou
 * não existir, como hoje), dois cliques simultâneos cobram duas vezes — que é
 * literalmente o caso do josimocerqueira@.
 */
export async function reivindicarCena(args: {
  sceneId: string;
  statusAtual: string | null | undefined;
  executor: ExecutorDeClaim;
}): Promise<ResultadoDoClaim> {
  const { sceneId, statusAtual, executor } = args;
  if (estaEmVoo(statusAtual)) return { ok: false, motivo: "em_voo" };
  const linhas = await executor({
    sceneId,
    de: statusAtual ?? null,
    para: "pending",
  });
  return linhas > 0 ? { ok: true } : { ok: false, motivo: "perdeu_corrida" };
}
