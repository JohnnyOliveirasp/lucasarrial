/**
 * Testes da recusa por tamanho (caso do cliente pagante, 09/09).
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/agent/mail-anexo-grande.test.ts
 *
 * O NÚMERO É REAL: o anexo dele (IMG_1177.PNG) tem 1.653.831 bytes medidos, e
 * a mensagem que carregava esse anexo passou de 2,3 MB por causa do base64.
 * O código antigo fazia `Math.round(2_300_000 / 1_000_000)` = 2 e escrevia
 * "seu anexo tem 2 MB" — número menor que o real, com o rótulo errado.
 *
 * Os testes marcados REGRESSÃO abaixo falham contra o texto antigo. Sem eles
 * dá pra "consertar" o arquivo e reintroduzir o mesmo e-mail no mês que vem.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidirAnexoGrande,
  formatarTamanho,
  podar,
  type EstadoRecusas,
} from "./mail-anexo-grande.ts";

/** Os bytes reais do caso. */
const ANEXO_REAL = 1_653_831; // IMG_1177.PNG, medido
const MENSAGEM_REAL = 2_300_000; // o mesmo print depois do base64
const TETO = 2_000_000; // MAIL_MAX_BYTES

// ------------------------------------------------------------ formatarTamanho

test("nunca subestima: 2,3 MB não vira '2 MB' (o bug que deu razão ao cliente)", () => {
  // Math.round(2_300_000/1e6) === 2 — era isso que ia no e-mail.
  assert.equal(Math.round(MENSAGEM_REAL / 1_000_000), 2, "premissa do teste");
  assert.equal(formatarTamanho(MENSAGEM_REAL), "2,3 MB");
});

test("arredonda pra cima, sempre", () => {
  assert.equal(formatarTamanho(2_010_000), "2,1 MB");
  assert.equal(formatarTamanho(2_099_999), "2,1 MB");
  assert.equal(formatarTamanho(ANEXO_REAL), "1,7 MB");
});

test("valor redondo não ganha ',0' pendurado", () => {
  assert.equal(formatarTamanho(2_000_000), "2 MB");
  assert.equal(formatarTamanho(33_000_000), "33 MB");
});

test("não inventa casa decimal por erro de float", () => {
  // 2_000_000/1e6 pode voltar 2.0000000000000004 dependendo da conta.
  assert.equal(formatarTamanho(2_000_000), "2 MB");
  assert.equal(formatarTamanho(1_000_000), "1 MB");
});

test("aguenta zero e lixo sem explodir", () => {
  assert.equal(formatarTamanho(0), "0 MB");
  assert.equal(formatarTamanho(-5), "0 MB");
});

// -------------------------------------------------- primeira recusa (defeito A)

test("REGRESSÃO: não chama de ANEXO um número que é da MENSAGEM", () => {
  const d = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 0,
  });
  // O texto antigo era: "veio com um anexo grande demais (2 MB)".
  assert.ok(
    !/anexo grande demais/i.test(d.texto),
    "não pode reusar a frase que atribuía o tamanho ao anexo",
  );
  // Não basta a palavra "e-mail" aparecer: o texto ANTIGO também começava com
  // "Recebi seu e-mail" e mesmo assim pendurava o número no ANEXO. O que este
  // teste cobra é o número estar ligado À MENSAGEM.
  assert.match(
    d.texto,
    /seu e-mail[^.]{0,60}2,3 MB/i,
    "o tamanho tem que estar atribuído ao e-mail, não solto no texto",
  );
  assert.ok(d.texto.includes("2,3 MB"), "tem que mostrar o tamanho real da mensagem");
});

test("REGRESSÃO: nunca imprime o tamanho subestimado que o cliente contestou", () => {
  const d = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 0,
  });
  // "(2 MB)" entre parênteses era a assinatura literal do texto velho.
  assert.ok(!d.texto.includes("(2 MB)"), "era o número que dava razão ao cliente");
});

test("diz qual é o limite, não só que passou dele", () => {
  const d = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 0,
  });
  assert.ok(d.texto.includes("2 MB"), "o teto tem que aparecer");
});

test("explica o inchaço do base64 (senão o número parece invenção nossa)", () => {
  const d = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 0,
  });
  assert.ok(
    /30%|engorda/i.test(d.texto),
    "tem que explicar por que o número não bate com o arquivo dele",
  );
});

