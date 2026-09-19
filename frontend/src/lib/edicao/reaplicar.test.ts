/**
 * Testes das decisões do "reaplicar" e do "voltar ao original" (19/09).
 *
 * Rodar, de dentro de frontend/:
 *   npx tsx --test src/lib/edicao/reaplicar.test.ts
 *
 * ⚠️ `npx tsx --test`, NÃO `node --test` pelado: o alias `@/` do tsconfig não
 * resolve no loader do Node e os tripwires (que leem as ROTAS) morreriam na
 * compilação — falha que derruba o arquivo inteiro e não dispara try/catch
 * nenhum, então "0 fail" aqui não significaria nada.
 *
 * O QUE ESTÁ COBERTO:
 *   (A) reaplicar com saída existente EXIGE confirmação, e o texto não promete
 *       desfazer — é o aviso que faltava quando a aluna Leonice pagou 4 b-rolls
 *       (800 cr, 20:51:10Z→20:54:26Z) e ficou com 1 arquivo;
 *   (B) primeira aplicação NÃO exige nada (o guarda não pode virar pedágio no
 *       caminho feliz);
 *   (C) "voltar ao original" não dispara job nem débito — travado pela FORMA do
 *       patch: um campo só, e nenhum campo de job/projeto;
 *   (D) encadeamento b-roll → captions continua funcionando, inclusive o caso
 *       novo: depois de voltar ao original a legenda vai no clone cru;
 *   (E) tripwires: as DUAS rotas realmente chamam `decidirAplicacao` e chamam
 *       ANTES do gate de crédito / da transcrição, e os dois componentes usam
 *       as funções puras em vez de refazer a regra na mão. Sem isto, alguém
 *       reordena as linhas e a cobrança volta a acontecer antes da pergunta.
 *
 * O QUE ESTE ARQUIVO NÃO PROVA: que dois cliques com o PRIMEIRO job ainda no ar
 * são barrados. Não são — nessa janela o arquivo de saída ainda não existe.
 * Está escrito no cabeçalho de `reaplicar.ts` e no relatório; fechar isso exige
 * guardar o job em voo do lado do servidor, que não foi feito aqui.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CODIGO_SUBSTITUICAO,
  decidirAplicacao,
  podeVoltarAoOriginal,
  sourceKeyParaLegenda,
  voltarAoOriginal,
} from "./reaplicar.ts";

const AQUI = import.meta.dirname;
const SRC = join(AQUI, "..", "..");

/* ── (A) reaplicar exige confirmação ───────────────────────────────────── */

test("A1: saída já existe e ninguém confirmou → recusa", () => {
  const d = decidirAplicacao({ saidaJaExiste: true, confirmou: false, custo: 200, alvo: "broll" });
  assert.equal(d.pode, false);
  assert.equal(d.motivo, "substituicao_nao_confirmada");
});

test("A2: a mensagem diz o que se perde, quanto custa, e NÃO promete desfazer", () => {
  const d = decidirAplicacao({ saidaJaExiste: true, confirmou: false, custo: 200, alvo: "broll" });
  assert.equal(d.pode, false);
  if (d.pode) return;
  assert.match(d.mensagem, /SUBSTITUI/);
  assert.match(d.mensagem, /b-roll/);
  assert.match(d.mensagem, /200 créditos/);
  // O arquivo antigo some de verdade. Prometer volta aqui seria mentira.
  assert.doesNotMatch(d.mensagem, /dá pra voltar|pode voltar|desfazer|reverter/i);
});

test("A3: captions tem a mesma regra, com o alvo certo no texto", () => {
  const d = decidirAplicacao({ saidaJaExiste: true, confirmou: false, custo: 200, alvo: "captions" });
  assert.equal(d.pode, false);
  if (d.pode) return;
  assert.match(d.mensagem, /legendada/);
  assert.doesNotMatch(d.mensagem, /b-roll/);
});

test("A4: confirmou → passa, e o motivo registra que foi substituição", () => {
  const d = decidirAplicacao({ saidaJaExiste: true, confirmou: true, custo: 200, alvo: "broll" });
  assert.equal(d.pode, true);
  assert.equal(d.motivo, "substituicao_confirmada");
});

/* ── (B) primeira aplicação passa direto ───────────────────────────────── */

test("B1: sem saída anterior → passa sem confirmar (caminho feliz intocado)", () => {
  for (const alvo of ["broll", "captions"] as const) {
    const d = decidirAplicacao({ saidaJaExiste: false, confirmou: false, custo: 200, alvo });
    assert.equal(d.pode, true, alvo);
    assert.equal(d.motivo, "primeira_aplicacao", alvo);
  }
});

test("B2: sem saída anterior, confirmação sobrando não muda nada", () => {
  const d = decidirAplicacao({ saidaJaExiste: false, confirmou: true, custo: 200, alvo: "broll" });
  assert.equal(d.pode, true);
  assert.equal(d.motivo, "primeira_aplicacao");
});

/* ── (C) voltar ao original não dispara job nem débito ─────────────────── */

test("C1: o patch mexe em UM campo só e é null — nada que dispare job", () => {
  const patch = voltarAoOriginal();
  assert.deepEqual(Object.keys(patch), ["videoEditadoKey"]);
  assert.equal(patch.videoEditadoKey, null);
});

