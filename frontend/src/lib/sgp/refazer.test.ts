/**
 * O que este teste protege, em uma frase: o time consegue remandar a entrega
 * que morreu por falha nossa, SEM que o aluno seja cobrado por isso.
 *
 * "Não cobra" é a metade que mais importa. O SGP já debitou 10.525 de carteira
 * vazia uma vez (09/09, 12 perfis a -126.300 no total) e a cura foi
 * `deveCobrarOnboarding({origem:"sgp"}) === false`. Um botão de "refazer" que
 * passasse `origem` errada reabriria aquele buraco por um caminho novo — então
 * a origem é testada aqui, contra a regra de produção, não contra uma cópia.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirRefazer, type PedidoParaRefazer } from "./refazer.ts";
import { deveCobrarOnboarding } from "../credits/onboarding-cobranca.ts";
import type { VoiceStatus } from "../db/types.ts";

const PEDIDO: PedidoParaRefazer = {
  user_id: "u-ricardo",
  voice_id: "f58a158a",
  status: "falhou",
};

test("pedido 'falhou' com voz 'failed' → dispara, devolvendo a voz pra fila", () => {
  // O caso real de 15/09: CUDA out of memory, disputa de GPU, transitório.
  const d = decidirRefazer(PEDIDO, { status: "failed" });
  assert.deepEqual(d, {
    acao: "disparar",
    userId: "u-ricardo",
    voiceId: "f58a158a",
    devolverPraFila: true,
  });
});

test("voz já em 'awaiting_training' → dispara direto, sem mexer no status", () => {
  const d = decidirRefazer(PEDIDO, { status: "awaiting_training" });
  assert.equal(d.acao, "disparar");
  assert.equal(d.acao === "disparar" && d.devolverPraFila, false);
});

test("o disparo NÃO cobra o aluno — a origem 'sgp' é a que zera o débito", () => {
  // Mede contra a função de produção. Se alguém inverter a regra lá, quebra aqui.
  assert.equal(deveCobrarOnboarding({ origem: "sgp", bypass: false }), false);
  // E a prova de que a alternativa cobraria: a rota não pode usar "planilha".
  assert.equal(deveCobrarOnboarding({ origem: "planilha", bypass: false }), true);
});

test("a rota passa origem 'sgp' — lida do arquivo, não da minha lembrança", async () => {
  // Cadeado de texto: um `refazer` que cobrasse seria pior que não ter rota, e
  // esse erro cabe numa palavra trocada. Barato de guardar, caro de descobrir.
  const fs = await import("node:fs/promises");
  const url = new URL(
    "../../app/api/v1/admin/sgp/[id]/refazer/route.ts",
    import.meta.url,
  );
  const src = await fs.readFile(url, "utf8");
  assert.match(src, /dispararTreinoOnboarding\(\s*admin,\s*decisao\.userId,\s*decisao\.voiceId,\s*"sgp"\s*\)/);
});

test("voz já treinando → recusa, pra não jogar GPU fora", () => {
  const d = decidirRefazer(PEDIDO, { status: "training" });
  assert.equal(d.acao, "recusar");
  assert.equal(d.acao === "recusar" && d.codigo, "ja_treinando");
});

test("voz pronta → recusa (não é retreino automático)", () => {
  const d = decidirRefazer({ ...PEDIDO, status: "pronto" }, { status: "ready" });
  assert.equal(d.acao === "recusar" && d.codigo, "ja_pronta");
});

test("áudio curto demais é TERMINAL — repetir daria o mesmo resultado", () => {
  // Falha de DADO, não falha técnica. Quem destrava é o aluno mandando áudio.
  const d = decidirRefazer(PEDIDO, { status: "rejected_too_short" });
  assert.equal(d.acao === "recusar" && d.codigo, "audio_curto");
});

test("pedido sem voz criada → recusa em vez de estourar", () => {
  for (const p of [
    { ...PEDIDO, voice_id: null },
    { ...PEDIDO, user_id: null },
  ]) {
    const d = decidirRefazer(p, { status: "failed" });
    assert.equal(d.acao === "recusar" && d.codigo, "sem_voz");
  }
});

test("voz apontada que não existe mais → recusa, não 500", () => {
  const d = decidirRefazer(PEDIDO, null);
  assert.equal(d.acao === "recusar" && d.codigo, "voz_sumiu");
});

test("todo VoiceStatus tem decisão, e só dois disparam", () => {
  const todos: VoiceStatus[] = [
    "uploading",
    "validating",
    "awaiting_training",
    "rejected_too_short",
    "training",
    "ready",
    "failed",
  ];
  const disparam = todos.filter((s) => decidirRefazer(PEDIDO, { status: s }).acao === "disparar");
  assert.deepEqual(disparam, ["awaiting_training", "failed"]);
});

test("nenhuma recusa deixa o atendente sem saber o que fazer", () => {
  const todos: VoiceStatus[] = ["uploading", "validating", "rejected_too_short", "training", "ready"];
  for (const s of todos) {
    const d = decidirRefazer(PEDIDO, { status: s });
    assert.equal(d.acao, "recusar");
    if (d.acao !== "recusar") continue;
    assert.ok(d.mensagem.length > 40, `${s}: mensagem curta demais pro atendente`);
    assert.equal(d.http, 409);
    // Texto pro atendente, não pro programador: nada de jargão de código.
    assert.equal(/status|null|undefined|treino\.ts/.test(d.mensagem), false, `${s}: ${d.mensagem}`);
  }
});
