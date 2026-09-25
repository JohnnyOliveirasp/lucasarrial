/**
 * Testes dos guardrails de Trial Reel (trial-guardrails-pure.ts +
 * trial-conteudo.ts, que fornece os hashes do dedupe por conteúdo).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo), de dentro de frontend/:
 *   node --test src/lib/social/trial-guardrails.test.ts
 *
 * MUTAÇÃO — cada regra tem um par de fronteira; afrouxe UMA regra e o teste
 * correspondente cai (guarda que passa com e sem a regra não prova nada):
 *   - limite 6/dia → 7 (ou remover)      → cai o teste 1 (6 na janela bloqueia)
 *   - limite NOSSO trocado pelo da Meta  → caem os testes 1 e 25 (6 barra
 *     mesmo com quota_usage 0/100 — o 6 é mais restritivo e não é substituído)
 *   - janela de 24h esticada             → cai o teste 3 (25h atrás NÃO conta)
 *   - espaçamento trial 2h → 1h30/remover→ cai o teste 4 (1h59 bloqueia)
 *   - espaçamento normal 1h removido     → cai o teste 23 (59min bloqueia)
 *   - cota Meta: null passando a barrar  → cai o teste 24 (falha da consulta
 *     NUNCA barra — instrumento quebrado não derruba publicação)
 *   - breaker sem exigir 3 consecutivas  → cai o teste 6 (2 falhas NÃO abrem)
 *   - breaker removido/encurtado         → cai o teste 7 (3ª falha abre)
 *   - sucesso NÃO zerando a contagem     → cai o teste 8 (falha,falha,sucesso,falha)
 *   - breaker sem excluir guardrail_block→ cai o teste 10 (3 bloqueios NOSSOS não abrem)
 *   - dedupe por hash de vídeo removido  → cai o teste 11 (mesmo sha256 em 6d bloqueia)
 *   - janela de 7 dias do dedupe esticada→ cai o teste 12 (8 dias atrás LIBERA)
 *   - normalização da legenda removida   → cai o teste 13 (acento/emoji/caixa bloqueia)
 *   - dedupe exigindo vídeo E legenda    → cai o teste 14 (só o vídeo igual já barra)
 *   - legenda vazia entrando no dedupe   → cai o teste 15 (sem legenda não colide)
 *   - dedupe por media_url removido      → cai o teste 16 (mesmo media_url bloqueia)
 *   - dedupe sem normalizar r2-cleaned://→ cai o teste 18 (vídeo já limpo bloqueia)
 *   - retry aceitando status ≠ 429       → cai o teste 21 (500/400/rede não retenta)
 *   - backoff sem dobrar                 → cai o teste 20 (2ª tentativa = 30min)
 * E os tripwires (últimos 3 testes) acusam se alguém tirar a decisão — os
 * hashes de conteúdo, a cota da Meta ou o espaçamento normal — do caminho
 * REAL do envio (publisher) ou da rota.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  BACKOFF_429_BASE_MS,
  BREAKER_MS,
  ESPACAMENTO_NORMAL_PADRAO_MIN,
  ESPACAMENTO_TRIAL_PADRAO_MIN,
  FALHAS_CONSECUTIVAS_BREAKER,
  JANELA_DIARIA_MS,
  LIMITE_TRIALS_POR_DIA,
  chaveDedupe,
  decidirCotaMeta,
  decidirEnvioNormal,
  decidirEnvioTrial,
  decidirRetryTrial,
  momentoEnvio,
  normalizarLegenda,
  resolverEspacamentoMs,
  type TrialAnterior,
} from "./trial-guardrails-pure.ts";
import { hashLegenda } from "./trial-conteudo.ts";

const ESPACAMENTO_TRIAL_MS = ESPACAMENTO_TRIAL_PADRAO_MIN * 60_000;
const ESPACAMENTO_NORMAL_MS = ESPACAMENTO_NORMAL_PADRAO_MIN * 60_000;

// ───────── relógio fixo e fábrica de linhas (nada lê Date.now) ─────────

const AGORA = "2026-09-23T12:00:00.000Z";
const AGORA_MS = Date.parse(AGORA);

/** ISO de N minutos ATRÁS do agora fixo. */
function haMin(min: number): string {
  return new Date(AGORA_MS - min * 60_000).toISOString();
}

