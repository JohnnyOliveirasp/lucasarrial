/**
 * GUARDA DE REGRESSÃO do #527 — lê o FONTE REAL, não um mock.
 *
 * O defeito que ela impede de voltar: o ramo de "estorno não confirmado" do
 * delete de imagem prometia ao aluno, no card E na resposta, que "o suporte já
 * foi avisado" — e a única coisa que acontecia era um `console.error`. Medido
 * em 23/09: nenhum cron do Hetzner lê o stdout do app, então ninguém era
 * avisado, justamente no caminho em que o dinheiro NÃO voltou.
 *
 *   npx tsx --test src/app/api/v1/images/estorno-chamado.guard.test.ts
 *
 * ⚠️ Esta guarda vale porque REPROVA no código de antes do conserto — o teste
 * de mutação está no próprio arquivo (último caso).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = new URL("./route.ts", import.meta.url).pathname;
const src = readFileSync(FONTE, "utf8");

/**
 * Só o corpo do ramo que interessa, pra não casar com outro trecho do arquivo.
 *
 * ⚠️ A fronteira é o `return jsonOk(` que fecha o handler, NÃO um número de
 * caracteres. A primeira versão desta guarda usava `i + 3000` e reprovou por
 * 34 caracteres quando o conserto entrou — o código estava certo, a régua é
 * que era curta. Janela por tamanho fixo quebra no primeiro comentário a mais.
 */
function ramoDoEstornoNaoConfirmado(texto: string): string {
  const i = texto.indexOf("ESTORNO NÃO CONFIRMADO");
  assert.ok(i > 0, "o marcador do ramo sumiu do arquivo");
  const fim = texto.indexOf("return jsonOk(", i);
  return texto.slice(i, fim > i ? fim : texto.length);
}

test("o ramo ABRE CHAMADO, não só loga", () => {
  const ramo = ramoDoEstornoNaoConfirmado(src);
  assert.match(ramo, /abrirChamadoReportado\(/, "promete 'suporte avisado' sem abrir chamado");
});

test("a assinatura ORDENA os ids (mesmo lote = mesmo chamado)", () => {
  const ramo = ramoDoEstornoNaoConfirmado(src);
  const assinatura = ramo.match(/signature:[\s\S]{0,220}/)?.[0] ?? "";
  assert.match(assinatura, /\.sort\(\)/, "sem sort, a mesma falha vira chamado novo por ordem do array");
  assert.match(assinatura, /images:estorno-nao-confirmado/);
});

test("entra na fila TECNICA (existe ação nossa: devolver na mão)", () => {
  assert.match(ramoDoEstornoNaoConfirmado(src), /categoria:\s*"tecnico"/);
});

test("é best-effort: falhar ao abrir chamado NÃO derruba o resto", () => {
  const ramo = ramoDoEstornoNaoConfirmado(src);
  const i = ramo.indexOf("abrirChamadoReportado(");
  const antes = ramo.slice(0, i);
  assert.match(antes, /try\s*\{/, "a chamada precisa estar dentro de try");
  assert.match(ramo.slice(i), /catch/, "sem catch, o aluno perde o card corrigido");
});

test("o card do aluno continua sendo corrigido DEPOIS de abrir o chamado", () => {
  const ramo = ramoDoEstornoNaoConfirmado(src);
  const iChamado = ramo.indexOf("abrirChamadoReportado(");
  const iCard = ramo.indexOf("error_message");
  assert.ok(iCard > iChamado, "a correção do card sumiu ou veio antes — ela não pode ser perdida");
});

test("MUTAÇÃO — a guarda REPROVA no código de antes do conserto", () => {
  // O ramo original, copiado do main antes do #527: só console.error.
  const antigo = `
    console.error(
      \`[images:delete] ESTORNO NÃO CONFIRMADO — delete abortado. user=\${auth.user_id} \` +
        \`ids=\${resultado.bloqueados.join(",")}\`,
    );
    await admin.from("image_generations").update({ error_message: "..." });
  `;
  const ramo = ramoDoEstornoNaoConfirmado(antigo);
  assert.doesNotMatch(ramo, /abrirChamadoReportado\(/, "o código antigo NÃO abria chamado — se casar aqui, a guarda não prova nada");
});
