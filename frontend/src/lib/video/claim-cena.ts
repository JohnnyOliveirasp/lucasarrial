/**
 * O CLAIM ATÔMICO do despacho de clipe de cena (#485, perna (b)).
 *
 * A decisão pura está em `lib/video/regen-fallback.ts`; aqui mora só o I/O.
 *
 * POR QUE O TOKEN É O PRÓPRIO `video_status` E NÃO UMA COLUNA NOVA.
 * Os dois irmãos usam flag dedicada — `image_generations.video_retry_count`
 * (0→1, `lib/images/video-sync.ts:159`) e `studio_scenes.anim_retried`
 * (false→true, `lib/studio/scenes.ts:335`) — porque lá a corrida é poll ×
 * webhook sobre uma linha que FICA em pending/generating: o status não muda
 * entre os dois concorrentes, então precisa de um flag à parte.
 * Aqui a corrida é POST × POST do aluno sobre uma linha que PRECISA sair do
 * estado atual pra ser despachada, então `video_status` já é o token natural.
 * `video_scenes` não tem nenhuma flag equivalente (migrations 17/19/20/83), e
 * usar o status evita subir código dependente de DDL não aplicado (#446).
 *
 * Server-only.
 */
import { getAdmin } from "@/lib/db/admin";
import type { ImageGenerationStatus } from "@/lib/db/types";
import { reivindicarCena, type ExecutorDeClaim, type ResultadoDoClaim } from "@/lib/video/regen-fallback";

/**
 * Estreitamento de tipo na fronteira com o banco. O módulo puro fala `string`
 * de propósito (pra não importar nada) e o client tipado quer o union de
 * `lib/db/types.ts:18`.
 *
 * NÃO valida nem lança: no Postgres `video_scenes.video_status` é `text` puro,
 * sem CHECK (migration 20), então um valor fora do union é dado possível, não
 * bug de programação. Lançar aqui transformaria uma linha estranha num 500 no
 * Regerar do aluno; repassar o valor faz o `where` simplesmente não casar, que
 * é o comportamento correto — ninguém despacha em cima de linha que não
 * reconhecemos.
 */
function comoStatus(v: string): ImageGenerationStatus {
  return v as ImageGenerationStatus;
}

/**
 * `update ... where id = ? and video_status = <de>` — devolve quantas linhas
 * mudaram. 1 = ganhei a corrida; 0 = outra via já tomou a cena.
 *
 * O `video_kie_task_id: null` NÃO é enfeite: a cena que falhou guarda o task id
 * ANTIGO. Sem zerar, o GET da rota (que sincroniza tudo que está
 * pending/generating COM task id) iria consultar a task velha, veria `fail` e
 * chamaria `failSceneVideo`, derrubando pra `failed` a cena cujo despacho NOVO
 * ainda está em voo. O `video_error: null` limpa o erro da tentativa anterior.
 */
const executorSupabase: ExecutorDeClaim = async ({ sceneId, de, para }) => {
  const base = getAdmin()
    .from("video_scenes")
    .update({ video_status: comoStatus(para), video_kie_task_id: null, video_error: null })
    .eq("id", sceneId);
  // PostgREST: `.eq(col, null)` não casa com NULL — tem que ser `.is`.
  const filtrado = de === null ? base.is("video_status", null) : base.eq("video_status", comoStatus(de));
  const { data } = await filtrado.select("id");
  return (data ?? []).length;
};

/**
 * Toma a cena pra si ANTES de chamar o Kie e ANTES de debitar. Só quem recebe
 * `{ ok: true }` pode despachar e cobrar.
 */
export function reivindicarCenaParaDespacho(
  sceneId: string,
  statusAtual: string | null | undefined,
): Promise<ResultadoDoClaim> {
  return reivindicarCena({ sceneId, statusAtual, executor: executorSupabase });
}