/** ISO de N DIAS atrás do agora fixo (dedupe pensa em dias). */
function haDias(dias: number): string {
  return haMin(dias * 24 * 60);
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

/** Falha REAL (da Meta) concluída há N minutos — sem envio registrado. */
function falha(minAtras: number, extra: Partial<TrialAnterior> = {}): TrialAnterior {
  return trial({
    mediaUrl: `r2://media/falha-${minAtras}.mp4`,
    status: "failed",
    atualizadaEm: haMin(minAtras),
    ...extra,
  });
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

// ───────── regra 2: espaçamento mínimo do trial (piso 2h, configurável) ─────────

// 4. último envio há 1h59 → bloqueia (piso do trial é 2h), com o horário exato
test("espaçamento trial: 1h59 desde o último trial bloqueia; libera em envio+2h", () => {
  const envio = haMin(119); // 1h59 atrás
  const anteriores = [trial({ enviadaEm: envio })];
  const d = decidirEnvioTrial({ agora: AGORA, mediaUrl: "r2://media/novo.mp4", anteriores });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "espacamento");
  assert.equal(
    !d.permitido && d.liberadoEm,
    new Date(Date.parse(envio) + ESPACAMENTO_TRIAL_MS).toISOString(),
  );
});

// 5. último envio há 2h01 → passa
test("espaçamento trial: 2h01 desde o último trial já permite", () => {
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/novo.mp4",
    anteriores: [trial({ enviadaEm: haMin(121) })],
  });
  assert.deepEqual(d, { permitido: true });
});

// 5b. espaçamento do trial é CONFIGURÁVEL (env em minutos), mas config
//     quebrada/≤0 NUNCA desliga a regra — cai no padrão
test("espaçamento trial: env válido muda o piso; inválido/ausente cai no padrão 2h", () => {
  const ms3h = resolverEspacamentoMs("trial", { SOCIAL_ESPACAMENTO_TRIAL_MIN: "180" });
  assert.equal(ms3h, 180 * 60_000);
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/novo.mp4",
    anteriores: [trial({ enviadaEm: haMin(121) })], // 2h01: passa no padrão…
    espacamentoMs: ms3h, // …mas barra com 3h configurado
  });
  assert.equal(!d.permitido && d.regra, "espacamento");
  assert.equal(resolverEspacamentoMs("trial", {}), ESPACAMENTO_TRIAL_MS);
  assert.equal(
    resolverEspacamentoMs("trial", { SOCIAL_ESPACAMENTO_TRIAL_MIN: "banana" }),
    ESPACAMENTO_TRIAL_MS,
  );
  assert.equal(
    resolverEspacamentoMs("trial", { SOCIAL_ESPACAMENTO_TRIAL_MIN: "0" }),
    ESPACAMENTO_TRIAL_MS,
  );
});

// ───────── regra 3: circuit breaker — 3 falhas CONSECUTIVAS ─────────

// 6. 2 falhas seguidas NÃO abrem o breaker (o gatilho é 3)
test("breaker: 2 falhas consecutivas ainda NÃO pausam a conta", () => {
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/novo.mp4",
    anteriores: [falha(180), falha(60)],
  });
  assert.deepEqual(d, { permitido: true });
});

// 7. a 3ª falha consecutiva abre: pausa 24h desde a ÚLTIMA falha, e a
//    mensagem diz quantas falhas, quando reabre e OFERECE reenviar os
//    pendentes como Reel normal (sem reenviar sozinha)
test("breaker: 3ª falha consecutiva abre por 24h com motivo completo", () => {
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/novo.mp4",
    anteriores: [falha(300), falha(200), falha(60)],
  });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "circuit_breaker");
  assert.equal(
    !d.permitido && d.liberadoEm,
    new Date(Date.parse(haMin(60)) + BREAKER_MS).toISOString(),
  );
  const erro = !d.permitido ? d.erro : "";
  assert.match(erro, new RegExp(`${FALHAS_CONSECUTIVAS_BREAKER} falhas`), "diz QUANTAS falhas");
  assert.match(erro, /Reabre em/i, "diz QUANDO reabre");
  assert.match(erro, /Reel NORMAL/i, "oferece a saída pelo Reel normal");
  assert.match(erro, /nada é reenviado sozinho/i, "deixa claro que NÃO reenvia sozinho");
});

