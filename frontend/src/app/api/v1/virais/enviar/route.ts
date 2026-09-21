/**
 * POST /api/v1/virais/enviar — Vídeos Virais 1.0 (pedido do Johnny 21/09).
 *
 * O aluno cola o LINK de um post do Instagram ou do TikTok, marca o
 * consentimento e o vídeo entra no acervo que TODOS veem — continuando
 * visível na galeria dele.
 *
 * Decisões que estão embutidas aqui:
 *  • Sem consentimento não entra. Não é aviso na tela: é regra do servidor,
 *    porque a tela pode ser contornada e a prova de direito autoral não.
 *  • Sem moderação, de propósito (ordem do Johnny): "o problema é do aluno,
 *    ele se responsabiliza". O freio é o botão de remover do admin.
 *  • Nada de Apify aqui: o yt-dlp já está no servidor, lê Instagram e TikTok
 *    e custa ZERO por envio. O Apify cobra US$ 0,0037 por vídeo e só faz
 *    TikTok — não faz sentido pagar pra ler um link que já temos como ler.
 *  • O mesmo viral enviado duas vezes NÃO duplica: a chave é
 *    (plataforma, video_id). Se a casa já tinha garimpado aquele vídeo, o
 *    envio do aluno só o torna público e registra quem trouxe.
 *  • O vídeo é baixado UMA vez, numa chave comum — o acervo é de todos, então
 *    guardar uma cópia por aluno seria pagar armazenamento pelo mesmo arquivo.
 */
import type { NextRequest } from "next/server";
import { authenticate } from "@/lib/api/auth";
import { badRequest, jsonOk, serverError, unauthorized } from "@/lib/api/responses";
import { getAdmin } from "@/lib/db/admin";
import { guardarThumb } from "@/lib/virais/thumb";
import { consentimentoRegistrado } from "@/lib/virais/consentimento";
import { LinkViralError, lerDadosDoLink, lerLink } from "@/lib/virais/link-do-aluno";
import { baixarViralDaComunidade } from "@/lib/virais/download-comunidade";

/** O download roda dentro da requisição; 80MB em rede ruim pede folga. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: { url?: unknown; consentimento?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (body.consentimento !== true) {
    return badRequest("Marque o consentimento para enviar o vídeo.");
  }

  const link = lerLink(typeof body.url === "string" ? body.url : "");
  if (!link) {
    return badRequest("Cole o link de um post do Instagram (reel) ou do TikTok.");
  }

  const admin = getAdmin();

  try {
    // 1) Dados do post, sem baixar nada ainda (é aqui que link morto aparece).
    const dados = await lerDadosDoLink(link);
    const videoId = dados.videoId || link.videoId;
    if (!videoId) return badRequest("Não consegui identificar esse post. Tente o link completo.");

    // 2) Já existe? (garimpo da casa ou envio de outro aluno)
    const { data: existente } = await admin
      .from("viral_videos")
      .select("id, publico, enviado_por, removido_em, r2_key")
      .eq("plataforma", link.plataforma)
      .eq("video_id", videoId)
      .maybeSingle();

    const consentimento = consentimentoRegistrado();

    if (existente) {
      const ja = existente as {
        id: string;
        publico: boolean;
        enviado_por: string | null;
        removido_em: string | null;
        r2_key: string | null;
      };
      // Removido pelo admin não volta por reenvio — senão o botão de remover
      // não valeria nada: bastaria colar o link de novo.
      if (ja.removido_em) {
        return badRequest("Esse vídeo foi removido do acervo e não pode ser reenviado.");
      }
      if (!ja.publico) {
        await admin
          .from("viral_videos")
          .update({
            publico: true,
            enviado_por: ja.enviado_por ?? auth.user_id,
            enviado_em: new Date().toISOString(),
            consentimento_texto: consentimento,
          })
          .eq("id", ja.id);
      }
      if (!ja.r2_key) await baixarViralDaComunidade(admin, ja.id, dados.url);
      return jsonOk({ id: ja.id, ja_existia: true });
    }

    // 3) Capa vira nossa já na entrada: a do Instagram/TikTok expira em horas.
    const thumbKey = await guardarThumb({
      plataforma: link.plataforma,
      videoId,
      urlDoVideo: dados.url,
      thumbUrl: dados.thumbUrl,
    }).catch(() => null);

    const { data: criado, error } = await admin
      .from("viral_videos")
      .insert({
        plataforma: link.plataforma,
        video_id: videoId,
        url: dados.url,
        autor: dados.autor,
        legenda: dados.legenda,
        // `likes` é NOT NULL no banco (a ordenação do acervo depende dele):
        // post sem contagem visível entra como 0, não como nulo.
        likes: dados.likes ?? 0,
        views: dados.views,
        comentarios: dados.comentarios,
        duracao_seg: dados.duracaoSeg,
        thumb_url: dados.thumbUrl,
        thumb_r2_key: thumbKey,
        hashtags: dados.hashtags,
        publicado_em: dados.publicadoEm,
        termo_busca: null,
        enviado_por: auth.user_id,
        enviado_em: new Date().toISOString(),
        consentimento_texto: consentimento,
        publico: true,
      })
      .select("id")
      .single();

    if (error || !criado) {
      return serverError("Não consegui salvar esse viral agora.");
    }

    // 4) Baixa o mp4 pro acervo. Falhou? A linha FICA: o card mostra a capa e
    //    o link, e o download pode ser refeito — perder o envio seria pior.
    const baixado = await baixarViralDaComunidade(admin, (criado as { id: string }).id, dados.url);

    return jsonOk({ id: (criado as { id: string }).id, ja_existia: false, baixado });
  } catch (e) {
    if (e instanceof LinkViralError) return badRequest(e.message);
    return serverError(e instanceof Error ? e.message : "Falha ao enviar o viral");
  }
}
