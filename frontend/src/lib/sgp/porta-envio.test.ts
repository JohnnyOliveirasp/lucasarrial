/**
 * O que este teste protege, em uma frase: o aluno NUNCA lê "complete as etapas
 * anteriores" num pedido que ele já completou.
 *
 * A frase chega crua nos olhos dele (`sgp-enviar-form.tsx` joga
 * `error.message` direto no estado), então o texto é o produto — não é detalhe
 * de implementação. Os dois casos medidos em 15/09: `falhou` (ele completou
 * tudo e nós quebramos) e `enviado` (fila legítima, sem mitigação nenhuma).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mensagemDeFalha, portaDoEnvio } from "./porta-envio.ts";
import { SGP_STATUS, type SgpStatus } from "./types.ts";

/** A frase do defeito. Aparece aqui uma vez só, e é contra ela que se mede. */
const CULPA = "Complete as etapas anteriores antes de enviar.";

test("`enviado` responde idempotente — era o buraco SEM mitigação", () => {
  // Não estava na whitelist da rota NEM no redirect da /sgp/revisao: caminho
  // normal, botão ativo, e o aluno na fila levava a frase que o culpa.
  assert.deepEqual(portaDoEnvio("enviado"), { acao: "ja_enviado" });
});

test("`processando` e `pronto` seguem idempotentes (nada regrediu)", () => {
  assert.deepEqual(portaDoEnvio("processando"), { acao: "ja_enviado" });
  assert.deepEqual(portaDoEnvio("pronto"), { acao: "ja_enviado" });
});

test("`revisao` é o único que envia de verdade", () => {
  assert.deepEqual(portaDoEnvio("revisao"), { acao: "enviar" });
  for (const s of SGP_STATUS.filter((x) => x !== "revisao")) {
    assert.notEqual(portaDoEnvio(s).acao, "enviar", `${s} não pode disparar envio`);
  }
});

test("`falhou` não manda o aluno completar nada e aponta o acompanhamento", () => {
  const r = portaDoEnvio("falhou", null);
  assert.equal(r.acao, "recusar");
  assert.equal(r.acao === "recusar" && r.mensagem.includes(CULPA), false);
  assert.match(r.acao === "recusar" ? r.mensagem : "", /\/sgp\/acompanhar/);
  assert.match(r.acao === "recusar" ? r.mensagem : "", /não precisa refazer nada/i);
});

test("`falhou` sem motivo gravado NÃO atribui culpa a ninguém", () => {
  // `erro` está NULL nos 268 pedidos da base (medido 15/09), e
  // `classificarErro("")` devolveria "aluno" — a culpa indevida que este
  // módulo existe pra impedir. Sem motivo, o texto não fala em material dele.
  const m = mensagemDeFalha(null);
  assert.equal(/foto|áudio|audio|material que você|confira/i.test(m), false, m);
  assert.equal(m.includes("O que aconteceu"), false);
});

test("`falhou` COM motivo carrega o motivo — a rota antiga nem lia o campo", () => {
  const m = mensagemDeFalha("CUDA out of memory no treino da voz");
  assert.match(m, /O que aconteceu: CUDA out of memory no treino da voz/);
  assert.match(m, /\/sgp\/acompanhar/);
});

test("a frase que culpa sobrevive SÓ onde ela é verdade", () => {
  for (const s of ["dados", "foto", "audio"] as const) {
    const r = portaDoEnvio(s);
    assert.deepEqual(r, { acao: "recusar", mensagem: CULPA }, `${s} deveria manter a frase`);
  }
});

test("NENHUM status pós-envio produz a frase que culpa o aluno", () => {
  // A rede larga: qualquer status em que o pedido já saiu das mãos dele.
  const posEnvio: SgpStatus[] = ["revisao", "enviado", "processando", "pronto", "falhou"];
  for (const s of posEnvio) {
    const r = portaDoEnvio(s, "qualquer motivo");
    const msg = r.acao === "recusar" ? r.mensagem : "";
    assert.equal(msg.includes(CULPA), false, `${s} não pode culpar o aluno`);
  }
});

test("a régua cobre SGP_STATUS inteiro — status novo não herda a frase", () => {
  for (const s of SGP_STATUS) {
    const r = portaDoEnvio(s);
    assert.ok(["enviar", "ja_enviado", "recusar"].includes(r.acao), `${s} sem decisão`);
  }
});