// 8. sucesso no meio ZERA: falha, falha, sucesso, falha → só 1 consecutiva
test("breaker: sucesso no meio zera a contagem (falha,falha,sucesso,falha não abre)", () => {
  const sucesso = trial({
    mediaUrl: "r2://media/sucesso.mp4",
    status: "published",
    enviadaEm: haMin(400),
    atualizadaEm: haMin(120), // publicou DEPOIS das duas primeiras falhas
  });
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/novo.mp4",
    anteriores: [falha(300), falha(240), sucesso, falha(60)],
  });
  assert.deepEqual(d, { permitido: true });
});

// 9. 3 falhas consecutivas mas a última há 25h → o breaker já fechou
test("breaker: 3 falhas com a última há 25h já não pausam", () => {
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/novo.mp4",
    anteriores: [falha(27 * 60), falha(26 * 60), falha(25 * 60)],
  });
  assert.deepEqual(d, { permitido: true });
});

// 10. bloqueio NOSSO (guardrail_block) não é falha da Meta: 3 seguidos não
//     abrem o breaker (nem contam, nem zeram)
test("breaker: 3 bloqueios do nosso próprio guardrail NÃO abrem o breaker", () => {
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/novo.mp4",
    anteriores: [
      falha(300, { bloqueadaPorGuardrail: true }),
      falha(200, { bloqueadaPorGuardrail: true }),
      falha(60, { bloqueadaPorGuardrail: true }),
    ],
  });
  assert.deepEqual(d, { permitido: true });
});

// ───────── regra 4: dedupe por CONTEÚDO, janela de 7 dias ─────────

const SHA_VIDEO = "a".repeat(64); // sha256 hex fictício, opaco pra decisão

// 11. mesmo sha256 de vídeo há 6 dias → barra, mesmo com media_url diferente
//     (é o caso que o dedupe antigo por url deixava passar: MESMO arquivo
//     re-subido ganha outra chave)
test("dedupe: mesmo hash de vídeo há 6 dias barra, mesmo com outra media_url", () => {
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/social-uploads/upload-novo.mp4",
    videoHash: SHA_VIDEO,
    anteriores: [
      trial({
        mediaUrl: "r2://media/social-uploads/upload-antigo.mp4",
        enviadaEm: haDias(6),
        videoHash: SHA_VIDEO,
      }),
    ],
  });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "dedupe");
  assert.equal(!d.permitido && d.liberadoEm, null); // sem reagendamento automático
});

// 12. mesmo hash de vídeo há 8 dias → LIBERA (a janela de 7 dias afrouxa de
//     propósito o dedupe antigo, que era permanente)
test("dedupe: mesmo hash de vídeo há 8 dias já libera (janela de 7 dias)", () => {
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/social-uploads/upload-novo.mp4",
    videoHash: SHA_VIDEO,
    anteriores: [
      trial({
        mediaUrl: "r2://media/social-uploads/upload-antigo.mp4",
        enviadaEm: haDias(8),
        videoHash: SHA_VIDEO,
      }),
    ],
  });
  assert.deepEqual(d, { permitido: true });
});

// 13. a normalização da legenda funciona: acento/emoji/caixa/espaço duplicado
//     diferentes produzem o MESMO hash → barra
test("dedupe: mesma legenda com acento, emoji e caixa diferentes barra", () => {
  const antiga = "menina da fazenda no por do sol!";
  const nova = "Menina da FAZENDA  no pôr do Sol! 🌅";
  assert.equal(normalizarLegenda(nova), normalizarLegenda(antiga));
  assert.equal(hashLegenda(nova), hashLegenda(antiga));
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/video-b.mp4",
    videoHash: "b".repeat(64), // vídeos DIFERENTES: só a legenda coincide
    legendaHash: hashLegenda(nova),
    anteriores: [
      trial({
        mediaUrl: "r2://media/video-a.mp4",
        enviadaEm: haDias(2),
        videoHash: "c".repeat(64),
        legendaHash: hashLegenda(antiga),
      }),
    ],
  });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "dedupe");
});

// 14. legendas diferentes com o MESMO vídeo: barra (basta UM dos critérios)
test("dedupe: legendas diferentes não salvam o mesmo vídeo", () => {
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/video-b.mp4",
    videoHash: SHA_VIDEO,
    legendaHash: hashLegenda("legenda totalmente nova"),
    anteriores: [
      trial({
        mediaUrl: "r2://media/video-a.mp4",
        enviadaEm: haDias(2),
        videoHash: SHA_VIDEO,
        legendaHash: hashLegenda("a legenda antiga era outra"),
      }),
    ],
  });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "dedupe");
});

