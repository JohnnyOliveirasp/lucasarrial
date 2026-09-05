/**
 * SGP — a prévia da tela 5 (/sgp/acompanhar): assina as URLs da foto clone e da
 * amostra de voz DESTE pedido. Quem decide o QUE pode aparecer é `previa-pure.ts`
 * (é lá que mora a régua de segurança e o teste dela); aqui é só a ida ao banco
 * e ao R2.
 *
 * A tela não tem login: o dono é a SESSÃO httpOnly do wizard, que é quem entrega
 * o `pedido` a esta função. Nada aqui recebe id vindo da URL nem lista coleção —
 * as duas consultas são presas ao `user_id` do pedido, e a do áudio também ao
 * `voice_id` dele.
 *
 * TUDO best-effort: prévia que falha vira `null` e a tela continua mostrando as
 * etapas. O aluno perder o player é ruim; a tela de acompanhamento cair é pior.
 */
import { getAdmin } from "@/lib/db/admin";
import { imagesBucket, R2_BUCKETS } from "@/lib/r2/client";
import { createPresignedGet } from "@/lib/r2/presigned";
import type { EtapasSgp } from "./etapas";
import { escolherAudio, escolherImagem, SGP_IDEA_AVATAR, SGP_NOME_AMOSTRA } from "./previa-pure";
import type { SgpPedidoRow } from "./types";

export type SgpPrevia = {
  imagemUrl: string | null;
  audioUrl: string | null;
  audioSegundos: number | null;
};

export const PREVIA_VAZIA: SgpPrevia = { imagemUrl: null, audioUrl: null, audioSegundos: null };

/**
 * 1h — o MESMO TTL que o resto do app já usa pra entregar mídia ao browser
 * (/api/v1/images, /api/v1/generations, /api/v1/videos). Não é arbitrário: o
 * polling da tela para de rodar quando o pedido fica `pronto`, então uma URL
 * curta demais 403-aria no aluno que deixa a página aberta e vai ouvir depois.
 */
const TTL_SEGUNDOS = 60 * 60;

function etapaFeita(estado: EtapasSgp, chave: "foto" | "voz"): boolean {
  return estado.etapas.find((e) => e.chave === chave)?.estado === "feito";
}

/**
 * A prévia do pedido. Só busca o que a etapa correspondente já deu como
 * `feito` — enquanto está gerando/treinando não há o que mostrar, e não vale
 * pagar consulta a cada tick de 8s do polling.
 */
export async function previaDoPedido(pedido: SgpPedidoRow, estado: EtapasSgp): Promise<SgpPrevia> {
  const userId = pedido.user_id;
  if (!userId) return PREVIA_VAZIA;

  const querFoto = etapaFeita(estado, "foto");
  const querVoz = etapaFeita(estado, "voz");
  if (!querFoto && !querVoz) return PREVIA_VAZIA;

  const admin = getAdmin();
  const [imagemUrl, audio] = await Promise.all([
    querFoto ? urlDaImagem(admin, userId) : Promise.resolve(null),
    querVoz ? urlDoAudio(admin, userId, pedido.voice_id) : Promise.resolve(null),
  ]);

  return { imagemUrl, audioUrl: audio?.url ?? null, audioSegundos: audio?.segundos ?? null };
}

type Admin = ReturnType<typeof getAdmin>;

async function urlDaImagem(admin: Admin, userId: string): Promise<string | null> {
  try {
    const { data } = await admin
      .from("image_generations")
      .select("user_id, idea, status, image_path, created_at")
      .eq("user_id", userId)
      .eq("idea", SGP_IDEA_AVATAR)
      .eq("status", "ready");
    const key = escolherImagem(userId, data ?? []);
    if (!key) return null;
    return await createPresignedGet(imagesBucket(), key, TTL_SEGUNDOS);
  } catch (e) {
    console.error("[sgp/previa] imagem:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function urlDoAudio(
  admin: Admin,
  userId: string,
  voiceId: string | null,
): Promise<{ url: string; segundos: number | null } | null> {
  if (!voiceId) return null;
  try {
    const { data } = await admin
      .from("generations")
      .select("user_id, voice_id, name, status, audio_path, duration_seconds")
      .eq("user_id", userId)
      .eq("voice_id", voiceId)
      .eq("name", SGP_NOME_AMOSTRA)
      .eq("status", "ready");
    const achada = escolherAudio(userId, voiceId, data ?? []);
    if (!achada) return null;
    // A amostra vive no bucket de `generations` — é o mesmo lugar de onde o
    // player do histórico lê (start-training sobe o sample.wav lá).
    const url = await createPresignedGet(R2_BUCKETS.generations, achada.key, TTL_SEGUNDOS);
    return { url, segundos: achada.segundos };
  } catch (e) {
    console.error("[sgp/previa] áudio:", e instanceof Error ? e.message : e);
    return null;
  }
}
