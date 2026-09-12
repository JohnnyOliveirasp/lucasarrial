/**
 * `node --test src/lib/onboarding/desfecho-pure.test.ts`
 *
 * O que estes testes protegem:
 *
 * 1. #364 — avatar morto com a voz PRONTA tem que ter desfecho TERMINAL. Sem
 *    isto, `etapas.ts` grava "processando" pra sempre e a tela do aluno diz
 *    "em andamento" pra uma imagem que já está `failed` no banco. Caso-prova
 *    real: pedido fe00d4e2 (rafaelzan), 18h em silêncio, avatar barrado na
 *    moderação do Kie.
 * 2. O MOTIVO não pode mentir: com a voz `ready`, quem morreu foi a foto —
 *    dizer "o treino da voz falhou" seria falso com prova no banco.
 * 3. A régua de 22/08 continua inteira (regressão): zero avatar + voz pronta
 *    fecha a linha; avatar pendente segura o veredito; voz morta é terminal.
 *
 * Import com extensão `.ts` e sem alias `@/`: o runner do `node --test` não
 * resolve o alias (lição do PR #159).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  desfechoOnboarding,
  MOTIVO_AUDIO_CURTO,
  MOTIVO_FOTO,
  type EntradaDesfecho,
} from "./desfecho-pure.ts";

/** O caso feliz, pra cada teste mexer só no que interessa. */
const base: EntradaDesfecho = {
  onboarding: true,
  houveAvatar: true,
  prontos: 1,
  pendentes: 0,
  vozStatus: "ready",
  vozTreinando: false,
  vozErro: null,
};

// ── 1. O DEFEITO DO #364 ────────────────────────────────────────────────────

test("#364: avatar morto + voz pronta = FALHOU (era limbo eterno)", () => {
  const d = desfechoOnboarding({ ...base, prontos: 0 });
  assert.equal(d.pronto, false, "não está pronto: nenhum avatar ficou ready");
  assert.equal(d.falhou, true, "TEM que ser terminal — senão a tela mente pra sempre");
});

test("#364: o motivo fala da FOTO, não da voz (voz está ready)", () => {
  const d = desfechoOnboarding({ ...base, prontos: 0 });
  assert.equal(d.motivo, MOTIVO_FOTO);
  assert.ok(
    !String(d.motivo).includes("voz"),
    "com a voz ready, culpar a voz é mentira com prova no banco",
  );
});

test("#364: o caso-prova fe00d4e2 (1 avatar failed, voz ready) fecha", () => {
  const d = desfechoOnboarding({
    onboarding: true,
    houveAvatar: true,
    prontos: 0,
    pendentes: 0,
    vozStatus: "ready",
    vozTreinando: false,
  });
  assert.deepEqual(d, { pronto: false, falhou: true, motivo: MOTIVO_FOTO });
});

// ── 2. NÃO DERRUBAR LINHA QUE AINDA IA DAR CERTO ────────────────────────────

test("avatar ainda pendente NÃO é desfecho — nem pronto, nem falhou", () => {
  const d = desfechoOnboarding({ ...base, prontos: 0, pendentes: 1 });
  assert.equal(d.falhou, false, "tem avatar em andamento: esperar é o certo");
  assert.equal(d.pronto, false);
  assert.equal(d.motivo, null);
});

test("avatar morto mas voz AINDA TREINANDO (validating) não fecha", () => {
  const d = desfechoOnboarding({
    ...base,
    prontos: 0,
    vozStatus: "validating",
    vozTreinando: true,
  });
  assert.equal(d.falhou, false, "a voz ainda pode ficar pronta");
});

test("avatar morto com voz em awaiting_training não fecha (voz não assentada)", () => {
  const d = desfechoOnboarding({ ...base, prontos: 0, vozStatus: "awaiting_training" });
  assert.equal(d.falhou, false, "o treino ainda pode disparar — quem cuida é o prazo de 45min");
});

// ── 3. REGRESSÃO: A RÉGUA DE 22/08 CONTINUA INTEIRA ─────────────────────────

test("22/08: zero avatar + voz pronta = PRONTO (não trava a linha)", () => {
  const d = desfechoOnboarding({ ...base, houveAvatar: false, prontos: 0 });
  assert.equal(d.pronto, true, "quem nunca teve avatar fecha pela voz");
  assert.equal(d.falhou, false);
});

test("22/08: voz rejected_too_short é terminal, com o motivo do áudio curto", () => {
  const d = desfechoOnboarding({ ...base, prontos: 0, vozStatus: "rejected_too_short" });
  assert.equal(d.falhou, true);
  assert.equal(d.motivo, MOTIVO_AUDIO_CURTO);
});

test("22/08: voz failed é terminal e carrega o error_message no motivo", () => {
  const d = desfechoOnboarding({
    ...base,
    prontos: 0,
    vozStatus: "failed",
    vozErro: "worker caiu no meio do treino",
  });
  assert.equal(d.falhou, true);
  assert.equal(d.motivo, "o treino da voz falhou: worker caiu no meio do treino");
});

test("voz morta tem precedência no motivo quando as DUAS pernas morreram", () => {
  const d = desfechoOnboarding({ ...base, prontos: 0, vozStatus: "failed" });
  assert.equal(d.falhou, true);
  assert.equal(d.motivo, "o treino da voz falhou", "a voz é a entrega principal");
});

test("caso feliz: avatar pronto + voz pronta = PRONTO, sem motivo", () => {
  const d = desfechoOnboarding(base);
  assert.deepEqual(d, { pronto: true, falhou: false, motivo: null });
});

test("quem nunca passou pelo onboarding não é nem pronto nem falhou", () => {
  const d = desfechoOnboarding({
    onboarding: false,
    houveAvatar: false,
    prontos: 0,
    pendentes: 0,
    vozStatus: null,
    vozTreinando: false,
  });
  assert.deepEqual(d, { pronto: false, falhou: false, motivo: null });
});
