/**
 * Testes do incidente 146 — o onboarding não repete veredito velho.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/onboarding/veredito-audio.test.ts
 *
 * Os dois defeitos cobertos:
 *  (A) a rota convertia um `voice_status` HERDADO (imported=0, skipped>0) em
 *      e-mail "o áudio enviado soma menos de 20 minutos" — sobre material que o
 *      sistema nunca abriu (18 das 20 recusas de 14 dias eram assim);
 *  (B) a guarda de idempotência pegava a voz MAIS ANTIGA e tratava falha
 *      terminal como "já pronto", pulando material NOVO sem medir.
 *
 * Testa-se a lógica pura; import.ts e a rota só ligam os fios.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOTIVO_AUDIO_CURTO_HERDADO,
  decidirAvisoAudio,
  decidirVozOnboarding,
  fileIdRepresentado,
  motivoAudioCurto,
  type EntradaAvisoAudio,
  type VozOnboarding,
} from "./veredito-audio.ts";

// ── Parte A: quem pode falar de DURAÇÃO com o aluno ────────────────────────

function entrada(over: Partial<EntradaAvisoAudio>): EntradaAvisoAudio {
  return {
    audiosPedidos: 10,
    imported: 0,
    skipped: 0,
    voiceStatus: null,
    training: null,
    primeiroErro: null,
    qtdErros: 0,
    ...over,
  };
}

test("A: imported=0 + skipped>0 + rejected_too_short NÃO gera motivo nem e-mail de áudio curto", () => {
  // Run real f7a26c5e (ycarlosk@gmail.com, 26/08 19h31): a importação pulou os
  // 10 arquivos e devolveu o status de uma voz de 24/08 com 72s. O aluno tinha
  // acabado de mandar 28min.
  const r = decidirAvisoAudio(
    entrada({ imported: 0, skipped: 10, voiceStatus: "rejected_too_short" }),
  );
  assert.equal(r.audioCurto, false, "não mediu nada: não pode afirmar duração");
  assert.equal(r.audioCurtoHerdado, true);
  assert.equal(r.acao, "so_grupo_herdado", "o aluno NÃO recebe e-mail");
  assert.equal(r.motivo, MOTIVO_AUDIO_CURTO_HERDADO);
  assert.ok(
    !/menos de 20 minutos/.test(r.motivo ?? ""),
    "o motivo não pode alegar duração medida",
  );
});

test("A: imported>0 + rejected_too_short CONTINUA avisando o aluno (recusa MEDIDA)", () => {
  // Não quebrar o caso legítimo: definidameta (25/08) e a 1ª run do itabenke
  // foram recusas de verdade, com o material baixado e medido.
  const r = decidirAvisoAudio(
    entrada({
      imported: 9,
      skipped: 0,
      voiceStatus: "rejected_too_short",
      training: "mínimo não atingido",
    }),
  );
  assert.equal(r.audioCurto, true);
  assert.equal(r.audioCurtoHerdado, false);
  assert.equal(r.acao, "avisar_aluno");
  assert.equal(r.motivo, motivoAudioCurto("mínimo não atingido"));
  assert.match(r.motivo ?? "", /menos de 20 minutos/);
});

test("A: imported>0 + skipped>0 + rejected_too_short também é recusa medida", () => {
  // Importação parcial (parte do material já estava no R2): mediu, logo avisa.
  const r = decidirAvisoAudio(
    entrada({ imported: 3, skipped: 7, voiceStatus: "rejected_too_short" }),
  );
  assert.equal(r.audioCurto, true);
  assert.equal(r.acao, "avisar_aluno");
});

test("A: imported+skipped=0 continua avisando 'nenhum áudio aproveitável'", () => {
  const r = decidirAvisoAudio(entrada({ imported: 0, skipped: 0, voiceStatus: null }));
  assert.equal(r.acao, "avisar_aluno");
  assert.equal(r.motivo, "nenhum áudio aproveitável no link");
});

test("A: imported+skipped=0 usa o erro real quando existe (link/página de login)", () => {
  const r = decidirAvisoAudio(
    entrada({
      imported: 0,
      skipped: 0,
      qtdErros: 2,
      primeiroErro: "não conseguimos baixar o áudio desse link",
    }),
  );
  assert.equal(r.acao, "avisar_aluno");
  assert.equal(r.motivo, "não conseguimos baixar o áudio desse link");
  assert.equal(r.audioCurto, false);
});

test("A: linha sem áudio nenhum não avisa ninguém", () => {
  const r = decidirAvisoAudio(entrada({ audiosPedidos: 0 }));
  assert.equal(r.acao, "nenhum");
  assert.equal(r.motivo, null);
});

test("A: falha parcial (entrou material) fica só no grupo", () => {
  const r = decidirAvisoAudio(
    entrada({
      imported: 8,
      skipped: 0,
      voiceStatus: "awaiting_training",
      qtdErros: 2,
      primeiroErro: "teto 400MB",
    }),
  );
  assert.equal(r.acao, "so_grupo_parcial");
  assert.equal(r.motivo, "2 de 10 falharam: teto 400MB");
  assert.equal(r.audioCurto, false);
});

test("A: run saudável (voz treinando) não gera aviso algum", () => {
  const r = decidirAvisoAudio(
    entrada({ imported: 10, skipped: 0, voiceStatus: "training" }),
  );
  assert.equal(r.acao, "nenhum");
  assert.equal(r.audioCurto, false);
  assert.equal(r.audioCurtoHerdado, false);
});

// ── Parte B: qual voz a guarda de idempotência escolhe ─────────────────────

function voz(over: Partial<VozOnboarding> & { id: string }): VozOnboarding {
  return {
    status: "ready",
    raw_audio_paths: [],
    created_at: "2026-08-20T12:00:00Z",
    ...over,
  };
}

/** Chave igual à do `buildRawAudioKey`: <user>/<voice>/raw/NNN_onboarding_<id>.<ext> */
function chave(voiceId: string, i: number, fileId: string, ext = "mp3"): string {
  return `user-1/${voiceId}/raw/${String(i).padStart(3, "0")}_onboarding_${fileId}.${ext}`;
}

