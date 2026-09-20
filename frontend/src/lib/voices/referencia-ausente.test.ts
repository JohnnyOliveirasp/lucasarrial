/**
 * Testes de comportamento do módulo PURO (sem Supabase, sem rede).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/voices/referencia-ausente.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  assinaturaDaReferencia,
  avaliarReferencia,
  descricaoDaReferencia,
  tituloDaReferencia,
  type SaidaDaReferencia,
} from "./referencia-ausente.ts";

const VOZ = "d1ff6f1a-d333-489e-a127-337bf0e61ccf";
const USER = "877bb47e-d74a-497e-aab4-cdde16dd3639";
const JOB = "f63f6611-6ad2-4d2f-93e2-bce2823a0408-e2";

/** O que o worker devolve quando tudo deu certo. */
const OK: SaidaDaReferencia = {
  reference_uploaded: true,
  reference_transcript: "E aí, gente, tudo bem com vocês? Hoje eu quero falar de uma coisa.",
  reference_cura_ramo: "curado",
  reference_cut_mode: "snap_ok",
};

// ── O caso real que abriu o cartão ────────────────────────────────────────────

test("a voz da Miriam (d1ff6f1a) é pega como sem_referencia", () => {
  // Saída reconstruída do estado gravado em 19/09: voz ready, LoRA no R2,
  // amostra pós-treino gerada — e reference_audio_path/transcript/cut_mode
  // todos NULOS no banco, que é o que `reference_uploaded: false` produz
  // (finalize-training só escreve os três dentro do `if (out.reference_uploaded)`).
  const v = avaliarReferencia(true, {
    reference_uploaded: false,
    reference_transcript: null,
    reference_error: "reference selection/transcription returned empty",
    reference_cut_mode: null,
  });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.classe, "sem_referencia");
});

test("voz com o par completo não abre chamado nenhum", () => {
  assert.deepEqual(avaliarReferencia(true, OK), { ok: true });
});

// ── As duas classes ──────────────────────────────────────────────────────────

test("sem_referencia: `reference_uploaded` falso ganha de qualquer transcript", () => {
  // Transcript presente com upload falso é incoerente (o worker só preenche um
  // com o outro), mas se chegar assim a classe tem que ser a GRAVE: sem áudio
  // no R2 a rota não manda prompt_wav_url e é a truncagem que importa.
  const v = avaliarReferencia(true, {
    reference_uploaded: false,
    reference_transcript: "texto que sobrou de um treino anterior",
  });
  assert.equal(v.ok === false && v.classe, "sem_referencia");
});

test("sem_referencia também quando o campo nem vem (worker antigo)", () => {
  const v = avaliarReferencia(true, {});
  assert.equal(v.ok === false && v.classe, "sem_referencia");
});

test("transcript_vazio: áudio subiu e o texto veio null", () => {
  const v = avaliarReferencia(true, { reference_uploaded: true, reference_transcript: null });
  assert.equal(v.ok === false && v.classe, "transcript_vazio");
});

test("transcript_vazio: áudio subiu e o texto veio string vazia", () => {
  // É o ramo `sem_previsto` de train_reference.transcricao_fiel: nem whisper
  // nem texto previsto → `texto = ""`. Chega como "" e não como null, e `??`
  // sozinho deixaria passar — por isso a comparação é depois do trim.
  const v = avaliarReferencia(true, { reference_uploaded: true, reference_transcript: "" });
  assert.equal(v.ok === false && v.classe, "transcript_vazio");
});

test("transcript_vazio: texto só de espaço em branco não conta como texto", () => {
  const v = avaliarReferencia(true, { reference_uploaded: true, reference_transcript: "   \n  " });
  assert.equal(v.ok === false && v.classe, "transcript_vazio");
});

test("transcript_vazio: campo ausente com upload OK", () => {
  const v = avaliarReferencia(true, { reference_uploaded: true });
  assert.equal(v.ok === false && v.classe, "transcript_vazio");
});

// ── O portão do sucesso ──────────────────────────────────────────────────────

test("treino FALHO nunca abre chamado de referência", () => {
  // A voz já vai para `failed` com estorno e chamado técnico próprios. Um
  // segundo chamado dizendo "ficou sem referência" é ruído em cima de uma
  // falha já registrada — e pior, com assinatura diferente, então não some
  // nem por dedupe.
  assert.deepEqual(avaliarReferencia(false, { reference_uploaded: false }), { ok: true });
  assert.deepEqual(avaliarReferencia(false, {}), { ok: true });
  assert.deepEqual(
    avaliarReferencia(false, { reference_uploaded: true, reference_transcript: "" }),
    { ok: true },
  );
});

// ── Assinatura (dedupe) ──────────────────────────────────────────────────────

test("a assinatura separa POR VOZ — cada uma é um conserto diferente", () => {
  const a = assinaturaDaReferencia("sem_referencia", VOZ);
  const b = assinaturaDaReferencia("sem_referencia", "outra-voz");
  assert.notEqual(a, b);
  assert.ok(a.includes(VOZ), "a assinatura perdeu o voice_id e vira chamado eterno");
});

