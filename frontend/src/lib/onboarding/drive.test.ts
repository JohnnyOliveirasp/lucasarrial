/**
 * Download do Drive: retry da cota e download em PEDAÇOS (faixas Range).
 *
 * Medição de 29/08 (aluno johnathan.ppires@gmail.com, cota estourada): o
 * pedido do arquivo INTEIRO — `Range: bytes=0-`, que era o que o código fazia
 * — deu 0 sucesso em 9 tentativas; a faixa LIMITADA passa de forma
 * intermitente. Não é bypass de cota, é ganho de probabilidade.
 *
 * O diagnóstico do HTML (qual é qual, e de quem é a culpa) está em
 * drive-html.test.ts. Sem rede: fetch, espera e relógio são injetados.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/onboarding/drive.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  downloadDriveFile,
  downloadDriveFileToPath,
  esquecerCotaExaurida,
  type DriveDeps,
} from "./drive.ts";
import { dependeDoAluno } from "./erro-dono.ts";
import { HTML_LOGIN, HTML_QUOTA } from "./drive-html.fixtures.ts";

const ID = "1AbCdEfGhIjK";

// ── 3. Retry da cota ──────────────────────────────────────────────────────

function respostaQuota(): Response {
  return new Response(HTML_QUOTA, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function respostaArquivo(corpo = "conteudo-de-video"): Response {
  return new Response(corpo, {
    status: 206,
    headers: {
      "content-type": "video/mp4",
      "content-disposition": 'attachment; filename="aula.mp4"',
    },
  });
}

/** Um PEDAÇO 206 com Content-Range — é dele que sai o tamanho total. */
function respostaPedaco(corpo: string, inicio: number, total: number): Response {
  return new Response(corpo, {
    status: 206,
    headers: {
      "content-type": "video/mp4",
      "content-disposition": 'attachment; filename="aula.mp4"',
      "content-range": `bytes ${inicio}-${inicio + corpo.length - 1}/${total}`,
    },
  });
}

/** fetch falso + relógio falso: nenhum sono real, nenhuma rede.
 *  `relogio` é uma fila de instantes; esgotada, repete o último.
 *
 *  As respostas podem vir como FÁBRICA (`() => Response`) e a última da lista
 *  se repete. Isso importa: um `Response` só pode ter o corpo lido UMA vez, e
 *  o caminho da cota lê o corpo pra classificar o HTML — repetir o MESMO
 *  objeto dava "ReadableStream is locked" na 2ª tentativa, erro do teste, não
 *  do código (o fetch de verdade devolve um Response novo a cada chamada). */
function deps(
  respostas: Array<Response | (() => Response)>,
  relogio?: number[],
): DriveDeps & { chamadas: () => number; esperas: () => number[]; faixas: () => string[] } {
  let i = 0;
  let t = 0;
  const esperas: number[] = [];
  const faixas: string[] = [];
  return {
    fetchImpl: (async (_url: string, init?: RequestInit) => {
      faixas.push(String((init?.headers as Record<string, string> | undefined)?.Range ?? ""));
      const r = respostas[Math.min(i, respostas.length - 1)];
      i++;
      return typeof r === "function" ? r() : r;
    }) as unknown as typeof fetch,
    esperar: async (ms: number) => {
      esperas.push(ms);
    },
    agora: relogio ? () => relogio[Math.min(t++, relogio.length - 1)] : () => 0,
    chamadas: () => i,
    esperas: () => esperas,
    faixas: () => faixas,
  };
}

