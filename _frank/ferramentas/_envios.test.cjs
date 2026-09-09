/**
 * Testes da trava anti-duplicata de e-mail. Sem banco, sem rede, sem SMTP:
 *
 *   node --test _frank/ferramentas/_envios.test.cjs
 *
 * Cada caso aqui é uma armadilha REAL — ou já mordeu (a leva dupla de 06/09),
 * ou morderia calada na primeira vez que a trava entrasse em produção. O risco
 * de uma trava de envio não é só deixar passar: é BARRAR carta legítima e o
 * aluno ficar sem resposta achando que foi ignorado. Metade dos casos abaixo
 * existe pra provar o que a trava NÃO bloqueia.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const E = require("./_envios.cjs");

const HORA = 3600000;
const AGORA = Date.parse("2026-09-06T02:00:00.000Z");

/** Monta o estado como se `registrar` tivesse rodado. */
function estadoCom(...registros) {
  let estado = {};
  for (const r of registros) {
    estado[E.indicePorChave(r.para, r.chave)] = r;
    if (r.sha) estado[E.indicePorCorpo(r.para, r.sha)] = r;
  }
  return estado;
}

const envio = (over = {}) => ({
  at: new Date(AGORA - 32 * 60000).toISOString(), // 32 min atrás: a leva de 06/09
  para: "costa.anaelson@exemplo.com",
  chave: "video-clone-voltou",
  assunto: "O Vídeo Clone voltou",
  message_id: "<frank-1@fastcloner.com>",
  sha: "aaaaaaaaaaaaaaaa",
  ...over,
});

const decidirSobre = (estado, alvo, opts = {}) =>
  E.decidir(E.consultar(estado, alvo), { agora: AGORA, janelaHoras: E.JANELA_PADRAO_HORAS, ...opts });

/* ─────────────────────────── chave do aviso ─────────────────────────── */

test("ARMADILHA REAL: o assunto reescrito à mão continua sendo o MESMO aviso", () => {
  // A segunda leva de 06/09 não copiou o assunto da primeira, digitou de novo.
  // Comparar assunto cru deixaria as duas passarem como avisos diferentes.
  assert.equal(E.chaveDoAviso("O Vídeo Clone voltou!"), E.chaveDoAviso("o video clone voltou"));
  assert.equal(E.chaveDoAviso("Vídeo  Clone   voltou "), "video-clone-voltou");
});

test("assunto diferente de verdade dá chave diferente (senão a trava vira mordaça)", () => {
  assert.notEqual(E.chaveDoAviso("O Vídeo Clone voltou"), E.chaveDoAviso("Seus créditos foram estornados"));
});

test("assunto sem nenhuma letra NÃO vira chave vazia", () => {
  // Chave vazia colidiria com toda outra carta sem letras e barraria envio
  // legítimo de aluno que nada tem a ver com o anterior.
  const a = E.chaveDoAviso("🎉🎉🎉");
  const b = E.chaveDoAviso("✅");
  assert.match(a, /^assunto-[0-9a-f]{12}$/);
  assert.notEqual(a, b);
});

test("--chave explícita manda no assunto e é normalizada", () => {
  assert.equal(E.chaveDoAviso("qualquer coisa", "Video-Clone Voltou"), "video-clone-voltou");
  // string vazia/espaço não conta como explícita: cai no assunto
  assert.equal(E.chaveDoAviso("Assunto Bom", "   "), "assunto-bom");
});

test("e-mail é comparado sem caixa e sem espaço nas bordas", () => {
  assert.equal(E.normalizarEmail("  Costa.Anaelson@Exemplo.COM "), "costa.anaelson@exemplo.com");
});

/* ──────────────────────────── a decisão ─────────────────────────────── */

test("O CASO DE 06/09: mesma chave, mesmo aluno, 32 min depois → BLOQUEIA", () => {
  const v = decidirSobre(estadoCom(envio()), {
    para: "costa.anaelson@exemplo.com",
    chave: "video-clone-voltou",
    sha: "bbbbbbbbbbbbbbbb",
  });
  assert.equal(v.bloqueia, true);
  assert.equal(v.motivos[0].tipo, "mesma chave de aviso");
  assert.ok(v.motivos[0].horas < 1);
});

