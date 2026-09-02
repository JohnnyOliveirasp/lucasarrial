/**
 * Testes do armazenamento local dos clipes (incidente #235, Alana).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/audio/clip-store.test.ts
 *
 * O DEFEITO COBERTO — o caminho por onde os 20 minutos sumiam em silêncio:
 * `tx()` resolvia em `req.onsuccess`, que o navegador dispara ANTES do commit
 * da transação, e a transação não tinha `onabort` nem `onerror`. Quando o
 * commit era abortado (cota estourada / eviction — a forma típica de falhar no
 * Safari do iPhone e no WebView antigo do Android), a promise já estava
 * resolvida: `saveClip()` afirmava ter salvo, o clipe entrava na lista, a barra
 * subia, a CTA liberava — e não havia áudio nenhum guardado. Nenhum `.catch()`
 * do chamador podia pegar isso, porque nada rejeitava.
 *
 * O IndexedDB de mentira daqui existe para reproduzir EXATAMENTE essa ordem de
 * eventos: `onsuccess` do pedido primeiro, `onabort` da transação depois.
 *
 * As armadilhas que estes testes travam:
 *   - commit abortado REJEITA (e não deixa o dado meio-salvo);
 *   - pedido com erro REJEITA;
 *   - `transaction()` jogando síncrono REJEITA em vez de pendurar a promise
 *     para sempre;
 *   - a conexão com o banco fecha nos caminhos de falha, não só no feliz.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { saveClip, listClips, deleteClip, clearClips, type StoredClip } from "./clip-store.ts";

// ───────── IndexedDB de mentira ─────────

type Ouvinte = (() => void) | null;

type PedidoFalso = {
  result: unknown;
  error: Error | null;
  onsuccess: Ouvinte;
  onerror: Ouvinte;
  onupgradeneeded: Ouvinte;
};

type LojaFalsa = {
  put: (v: StoredClip) => PedidoFalso;
  getAll: () => PedidoFalso;
  delete: (id: string) => PedidoFalso;
  clear: () => PedidoFalso;
};

type TransacaoFalsa = {
  error: Error | null;
  oncomplete: Ouvinte;
  onabort: Ouvinte;
  onerror: Ouvinte;
  objectStore: () => LojaFalsa;
};

/**
 * - `ok`                → commit normal;
 * - `aborta-no-commit`  → pedido dá `onsuccess` e o COMMIT aborta (cota);
 * - `erro-no-pedido`    → o pedido falha e derruba a transação;
 * - `transaction-joga`  → `db.transaction()` joga síncrono (db fechando).
 */
type Comportamento = "ok" | "aborta-no-commit" | "erro-no-pedido" | "transaction-joga";

function instalarIndexedDB(comportamento: Comportamento) {
  const registros = new Map<string, StoredClip>();
  let conexoesAbertas = 0;

  function novoPedido(): PedidoFalso {
    return { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
  }

  const db = {
    objectStoreNames: { contains: () => true },
    createObjectStore: () => {},
    close: () => {
      conexoesAbertas--;
    },
    transaction: (): TransacaoFalsa => {
      if (comportamento === "transaction-joga") throw new Error("InvalidStateError");

      // Snapshot: o que a transação escreveu volta atrás quando ela aborta,
      // igual ao IndexedDB de verdade.
      const antes = new Map(registros);
      const desfazer = () => {
        registros.clear();
        for (const [k, v] of antes) registros.set(k, v);
      };

      const t: TransacaoFalsa = {
        error: null,
        oncomplete: null,
        onabort: null,
        onerror: null,
        objectStore: () => loja,
      };

      function pedido(acao: () => unknown): PedidoFalso {
        const req = novoPedido();
        queueMicrotask(() => {
          if (comportamento === "erro-no-pedido") {
            req.error = new Error("ConstraintError");
            req.onerror?.();
            desfazer();
            t.error = req.error;
            t.onabort?.(); // pedido com erro não tratado aborta a transação
            return;
          }
          req.result = acao();
          // ⚠️ O ponto do defeito: o navegador avisa o SUCESSO DO PEDIDO aqui,
          // muito antes de saber se o commit vai colar.
          req.onsuccess?.();
          queueMicrotask(() => {
            if (comportamento === "aborta-no-commit") {
              desfazer();
              t.error = new Error("QuotaExceededError");
              t.onabort?.();
              return;
            }
            t.oncomplete?.();
          });
        });
        return req;
      }

      const loja: LojaFalsa = {
        put: (v) => pedido(() => (registros.set(v.id, v), v.id)),
        getAll: () => pedido(() => [...registros.values()]),
        delete: (id) => pedido(() => registros.delete(id)),
        clear: () => pedido(() => registros.clear()),
      };

      return t;
    },
  };

  const idb = {
    open: () => {
      const req = novoPedido();
      queueMicrotask(() => {
        conexoesAbertas++;
        req.result = db;
        req.onsuccess?.();
      });
      return req;
    },
  };

  (globalThis as unknown as { indexedDB: unknown }).indexedDB = idb;
  return { registros, conexoesAbertas: () => conexoesAbertas };
}

/**
 * Promise que NÃO pode ficar pendurada: o defeito irmão do que estamos
 * consertando é a promise que nunca assenta, e sem limite ela travaria a
 * suíte inteira em vez de falhar.
 */
function comLimite<T>(p: Promise<T>, ms = 2000): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  const alarme = new Promise<never>((_, rejeitar) => {
    id = setTimeout(() => rejeitar(new Error("a promise nunca assentou")), ms);
  });
  return Promise.race([p, alarme]).finally(() => {
    if (id !== undefined) clearTimeout(id);
  });
}