test("C2: o patch não carrega NENHUM campo capaz de virar job, projeto ou custo", () => {
  const patch = voltarAoOriginal() as Record<string, unknown>;
  // brollJob/captionJob ligam o poll; brollProjectId reabre a esteira do
  // Estúdio (que cobra por cena). Nenhum deles pode aparecer aqui.
  for (const proibido of ["brollJob", "captionJob", "brollProjectId", "cenasProjectId", "video", "audio"]) {
    assert.equal(proibido in patch, false, `campo proibido no patch: ${proibido}`);
  }
});

test("C3: o botão só aparece com edição em uso e nenhum job no ar", () => {
  const K = "u1/edicao/broll/clone-padrao-abc.mp4";
  assert.equal(podeVoltarAoOriginal({ videoEditadoKey: K, jobEmVoo: false }), true);
  // job no ar: reverter no meio deixaria o poll gravando a key de volta
  assert.equal(podeVoltarAoOriginal({ videoEditadoKey: K, jobEmVoo: true }), false);
  // sem edição em uso não há o que reverter
  assert.equal(podeVoltarAoOriginal({ videoEditadoKey: null, jobEmVoo: false }), false);
  assert.equal(podeVoltarAoOriginal({ videoEditadoKey: "", jobEmVoo: false }), false);
});

/* ── (D) encadeamento b-roll → captions ────────────────────────────────── */

test("D1: com b-roll aplicado, a legenda queima POR CIMA da saída do b-roll", () => {
  const K = "u1/edicao/broll/clone-padrao-abc.mp4";
  assert.equal(sourceKeyParaLegenda(K), K);
});

test("D2: saída de captions NÃO vira fonte (não se re-legenda em cima de si)", () => {
  assert.equal(sourceKeyParaLegenda("u1/edicao/captions/clone-padrao-abc.mp4"), null);
});

test("D3: depois do voltar ao original a legenda volta pro clone cru", () => {
  // é exatamente o encadeamento dos dois: patch → key null → sem source_key
  const depois = voltarAoOriginal();
  assert.equal(sourceKeyParaLegenda(depois.videoEditadoKey), null);
});

/* ── (E) tripwires: as rotas e a tela usam mesmo isto ──────────────────── */

const ROTAS = [
  { nome: "broll", caminho: join(SRC, "app/api/v1/edicao/broll/route.ts") },
  { nome: "captions", caminho: join(SRC, "app/api/v1/edicao/captions/route.ts") },
];

for (const rota of ROTAS) {
  test(`E1/${rota.nome}: a rota chama decidirAplicacao e devolve o código do 409`, () => {
    const fonte = readFileSync(rota.caminho, "utf8");
    assert.match(fonte, /decidirAplicacao\(/);
    assert.match(fonte, /CODIGO_SUBSTITUICAO/);
    assert.match(fonte, /409/);
  });

  test(`E2/${rota.nome}: a decisão vem ANTES do gate de crédito`, () => {
    const fonte = readFileSync(rota.caminho, "utf8");
    const decisao = fonte.indexOf("decidirAplicacao(");
    const gate = fonte.indexOf("await gateStudioCredits(");
    assert.ok(decisao > 0, "decidirAplicacao não encontrado");
    assert.ok(gate > 0, "gateStudioCredits não encontrado");
    // Perguntar não pode custar nada: se o gate rodar primeiro, a pessoa paga
    // (ou leva 402) antes de ser avisada de que ia sobrescrever.
    assert.ok(decisao < gate, "decidirAplicacao precisa vir antes de gateStudioCredits");
  });
}

test("E3/captions: a decisão vem antes da transcrição (a parte cara)", () => {
  const fonte = readFileSync(ROTAS[1].caminho, "utf8");
  const decisao = fonte.indexOf("decidirAplicacao(");
  const whisper = fonte.indexOf("await transcribeWords(");
  assert.ok(whisper > 0, "transcribeWords não encontrado");
  assert.ok(decisao < whisper, "não faz sentido transcrever pra recusar depois");
});

test("E4: o card do b-roll usa as funções puras (não refaz a regra na mão)", () => {
  const fonte = readFileSync(join(SRC, "components/edicao/editar-clone-broll.tsx"), "utf8");
  assert.match(fonte, /voltarAoOriginal\(\)/);
  assert.match(fonte, /podeVoltarAoOriginal\(/);
  assert.match(fonte, /CODIGO_SUBSTITUICAO/);
  assert.match(fonte, /confirmar_substituicao/);
});

test("E5: o card de legendas usa sourceKeyParaLegenda no lugar do includes solto", () => {
  const fonte = readFileSync(join(SRC, "components/edicao/passo-editar.tsx"), "utf8");
  assert.match(fonte, /sourceKeyParaLegenda\(/);
  assert.match(fonte, /CODIGO_SUBSTITUICAO/);
  // a expressão antiga não pode ter sobrado em paralelo com a função
  assert.doesNotMatch(fonte, /videoEditadoKey\?\.includes\(/);
});

/* ── (F) o módulo de decisão é PURO de verdade ─────────────────────────── */

test("F1: reaplicar.ts não tem import nenhum (padrão da casa)", () => {
  const fonte = readFileSync(join(AQUI, "reaplicar.ts"), "utf8");
  const linhas = fonte.split("\n").filter((l) => /^\s*import\s/.test(l));
  assert.deepEqual(linhas, [], `imports encontrados: ${linhas.join(" | ")}`);
});

test("F2: o código do 409 é o mesmo string que os clientes procuram", () => {
  assert.equal(CODIGO_SUBSTITUICAO, "substituicao_requer_confirmacao");
});