// 15. legenda VAZIA não participa do dedupe: dois trials sem legenda (vídeos
//     e urls diferentes) não colidem — hashLegenda devolve null
test("dedupe: legenda vazia (ou só emoji) vira null e não colide", () => {
  assert.equal(hashLegenda(""), null);
  assert.equal(hashLegenda(null), null);
  assert.equal(hashLegenda(" 🌅 "), null);
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/video-b.mp4",
    videoHash: "b".repeat(64),
    legendaHash: null,
    anteriores: [
      trial({
        mediaUrl: "r2://media/video-a.mp4",
        enviadaEm: haDias(2),
        videoHash: "c".repeat(64),
        legendaHash: null,
      }),
    ],
  });
  assert.deepEqual(d, { permitido: true });
});

// 16. fallback por media_url continua valendo (cobre linha antiga sem hash)
test("dedupe: mesmo media_url dentro de 7 dias ainda barra (linha sem hash)", () => {
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

// 17. mesmo vídeo mas o anterior FALHOU → re-tentar é legítimo
test("dedupe: trial anterior failed com o mesmo vídeo não bloqueia", () => {
  const url = "r2://media/video-clone/abc/result.mp4";
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: url,
    anteriores: [trial({ mediaUrl: url, status: "failed", atualizadaEm: haMin(30 * 60) })],
  });
  assert.deepEqual(d, { permitido: true });
});

// 18. a limpeza de 7 dias reescreve r2:// → r2-cleaned:// — o dedupe compara
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

// 19. precedência: dedupe fala mais alto que espaçamento — o aluno precisa
//     saber da causa que NÃO se resolve só esperando a próxima janela
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

// 20. 429 retenta com backoff exponencial (15min, 30min) até o teto de tentativas
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

// 21. QUALQUER status ≠ 429 não retenta — inclusive restrição (400 c/ subcode
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

// 22. trial_sent_at é a fonte; legado processing/published cai pro created_at;
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

// ───────── espaçamento de post NORMAL (novo: 1h padrão, configurável) ─────────

// 23. padrão 1h: 59min barra e reagenda pro envio+1h; 1h01 libera.
//     MUDANÇA DE COMPORTAMENTO consciente: antes o post normal não tinha
//     espaçamento nenhum (só o trial tinha).
test("espaçamento normal (padrão 1h): 59min desde o último envio barra; 1h01 libera", () => {
  const envio = haMin(59);
  const d = decidirEnvioNormal({ agora: AGORA, enviosAnteriores: [envio] });
  assert.equal(d.permitido, false);
  assert.equal(
    !d.permitido && d.liberadoEm,
    new Date(Date.parse(envio) + ESPACAMENTO_NORMAL_MS).toISOString(),
  );
  assert.deepEqual(
    decidirEnvioNormal({ agora: AGORA, enviosAnteriores: [haMin(61)] }),
    { permitido: true },
  );
  // sem envio anterior nenhum (conta nova) → sempre passa
  assert.deepEqual(decidirEnvioNormal({ agora: AGORA, enviosAnteriores: [] }), { permitido: true });
  // null/undefined (linha legada sem sent_at utilizável) são ignorados
  assert.deepEqual(
    decidirEnvioNormal({ agora: AGORA, enviosAnteriores: [null, undefined] }),
    { permitido: true },
  );
});

// 23b. configurado pra 2h via env: 1h59 entre dois posts normais barra, 2h01 libera
test("espaçamento normal configurado pra 2h: 1h59 entre dois posts normais barra, 2h01 libera", () => {
  const ms2h = resolverEspacamentoMs("normal", { SOCIAL_ESPACAMENTO_NORMAL_MIN: "120" });
  assert.equal(ms2h, 120 * 60_000);
  const d = decidirEnvioNormal({
    agora: AGORA,
    enviosAnteriores: [haMin(119)], // 1h59
    espacamentoMs: ms2h,
  });
  assert.equal(d.permitido, false);
  assert.deepEqual(
    decidirEnvioNormal({ agora: AGORA, enviosAnteriores: [haMin(121)], espacamentoMs: ms2h }),
    { permitido: true },
  );
  // env inválido/ausente do normal cai no padrão de 1h — nunca desliga
  assert.equal(resolverEspacamentoMs("normal", {}), ESPACAMENTO_NORMAL_MS);
  assert.equal(
    resolverEspacamentoMs("normal", { SOCIAL_ESPACAMENTO_NORMAL_MIN: "-5" }),
    ESPACAMENTO_NORMAL_MS,
  );
});

