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

/** Chamado pelo Gravador sempre que a lista de clipes muda. */
export function marcarGravacao(clipes: number, segundos: number): void {
  if (typeof window === "undefined") return;
  try {
    if (clipes <= 0) {
      window.localStorage.removeItem(CHAVE);
      return;
    }
    const marca: MarcaGravacao = {
      clipes,
      segundos: Math.round(segundos),
      em: Date.now(),
    };
    window.localStorage.setItem(CHAVE, JSON.stringify(marca));
  } catch {
    /* sem localStorage — a tela seguinte só perde o aviso, nada quebra */
  }
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
