/** Formas que a tela "Vídeos Virais" recebe da API (rotas /api/v1/virais). */
export type Viral = {
  id: string;
  plataforma: string;
  video_id: string;
  url: string;
  autor: string | null;
  autor_seguidores: number | null;
  legenda: string | null;
  likes: number;
  views: number | null;
  comentarios: number | null;
  publicado_em: string | null;
  duracao_seg: number | null;
  thumb_url: string | null;
  video_url: string | null;
  hashtags: string[] | null;
  termo_busca: string | null;
  /** Guardei este em "Meus Virais" (mig 75). Reservar NÃO baixa o vídeo. */
  reservado: boolean;
  /** Já virou Video React. */
  usado: boolean;
  /** Quantas pessoas guardaram/usaram — o selo que substitui a trava. */
  usando: number;
  /** Garimpo pago de outra pessoa, ainda nos 7 dias de vantagem dela. */
  exclusivo_de_outro: boolean;
  download_status: string;
};

/** Execução do Apify (a busca lá fora). */
export type Run = {
  id: string;
  status: string;
  terminado_em: string | null;
  dataset_id: string | null;
  itens: number | null;
};
