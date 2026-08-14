/**
 * Provedor TikTok do buscador de virais.
 *
 * ⚠️ ESTADO 14/08/2026 (medido, não suposto): a busca do TikTok não responde
 * mais sem sessão. Testado na mão nesta data:
 *   - davidteather/TikTok-Api 7.3.3, browser=webkit, com msToken fresco do
 *     navegador → EmptyResponseException em search.search_type E em
 *     hashtag.videos (funcionava em julho/2026 — o smoke está em
 *     C:\Users\johnn\Downloads\tiktok-smoke).
 *   - yt-dlp 2026.07.04, extractor tiktok:tag → "No working app info".
 *   - www.tiktok.com/search/video?q=... no navegador → redireciona pro login.
 *
 * O motor definitivo está sendo escolhido com base em levantamento dos
 * projetos open source ativos. Até lá o provedor se declara indisponível com
 * o motivo — a tela mostra isso em vez de fingir "nenhum resultado".
 */
import type { BuscaParams, Provedor, ResultadoPlataforma } from "./tipos";

export const provedorTiktok: Provedor = {
  plataforma: "tiktok",
  async buscar(_params: BuscaParams): Promise<ResultadoPlataforma> {
    return {
      plataforma: "tiktok",
      videos: [],
      varridos: 0,
      indisponivel:
        "TikTok fechou a busca pública: hoje ela só responde com sessão logada. Estamos escolhendo o motor — por enquanto use o Instagram.",
    };
  },
};