test("O QUE NÃO PODE BLOQUEAR: a leva inteira, aluno por aluno", () => {
  // Este é o teste que impede o conserto de virar um dano maior que o defeito.
  // 9 alunos receberam o mesmo aviso na leva de 00:36Z. Se a trava fosse por
  // chave (e não por destinatário+chave), o 2º aluno em diante ficaria sem
  // carta e o apagão seguiria sem aviso pra 8 pessoas.
  const estado = estadoCom(envio());
  for (const outro of ["rafaluanravi29@exemplo.com", "clayton@exemplo.com", "lux.neuropsi@exemplo.com"]) {
    const v = decidirSobre(estado, { para: outro, chave: "video-clone-voltou", sha: "cccccccccccccccc" });
    assert.equal(v.bloqueia, false, `${outro} tinha que passar`);
    assert.deepEqual(v.anteriores, []);
  }
});

test("mesmo aluno, aviso DIFERENTE, no mesmo minuto → passa", () => {
  const v = decidirSobre(estadoCom(envio()), {
    para: "costa.anaelson@exemplo.com",
    chave: "seu-audio-ficou-pronto",
    sha: "dddddddddddddddd",
  });
  assert.equal(v.bloqueia, false);
});

test("fora da janela → passa (a trava tem prazo, não é lista negra eterna)", () => {
  const v = decidirSobre(
    estadoCom(envio({ at: new Date(AGORA - 73 * HORA).toISOString() })),
    { para: "costa.anaelson@exemplo.com", chave: "video-clone-voltou", sha: "eeeeeeeeeeeeeeee" },
    { janelaHoras: 72 },
  );
  assert.equal(v.bloqueia, false);
  // ...mas o envio antigo AINDA aparece: quem manda precisa ver o que já saiu.
  assert.equal(v.anteriores.length, 1);
  assert.ok(v.anteriores[0].horas > 72);
});

test("na borda exata da janela ainda bloqueia (72h00 não é 'passou')", () => {
  const dentro = decidirSobre(
    estadoCom(envio({ at: new Date(AGORA - 72 * HORA + 1000).toISOString() })),
    { para: "costa.anaelson@exemplo.com", chave: "video-clone-voltou" },
    { janelaHoras: 72 },
  );
  assert.equal(dentro.bloqueia, true);
});

test("SEGUNDA TRAVA: corpo byte-idêntico bloqueia mesmo com assunto novo", () => {
  // Sem isto, bastava trocar uma palavra do assunto pra carta idêntica sair de
  // novo — a trava de chave sozinha é fácil demais de furar sem querer.
  const v = decidirSobre(estadoCom(envio()), {
    para: "costa.anaelson@exemplo.com",
    chave: "aviso-com-outro-titulo",
    sha: "aaaaaaaaaaaaaaaa",
  });
  assert.equal(v.bloqueia, true);
  assert.equal(v.motivos[0].tipo, "corpo byte-idêntico");
});

test("corpo diferente + chave diferente → passa (carta nova de verdade)", () => {
  const v = decidirSobre(estadoCom(envio()), {
    para: "costa.anaelson@exemplo.com",
    chave: "outro-aviso",
    sha: "ffffffffffffffff",
  });
  assert.equal(v.bloqueia, false);
});

test("--forcar libera, mas devolve o que já saiu pra quem forçou VER", () => {
  const v = decidirSobre(
    estadoCom(envio()),
    { para: "costa.anaelson@exemplo.com", chave: "video-clone-voltou", sha: "aaaaaaaaaaaaaaaa" },
    { forcar: true },
  );
  assert.equal(v.bloqueia, false);
  assert.equal(v.forcado, true);
  assert.ok(v.motivos.length >= 1);
  assert.equal(v.anteriores[0].message_id, "<frank-1@fastcloner.com>");
});

test("registro anterior com data ilegível FECHA a porta (não abre)", () => {
  // Não dá pra afirmar que está fora da janela. Afirmar isso é exatamente o
  // erro que manda a carta duas vezes — então a dúvida vira recusa, com o
  // motivo escrito, e `--forcar` continua disponível.
  const v = decidirSobre(estadoCom(envio({ at: "ontem de tarde" })), {
    para: "costa.anaelson@exemplo.com",
    chave: "video-clone-voltou",
  });
  assert.equal(v.bloqueia, true);
  assert.equal(v.motivos[0].detalhe, "registro anterior sem data legível");
  assert.equal(v.motivos[0].horas, null);
  assert.equal(v.anteriores[0].horas, null);
});

