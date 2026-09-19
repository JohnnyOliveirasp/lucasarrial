/**
 * A Fast precisa receber, POR TRABALHO, se o crédito foi cobrado e se voltou.
 * Rodar:
 *   cd frontend && npx tsx --test src/lib/agent/account-dinheiro.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE (incidente 70633cab / cartão #473, medido 19/09).
 *
 * Em 17/09 08:50Z (Enviados uid 2606) a casa escreveu à aluna
 * katiasalvador32@gmail.com: "Os 400 créditos que foram cobrados já voltaram
 * automaticamente pra sua conta." Era falso — a geração `019c58d1` tinha UMA
 * linha no ledger, `-400` em 16/09, e estorno nenhum. Ela passou 3 dias 400
 * créditos no negativo acreditando que não estava.
 *
 * O `account-extrato.test.ts` (#260) já protege o passo anterior: o `ref_type`
 * vai no extrato, então estorno não chega mais disfarçado de "extra_purchase".
 * Mas isso resolve "existe estorno NESTA CONTA?", e a pergunta que a Fast
 * responde é outra: "este TRABALHO foi estornado?". A conta da Katia tinha um
 * +400 `generation_refund` de 12/09 casado com OUTRA geração (`b6df1a7e`), e é
 * exatamente ele que a leitura por valor/data transformou na frase falsa.
 *
 * O que muda o desfecho é o `ref_id`. Este arquivo guarda as quatro coisas que,
 * se alguém desfizer, devolvem a Fast ao estado de 17/09:
 *   1. o `id` de cada trabalho é BUSCADO (sem ele não há o que casar);
 *   2. o extrato é buscado POR `ref_id`, não por valor nem por data;
 *   3. o veredito é RENDERIZADO (buscar e não imprimir é pior que não buscar:
 *      custa a consulta e a Fast continua cega — regra do #260);
 *   4. o aviso sai por EXISTIR TRABALHO, não por "apareceu linha de dinheiro" —
 *      porque é a AUSÊNCIA da linha que convida o chute.
 *
 * Lê o FONTE (padrão do `manual.test.ts` / #215 e do `account-extrato.test.ts`):
 * `account.ts` importa por alias `@/` e fala com o banco; o que se quer proteger
 * aqui são decisões literais de select e de montagem de prompt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FONTE = readFileSync(fileURLToPath(new URL("./account.ts", import.meta.url)), "utf8");

/** Uma chamada `recent("<tabela>", "<colunas>")`, isolada. */
function selectDoTrabalho(tabela: string): string {
  const m = FONTE.match(new RegExp(`recent\\("${tabela}",\\s*"([^"]+)"\\)`));
  assert.ok(m, `sumiu a busca de ${tabela} em account.ts — se mudou de forma, ajuste este teste junto`);
  return m[1];
}

/** As 5 tabelas de trabalho que entram na lista da Fast. */
const TABELAS = ["voices", "generations", "video_clones", "image_generations", "video_projects"];

// ── 1. o id é buscado ────────────────────────────────────────────────────────

for (const tabela of TABELAS) {
  test(`o select de ${tabela} traz id (sem ele nada casa com o extrato)`, () => {
    const cols = selectDoTrabalho(tabela).split(",").map((c) => c.trim());
    assert.ok(
      cols.includes("id"),
      `o select de ${tabela} perdeu o id — sem ele a Fast volta a responder sobre estorno por valor/data/kind, que é o erro de 17/09`,
    );
  });
}

test("os selects continuam trazendo o que já traziam (não trocar campo por campo)", () => {
  for (const tabela of TABELAS) {
    const cols = selectDoTrabalho(tabela);
    for (const campo of ["name", "status", "error_message", "created_at"]) {
      assert.match(cols, new RegExp(`\\b${campo}\\b`), `o select de ${tabela} perdeu ${campo}`);
    }
  }
  // os dois campos que são de UMA tabela só, e cada um tem incidente atrás:
  assert.match(selectDoTrabalho("generations"), /\bqa\b/, "generations perdeu qa (incidente 702cc916)");
  assert.match(selectDoTrabalho("video_projects"), /\bscene_count\b/, "video_projects perdeu scene_count");
});

// ── 2. o extrato dos trabalhos é buscado POR ref_id ──────────────────────────

/** O corpo de `extratoDosTrabalhos`, isolado do resto do arquivo. */
function buscaDoExtratoPorRefId(): string {
  const i = FONTE.indexOf("async function extratoDosTrabalhos");
  assert.notEqual(i, -1, "sumiu extratoDosTrabalhos de account.ts — se mudou de nome, ajuste este teste junto");
  const fim = FONTE.indexOf("\n}", i);
  assert.notEqual(fim, -1, "não achei o fim de extratoDosTrabalhos");
  return FONTE.slice(i, fim);
}

