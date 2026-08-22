/**
 * A miniatura do viral, guardada por NÓS.
 *
 * Por que existe (22/08): `viral_videos.thumb_url` aponta pro CDN do TikTok
 * com assinatura e prazo (`x-expires`). Servir isso direto significa que a
 * galeria funciona hoje e vai apagando sozinha depois — 403 silencioso, um
 * vídeo de cada vez. As 560 linhas do acervo estavam assim, 560 de 560.
 *
 * É a MESMA lição de [[project-imagens-referencia]]: endereço de terceiro não
 * é acervo. O que é nosso, a gente copia.
 *
 * Bucket: o permanente (`imagesBucket()`). NÃO o de generations, que tem TTL
 * de 30 dias e recriaria o problema com outro nome.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";

import { imagesBucket, r2 } from "@/lib/r2/client";

/** Teto por miniatura. O oEmbed às vezes devolve o PNG original (3,7 MB
 *  medido) — guardar isso 560 vezes seria 2 GB à toa. */
const MAX_BYTES = 8 * 1024 * 1024;

export function chaveThumb(plataforma: string, videoId: string): string {
  return `virais/thumbs/${plataforma}/${videoId}.img`;
}

/**
 * Pede ao TikTok uma URL de miniatura NOVA.
 *
 * O oEmbed é público, sem chave e sem custo (diferente da Apify, que é paga):
 * `https://www.tiktok.com/oembed?url=<url do vídeo>` devolve `thumbnail_url`
 * recém-assinada. É isso que torna o backfill possível — as URLs guardadas no
 * banco já estão vencidas e não dá pra baixar delas.
 */
export async function thumbFrescaDoTikTok(urlDoVideo: string): Promise<string | null> {
  try {
    const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(urlDoVideo)}`, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { thumbnail_url?: string };
    return j.thumbnail_url ?? null;
  } catch {
    return null;
  }
}

/**
 * Baixa a miniatura e guarda no nosso R2. Devolve a chave, ou null.
 *
 * Nunca lança: miniatura é enfeite, não pode derrubar a busca nem a tela.
 * Tenta a URL que veio da busca primeiro (ainda válida logo após o scraping) e
 * só cai no oEmbed se ela já tiver vencido — assim o caminho normal não gasta
 * uma requisição extra ao TikTok.
 */
export async function guardarThumb(args: {
  plataforma: string;
  videoId: string;
  urlDoVideo: string | null;
  thumbUrl: string | null;
}): Promise<string | null> {
  const tentativas = [args.thumbUrl, args.urlDoVideo ? await thumbFrescaDoTikTok(args.urlDoVideo) : null];

  for (const url of tentativas) {
    if (!url) continue;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(25_000), cache: "no-store" });
      if (!r.ok) continue; // 403 = assinatura vencida: tenta a próxima
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.byteLength === 0 || buf.byteLength > MAX_BYTES) continue;
      const key = chaveThumb(args.plataforma, args.videoId);
      await r2.send(
        new PutObjectCommand({
          Bucket: imagesBucket(),
          Key: key,
          Body: buf,
          ContentType: r.headers.get("content-type") ?? "image/jpeg",
        }),
      );
      return key;
    } catch {
      /* tenta a próxima */
    }
  }
  return null;
}
