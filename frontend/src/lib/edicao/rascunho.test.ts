/**
 * Testes da invalidação do rascunho quando o roteiro muda (conserto 24/09,
 * caso ycarlosk@gmail.com — 3 escalonamentos no mesmo dia).
 *
 * Rodar, de dentro de frontend/:
 *   node --test src/lib/edicao/rascunho.test.ts
 * (o módulo puro tem zero imports, então o type-stripping nativo do Node ≥22
 * basta; os tripwires leem o fonte do wizard com readFileSync, sem compilar.)
 *
 * O QUE ESTÁ COBERTO:
 *   (A) roteiro muda com áudio+vídeo no rascunho → TODOS os derivados caem
 *       juntos (áudio, vídeo, jobs, chave editada, finalizado) e o passo
 *       recua — é o defeito (a) do card: sem isto a Saída reexporta a rodada
 *       anterior e o aluno acha que "gerou o vídeo antigo";
 *   (B) roteiro igual / patch sem roteiro / rascunho sem derivados → o patch
 *       volta INTOCADO (digitar o primeiro roteiro não pode zerar nada);
 *   (C) o reset do "Começar um vídeo novo" (patch que já derruba áudio e
 *       vídeo por conta própria) não dispara invalidação nem aviso — senão o
 *       banner "você mudou o roteiro" apareceria logo depois de recomeçar;
 *   (D) temProgresso: o atalho de recomeço aparece com QUALQUER progresso,
 *       inclusive finalizado=false — é o defeito (b) do card: quem voltou no
 *       meio do fluxo era exatamente quem não conseguia zerar o rascunho;
 *   (E) tripwires: o wizard REALMENTE passa o patch pela regra pura no
 *       updater, decide o aviso pela mesma regra, e o atalho de recomeço está
 *       atrás de temProgresso (não de draft.finalizado) abrindo o MESMO modal
 *       de confirmação do pill. Sem isto, alguém refatora o update e a regra
 *       vira letra morta sem nenhum teste cair.
 *
 * MUTAÇÃO OBRIGATÓRIA DO CARD (rodada na mão, relatada no PR): remover
 * `video: null` de DERIVADOS_INVALIDADOS — o teste 1 cai na asserção
 * `video === null` ("roteiro mudou mas o vídeo da rodada anterior sobrou").
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  DERIVADOS_INVALIDADOS,
  comInvalidacaoDeRoteiro,
  invalidaDerivados,
  patchJaDerruba,
  roteiroVaiMudar,
  temDerivados,
  temProgresso,
} from "./rascunho.ts";

// ───────── rascunhos de apoio ─────────

/** Rascunho no meio do fluxo: roteiro + áudio + vídeo da rodada anterior. */
const MEIO_DO_FLUXO = {
  passo: 0, // voltou pra E1 pra mexer no texto
  roteiro: "roteiro da rodada anterior",
  audio: { kind: "generation", id: "aud-1", label: "TTS 1" },
  video: { kind: "clone-padrao", id: "vid-1", label: "Clone 1" },
  cenasProjectId: "proj-1",
  captionJob: { job: "cap-1", key: "k1" },
  brollProjectId: "proj-2",
  brollJob: { job: "br-1", key: "k2" },
  videoEditadoKey: "user/edicao/broll/clone-vid-1.mp4",
  finalizado: false,
};

const VAZIO = {
  passo: 0,
  roteiro: "",
  audio: null,
  video: null,
  cenasProjectId: null,
  captionJob: null,
  brollProjectId: null,
  brollJob: null,
  videoEditadoKey: null,
  finalizado: false,
};

// ───────── (A) o caso do card: roteiro muda → derivados caem ─────────

test("1. roteiro muda com áudio+vídeo → os dois caem, com jobs, chave editada e finalizado", () => {
  const patch = { roteiro: "roteiro NOVO, texto diferente", roteiroId: null };
  // Alarga o tipo: o retorno é união (patch intocado | patch+invalidados) e
  // aqui o teste afirma exatamente o ramo invalidado, campo a campo.
  const saida: Record<string, unknown> = comInvalidacaoDeRoteiro(MEIO_DO_FLUXO, patch);

  // O núcleo do defeito (a): áudio e vídeo da rodada anterior NÃO sobrevivem.
  assert.equal(saida.audio, null, "roteiro mudou mas o áudio da rodada anterior sobrou");
  assert.equal(saida.video, null, "roteiro mudou mas o vídeo da rodada anterior sobrou");

  // O resto da rodada anterior cai junto — job em voo apontando pro texto
  // velho e chave editada velha são o mesmo defeito com outra roupa.
  assert.equal(saida.cenasProjectId, null);
  assert.equal(saida.captionJob, null);
  assert.equal(saida.brollProjectId, null);
  assert.equal(saida.brollJob, null);
  assert.equal(saida.videoEditadoKey, null);
  assert.equal(saida.finalizado, false);
  assert.equal(saida.passo, 0, "o passo recua pra estação do roteiro");

  // O patch original atravessa: o roteiro novo é o que fica.
  assert.equal(saida.roteiro, "roteiro NOVO, texto diferente");
  assert.equal(saida.roteiroId, null);

  // E a decisão composta (que arma o aviso na tela) concorda.
  assert.equal(invalidaDerivados(MEIO_DO_FLUXO, patch), true);
});

test("2. rascunho FINALIZADO também invalida quando o roteiro muda", () => {
  const finalizado = { ...MEIO_DO_FLUXO, passo: 4, finalizado: true };
  const saida: Record<string, unknown> = comInvalidacaoDeRoteiro(finalizado, {
    roteiro: "outro texto",
  });
  assert.equal(saida.video, null);
  assert.equal(saida.finalizado, false, "finalizado cai junto — o ciclo reabriu");
});