test("REGRESSÃO (defeito B): não promete abrir o mesmo anexo no reenvio", () => {
  const d = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 0,
  });
  assert.ok(
    !/reenvi\w* o (arquivo|anexo)|vou conseguir abrir|agora eu abro/i.test(d.texto),
    "foi essa promessa que produziu a segunda recusa idêntica",
  );
  assert.equal(d.escalar, false, "a primeira recusa ainda tenta resolver sozinha");
});

test("primeira recusa oferece caminho que de fato funciona", () => {
  const d = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 0,
  });
  assert.ok(/link/i.test(d.texto), "link é a alternativa que passa pelo limite");
  assert.ok(/texto/i.test(d.texto), "responder em texto resolve a maioria dos casos");
});

// --------------------------------------------------- segunda recusa (defeito B)

test("REGRESSÃO (defeito B): a 2ª recusa ao mesmo remetente vai pra humano", () => {
  const d = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 1,
  });
  assert.equal(d.escalar, true, "repetir a receita é o que fez ele pedir humano");
  assert.ok(/pessoa da equipe|humano/i.test(d.texto));
});

test("a 2ª recusa NÃO repete a receita da primeira", () => {
  const primeira = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 0,
  });
  const segunda = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 1,
  });
  assert.notEqual(primeira.texto, segunda.texto);
  assert.ok(
    !/Google Drive|WeTransfer/i.test(segunda.texto),
    "a lista de alternativas já foi dada e já falhou com esta pessoa",
  );
});

test("a 2ª recusa não culpa o cliente nem manda tentar de novo", () => {
  const d = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 1,
  });
  assert.ok(/não vou te fazer tentar de novo/i.test(d.texto));
  assert.ok(/culpa não é/i.test(d.texto));
});

test("da 3ª em diante continua escalando (não volta a repetir a receita)", () => {
  for (const n of [2, 5, 20]) {
    const d = decidirAnexoGrande({
      sizeBytes: MENSAGEM_REAL,
      limitBytes: TETO,
      recusasAnteriores: n,
    });
    assert.equal(d.escalar, true, `recusa nº ${n + 1} tem que escalar`);
  }
});

test("o motivo diz o que o time precisa saber, com o tamanho certo", () => {
  const primeira = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 0,
  });
  assert.ok(primeira.motivo.includes("2,3 MB"));
  const segunda = decidirAnexoGrande({
    sizeBytes: MENSAGEM_REAL,
    limitBytes: TETO,
    recusasAnteriores: 1,
  });
  assert.ok(/2ª recusa/.test(segunda.motivo), "o time precisa saber que é reincidência");
});

// ------------------------------------------------------------------------ podar

const AGORA = Date.parse("2026-09-10T12:00:00Z");
const diasAtras = (d: number) => new Date(AGORA - d * 24 * 60 * 60 * 1000).toISOString();

test("podar mantém quem é recente e joga fora quem passou da janela", () => {
  const estado: EstadoRecusas = {
    "novo@x.com": { n: 1, at: diasAtras(2) },
    "velho@x.com": { n: 1, at: diasAtras(31) },
  };
  const out = podar(estado, AGORA);
  assert.deepEqual(Object.keys(out), ["novo@x.com"]);
});

test("podar não descarta registro com data ilegível (na dúvida, preserva)", () => {
  // Descartar aqui significaria tratar como PRIMEIRA recusa alguém que já
  // levou uma — exatamente o erro que este card conserta.
  const estado: EstadoRecusas = {
    "quebrado@x.com": { n: 1, at: "não é data" },
    "vazio@x.com": { n: 2, at: "" },
  };
  const out = podar(estado, AGORA);
  assert.equal(Object.keys(out).length, 2);
});

test("podar num estado vazio não explode", () => {
  assert.deepEqual(podar({}, AGORA), {});
});

// ------------------------------------------------------------------ o caso 33MB

test("o caso de 33MB (08/08) continua tratado normalmente", () => {
  const d = decidirAnexoGrande({
    sizeBytes: 33_000_000,
    limitBytes: TETO,
    recusasAnteriores: 0,
  });
  assert.ok(d.texto.includes("33 MB"));
  assert.equal(d.escalar, false);
});
