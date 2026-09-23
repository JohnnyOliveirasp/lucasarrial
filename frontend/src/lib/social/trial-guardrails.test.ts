/**
 * Testes dos guardrails de Trial Reel (trial-guardrails-pure.ts).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo), de dentro de frontend/:
 *   node --test src/lib/social/trial-guardrails.test.ts
 *
 * MUTAÇÃO — cada regra tem um par de fronteira; afrouxe UMA regra e o teste
 * correspondente cai (guarda que passa com e sem a regra não prova nada):
 *   - limite 6/dia → 7 (ou remover)      → cai o teste 1 (6 na janela bloqueia)
 *   - janela de 24h esticada             → cai o teste 3 (25h atrás NÃO conta)
 *   - espaçamento 2h30 → 2h (ou remover) → cai o teste 4 (2h29 bloqueia)
 *   - breaker 24h encurtado/removido     → cai o teste 6 (falha há 1h bloqueia)
 *   - breaker sem excluir guardrail_block→ cai o teste 8 (bloqueio NOSSO não abre)
 *   - dedupe removido                    → cai o teste 9 (mesmo vídeo bloqueia)
 *   - dedupe sem normalizar r2-cleaned://→ cai o teste 11 (vídeo já limpo bloqueia)
 *   - retry aceitando status ≠ 429       → cai o teste 14 (500/400/rede não retenta)
 *   - backoff sem dobrar                 → cai o teste 13 (2ª tentativa = 30min)
 * E os tripwires (testes 16–17) acusam se alguém tirar a decisão do caminho
 * REAL do envio (publisher) ou da rota — regra fora do fio não protege nada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BACKOFF_429_BASE_MS,
  BREAKER_MS,
  ESPACAMENTO_MINIMO_MS,
  JANELA_DIARIA_MS,
  LIMITE_TRIALS_POR_DIA,
  chaveDedupe,
  decidirEnvioTrial,
  decidirRetryTrial,
  momentoEnvio,
  type TrialAnterior,
} from "./trial-guardrails-pure.ts";

// ───────── relógio fixo e fábrica de linhas (nada lê Date.now) ─────────

const AGORA = "2026-09-23T12:00:00.000Z";
const AGORA_MS = Date.parse(AGORA);

/** ISO de N minutos ATRÁS do agora fixo. */
function haMin(min: number): string {
  return new Date(AGORA_MS - min * 60_000).toISOString();
}

function trial(sobrescreve: Partial<TrialAnterior> & { enviadaEm?: string | null }): TrialAnterior {
  return {
    mediaUrl: "r2://media/social-uploads/outro-video.mp4",
    status: "published",
    criadaEm: haMin(600),
    atualizadaEm: haMin(600),
    enviadaEm: null,
    ...sobrescreve,
  };
}

/** N envios bem espaçados (>2h30 entre si e do agora), todos dentro de 24h. */
function enviosNaJanela(n: number): TrialAnterior[] {
  return Array.from({ length: n }, (_, i) =>
    trial({ mediaUrl: `r2://media/v${i}.mp4`, enviadaEm: haMin(180 * (i + 1)) }),
  );
}

// ───────── regra 1: máximo 6 por dia, por conta ─────────

// 1. exatamente 6 enviados na janela → o 7º é recusado
test("limite diário: 6 trials enviados em 24h bloqueiam o próximo", () => {
  const anteriores = enviosNaJanela(LIMITE_TRIALS_POR_DIA); // 3h..18h atrás
  const d = decidirEnvioTrial({ agora: AGORA, mediaUrl: "r2://media/novo.mp4", anteriores });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "limite_diario");
  // libera quando o MAIS ANTIGO da janela (18h atrás) completar 24h → agora+6h
  assert.equal(
    !d.permitido && d.liberadoEm,
    new Date(Date.parse(haMin(180 * 6)) + JANELA_DIARIA_MS).toISOString(),
  );
});

// 2. 5 enviados → passa (o limite é 6, não 5)
test("limite diário: 5 trials em 24h ainda permitem o 6º", () => {
  const anteriores = enviosNaJanela(LIMITE_TRIALS_POR_DIA - 1);
  const d = decidirEnvioTrial({ agora: AGORA, mediaUrl: "r2://media/novo.mp4", anteriores });
  assert.deepEqual(d, { permitido: true });
});

// 3. a janela é DESLIZANTE de 24h: envio há 25h não conta
test("limite diário: envio há 25h fica FORA da janela e não conta", () => {
  const anteriores = [
    ...enviosNaJanela(LIMITE_TRIALS_POR_DIA - 1),
    trial({ mediaUrl: "r2://media/velho.mp4", enviadaEm: haMin(25 * 60) }),
  ];
  const d = decidirEnvioTrial({ agora: AGORA, mediaUrl: "r2://media/novo.mp4", anteriores });
  assert.deepEqual(d, { permitido: true });
});

// ───────── regra 2: espaçamento mínimo de 2h30 ─────────

