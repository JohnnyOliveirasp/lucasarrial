/**
 * Onboarding — decidir se um áudio recusado por TAMANHO merece o resgate por
 * streaming (baixar pro disco e tirar só a faixa de áudio).
 *
 * Por que é um módulo à parte, e puro: a decisão vivia solta dentro do laço de
 * `import.ts`, onde só dá pra exercitar com Drive de verdade — e foi ali que o
 * defeito do incidente #194 passou batido.
 *
 * O DEFEITO (medido 29/08 na pasta do johnathan.ppires@gmail.com, que é o caso
 * que fez o resgate existir): o orçamento de 3 vagas era debitado ANTES de
 * saber se o arquivo cabia no teto do próprio resgate (4GB). Os dois primeiros
 * arquivos da pasta dele têm 10,9GB e 9,4GB — queimavam duas vagas e não
 * entregavam byte nenhum, porque `downloadDriveFileToPath` rejeita pelo
 * `content-length` declarado. A terceira vaga ia pro arquivo seguinte, e o de
 * 490MB — o único com 28min22s de fala, que SOZINHO abre a porta de 20min e é
 * a razão de o conserto existir (`video-audio.ts`) — ficava sem vaga.
 *
 * O tamanho já vem escrito na mensagem de erro que o downloader levanta
 * ("Arquivo X tem 10905MB (teto 400MB)"), então dá pra decidir sem gastar nem
 * uma requisição. Quando a mensagem NÃO traz número legível, o comportamento
 * antigo é mantido de propósito: na dúvida, tenta — o custo de tentar é um
 * download que falha, e o custo de não tentar é o aluno parado.
 */

/** MB da mensagem são decimais (`Math.round(bytes / 1e6)` em `drive.ts`). */
const BYTES_POR_MB = 1e6;

/** As duas formas que os downloaders usam pra recusar por tamanho. */
const RE_TAMANHO = /teto \d+ ?MB|passa do teto|passou de \d+ ?MB/i;
/** `Arquivo <id> tem 10905MB (teto 400MB)` — recusa pelo content-length. */
const RE_MB_DECLARADO = /tem (\d+) ?MB/i;
/** `arquivo <nome> de 878 MB passa do teto` — recusa do arquivo local já em disco. */
const RE_MB_LOCAL = /de (\d+) ?MB passa do teto/i;

export type MotivoSemResgate =
  /** A recusa não foi por tamanho (privado, HTML de login, id inválido). */
  | "nao_e_tamanho"
  /** Passa do teto do PRÓPRIO resgate — tentar seria o mesmo erro, de graça. */
  | "nao_cabe_no_resgate"
  /** O orçamento de vagas acabou. */
  | "sem_vaga"
  /** O relógio da rota acabou. */
  | "sem_tempo";

export type DecisaoResgate =
  | { resgatar: true }
  | { resgatar: false; motivo: MotivoSemResgate };

/**
 * Lê o tamanho declarado na mensagem de erro. `null` = a mensagem não diz.
 * Exportada porque é a peça que o teto do resgate depende de acertar.
 */
export function mbDeclaradoNoErro(msgErro: string): number | null {
  const m = RE_MB_DECLARADO.exec(msgErro) ?? RE_MB_LOCAL.exec(msgErro);
  if (!m) return null;
  const mb = Number(m[1]);
  return Number.isFinite(mb) && mb > 0 ? mb : null;
}

/**
 * A decisão. `resgatar: true` é a ÚNICA resposta que autoriza o chamador a
 * debitar uma vaga — é essa amarração que conserta o #194.
 *
 * A ordem das checagens é escolhida pra que "não cabe" seja avaliado ANTES de
 * "sem vaga": assim um arquivo grande demais nunca é contabilizado como
 * consumo, nem quando ainda havia vaga sobrando.
 */
export function decidirResgate(p: {
  msgErro: string;
  streamsRestantes: number;
  agoraMs: number;
  deadlineMs: number;
  tetoResgateBytes: number;
}): DecisaoResgate {
  if (!RE_TAMANHO.test(p.msgErro)) return { resgatar: false, motivo: "nao_e_tamanho" };

  const mb = mbDeclaradoNoErro(p.msgErro);
  if (mb !== null && mb * BYTES_POR_MB > p.tetoResgateBytes) {
    return { resgatar: false, motivo: "nao_cabe_no_resgate" };
  }

  if (p.streamsRestantes <= 0) return { resgatar: false, motivo: "sem_vaga" };
  if (p.agoraMs > p.deadlineMs) return { resgatar: false, motivo: "sem_tempo" };

  return { resgatar: true };
}
