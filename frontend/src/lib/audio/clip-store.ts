/**
 * Persistência LOCAL dos clipes gravados (IndexedDB) — anti-perda.
 *
 * Cada clipe aceito é salvo no navegador ANTES de subir. Se a aba recarregar,
 * cair a conexão ou o navegador matar a página, os clipes não somem — dá pra
 * listar de novo e retomar o upload (Slice 2). Sem dependências externas.
 */

const DB_NAME = "aiverse-voice";
const STORE = "clips";
const VERSION = 1;

export type StoredClip = {
  id: string;
  blob: Blob;
  seconds: number;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Roda um pedido dentro de uma transação e só resolve quando a transação
 * COMITA.
 *
 * 🐛 #235 (Alana): antes isto resolvia em `req.onsuccess`, que dispara ANTES
 * do commit, e a transação em si não tinha `onabort` nem `onerror`. Um commit
 * abortado — a forma típica de estourar cota / sofrer eviction no Safari iOS e
 * no WebView antigo do Android — deixava a promise resolvida PARA SEMPRE:
 * `saveClip()` dizia "salvei", o clipe entrava na lista da tela, a barra subia,
 * a CTA liberava, e o áudio não existia em lugar nenhum. Era o mecanismo mais
 * provável dos "20 min gravados e sumiu", e nenhum `.catch()` no chamador podia
 * pegá-lo, porque nada rejeitava.
 *
 * Agora: `oncomplete` (commit feito) resolve; `onabort` e `onerror` rejeitam; e
 * a conexão fecha nos TRÊS caminhos — antes só o commit feliz fechava, então
 * cada abort vazava um IDBDatabase aberto.
 */
function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        let fechado = false;
        const fechar = () => {
          if (fechado) return;
          fechado = true;
          try {
            db.close();
          } catch {
            /* já fechado pelo navegador — nada a fazer */
          }
        };

        let t: IDBTransaction;
        let req: IDBRequest;
        try {
          t = db.transaction(STORE, mode);
          req = fn(t.objectStore(STORE));
        } catch (e) {
          // `transaction()` joga síncrono quando o store não existe ou o db já
          // está fechando. Sem isto a promise ficava pendente para sempre.
          fechar();
          reject(e);
          return;
        }

        let resultado: T | undefined;
        let erroDoPedido: DOMException | null = null;
        req.onsuccess = () => {
          // Guarda o resultado, mas NÃO resolve: nada está salvo antes do
          // commit. Quem resolve é `t.oncomplete`.
          resultado = req.result as T;
        };
        req.onerror = () => {
          // O erro sobe para a transação e a aborta; guardamos a causa real
          // para a mensagem não sair vazia.
          erroDoPedido = req.error;
        };
        t.oncomplete = () => {
          fechar();
          resolve(resultado as T);
        };
        const falhar = (rotulo: string) => () => {
          fechar();
          reject(t.error ?? erroDoPedido ?? new Error(rotulo));
        };
        t.onabort = falhar("IndexedDB: transação abortada");
        t.onerror = falhar("IndexedDB: erro na transação");
      }),
  );
}

export async function saveClip(clip: StoredClip): Promise<void> {
  await tx("readwrite", (s) => s.put(clip));
}

export async function listClips(): Promise<StoredClip[]> {
  const all = await tx<StoredClip[]>("readonly", (s) => s.getAll());
  return (all ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteClip(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function clearClips(): Promise<void> {
  await tx("readwrite", (s) => s.clear());
}