test("o extrato dos trabalhos é filtrado por ref_id, não por valor nem por data", () => {
  const bloco = buscaDoExtratoPorRefId();
  assert.match(bloco, /credit_transactions/, "extratoDosTrabalhos não lê credit_transactions");
  assert.match(
    bloco,
    /\.in\("ref_id",/,
    'a busca precisa casar por ref_id (`.in("ref_id", ids)`) — casar por valor ou por data é literalmente o erro de 17/09',
  );
  for (const campo of ["ref_id", "ref_type", "amount", "created_at"]) {
    assert.match(bloco, new RegExp(`\\b${campo}\\b`), `o select do extrato por trabalho perdeu ${campo}`);
  }
});

test("a busca do extrato por trabalho é SEPARADA da janela das 6 últimas movimentações", () => {
  // A janela de 6 é da CONTA e é recente; o débito de um trabalho de 3 dias
  // atrás cai fora dela. Reaproveitar aquela lista aqui reintroduz o buraco.
  const bloco = buscaDoExtratoPorRefId();
  assert.doesNotMatch(bloco, /\.limit\(6\)/, "a busca por ref_id não pode herdar o limite da janela de 6");
  assert.match(FONTE, /\.limit\(6\)/, "a janela de 6 últimas movimentações da conta não pode ter sido removida");
});

// ── 3. o veredito é calculado E renderizado ──────────────────────────────────

test("o veredito de dinheiro é calculado para cada trabalho", () => {
  const i = FONTE.indexOf("const lines = (label: string");
  assert.notEqual(i, -1, "sumiu a montagem das linhas de trabalho");
  const bloco = FONTE.slice(i, FONTE.indexOf("const jobs", i));
  assert.match(bloco, /extratoVeredito\(/, "nenhum trabalho passa por extratoVeredito");
  assert.match(bloco, /dinheiro:/, "o veredito não é guardado no campo dinheiro da linha");
  // A regra do módulo: quem casa o ref_id é ele, recebendo o extrato inteiro.
  assert.match(bloco, /extratoVeredito\(r\.id,/, "o veredito tem que ser casado com o id do PRÓPRIO trabalho");
});

test("o campo dinheiro é RENDERIZADO, não só calculado", () => {
  // Calcular e não imprimir é pior que não calcular: custa a consulta e a Fast
  // continua cega. O prompt só enxerga o que sai de jobLines.
  //
  // ⚠️ Conferir só "a string j.dinheiro aparece no bloco" NÃO basta, e isso foi
  // medido: mutando `const money = ""` o valor continua sendo calculado, a
  // menção continua no arquivo e a linha nunca chega ao prompt. Então este teste
  // exige as DUAS pontas — o valor lido E a variável interpolada no template que
  // é devolvido.
  const i = FONTE.indexOf("function jobLines");
  assert.notEqual(i, -1, "sumiu jobLines");
  const bloco = FONTE.slice(i, FONTE.indexOf("\n}", i));

  const m = bloco.match(/const\s+(\w+)\s*=\s*j\.dinheiro\s*\?/);
  assert.ok(m, "jobLines não lê j.dinheiro — a Fast continua sem enxergar o veredito de crédito");
  const variavel = m[1];

  // Do `return` do template até o fim do bloco. NÃO dá para casar o template
  // com /`[^`]*`/: ele tem backtick ANINHADO dentro (`${j.name ? ` "..."` : ""}`),
  // e o casamento pararia antes de chegar no que interessa — este teste já caiu
  // nessa armadilha uma vez.
  const r = bloco.lastIndexOf("return `");
  assert.notEqual(r, -1, "não achei o template devolvido por jobLines");
  const devolvido = bloco.slice(r);
  assert.ok(
    devolvido.includes("${" + variavel + "}"),
    `jobLines calcula "${variavel}" mas não interpola no texto devolvido — o veredito de crédito nunca chega ao prompt`,
  );
  // Controle: a ressalva de QA não pode ter caído fora no mesmo movimento.
  assert.match(bloco, /j\.ressalva/, "jobLines perdeu a ressalva de QA (incidente 702cc916)");
});

// ── 4. o aviso sai por EXISTIR TRABALHO, não por ter saído linha ─────────────

test("o aviso de estorno casado é emitido no contexto da Fast", () => {
  assert.match(FONTE, /AVISO_ESTORNO_SO_CASADO/, "o aviso não é importado/usado em account.ts");
  const i = FONTE.indexOf("AVISO_ESTORNO_SO_CASADO :");
  assert.notEqual(i, -1, "o aviso não entra na montagem do contexto");
});

test("o aviso NÃO é condicionado a ter aparecido linha de dinheiro", () => {
  // Esta assimetria em relação ao AVISO_QA_NAO_PROVA é o ponto do incidente: a
  // ausência de ressalva de QA é inofensiva, mas a ausência de linha de dinheiro
  // é justamente o estado em que a Fast inventa ("não vi pendência, então já
  // voltou"). Condicionar o aviso a `jobs.some(j => j.dinheiro)` faria o aviso
  // desaparecer exatamente quando ele é mais necessário — inclusive quando a
  // consulta ao extrato falha e devolve [].
  const linha = FONTE.split("\n").find((l) => l.includes("AVISO_ESTORNO_SO_CASADO :"));
  assert.ok(linha, "não achei a linha que emite o aviso");
  assert.doesNotMatch(
    linha,
    /j\.dinheiro/,
    "o aviso não pode depender de ter saído linha de dinheiro: some justamente quando é mais necessário",
  );
  assert.match(
    linha,
    /idsDosTrabalhos\.length/,
    "o aviso sai quando a leitura do extrato foi TENTADA (existe trabalho com id)",
  );
});

test("o aviso de QA continua condicionado à ressalva (não inflar prompt à toa)", () => {
  // Controle: o aviso de QA não pode virar sempre-ligado de carona nesta mudança.
  const linha = FONTE.split("\n").find((l) => l.includes("AVISO_QA_NAO_PROVA :"));
  assert.ok(linha, "sumiu a emissão do aviso de QA");
  assert.match(linha, /j\.ressalva/, "o aviso de QA perdeu a condição de ressalva");
});