// ───────── cota de publicação da PRÓPRIA Meta ─────────

// 24. quota_usage >= quota_total barra; abaixo libera; consulta FALHOU (null)
//     NUNCA barra — instrumento quebrado não derruba a publicação
test("cota Meta: usage >= total barra; abaixo libera; falha da consulta NÃO barra", () => {
  assert.equal(decidirCotaMeta({ quotaTotal: 100, quotaUsage: 100 }).permitido, false);
  assert.equal(decidirCotaMeta({ quotaTotal: 100, quotaUsage: 250 }).permitido, false);
  assert.deepEqual(decidirCotaMeta({ quotaTotal: 100, quotaUsage: 99 }), { permitido: true });
  assert.deepEqual(decidirCotaMeta({ quotaTotal: 100, quotaUsage: 0 }), { permitido: true });
  // consulta falhou (rede/token/5xx) ou resposta sem os campos → null → passa
  assert.deepEqual(decidirCotaMeta(null), { permitido: true });
  // resposta absurda (total ≤ 0 / NaN) também não barra — sem dado, sem bloqueio
  assert.deepEqual(decidirCotaMeta({ quotaTotal: 0, quotaUsage: 0 }), { permitido: true });
  assert.deepEqual(decidirCotaMeta({ quotaTotal: NaN, quotaUsage: 5 }), { permitido: true });
});

// 21. os DOIS limites somam: a cota da Meta folgada (0/100) NÃO afrouxa o
//     nosso 6/dia — quem barrar primeiro manda, e o nosso barra primeiro.
//     (Mutação: trocar LIMITE_TRIALS_POR_DIA pelos 100 da Meta derruba este
//     teste e o teste 1.)
test("limite nosso continua valendo mesmo com a cota da Meta folgada", () => {
  assert.deepEqual(decidirCotaMeta({ quotaTotal: 100, quotaUsage: 0 }), { permitido: true });
  const d = decidirEnvioTrial({
    agora: AGORA,
    mediaUrl: "r2://media/novo.mp4",
    anteriores: enviosNaJanela(LIMITE_TRIALS_POR_DIA),
  });
  assert.equal(d.permitido, false);
  assert.equal(!d.permitido && d.regra, "limite_diario");
});

// ───────── tripwires na fonte: a decisão está no FIO real ─────────

function fonte(rel: string): string {
  return readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
}

// 23. publisher: a decisão roda no ENVIO, antes do createContainer, SÓ pra
//     trial (reel normal não passa pela decisão — breaker não corta o normal),
//     hasheia o CONTEÚDO antes de decidir, grava trial_sent_at + os hashes no
//     envio, marca guardrail_block no bloqueio permanente e usa
//     decidirRetryTrial na falha. Se alguém "simplificar" removendo qualquer
//     peça do fio, este teste acusa.
test("tripwire publisher: guardrail antes do createContainer, com hashes de conteúdo", () => {
  const f = fonte("./publisher.ts");
  const iEhTrial = f.indexOf("const ehTrial = Boolean(opts.is_trial)");
  const iSoTrial = f.indexOf("if (ehTrial) {");
  const iCarregar = f.indexOf("carregarTrialsAnteriores(pub.account_id");
  const iHashVideo = f.indexOf("sha256DeUrl(");
  const iHashLegenda = f.indexOf("hashLegenda(pub.caption)");
  const iDecisao = f.indexOf("decidirEnvioTrial(");
  const iCreate = f.indexOf("await createContainer(");
  const iRetry = f.indexOf("decidirRetryTrial(");
  assert.ok(iEhTrial !== -1, "a definição de ehTrial sumiu do startPublication");
  assert.ok(iSoTrial !== -1 && iSoTrial < iDecisao, "a decisão precisa estar DENTRO de if (ehTrial)");
  assert.ok(iCarregar !== -1 && iCarregar < iDecisao, "a decisão precisa ler os trials anteriores da CONTA");
  assert.ok(iHashVideo !== -1 && iHashVideo < iDecisao,
    "o sha256 do vídeo precisa ser calculado ANTES da decisão (dedupe por conteúdo)");
  assert.ok(iHashLegenda !== -1 && iHashLegenda < iDecisao,
    "o hash da legenda normalizada precisa ser calculado ANTES da decisão");
  assert.ok(iDecisao !== -1 && iCreate !== -1 && iDecisao < iCreate,
    "a decisão de guardrail precisa vir ANTES do createContainer (checagem do ENVIO)");
  assert.ok(iRetry !== -1 && iRetry > iCreate, "a falha do trial precisa passar por decidirRetryTrial");
  assert.ok(f.includes("guardrail_block: decisao.regra"),
    "bloqueio permanente precisa marcar guardrail_block (senão abre o breaker)");
  assert.ok(f.includes("trial_sent_at: new Date().toISOString()"),
    "o envio precisa gravar trial_sent_at (fonte do limite diário e do espaçamento)");
  assert.ok(f.includes("video_sha256: videoHash") && f.includes("caption_hash: legendaHash"),
    "o envio precisa gravar os hashes de conteúdo (fonte do dedupe das próximas decisões)");
  assert.ok(f.includes("scheduled_at: decisao.liberadoEm") && f.includes("error: decisao.erro"),
    "bloqueio transitório precisa manter ready com motivo em error e adiar via scheduled_at");
});