// 4. último envio há 2h29 → bloqueia, com o horário exato da liberação
test("espaçamento: 2h29 desde o último trial bloqueia; libera em envio+2h30", () => {
  const envio = haMin(149); // 2h29 atrás
  const anteriores = [trial({ enviadaEm: envio })];
  const d = decidirEnvioTrial({ agora: AGORA, mediaUrl: "r2://media/novo.mp4", anteriores });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "espacamento");
  assert.equal(
    !d.permitido && d.liberadoEm,
    new Date(Date.parse(envio) + ESPACAMENTO_MINIMO_MS).toISOString(),
  );
});

// 5. último envio há 2h31 → passa
test("espaçamento: 2h31 desde o último trial já permite", () => {
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/novo.mp4",
    anteriores: [trial({ enviadaEm: haMin(151) })],
  });
  assert.deepEqual(d, { permitido: true });
});

// ───────── regra 3: circuit breaker de 24h ─────────

// 6. trial falhou há 1h → trials da conta pausados (liberadoEm = falha+24h)
test("breaker: trial failed há 1h pausa os trials da conta por 24h", () => {
  const falha = trial({ status: "failed", atualizadaEm: haMin(60), enviadaEm: haMin(90) });
  const d = decidirEnvioTrial({ agora: AGORA, mediaUrl: "r2://media/novo.mp4", anteriores: [falha] });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "circuit_breaker");
  assert.equal(
    !d.permitido && d.liberadoEm,
    new Date(Date.parse(haMin(60)) + BREAKER_MS).toISOString(),
  );
  // A mensagem deixa claro que Reel NORMAL não é afetado (regra 3: nunca
  // punir o aluno cortando o normal junto — o publisher nem chama a decisão
  // pra reel sem is_trial; ver tripwire do teste 16).
  assert.match(!d.permitido ? d.erro : "", /normais continuam/i);
});

// 7. falha há 25h → breaker fechado de novo
test("breaker: falha há 25h já não pausa", () => {
  const falha = trial({ status: "failed", atualizadaEm: haMin(25 * 60) });
  const d = decidirEnvioTrial({ agora: AGORA, mediaUrl: "r2://media/novo.mp4", anteriores: [falha] });
  assert.deepEqual(d, { permitido: true });
});

// 8. falha marcada como guardrail_block (recusa NOSSA, ex.: dedupe) NÃO abre
//    o breaker — bloqueio nosso não é falha da Meta
test("breaker: failed por guardrail NOSSO não abre o breaker", () => {
  const bloqueio = trial({
    status: "failed",
    atualizadaEm: haMin(60),
    bloqueadaPorGuardrail: true,
  });
  const d = decidirEnvioTrial({ agora: AGORA, mediaUrl: "r2://media/novo.mp4", anteriores: [bloqueio] });
  assert.deepEqual(d, { permitido: true });
});

// ───────── regra 4: dedupe por media_url ─────────

// 9. mesmo vídeo já publicado como trial na conta → recusa PERMANENTE
test("dedupe: mesmo media_url já publicado como trial bloqueia (liberadoEm null)", () => {
  const url = "r2://media/video-clone/abc/result.mp4";
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: url,
    anteriores: [trial({ mediaUrl: url, status: "published", enviadaEm: haMin(30 * 60) })],
  });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "dedupe");
  assert.equal(!d.permitido && d.liberadoEm, null);
});

// 10. mesmo vídeo mas o anterior FALHOU → re-tentar é legítimo
test("dedupe: trial anterior failed com o mesmo vídeo não bloqueia", () => {
  const url = "r2://media/video-clone/abc/result.mp4";
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: url,
    anteriores: [trial({ mediaUrl: url, status: "failed", atualizadaEm: haMin(30 * 60) })],
  });
  assert.deepEqual(d, { permitido: true });
});

// 11. a limpeza de 7 dias reescreve r2:// → r2-cleaned:// — o dedupe compara
//     a mídia NORMALIZADA, senão a duplicata passaria depois da limpeza
test("dedupe: linha antiga r2-cleaned:// ainda barra o mesmo vídeo r2://", () => {
  assert.equal(chaveDedupe("r2-cleaned://media/x.mp4"), chaveDedupe("r2://media/x.mp4"));
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/video-clone/abc/result.mp4",
    anteriores: [
      trial({
        mediaUrl: "r2-cleaned://media/video-clone/abc/result.mp4",
        status: "published",
        enviadaEm: haMin(30 * 60),
      }),
    ],
  });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "dedupe");
});

// 12. precedência: dedupe (permanente) fala mais alto que espaçamento — o
//     aluno precisa saber da causa que NÃO se resolve esperando
test("precedência: dedupe vence espaçamento quando os dois bloqueariam", () => {
  const url = "r2://media/v.mp4";
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: url,
    anteriores: [trial({ mediaUrl: url, status: "published", enviadaEm: haMin(60) })],
  });
  assert.equal(!d.permitido && d.regra, "dedupe");
});

// ───────── regra 5: retry só em 429, com backoff ─────────