test("o pedido é por FAIXA LIMITADA, nunca o range aberto `bytes=0-`", async () => {
  // Este é o miolo do conserto. Medição de 29/08: o range ABERTO (que é o que
  // este arquivo mandava) levou 0 sucesso em 9 tentativas contra a cota
  // estourada; a faixa curta é a que às vezes passa. Se alguém voltar o header
  // pro `bytes=0-`, o download morre de novo e este teste é quem avisa.
  esquecerCotaExaurida();
  const d = deps([
    respostaPedaco("AAAA", 0, 12),
    respostaPedaco("BBBB", 4, 12),
    respostaPedaco("CCCC", 8, 12),
  ]);
  await downloadDriveFile(ID, 10_000_000, d);

  const PEDACO = 8 * 1024 * 1024;
  assert.deepEqual(d.faixas(), [
    `bytes=0-${PEDACO - 1}`, // 1º pedaço: ainda não sabemos o tamanho total
    "bytes=4-11", // já sabemos (Content-Range disse 12): pede só o que falta
    "bytes=8-11",
  ]);
  for (const faixa of d.faixas()) {
    assert.doesNotMatch(faixa, /^bytes=\d+-$/, "range ABERTO é justamente o que não passa");
  }
});

test("cota persistente: gasta o orçamento de sono e lança o erro transitório", async () => {
  esquecerCotaExaurida();
  const d = deps([respostaQuota]);
  await assert.rejects(
    () => downloadDriveFile(ID, 10_000_000, d),
    (e: Error) => {
      assert.match(e.message, /limitou temporariamente/i);
      assert.equal(dependeDoAluno(e.message), false);
      return true;
    },
  );
  assert.equal(d.chamadas(), 8, "MAX_TENTATIVAS_QUOTA tentativas do mesmo pedaço");
  assert.deepEqual(
    d.esperas(),
    [2_000, 5_000, 10_000, 10_000, 10_000, 10_000, 10_000],
    "backoff só ENTRE tentativas, somando 57s dentro do teto de 60s",
  );
  esquecerCotaExaurida();
});

test("regime DEGRADADO: depois de um arquivo esgotar a cota, o próximo volta a ser curto", async () => {
  // Sem isto o conserto estoura o maxDuration=600 da rota: 20 arquivos × 60s.
  esquecerCotaExaurida();
  const primeiro = deps([respostaQuota]);
  await assert.rejects(() => downloadDriveFile(ID, 10_000_000, primeiro));
  assert.equal(primeiro.chamadas(), 8);

  // O breaker está armado (mesmo instante 0 do relógio falso): o próximo
  // arquivo tem 7s de orçamento, exatamente as 3 tentativas de antes.
  const segundo = deps([respostaQuota]);
  await assert.rejects(() => downloadDriveFile(ID, 10_000_000, segundo));
  assert.equal(segundo.chamadas(), 3, "regime degradado = comportamento de hoje");
  assert.deepEqual(segundo.esperas(), [2_000, 5_000]);
  esquecerCotaExaurida();
});

test("um pedaço REAL desarma o regime degradado", async () => {
  esquecerCotaExaurida();
  const ruim = deps([respostaQuota]);
  await assert.rejects(() => downloadDriveFile(ID, 10_000_000, ruim));

  // Arquivo saudável no meio da pasta: baixa e limpa o estado.
  const bom = deps([respostaArquivo("ok")]);
  assert.equal((await downloadDriveFile(ID, 10_000_000, bom)).bytes.toString(), "ok");

  // Agora o orçamento cheio voltou.
  const depois = deps([respostaQuota]);
  await assert.rejects(() => downloadDriveFile(ID, 10_000_000, depois));
  assert.equal(depois.chamadas(), 8, "orçamento cheio de novo");
  esquecerCotaExaurida();
});

test("cota que passa na 2ª tentativa: o arquivo é baixado, ninguém é avisado", async () => {
  const d = deps([respostaQuota(), respostaArquivo()]);
  const file = await downloadDriveFile(ID, 10_000_000, d);
  assert.equal(file.contentType, "video/mp4");
  assert.equal(file.filename, "aula.mp4");
  assert.equal(file.bytes.toString(), "conteudo-de-video");
  assert.equal(d.chamadas(), 2);
});