// 24. rota: a checagem de cortesia existe, vem DEPOIS da validação do trial e
//     inclui o hash da legenda (o do vídeo fica só no envio — a rota não baixa)
test("tripwire rota: /publish checa os guardrails na criação (erro amigável)", () => {
  const f = fonte("../../app/api/v1/social/publish/route.ts");
  const iValidar = f.indexOf("validarTrialReel(");
  const iDecisao = f.indexOf("decidirEnvioTrial(");
  assert.ok(iDecisao !== -1, "a rota perdeu a checagem de guardrails");
  assert.ok(iValidar !== -1 && iValidar < iDecisao,
    "guardrail na rota vem depois da validação do trial");
  assert.ok(f.includes("carregarTrialsAnteriores(accountId)"),
    "a rota precisa consultar os trials anteriores da MESMA conta");
  assert.ok(f.includes("hashLegenda(caption)"),
    "a cortesia precisa deduplicar pela legenda normalizada (barata, sem download)");
});

// 26. publisher: cota da Meta consultada ANTES do createContainer, decidida
//     pelo módulo puro, e falha da CONSULTA engolida (nunca bloqueia);
//     espaçamento de post normal no fio, lendo os envios da CONTA; e o envio
//     grava sent_at (fonte do espaçamento normal — sem ele a regra morre de
//     fome em silêncio nas linhas novas).
test("tripwire publisher: cota da Meta e espaçamento normal estão no fio do envio", () => {
  const f = fonte("./publisher.ts");
  const iCota = f.indexOf("contentPublishingLimit(");
  const iDecisaoCota = f.indexOf("decidirCotaMeta(");
  const iNormal = f.indexOf("decidirEnvioNormal(");
  const iCarregarNormais = f.indexOf("carregarEnviosNormais(pub.account_id");
  const iCreate = f.indexOf("await createContainer(");
  assert.ok(iCota !== -1 && iCota < iCreate,
    "a cota da Meta precisa ser consultada ANTES do createContainer");
  assert.ok(iDecisaoCota !== -1 && iDecisaoCota < iCreate,
    "a decisão da cota precisa vir do módulo puro (decidirCotaMeta), antes do envio");
  assert.ok(f.includes("seguindo com as regras locais"),
    "falha da consulta da cota precisa ser engolida com registro — nunca bloquear");
  assert.ok(iNormal !== -1 && iNormal < iCreate,
    "o espaçamento de post normal precisa rodar ANTES do envio");
  assert.ok(iCarregarNormais !== -1 && iCarregarNormais < iCreate,
    "o espaçamento normal precisa ler os envios anteriores da CONTA antes do envio");
  assert.ok(f.includes(", sent_at: new Date().toISOString()"),
    "o envio precisa gravar sent_at (fonte do espaçamento de post normal)");
  assert.ok(f.includes('resolverEspacamentoMs("trial", process.env)') &&
    f.includes('resolverEspacamentoMs("normal", process.env)'),
    "os DOIS espaçamentos precisam vir do env resolvido pelo módulo puro");
});