// 13. 429 retenta com backoff exponencial (15min, 30min) até o teto de tentativas
test("retry: 429 retenta com backoff dobrando; 3ª tentativa não retenta mais", () => {
  assert.deepEqual(decidirRetryTrial({ httpStatus: 429, attempts: 1 }), {
    retry: true,
    backoffMs: BACKOFF_429_BASE_MS,
  });
  assert.deepEqual(decidirRetryTrial({ httpStatus: 429, attempts: 2 }), {
    retry: true,
    backoffMs: BACKOFF_429_BASE_MS * 2,
  });
  assert.deepEqual(decidirRetryTrial({ httpStatus: 429, attempts: 3 }), { retry: false });
});

// 14. QUALQUER status ≠ 429 não retenta — inclusive restrição (400 c/ subcode
//     2207xxx chega como status 400) e 5xx; retentar restrição vira bloqueio
test("retry: 400 (restrição), 500 e erro sem status NUNCA retentam", () => {
  for (const httpStatus of [400, 403, 500, null]) {
    assert.deepEqual(
      decidirRetryTrial({ httpStatus, attempts: 1 }),
      { retry: false },
      `status ${httpStatus} não pode retentar`,
    );
  }
});

// ───────── momentoEnvio (fonte do limite e do espaçamento) ─────────

// 15. trial_sent_at é a fonte; legado processing/published cai pro created_at;
//     failed SEM trial_sent_at falhou antes do envio → não conta
test("momentoEnvio: trial_sent_at manda; legado usa created_at; failed pré-envio não conta", () => {
  assert.equal(
    momentoEnvio(trial({ enviadaEm: haMin(10), criadaEm: haMin(500) })),
    Date.parse(haMin(10)),
  );
  assert.equal(
    momentoEnvio(trial({ status: "processing", enviadaEm: null, criadaEm: haMin(500) })),
    Date.parse(haMin(500)),
  );
  assert.equal(momentoEnvio(trial({ status: "failed", enviadaEm: null })), null);
});

// ───────── tripwires na fonte: a decisão está no FIO real ─────────

function fonte(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

// 16. publisher: a decisão roda no ENVIO, antes do createContainer, SÓ pra
//     trial (reel normal não passa pela decisão — breaker não corta o normal),
//     grava trial_sent_at no envio, marca guardrail_block no bloqueio
//     permanente e usa decidirRetryTrial na falha. Se alguém "simplificar"
//     removendo qualquer peça do fio, este teste acusa.
test("tripwire publisher: guardrail antes do createContainer, só pra trial, com retry 429", () => {
  const f = fonte("./publisher.ts");
  const iEhTrial = f.indexOf("const ehTrial = Boolean(opts.is_trial)");
  const iSoTrial = f.indexOf("if (ehTrial) {");
  const iCarregar = f.indexOf("carregarTrialsAnteriores(pub.account_id");
  const iDecisao = f.indexOf("decidirEnvioTrial(");
  const iCreate = f.indexOf("await createContainer(");
  const iRetry = f.indexOf("decidirRetryTrial(");
  assert.ok(iEhTrial !== -1, "a definição de ehTrial sumiu do startPublication");
  assert.ok(iSoTrial !== -1 && iSoTrial < iDecisao, "a decisão precisa estar DENTRO de if (ehTrial)");
  assert.ok(iCarregar !== -1 && iCarregar < iDecisao, "a decisão precisa ler os trials anteriores da CONTA");
  assert.ok(iDecisao !== -1 && iCreate !== -1 && iDecisao < iCreate,
    "a decisão de guardrail precisa vir ANTES do createContainer (checagem do ENVIO)");
  assert.ok(iRetry !== -1 && iRetry > iCreate, "a falha do trial precisa passar por decidirRetryTrial");
  assert.ok(f.includes("guardrail_block: decisao.regra"),
    "bloqueio permanente precisa marcar guardrail_block (senão abre o breaker)");
  assert.ok(f.includes("trial_sent_at: new Date().toISOString()"),
    "o envio precisa gravar trial_sent_at (fonte do limite diário e do espaçamento)");
  assert.ok(f.includes("scheduled_at: decisao.liberadoEm") && f.includes("error: decisao.erro"),
    "bloqueio transitório precisa manter ready com motivo em error e adiar via scheduled_at");
});

// 17. rota: a checagem de cortesia existe e vem DEPOIS da validação do trial
test("tripwire rota: /publish checa os guardrails na criação (erro amigável)", () => {
  const f = fonte("../../app/api/v1/social/publish/route.ts");
  const iValidar = f.indexOf("validarTrialReel(");
  const iDecisao = f.indexOf("decidirEnvioTrial(");
  assert.ok(iDecisao !== -1, "a rota perdeu a checagem de guardrails");
  assert.ok(iValidar !== -1 && iValidar < iDecisao,
    "guardrail na rota vem depois da validação do trial");
  assert.ok(f.includes("carregarTrialsAnteriores(accountId)"),
    "a rota precisa consultar os trials anteriores da MESMA conta");
});