test("janela 0 desliga a trava (e não explode)", () => {
  const v = decidirSobre(
    estadoCom(envio()),
    { para: "costa.anaelson@exemplo.com", chave: "video-clone-voltou", sha: "aaaaaaaaaaaaaaaa" },
    { janelaHoras: 0 },
  );
  assert.equal(v.bloqueia, false);
});

test("estado vazio: primeira carta da vida passa", () => {
  const v = decidirSobre({}, { para: "novo@exemplo.com", chave: "video-clone-voltou", sha: "1111111111111111" });
  assert.equal(v.bloqueia, false);
  assert.deepEqual(v.anteriores, []);
});

test("o mesmo envio achado pelas duas travas aparece UMA vez na lista", () => {
  const v = decidirSobre(estadoCom(envio()), {
    para: "costa.anaelson@exemplo.com",
    chave: "video-clone-voltou",
    sha: "aaaaaaaaaaaaaaaa",
  });
  assert.equal(v.motivos.length, 2, "as duas travas dispararam");
  assert.equal(v.anteriores.length, 1, "mas é o mesmo e-mail, não dois");
});

/* ──────────────────────────── poda e fusão ──────────────────────────── */

test("poda descarta o que passou da retenção e mantém o resto", () => {
  const velho = envio({ at: new Date(AGORA - 31 * 24 * HORA).toISOString(), para: "velho@x.com" });
  const novo = envio({ para: "novo@x.com" });
  const podado = E.podar(estadoCom(velho, novo), AGORA);
  assert.equal(E.indicePorChave("velho@x.com", velho.chave) in podado, false);
  assert.equal(E.indicePorChave("novo@x.com", novo.chave) in podado, true);
});

test("poda NÃO apaga registro com data ilegível (apagar prova é pior)", () => {
  const estado = estadoCom(envio({ at: "sei lá quando" }));
  assert.deepEqual(Object.keys(E.podar(estado, AGORA)).sort(), Object.keys(estado).sort());
});

test("fusão banco+local: o registro mais NOVO do mesmo índice vence", () => {
  const antigo = envio({ at: new Date(AGORA - 10 * HORA).toISOString(), message_id: "<antigo>" });
  const recente = envio({ at: new Date(AGORA - 1 * HORA).toISOString(), message_id: "<recente>" });
  const k = E.indicePorChave(antigo.para, antigo.chave);
  assert.equal(E.fundir(estadoCom(antigo), estadoCom(recente))[k].message_id, "<recente>");
  assert.equal(E.fundir(estadoCom(recente), estadoCom(antigo))[k].message_id, "<recente>");
});

/* ────────────────────────── espelho local ───────────────────────────── */

test("espelho local: grava, relê e a trava enxerga o que ELE mesmo mandou", () => {
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "envios-")), "ledger.jsonl");
  const reg = envio();
  E.gravarLocal(reg, arq);
  const estado = E.lerLocal(arq);
  const v = decidirSobre(estado, { para: reg.para, chave: reg.chave, sha: reg.sha });
  assert.equal(v.bloqueia, true, "máquina sem banco ainda dedupe pelo próprio registro");
});

test("arquivo local inexistente é estado vazio, não erro", () => {
  assert.deepEqual(E.lerLocal(path.join(os.tmpdir(), "nao-existe-", "x.jsonl")), {});
});

test("linha truncada no arquivo derruba a LINHA, não o arquivo inteiro", () => {
  // Queda no meio do append já aconteceu com o enviados_local.jsonl. Se uma
  // linha quebrada zerasse a leitura, a trava sumiria justo depois de um
  // acidente — que é quando ela mais precisa existir.
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "envios-")), "ledger.jsonl");
  const bom = envio();
  fs.writeFileSync(arq, `{"at":"2026-09-06T00:00:00.000Z","para":"x@y.com","chav\n${JSON.stringify(bom)}\n`, "utf8");
  const estado = E.lerLocal(arq);
  assert.equal(E.indicePorChave(bom.para, bom.chave) in estado, true);
});

test("linha sem para/chave é ignorada (não vira índice fantasma)", () => {
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "envios-")), "ledger.jsonl");
  fs.writeFileSync(arq, `${JSON.stringify({ at: new Date().toISOString(), assunto: "sem chave" })}\n`, "utf8");
  assert.deepEqual(E.lerLocal(arq), {});
});
