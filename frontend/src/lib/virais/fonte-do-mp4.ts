/**
 * De onde sai o mp4 de um viral — e quem pode usá-lo.
 *
 * Existe por causa do chamado #540 (24/09): o "Usar um vídeo meu" do React
 * grava `url: ""` DE PROPÓSITO (ver /virais/enviar — "sem post de origem, a
 * identidade é a própria chave do arquivo") e deixa o mp4 pronto em
 * `viral_videos.r2_key`. As rotas do React, porém, guardavam pela URL
 * (`if (!viral.url) → "Vídeo não encontrado no acervo."`), então NENHUM vídeo
 * enviado pelo aluno passava do passo 1.
 *
 * A pergunta certa é "temos o arquivo?", não "existe post na rede?".
 */
/** O que as rotas precisam ler do viral pra achar o arquivo e liberar o uso. */
export type FonteDoViral = {
  id: string;
  plataforma: string;
  url: string;
  r2_key: string | null;
  publico: boolean;
  enviado_por: string | null;
  removido_em: string | null;
};

/**
 * Upload do próprio aluno: o arquivo já é NOSSO (o envio gravou a chave), não
 * há o que baixar. Quem chama usa `viral.r2_key` direto em vez de yt-dlp.
 */
export function ehUploadProprio(v: FonteDoViral): boolean {
  return v.plataforma === "upload" && !!v.r2_key;
}

/**
 * Pode usar? Precisa existir, estar no ar, ser visível PRA ESTA PESSOA
 * (público, ou o privado dela) e ter de onde tirar o mp4.
 *
 * A visibilidade entra junto com o conserto e não é zelo extra: ligar o
 * caminho do upload sem ela deixaria um aluno mandar o id do vídeo privado de
 * outro e receber de volta a transcrição dele.
 */
export function podeUsarViral(
  v: FonteDoViral | null | undefined,
  userId: string,
): v is FonteDoViral {
  if (!v || v.removido_em) return false;
  if (!v.publico && v.enviado_por !== userId) return false;
  return !!v.url || ehUploadProprio(v);
}