test("privado NÃO é retentado — 1 tentativa só, e a culpa é do aluno", async () => {
  const d = deps([
    new Response(HTML_LOGIN, { status: 200, headers: { "content-type": "text/html" } }),
  ]);
  await assert.rejects(
    () => downloadDriveFile(ID, 10_000_000, d),
    (e: Error) => {
      assert.match(e.message, /não está público/);
      assert.equal(dependeDoAluno(e.message), true);
      return true;
    },
  );
  assert.equal(d.chamadas(), 1, "sem retry: permissão não passa sozinha");
  assert.deepEqual(d.esperas(), []);
});

test("arquivo normal passa direto, sem espera", async () => {
  const d = deps([respostaArquivo("abc")]);
  const file = await downloadDriveFile(ID, 10_000_000, d);
  assert.equal(file.bytes.toString(), "abc");
  assert.equal(d.chamadas(), 1);
  assert.deepEqual(d.esperas(), []);
});

test("a variante STREAMING tem o mesmo diagnóstico e o mesmo retry", async () => {
  const { mkdtemp, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dir = await mkdtemp(join(tmpdir(), "drive-test-"));
  const dest = join(dir, "saida.mp4");

  // 1) cota persistente: mesma mensagem transitória, mesmo orçamento.
  esquecerCotaExaurida();
  const d1 = deps([respostaQuota]);
  await assert.rejects(
    () => downloadDriveFileToPath(ID, dest, 10_000_000, d1),
    (e: Error) => {
      assert.match(e.message, /limitou temporariamente/i);
      assert.equal(dependeDoAluno(e.message), false);
      return true;
    },
  );
  assert.equal(d1.chamadas(), 8);

  // 2) cota que passa: o arquivo chega ao disco de verdade.
  esquecerCotaExaurida();
  const d2 = deps([respostaQuota(), respostaArquivo("bytes-em-disco")]);
  const r = await downloadDriveFileToPath(ID, dest, 10_000_000, d2);
  assert.equal(r.contentType, "video/mp4");
  assert.equal((await readFile(dest)).toString(), "bytes-em-disco");
  assert.equal(d2.chamadas(), 2);
});

test("teto de bytes continua valendo depois da mudança", async () => {
  esquecerCotaExaurida();
  const d = deps([respostaArquivo("12345678901234567890")]);
  await assert.rejects(
    () => downloadDriveFile(ID, 5, d),
    /teto|passou de/i,
  );
});

// ── 4. Download em PEDAÇOS ────────────────────────────────────────────────

test("arquivo montado por vários pedaços sai com os bytes na ORDEM certa", async () => {
  esquecerCotaExaurida();
  const d = deps([
    respostaPedaco("AAAA", 0, 12),
    respostaPedaco("BBBB", 4, 12),
    respostaPedaco("CCCC", 8, 12),
    // Se o laço pedisse um 4º pedaço, este 206 vazio quebraria a asserção
    // abaixo por excesso de chamadas — trava a condição de parada.
    respostaPedaco("", 12, 12),
  ]);
  const file = await downloadDriveFile(ID, 10_000_000, d);
  assert.equal(file.bytes.toString(), "AAAABBBBCCCC");
  assert.equal(file.contentType, "video/mp4");
  assert.equal(file.filename, "aula.mp4");
  assert.equal(d.chamadas(), 3, "para no total declarado pelo Content-Range");
});

test("pedaço do MEIO que volta cota passa na retentativa, sem perder a ordem", async () => {
  esquecerCotaExaurida();
  const d = deps([
    respostaPedaco("AAAA", 0, 8),
    respostaQuota(), // o 2º pedaço é recusado uma vez…
    respostaPedaco("BBBB", 4, 8), // …e vem na retentativa
  ]);
  const file = await downloadDriveFile(ID, 10_000_000, d);
  assert.equal(file.bytes.toString(), "AAAABBBB");
  assert.equal(d.chamadas(), 3);
  assert.deepEqual(d.esperas(), [2_000], "só o pedaço que falhou esperou");
  esquecerCotaExaurida();
});

test("o mesmo vale no caminho de DISCO: pedaços em ordem, nada de Buffer inteiro", async () => {
  esquecerCotaExaurida();
  const { mkdtemp, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const dest = join(await mkdtemp(join(tmpdir(), "drive-pedacos-")), "saida.bin");

  const d = deps([
    respostaPedaco("111", 0, 9),
    respostaQuota(),
    respostaPedaco("222", 3, 9),
    respostaPedaco("333", 6, 9),
  ]);
  const r = await downloadDriveFileToPath(ID, dest, 10_000_000, d);
  assert.equal(r.bytes, 9);
  assert.equal((await readFile(dest)).toString(), "111222333");
  esquecerCotaExaurida();
});

test("teto de RELÓGIO: estourou, aborta com o mesmo erro transitório de hoje", async () => {
  esquecerCotaExaurida();
  // Relógio: 0 no orçamento, 0 no 1º pedido, e aí salta além dos 240s.
  const d = deps(
    [respostaPedaco("AAAA", 0, 12), respostaPedaco("BBBB", 4, 12)],
    [0, 0, 240_001],
  );
  await assert.rejects(
    () => downloadDriveFile(ID, 10_000_000, d),
    (e: Error) => {
      assert.match(e.message, /limitou temporariamente/i);
      assert.equal(dependeDoAluno(e.message), false, "estouro de relógio é culpa NOSSA");
      return true;
    },
  );
  assert.equal(d.chamadas(), 1, "não pendurou: parou no pedaço seguinte");
  esquecerCotaExaurida();
});

test("estouro de TAMANHO continua casando com a regex que aciona o resgate", async () => {
  esquecerCotaExaurida();
  // Cópia literal de import.ts:584 — é ela que decide se `audioDeVideoGrande`
  // (resgate por streaming) roda. Se a mensagem mudar, o resgate morre calado.
  const REGEX_DO_IMPORT = /teto \d+ ?MB|passa do teto|passou de \d+ ?MB/i;

  // (a) tamanho DECLARADO no Content-Range: recusa antes de gastar rede.
  const declarado = deps([respostaPedaco("AAAA", 0, 50_000_000)]);
  await assert.rejects(
    () => downloadDriveFile(ID, 10_000_000, declarado),
    (e: Error) => {
      assert.match(e.message, REGEX_DO_IMPORT);
      assert.match(e.message, /tem 50MB \(teto 10MB\)/);
      return true;
    },
  );
  assert.equal(declarado.chamadas(), 1, "não baixa o resto de um arquivo já recusado");

  // (b) sem Content-Range: o estouro só aparece somando os pedaços.
  const somando = deps([respostaArquivo("12345678901234567890")]);
  await assert.rejects(
    () => downloadDriveFile(ID, 5, somando),
    (e: Error) => {
      assert.match(e.message, REGEX_DO_IMPORT);
      return true;
    },
  );
});

test("HTML de login NO MEIO do download não vira cota — falha na hora", async () => {
  esquecerCotaExaurida();
  const d = deps([
    respostaPedaco("AAAA", 0, 12),
    new Response(HTML_LOGIN, { status: 200, headers: { "content-type": "text/html" } }),
  ]);
  await assert.rejects(
    () => downloadDriveFile(ID, 10_000_000, d),
    (e: Error) => {
      assert.match(e.message, /não está público/);
      assert.equal(dependeDoAluno(e.message), true);
      return true;
    },
  );
  assert.equal(d.chamadas(), 2, "permissão não é retentada nem no meio");
  assert.deepEqual(d.esperas(), []);
});

test("416 no pedaço seguinte encerra o arquivo em vez de virar erro", async () => {
  esquecerCotaExaurida();
  // Drive sem Content-Range: só o 416 diz onde o arquivo acaba.
  const d = deps([
    respostaArquivo("x".repeat(8 * 1024 * 1024)),
    new Response(null, { status: 416 }),
  ]);
  const file = await downloadDriveFile(ID, 50_000_000, d);
  assert.equal(file.bytes.length, 8 * 1024 * 1024);
  assert.equal(d.chamadas(), 2);
});