test("a assinatura separa POR CLASSE — piorar de classe é chamado novo", () => {
  assert.notEqual(
    assinaturaDaReferencia("sem_referencia", VOZ),
    assinaturaDaReferencia("transcript_vazio", VOZ),
  );
});

test("a assinatura é estável: o MESMO defeito na MESMA voz soma ocorrência", () => {
  assert.equal(
    assinaturaDaReferencia("transcript_vazio", VOZ),
    assinaturaDaReferencia("transcript_vazio", VOZ),
  );
});

test("a assinatura não colide com as de treino (kind `training`)", () => {
  // `errorSignature("training", ...)` gera `training:<cause>:<erro>`. Prefixo
  // próprio evita que um chamado de referência caia dentro do guarda-chuva #11.
  assert.ok(assinaturaDaReferencia("sem_referencia", VOZ).startsWith("voice-reference:"));
});

// ── Título ───────────────────────────────────────────────────────────────────

test("cada classe tem título próprio", () => {
  assert.notEqual(tituloDaReferencia("sem_referencia"), tituloDaReferencia("transcript_vazio"));
  for (const c of ["sem_referencia", "transcript_vazio"] as const) {
    assert.ok(tituloDaReferencia(c).length > 10);
  }
});

// ── Descrição: o chamado não pode nascer cego ────────────────────────────────

test("a descrição carrega o reference_error — a ÚNICA pista do porquê", () => {
  // `training_jobs` não guarda o payload do worker. Se este campo não for pro
  // texto do chamado, depois do fato não há de onde tirar: foi exatamente o que
  // aconteceu com a d1ff6f1a (chamado aberto 4 dias depois, sem causa).
  const d = descricaoDaReferencia("sem_referencia", {
    voiceId: VOZ,
    userId: USER,
    userEmail: "aluna@exemplo.com",
    runpodJobId: JOB,
    out: {
      reference_uploaded: false,
      reference_error: "no normalized audio to slice the reference from",
    },
  });
  assert.match(d, /no normalized audio to slice the reference from/);
  assert.ok(d.includes(VOZ));
  assert.ok(d.includes(USER));
  assert.ok(d.includes(JOB));
  assert.ok(d.includes("aluna@exemplo.com"));
});

test("worker que não disse o motivo vira '(o worker não disse)', não vira invenção", () => {
  const d = descricaoDaReferencia("sem_referencia", {
    voiceId: VOZ,
    userId: USER,
    userEmail: null,
    runpodJobId: JOB,
    out: { reference_uploaded: false },
  });
  assert.match(d, /reference_error: \(o worker não disse\)/);
  assert.match(d, /\(não encontrado em profiles\)/);
});

test("a descrição manda fabricar a referência e PROÍBE retreinar", () => {
  // Retreinar é a conduta errada e cara: a LoRA está boa, e retreino queima
  // 10.000 créditos do aluno + GPU para consertar algo que roda sem GPU.
  const d = descricaoDaReferencia("sem_referencia", {
    voiceId: VOZ,
    userId: USER,
    userEmail: "aluna@exemplo.com",
    runpodJobId: JOB,
    out: { reference_uploaded: false },
  });
  assert.match(d, /fabricar_referencia\.cjs/);
  assert.ok(d.includes(`fabricar_referencia.cjs ${VOZ}`), "o comando saiu sem o voice_id");
  assert.match(d, /--confirmar/);
  assert.match(d, /não retreinar/i);
});

test("a descrição de transcript_vazio conta quantos chars o texto tinha", () => {
  const d = descricaoDaReferencia("transcript_vazio", {
    voiceId: VOZ,
    userId: USER,
    userEmail: null,
    runpodJobId: JOB,
    out: { reference_uploaded: true, reference_transcript: "" },
  });
  assert.match(d, /reference_transcript: \(vazio\)/);
  assert.match(d, /reference_uploaded: true/);
});

test("a descrição não vaza o transcript inteiro — só o tamanho", () => {
  // Transcrição de referência é fala do aluno. O chamado precisa saber se
  // existe e quão grande é, não reproduzir o conteúdo no corpo do incidente.
  const segredo = "meu CPF é 000 e eu moro na rua tal número tal";
  const d = descricaoDaReferencia("sem_referencia", {
    voiceId: VOZ,
    userId: USER,
    userEmail: null,
    runpodJobId: JOB,
    out: { reference_uploaded: false, reference_transcript: segredo },
  });
  assert.ok(!d.includes(segredo), "o transcript do aluno vazou para o corpo do chamado");
  assert.match(d, new RegExp(`reference_transcript: ${segredo.length} chars`));
});

test("a descrição registra a MEDIÇÃO que justifica a urgência", () => {
  // Sem o número, o chamado vira opinião e quem pegar ele amanhã não sabe se
  // corre ou não. 1197 chars: 45,8s sem referência contra 56,1s com, mesma voz
  // e mesmo dia (voz 0728c9bc, 28/05/2026).
  const d = descricaoDaReferencia("sem_referencia", {
    voiceId: VOZ,
    userId: USER,
    userEmail: null,
    runpodJobId: JOB,
    out: { reference_uploaded: false },
  });
  assert.match(d, /stop-predictor/);
  assert.match(d, /1197 chars/);
});
