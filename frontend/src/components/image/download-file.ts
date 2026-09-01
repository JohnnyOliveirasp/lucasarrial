/** Baixa um arquivo de uma URL (presignada) com nome amigável; fallback = abrir
 *  em nova aba. Compartilhado pelo histórico de imagens e pelo painel de vídeo.
 *
 * ⚠️ POR QUE ISTO CHECA `res.ok` (incidente 166, medido em 28/08).
 * As URLs que a tela usa são presignadas com validade de **1 hora** e a página
 * NÃO as renova. São DOIS modos de falha distintos, e eles se comportam
 * diferente no browser — medidos um a um contra o objeto real no R2, com o
 * `Origin` de produção (`https://aiverse.jcsolutionsus.com`):
 *
 *  1. **Link vencido → `403 ExpiredRequest`** (XML de 118 bytes) e, medido,
 *     **SEM** `access-control-allow-origin`: a assinatura é recusada antes da
 *     camada de CORS. Como o cabeçalho não vem, o browser nem entrega a
 *     resposta ao JS — o `fetch` **LANÇA** `TypeError: Failed to fetch`. A
 *     versão anterior caía no `catch` e chamava `window.open`, que roda depois
 *     de um `await` (fora do gesto do usuário) e por isso morre no bloqueador
 *     de popup. Para quem está do outro lado: clicar em baixar e não acontecer
 *     absolutamente nada.
 *  2. **Objeto ausente → `404`**, e este vem **COM** o cabeçalho de CORS (o
 *     404 passa pela camada de CORS normalmente). Aqui o `fetch` devolve a
 *     resposta, e a versão anterior chamava `res.blob()` sem olhar o status:
 *     gravava o XML de erro no disco com o nome `<nome>.mp4` — um "download"
 *     que aparentava dar certo e produzia um arquivo que não abre.
 *
 * Ou seja: o `catch` sozinho cobria só o (1) e o `res.ok` sozinho cobria só o
 * (2). Os dois juntos são necessários; é por isso que `buscar()` tem ambos.
 *
 * O parâmetro `refresh` existe para curar a causa em vez do sintoma: quem
 * chama passa uma função que busca uma URL nova no servidor, e a tentativa é
 * refeita com ela. Aluno: novaeraperformance@gmail.com, 2 vídeos de 77s.
 * (Os dois MP4 dele estavam ÍNTEGROS no R2 o tempo todo — H.264 High + AAC,
 * 480x832, 76s, 11,0 MB e 8,5 MB. Nunca foi o arquivo; foi sempre o link.)
 */
export async function downloadFromUrl(
  url: string,
  label: string,
  fallbackExt = "png",
  refresh?: () => Promise<string | null>,
): Promise<boolean> {
  const extDe = (u: string): string => {
    try {
      const m = new URL(u).pathname.match(/\.([a-z0-9]+)$/i);
      return m ? m[1].toLowerCase() : fallbackExt;
    } catch {
      return fallbackExt;
    }
  };
  const safe = (label || "arquivo").trim().replace(/[\\/:*?"<>|]+/g, "").slice(0, 120) || "arquivo";

  /** Busca a URL. Devolve o blob SÓ se a resposta for de verdade (2xx).
   *  `null` unifica os dois modos de falha descritos no topo: o `throw` do 403
   *  vencido (sem CORS) e a resposta legível de erro, como o 404 (com CORS). */
  const buscar = async (alvo: string): Promise<Blob | null> => {
    try {
      const res = await fetch(alvo, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  };

  let alvo = url;
  let blob = await buscar(alvo);

  // Link vencido é o caso comum, não a exceção: tenta renovar UMA vez.
  if (!blob && refresh) {
    const novo = await refresh().catch(() => null);
    if (novo) {
      alvo = novo;
      blob = await buscar(alvo);
    }
  }

  if (!blob) {
    // Sem blob não há o que salvar. Gravar a resposta de erro seria entregar
    // um arquivo quebrado dizendo que deu certo — o defeito que este incidente
    // corrigiu. Última tentativa é a navegação direta; quem chama recebe
    // `false` e pode avisar na tela.
    window.open(alvo, "_blank");
    return false;
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `${safe}.${extDe(alvo)}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
  return true;
}