function clipe(id: string, seconds: number, createdAt: number): StoredClip {
  return { id, blob: new Blob(["audio"], { type: "audio/wav" }), seconds, createdAt };
}

// ───────── testes ─────────

test("caminho feliz: salva, lista em ordem de gravação e apaga", async () => {
  const idb = instalarIndexedDB("ok");
  await comLimite(saveClip(clipe("b", 30, 2000)));
  await comLimite(saveClip(clipe("a", 10, 1000)));

  const lista = await comLimite(listClips());
  assert.deepEqual(
    lista.map((c) => c.id),
    ["a", "b"],
    "listClips ordena por createdAt",
  );

  await comLimite(deleteClip("a"));
  assert.equal((await comLimite(listClips())).length, 1);

  await comLimite(clearClips());
  assert.equal((await comLimite(listClips())).length, 0);
  assert.equal(idb.conexoesAbertas(), 0, "toda conexão do caminho feliz foi fechada");
});

test("O DEFEITO #235: commit abortado por cota REJEITA — antes dizia que salvou", async () => {
  const idb = instalarIndexedDB("aborta-no-commit");
  await assert.rejects(
    comLimite(saveClip(clipe("perdido", 1200, 1000))),
    /QuotaExceededError/,
    "saveClip não pode resolver quando o commit aborta — era assim que 20 min sumiam",
  );
  assert.equal(idb.registros.size, 0, "nada ficou meio-salvo");
});

test("commit abortado não vaza conexão de IndexedDB", async () => {
  const idb = instalarIndexedDB("aborta-no-commit");
  await assert.rejects(comLimite(saveClip(clipe("x", 10, 1))));
  await assert.rejects(comLimite(saveClip(clipe("y", 10, 2))));
  assert.equal(idb.conexoesAbertas(), 0, "abort também fecha o banco");
});

test("leitura com commit abortado rejeita em vez de devolver lista vazia", async () => {
  // Vazio silencioso é o pior desfecho desta tela: indistinguível de "nunca
  // gravou nada". Tem que estourar para a tela poder avisar.
  instalarIndexedDB("aborta-no-commit");
  await assert.rejects(comLimite(listClips()));
});

test("erro no próprio pedido rejeita", async () => {
  const idb = instalarIndexedDB("erro-no-pedido");
  await assert.rejects(comLimite(saveClip(clipe("z", 10, 1))), /ConstraintError/);
  assert.equal(idb.registros.size, 0);
  assert.equal(idb.conexoesAbertas(), 0);
});

test("transaction() jogando síncrono rejeita em vez de pendurar a promise", async () => {
  const idb = instalarIndexedDB("transaction-joga");
  await assert.rejects(comLimite(saveClip(clipe("w", 10, 1))), /InvalidStateError/);
  assert.equal(idb.conexoesAbertas(), 0, "o db aberto tem que fechar mesmo assim");
});
