/**
 * A MARCA de que alguém gravou neste navegador — em `localStorage`, de
 * propósito FORA do IndexedDB.
 *
 * Por que existe (incidente #235, Alana):
 *
 * Os clipes do Gravador vivem em IndexedDB, que é por APARELHO + NAVEGADOR e
 * pode falhar (aba privada, cota, storage bloqueado). Quando isso acontece a
 * tela de criar voz abre com a lista VAZIA — e vazia é indistinguível de
 * "essa pessoa nunca gravou nada, veio subir arquivo do disco". Foi assim que
 * a Alana gravou 20 minutos, chegou na tela seguinte e não recebeu nem um
 * aviso: só um formulário mudo.
 *
 * A marca é o bilhete deixado num armário DIFERENTE: se ela existe e os
 * clipes não, dá pra afirmar "você gravou aqui e eu não achei as gravações"
 * em vez de fingir que não houve nada. Se a pessoa limpar TUDO do navegador
 * a marca some junto — esse é o limite honesto, e nesse caso a tela não
 * inventa história.
 *
 * Tudo aqui é best-effort e nunca lança: `localStorage` joga exceção em
 * alguns navegadores (Safari privado, storage desabilitado) e um gravador que
 * quebra por causa do bilhete seria pior que o problema.
 */

const CHAVE = "aiverse-voice:gravacoes";

export type MarcaGravacao = {
  /** Quantos clipes existiam no gravador na última vez. */
  clipes: number;
  /** Quantos segundos de fala eles somavam. */
  segundos: number;
  /** Quando (epoch ms). */
  em: number;
};

/** Escreve o bilhete como está. Uso interno — nunca lança. */
function escrever(marca: MarcaGravacao): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(marca));
  } catch {
    /* sem localStorage — a tela seguinte só perde o aviso, nada quebra */
  }
}

/**
 * Chamado pelo Gravador sempre que a lista de clipes muda.
 *
 * ⚠️ `clipes <= 0` APAGA o bilhete. Quem chama a partir de uma lista que pode
 * estar vazia por FALHA de leitura tem que usar `sincronizarMarcaGravacao`.
 */
export function marcarGravacao(clipes: number, segundos: number): void {
  if (typeof window === "undefined") return;
  if (clipes <= 0) {
    limparMarcaGravacao();
    return;
  }
  escrever({ clipes, segundos: Math.round(segundos), em: Date.now() });
}

/**
 * A versão que o Gravador usa — a que sabe a diferença entre "não há clipe" e
 * "não consegui ler os clipes".
 *
 * Por que existe: o efeito que marca roda a CADA mudança da lista, e a lista
 * nasce `[]` antes do IndexedDB responder. Chamar `marcarGravacao(0, 0)` nesse
 * instante APAGA o bilhete só de abrir a página — e apaga exatamente para a
 * vítima do #235, cuja leitura do IndexedDB falha e cuja lista fica vazia para
 * sempre. O bilhete que existia para provar "você gravou aqui" seria destruído
 * pelo próprio código que deveria protegê-lo.
 *
 * A regra:
 *   - tem clipe na tela  → escreve (é sempre verdade que houve gravação);
 *   - lista vazia E leitura confiável → apaga (a pessoa apagou tudo mesmo);
 *   - lista vazia E leitura NÃO confiável (ainda carregando, ou falhou) → não
 *     encosta no bilhete.
 */
export function sincronizarMarcaGravacao(
  leituraConfiavel: boolean,
  clipes: number,
  segundos: number,
): void {
  if (clipes > 0) {
    marcarGravacao(clipes, segundos);
    return;
  }
  if (!leituraConfiavel) return;
  marcarGravacao(0, 0);
}

/**
 * Um clipe do Gravador saiu do IndexedDB (o aluno removeu na tela de criar
 * voz) — o bilhete encolhe junto e devolve como ficou.
 *
 * Sem isto o bilhete continua dizendo "8 gravações, 22:14" depois que o
 * próprio aluno apagou as 8 para subir arquivos do disco, e a tela o acusa de
 * ter perdido uma gravação que ele mesmo removeu — susto falso num caminho que
 * funciona.
 */
export function descontarDaMarca(segundos: number): MarcaGravacao | null {
  const atual = lerMarcaGravacao();
  if (!atual) return null;
  const clipes = atual.clipes - 1;
  if (clipes <= 0) {
    limparMarcaGravacao();
    return null;
  }
  const desconto = Number.isFinite(segundos) && segundos > 0 ? segundos : 0;
  // `em` é preservado de propósito: a hora da GRAVAÇÃO não muda porque o
  // aluno removeu um clipe depois.
  const restante: MarcaGravacao = {
    clipes,
    segundos: Math.max(0, Math.round(atual.segundos - desconto)),
    em: atual.em,
  };
  escrever(restante);
  return restante;
}

/** Lido pela tela de criar voz. `null` = não há bilhete confiável. */
export function lerMarcaGravacao(): MarcaGravacao | null {
  if (typeof window === "undefined") return null;
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return null;
    const m = JSON.parse(cru) as Partial<MarcaGravacao> | null;
    if (!m || typeof m.clipes !== "number" || m.clipes <= 0) return null;
    return {
      clipes: m.clipes,
      segundos: typeof m.segundos === "number" ? m.segundos : 0,
      em: typeof m.em === "number" ? m.em : 0,
    };
  } catch {
    return null;
  }
}

/** Some com o bilhete — depois que as gravações foram DE FATO enviadas. */
export function limparMarcaGravacao(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    /* idem */
  }
}
