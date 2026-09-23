/**
 * GUARDA DE REGRESSÃO — a perna do ESTORNO em `saldoPendenteDoTreino`
 * ====================================================================
 *
 * Por que este arquivo existe (medido em 23/09/2026, na ronda das falhas)
 * ----------------------------------------------------------------------
 * O PR #341 conserta o estorno de treino trocando "existe débito?" por SALDO
 * PENDENTE. O conserto está certo, e a regra PURA (`valorDoEstornoDeTreino`)
 * está bem coberta: 4 mutantes rodados nela, 4 pegos.
 *
 * Mas quem lê o extrato e decide o dinheiro de verdade é
 * `saldoPendenteDoTreino`, em `service.ts`, e ela NÃO tinha um único teste.
 * Medi o buraco em vez de supor: troquei a perna do estorno de
 * `ref_type === "voice_train_refund"` para `kind === "training"` — que é
 * exatamente a armadilha que a casa já documentou e que em 20/08 quase pagou
 * 13 alunos em dobro no `generation_refund` — e o resultado foi:
 *
 *     node --test (credits + voices) ......... 116 pass / 0 fail
 *     npx tsc --noEmit ....................... exit 0
 *
 * Ou seja: o defeito de dinheiro voltava por outra porta e NADA acusava.
 * O próprio `service.ts` avisa em caixa alta "JAMAIS por `kind`" e "não troque
 * este filtro" — mas comentário é pedido, não guarda. Esta é a guarda.
 *
 * Por que a guarda é TEXTUAL
 * --------------------------
 * `saldoPendenteDoTreino` faz I/O no Supabase (`getAdmin()`), e a casa não tem
 * fixture de banco para isto. Defeito de FILTRO não aparece em teste de tipo
 * nem em teste da regra pura — é a mesma classe do defeito de ORDEM de 23/09
 * (teto do poll escrito depois do `if (!r.ok) return;`), que `tsc` também não
 * viu. Então a guarda lê o FONTE REAL, como a casa já faz nesses casos.
 *
 * Lição de 23/09 aplicada de propósito: a guarda do teto do poll nasceu com um
 * FALSO POSITIVO porque comparou no arquivo INTEIRO e casou com um trecho de
 * outra função. Por isso aqui eu RECORTO a função antes de olhar, e um teste
 * confere que o recorte não vazou.
 *
 * CONTROLE NEGATIVO, rodado antes de subir: os 4 mutantes abaixo foram
 * aplicados no `service.ts` real e esta guarda reprovou CADA um (4 pass /
 * 1 fail em cada), enquanto a suíte inteira continuava 116/116. É o que
 * distingue guarda de enfeite.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./service.ts", import.meta.url), "utf8");

/** Recorta SÓ o corpo de `saldoPendenteDoTreino`. Ver aviso acima: comparar no
 *  arquivo inteiro é como a guarda irmã nasceu errada. */
function recorte(): string {
  const ini = FONTE.indexOf("export async function saldoPendenteDoTreino");
  assert.ok(
    ini > 0,
    "sumiu `saldoPendenteDoTreino` de service.ts — se renomearam, atualize esta guarda junto",
  );
  // Fim = próximo `\n}` na coluna 0 depois do início (fim de função top-level).
  const fim = FONTE.indexOf("\n}", ini);
  assert.ok(fim > ini, "não achei o fim da função");
  return FONTE.slice(ini, fim + 2);
}

test("o recorte pegou a função certa e NÃO vazou para a vizinha", () => {
  const f = recorte();
  assert.match(f, /export async function saldoPendenteDoTreino/);
  // Se o recorte vazar, ele arrasta a próxima função exportada do arquivo.
  const exports = f.match(/export (async )?function/g) ?? [];
  assert.equal(
    exports.length,
    1,
    `o recorte arrastou ${exports.length} funções; a guarda mediria o arquivo errado`,
  );
});

test("A PERNA DO ESTORNO SE CASA POR ref_type, JAMAIS POR kind", () => {
  // O mutante medido em 23/09: `kind === "training" && amount > 0`. Com ele, a
  // perna do estorno nunca acha nada (o RPC `add_extra_credits` carimba
  // `kind='extra_purchase'`), o saldo parece eternamente devedor, e a casa
  // estorna o MESMO débito em TODA falha — o bug do Heitor de volta.
  const f = recorte();
  assert.match(
    f,
    /l\.ref_type === "voice_train_refund" && amount > 0/,
    "a perna do estorno deixou de casar por ref_type='voice_train_refund'",
  );
  assert.ok(
    !/l\.kind === "training" && amount > 0/.test(f),
    "a perna do estorno passou a casar por kind — é a armadilha de 20/08 " +
      "(generation_refund, 13 alunos quase pagos em dobro). O estorno grava " +
      "kind='extra_purchase'; por kind ela não acha nada e a casa paga de novo.",
  );
});

test("a consulta TRAZ as linhas de estorno do banco (senão a perna fica cega)", () => {
  // Filtrar certo em JS não salva se a consulta não trouxer a linha. Se alguém
  // reduzir o `.in()` a `["voice"]`, o reduce nunca vê estorno e o saldo mente.
  const f = recorte();
  assert.match(
    f,
    /\.in\("ref_type", \["voice", "voice_train_refund"\]\)/,
    "a consulta parou de trazer voice_train_refund — a perna do estorno fica cega " +
      "e o saldo volta a parecer sempre devedor",
  );
  assert.ok(
    /\.select\([^)]*ref_type/.test(f),
    "o select parou de trazer ref_type, que é o campo que decide as duas pernas",
  );
});

test("o débito continua exigindo o shape contratado (e só o que saiu)", () => {
  // A simetria de 17/08: sem débito não se estorna. Se a perna do débito
  // afrouxar, uma linha de outro tipo com amount<0 viraria dívida inventada.
  const f = recorte();
  assert.match(f, /l\.ref_type === "voice" && l\.kind === "training" && amount < 0/);
});

test("consulta que falha responde 0 (conservador no erro), nunca estorna no escuro", () => {
  // Inverter isto para "na dúvida devolve" é criar dinheiro sem saber o que já
  // voltou. Deixar de devolver é reclamação que o suporte resolve.
  const f = recorte();
  assert.match(f, /if \(error\) \{[\s\S]*?return 0;[\s\S]*?\}/);
  assert.ok(
    !/if \(error\)[\s\S]{0,200}return TRAINING_CREDIT_COST/.test(f),
    "erro de consulta passou a devolver crédito",
  );
});