// ───────── (B) nada cai sem mudança real ─────────

test("3. roteiro IGUAL no patch → nada cai (mesma referência de patch)", () => {
  const patch = { roteiro: MEIO_DO_FLUXO.roteiro };
  assert.equal(comInvalidacaoDeRoteiro(MEIO_DO_FLUXO, patch), patch);
  assert.equal(invalidaDerivados(MEIO_DO_FLUXO, patch), false);
  assert.equal(roteiroVaiMudar(MEIO_DO_FLUXO, patch), false);
});

test("4. patch SEM roteiro (navegação, seconds…) → intocado", () => {
  const patches: Array<{ roteiro?: string; passo?: number; seconds?: number }> = [
    { passo: 2 },
    { seconds: 30 },
    {},
  ];
  for (const patch of patches) {
    assert.equal(comInvalidacaoDeRoteiro(MEIO_DO_FLUXO, patch), patch);
    assert.equal(invalidaDerivados(MEIO_DO_FLUXO, patch), false);
  }
});

test("5. roteiro muda SEM derivados → intocado (primeiro roteiro não zera nem avisa)", () => {
  const patch = { roteiro: "meu primeiro roteiro" };
  assert.equal(comInvalidacaoDeRoteiro(VAZIO, patch), patch);
  assert.equal(invalidaDerivados(VAZIO, patch), false);
  assert.equal(temDerivados(VAZIO), false);
});

// ───────── (C) o reset do "vídeo novo" não dispara a regra ─────────

test("6. reset (patch que JÁ derruba áudio e vídeo) → sem invalidação e sem aviso", () => {
  // É o update({ ...DRAFT_VAZIO }) do confirmar — roteiro "" difere do atual,
  // mas o patch já limpa tudo sozinho. Aviso aqui seria banner fantasma logo
  // depois de recomeçar.
  assert.equal(patchJaDerruba(VAZIO), true);
  assert.equal(invalidaDerivados(MEIO_DO_FLUXO, VAZIO), false);
  assert.equal(comInvalidacaoDeRoteiro(MEIO_DO_FLUXO, VAZIO), VAZIO);
});

// ───────── (D) o atalho aparece pra quem voltou no meio ─────────

test("7. temProgresso: qualquer progresso mostra o atalho, finalizado NÃO é pré-requisito", () => {
  assert.equal(temProgresso(VAZIO), false, "rascunho zerado não tem o que recomeçar");
  assert.equal(temProgresso({ ...VAZIO, roteiro: "só o texto" }), true);
  assert.equal(temProgresso({ ...VAZIO, audio: { kind: "take", key: "k", label: "t" } }), true);
  assert.equal(temProgresso({ ...VAZIO, video: { kind: "cenas", id: "v", label: "c" } }), true);
  assert.equal(temProgresso({ ...VAZIO, videoEditadoKey: "k.mp4" }), true);
  assert.equal(temProgresso({ ...VAZIO, passo: 1 }), true);
  // O caso do card: no meio do fluxo, finalizado=false, o escape TEM que existir.
  assert.equal(MEIO_DO_FLUXO.finalizado, false);
  assert.equal(temProgresso(MEIO_DO_FLUXO), true);
});

test("8. DERIVADOS_INVALIDADOS cobre exatamente os campos derivados + o recuo", () => {
  assert.deepEqual(Object.keys(DERIVADOS_INVALIDADOS).sort(), [
    "audio",
    "brollJob",
    "brollProjectId",
    "captionJob",
    "cenasProjectId",
    "finalizado",
    "passo",
    "video",
    "videoEditadoKey",
  ]);
});

// ───────── (E) tripwires: o wizard usa a regra de verdade ─────────

const FONTE_WIZARD = readFileSync(
  fileURLToPath(new URL("../../components/edicao/edicao-wizard.tsx", import.meta.url)),
  "utf8",
);

test("9. tripwire: o updater do wizard passa o patch pela regra pura", () => {
  assert.match(
    FONTE_WIZARD,
    /from\s+"@\/lib\/edicao\/rascunho"/,
    "o wizard não importa mais o módulo puro — a regra virou letra morta",
  );
  assert.match(
    FONTE_WIZARD,
    /\{\s*\.\.\.d,\s*\.\.\.comInvalidacaoDeRoteiro\(d,\s*patch\)\s*\}/,
    "o setDraft não aplica comInvalidacaoDeRoteiro(d, patch) — trocar o roteiro voltou a manter o vídeo velho",
  );
  assert.match(
    FONTE_WIZARD,
    /invalidaDerivados\(draftRef\.current,\s*patch\)/,
    "o aviso da tela não usa a MESMA decisão pura — regra e aviso podem divergir",
  );
});

test("10. tripwire: o atalho de recomeço está atrás de temProgresso, não de finalizado", () => {
  assert.match(
    FONTE_WIZARD,
    /\{temProgresso\(draft\)\s*&&/,
    "o atalho 'Começar um vídeo novo' sumiu ou voltou a depender de finalizado",
  );
  // O modal de confirmação abre de DOIS lugares: o pill pós-final e o atalho.
  const aberturas = FONTE_WIZARD.match(/setConfirmaNovo\(true\)/g) ?? [];
  assert.ok(
    aberturas.length >= 2,
    `o modal de confirmação abre de ${aberturas.length} lugar(es); esperado ≥2 (pill + atalho) — clique acidental não pode zerar sem confirmar`,
  );
});
