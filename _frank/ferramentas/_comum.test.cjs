/**
 * Testes de `existe()` em _comum.cjs.
 *
 *   node --test _frank/ferramentas/_comum.test.cjs
 *
 * O bug original (medido em 25/09, prova em /tmp/probe-r2-errors.cjs — não
 * versionado): `existe()` fazia `catch { return false }` sem olhar o erro.
 * Credencial inválida, bucket errado, rede fora — tudo virava "objeto não
 * existe" e uma medição por ausência (ex.: "52/52 vídeos ausentes no R2")
 * não tinha como se distinguir de uma falha de instrumento. A correção só
 * devolve `false` no único caso que a AWS/R2 modela como "não existe" de
 * verdade — HeadObject 404 — e LANÇA em qualquer outro caso.
 *
 * Os dois formatos de erro abaixo (404 com $metadata, e "sem $metadata" pra
 * erro de rede) foram copiados do que o SDK real devolveu contra o R2 de
 * produção no probe citado acima — não são inventados.
 *
 * Sem rede: patcha-se `S3Client.prototype.send` (exportado como `s3` por
 * _comum.cjs) em vez de bater no R2 de verdade.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { existe, s3 } = require("./_comum.cjs");

/** Troca S3Client.prototype.send por um fake que resolve/rejeita como mandado
 * e devolve uma função pra restaurar o original — sempre chamar em finally. */
function comSendFalso(fn) {
  const original = s3.S3Client.prototype.send;
  s3.S3Client.prototype.send = fn;
  return () => {
    s3.S3Client.prototype.send = original;
  };
}

/* ---- erro real medido contra o R2 (probe 25/09): key ausente ---- */
const ERRO_404_NOT_FOUND = Object.assign(new Error("UnknownError"), {
  name: "NotFound",
  $metadata: { httpStatusCode: 404 },
});

/* ---- erro real medido: credencial inválida (accessKeyId errado) ---- */
const ERRO_CREDENCIAL_INVALIDA = Object.assign(new Error("UnknownError"), {
  name: "Unknown",
  $metadata: { httpStatusCode: 400 },
});

/* ---- erro real medido: 403 (usado pra permissão/bucket sem acesso) ---- */
const ERRO_403_FORBIDDEN = Object.assign(new Error("Access Denied"), {
  name: "Forbidden",
  $metadata: { httpStatusCode: 403 },
});

/* ---- erro real medido: endpoint inalcançável, sem $metadata nenhum ---- */
const ERRO_REDE_SEM_METADATA = Object.assign(new Error("getaddrinfo ENOTFOUND algumacoisa.invalid"), {
  name: "Error",
  code: "ENOTFOUND",
});

test("existe(): objeto genuinamente ausente (404/NotFound) devolve false", async () => {
  const restaurar = comSendFalso(async () => {
    throw ERRO_404_NOT_FOUND;
  });
  try {
    assert.equal(await existe("bucket-qualquer", "chave/que/nao/existe.mp4"), false);
  } finally {
    restaurar();
  }
});

test("existe(): objeto presente (sem erro) devolve true", async () => {
  const restaurar = comSendFalso(async () => ({ ContentLength: 12345 }));
  try {
    assert.equal(await existe("bucket-qualquer", "chave/que/existe.mp4"), true);
  } finally {
    restaurar();
  }
});

test("existe(): credencial inválida (400, não é 404) LANÇA — não vira false silencioso", async () => {
  const restaurar = comSendFalso(async () => {
    throw ERRO_CREDENCIAL_INVALIDA;
  });
  try {
    await assert.rejects(
      existe("bucket-qualquer", "chave.mp4"),
      /nao deu pra perguntar ao R2/,
    );
  } finally {
    restaurar();
  }
});

test("existe(): 403 (permissão/bucket) LANÇA — não vira false silencioso", async () => {
  const restaurar = comSendFalso(async () => {
    throw ERRO_403_FORBIDDEN;
  });
  try {
    await assert.rejects(existe("bucket-qualquer", "chave.mp4"), /Forbidden|HTTP 403/);
  } finally {
    restaurar();
  }
});

test("existe(): erro de rede sem $metadata LANÇA — não vira false silencioso", async () => {
  const restaurar = comSendFalso(async () => {
    throw ERRO_REDE_SEM_METADATA;
  });
  try {
    await assert.rejects(existe("bucket-qualquer", "chave.mp4"), /ENOTFOUND|nao deu pra perguntar/);
  } finally {
    restaurar();
  }
});

test("existe(): o erro lançado preserva bucket e key na mensagem, pra diagnosticar sem repetir a chamada", async () => {
  const restaurar = comSendFalso(async () => {
    throw ERRO_CREDENCIAL_INVALIDA;
  });
  try {
    await assert.rejects(
      existe("bucket-especifico-xyz", "caminho/especifico/abc.mp4"),
      (e) => e.message.includes("bucket-especifico-xyz") && e.message.includes("caminho/especifico/abc.mp4"),
    );
  } finally {
    restaurar();
  }
});

test("existe(): o erro original fica em `cause`, pra quem quiser inspecionar o status/nome de verdade", async () => {
  const restaurar = comSendFalso(async () => {
    throw ERRO_403_FORBIDDEN;
  });
  try {
    await existe("bucket-qualquer", "chave.mp4");
    assert.fail("deveria ter lançado");
  } catch (e) {
    assert.equal(e.cause, ERRO_403_FORBIDDEN);
  } finally {
    restaurar();
  }
});
