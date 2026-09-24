/**
 * POST /api/v1/virais/enviar — Vídeos Virais 1.0 (pedido do Johnny 21/09).
 *
 * DOIS caminhos (ordem do Johnny 22/09: "as pessoas precisam subir o vídeo na
 * plataforma que quiserem, seja o vídeo por link ou o vídeo por upload"):
 *   1. LINK de um post do Instagram/TikTok — a casa lê e baixa;
 *   2. ARQUIVO, que o navegador já subiu pro R2 (ver /virais/upload-url).
 * Nos dois, o consentimento é obrigatório e o vídeo entra no acervo que TODOS
 * veem, continuando visível na galeria de quem enviou.
 *
 * Decisões que estão embutidas aqui:
 *  • Sem consentimento não entra. Não é aviso na tela: é regra do servidor,
 *    porque a tela pode ser contornada e a prova de direito autoral não.
 *  • Sem moderação, de propósito (ordem do Johnny): "o problema é do aluno,
 *    ele se responsabiliza". O freio é o botão de remover do admin.
 *  • Nada de Apify (decisão do Johnny 22/09: "não vamos liberar para as
 *    pessoas usarem o Apify mais, elas vão trazer os vídeos"). O link usa só o
 *    caminho grátis (yt-dlp); quando ele não abrir — e o leitor de TikTok está
 *    quebrado desde 21/09, medido — a resposta diz pro aluno mandar o arquivo,
 *    em vez de a casa pagar por envio.
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
import { LIMITE_VIRAL, recusaPorTamanho } from "@/lib/virais/limites";
import { tamanhoNoR2 } from "@/lib/virais/upload-viral";

/** O download roda dentro da requisição; 80MB em rede ruim pede folga. */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authenticate(request);
  if (!auth) return unauthorized();

  let body: {
    url?: unknown;
    consentimento?: unknown;
    arquivo_key?: unknown;
    titulo?: unknown;
    /** true = o vídeo é SÓ do aluno (upload do próprio vídeo, no React). */
    privado?: unknown;
    /** Segundos medidos pelo navegador antes de subir (só no caminho ARQUIVO). */
    duracao_seg?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  // Privado não vai pra lugar nenhum além da conta de quem subiu, então não
  // há o que consentir: o consentimento é sobre COMPARTILHAR com os outros.
  const privado = body.privado === true;
  if (!privado && body.consentimento !== true) {
    return badRequest("Marque o consentimento para enviar o vídeo.");
  }

  const admin = getAdmin();
  const consentimento = consentimentoRegistrado();

  // ───── Caminho 2: ARQUIVO já enviado pro R2 pelo navegador ─────
  const arquivoKey = typeof body.arquivo_key === "string" ? body.arquivo_key.trim() : "";
  if (arquivoKey) {
    // A chave carrega o dono no caminho (virais/comunidade/upload/<user>/…):
    // sem esta checagem, um aluno poderia publicar o arquivo de outro.
    if (!arquivoKey.startsWith(`virais/comunidade/upload/${auth.user_id}/`)) {
      return badRequest("Arquivo inválido para esta conta.");
    }
    // Tamanho conferido contra o objeto REAL: o navegador informa o que quiser.
    const bytes = await tamanhoNoR2(arquivoKey);
    if (bytes === null) return badRequest("Não encontrei o arquivo enviado. Tente de novo.");
    if (bytes > LIMITE_VIRAL.bytes) return badRequest(recusaPorTamanho(bytes));

    const titulo = typeof body.titulo === "string" ? body.titulo.trim().slice(0, 300) : null;
    // O navegador é a única fonte de duração aqui (não há post de origem, e
    // ler o mp4 no servidor custaria o arquivo inteiro na RAM). Ela dimensiona
    // o roteiro e o corte — sem ela o React trata todo upload como 30s.
    const medida = Number(body.duracao_seg);
    const duracaoSeg =
      Number.isFinite(medida) && medida > 0 && medida <= LIMITE_VIRAL.segundos
        ? Math.round(medida)
        : null;
    const { data: criado, error } = await admin
      .from("viral_videos")
      .insert({
        plataforma: "upload",
        // Sem post de origem: a identidade é a própria chave do arquivo.
        video_id: arquivoKey.split("/").pop()?.replace(/\.mp4$/, "") ?? arquivoKey,
        url: "",
        legenda: titulo,
        duracao_seg: duracaoSeg,
        r2_key: arquivoKey,
        download_status: "pronto",
        enviado_por: auth.user_id,
        enviado_em: new Date().toISOString(),
        consentimento_texto: privado ? null : consentimento,
        publico: !privado,
      })
      .select("id")
      .single();
    if (error || !criado) return serverError("Não consegui salvar esse vídeo agora.");
    return jsonOk({
      id: (criado as { id: string }).id,
      ja_existia: false,
      origem: "upload",
      privado,
    });
  }

  // ───── Caminho 1: LINK ─────
  const link = lerLink(typeof body.url === "string" ? body.url : "");
  if (!link) {
    return badRequest("Cole o link de um post do Instagram (reel) ou do TikTok — ou envie o arquivo do vídeo.");
  }

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