test("B: escolhe a voz READY mesmo com uma rejected_too_short MAIS ANTIGA", () => {
  // Caso rafaelleitemacedo: voz ready de 16/08, reprovada de 13/08. A guarda
  // antiga (created_at ASC limit 1) lia a reprovada e recusava o aluno em 22/08.
  const d = decidirVozOnboarding(
    [
      voz({ id: "velha-13-08", status: "rejected_too_short", created_at: "2026-08-13T10:00:00Z" }),
      voz({ id: "nova-16-08", status: "ready", created_at: "2026-08-16T10:00:00Z" }),
    ],
    ["fileNovo123456"],
  );
  assert.equal(d.acao, "reusar");
  assert.equal(d.acao === "reusar" && d.voz.id, "nova-16-08");
});

test("B: voz em awaiting_training segue mandando (ramo que dispara o treino)", () => {
  const d = decidirVozOnboarding(
    [voz({ id: "v1", status: "awaiting_training" })],
    ["abc1234567"],
  );
  assert.equal(d.acao, "reusar");
  assert.equal(d.acao === "reusar" && d.voz.status, "awaiting_training");
});

test("B: MESMO fileId com voz rejected_too_short → PULA (sem e-mail novo, sem cobrança)", () => {
  // É esta proteção que evita a repetição que deu 3 e-mails pro robson, 3 pro
  // itabenke e 3 pra isabella.
  const paths = [chave("v-ruim", 0, "id_um_1234567"), chave("v-ruim", 1, "id_dois_123456", "m4a")];
  const d = decidirVozOnboarding(
    [voz({ id: "v-ruim", status: "rejected_too_short", raw_audio_paths: paths })],
    ["id_um_1234567", "id_dois_123456"],
  );
  assert.equal(d.acao, "pular");
  assert.equal(d.acao === "pular" && d.voz.id, "v-ruim");
});

test("B: fileId NOVO com voz rejected_too_short → IMPORTA e mede de novo", () => {
  const paths = [chave("v-ruim", 0, "id_um_1234567")];
  const d = decidirVozOnboarding(
    [voz({ id: "v-ruim", status: "rejected_too_short", raw_audio_paths: paths })],
    ["id_um_1234567", "id_novinho_98765"],
  );
  assert.equal(d.acao, "importar");
});

test("B: voz 'failed' com material novo também volta pro fluxo de importação", () => {
  const d = decidirVozOnboarding(
    [voz({ id: "v-falhou", status: "failed", raw_audio_paths: [] })],
    ["qualquerCoisa1"],
  );
  assert.equal(d.acao, "importar");
});

test("B: sem voz nenhuma → importa", () => {
  assert.equal(decidirVozOnboarding([], ["abc1234567"]).acao, "importar");
});

test("B: voz em 'uploading' → retoma nela (importação anterior morreu no meio)", () => {
  const d = decidirVozOnboarding([voz({ id: "v-up", status: "uploading" })], ["abc1234567"]);
  assert.equal(d.acao, "retomar");
  assert.equal(d.acao === "retomar" && d.voz.id, "v-up");
});

test("B: status desconhecido continua pulando (conservador, como a guarda antiga)", () => {
  const d = decidirVozOnboarding([voz({ id: "v-x", status: "validando_algo" })], ["abc1234567"]);
  assert.equal(d.acao, "pular");
});

test("B: sem created_at a ordem não quebra e o estado bom continua vencendo", () => {
  const d = decidirVozOnboarding(
    [
      voz({ id: "sem-data-ruim", status: "failed", created_at: null }),
      voz({ id: "sem-data-boa", status: "training", created_at: null }),
    ],
    ["abc1234567"],
  );
  assert.equal(d.acao, "reusar");
  assert.equal(d.acao === "reusar" && d.voz.id, "sem-data-boa");
});

test("fileIdRepresentado casa qualquer extensão e ignora id de outra voz", () => {
  const paths = [chave("v1", 0, "AAA1234567", "wav"), chave("v1", 1, "BBB1234567", "ogg")];
  assert.equal(fileIdRepresentado(paths, "AAA1234567"), true);
  assert.equal(fileIdRepresentado(paths, "BBB1234567"), true);
  assert.equal(fileIdRepresentado(paths, "CCC1234567"), false);
  assert.equal(fileIdRepresentado(null, "AAA1234567"), false, "raw_audio_paths null não quebra");
  // A chave grava o id higienizado por [^a-zA-Z0-9_-]: "AAA/1234567" virou
  // "AAA1234567" na hora do upload, então o id cru tem que casar mesmo assim.
  assert.equal(fileIdRepresentado(paths, "AAA/1234567"), true, "higieniza igual ao buildRawAudioKey");
  assert.equal(fileIdRepresentado(paths, "///"), false, "id que some na higienização não casa nada");
});
