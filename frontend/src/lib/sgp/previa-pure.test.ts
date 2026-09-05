/**
 * Régua da prévia da tela 5 do SGP (/sgp/acompanhar) — a tela SEM LOGIN.
 *
 * O que estes testes protegem, em ordem de gravidade:
 *  1. NADA de outro aluno, e nada do próprio aluno que não seja o material
 *     DESTE pedido (a página não pede senha);
 *  2. a amostra tem que ser a da voz DO PEDIDO — o caso real do
 *     lucas.m.arrial@gmail.com tem 4 gerações de outra voz na mesma conta;
 *  3. sem conta / sem voz / material não pronto ⇒ null, nunca um chute.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/previa-pure.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escolherAudio,
  escolherImagem,
  SGP_IDEA_AVATAR,
  SGP_NOME_AMOSTRA,
  type LinhaAudio,
  type LinhaImagem,
} from "./previa-pure.ts";

const EU = "92e895af-addf-4600-84b3-2cd604562517";
const OUTRO = "79108e9e-c4cc-45a4-b58a-9990247b7a4f";
const VOZ_DO_PEDIDO = "acee4794-dd18-4fea-81ff-20602444cb7c";
const VOZ_ANTIGA = "1bf3f56e-70b0-40ff-a7b7-f627f2938a2a";

function img(p: Partial<LinhaImagem> = {}): LinhaImagem {
  return {
    user_id: EU,
    idea: SGP_IDEA_AVATAR,
    status: "ready",
    image_path: `${EU}/images/aaa/result.png`,
    created_at: "2026-09-03T01:37:05Z",
    ...p,
  };
}

function aud(p: Partial<LinhaAudio> = {}): LinhaAudio {
  return {
    user_id: EU,
    voice_id: VOZ_DO_PEDIDO,
    name: SGP_NOME_AMOSTRA,
    status: "ready",
    audio_path: `${EU}/${VOZ_DO_PEDIDO}/sample.wav`,
    duration_seconds: 5.28,
    ...p,
  };
}

// ── Imagem ────────────────────────────────────────────────────────────────

test("imagem: o avatar pronto do próprio aluno passa", () => {
  assert.equal(escolherImagem(EU, [img()]), `${EU}/images/aaa/result.png`);
});

test("imagem: linha de OUTRO aluno nunca passa, nem se for a única", () => {
  assert.equal(escolherImagem(EU, [img({ user_id: OUTRO })]), null);
});

test("imagem: imagem que o aluno gerou depois na plataforma não é prévia do SGP", () => {
  // Sem a marca `onboarding_avatar` é geração comum dele — a tela sem login
  // não pode virar um visualizador do histórico dele.
  assert.equal(escolherImagem(EU, [img({ idea: null })]), null);
  assert.equal(escolherImagem(EU, [img({ idea: "outra_ideia" })]), null);
});

test("imagem: só entra quando está ready e com caminho de verdade", () => {
  assert.equal(escolherImagem(EU, [img({ status: "pending" })]), null);
  assert.equal(escolherImagem(EU, [img({ status: "failed" })]), null);
  assert.equal(escolherImagem(EU, [img({ image_path: null })]), null);
  assert.equal(escolherImagem(EU, [img({ image_path: "   " })]), null);
});

test("imagem: sem conta (pedido que nem chegou no envio) não mostra nada", () => {
  assert.equal(escolherImagem(null, [img()]), null);
  assert.equal(escolherImagem("", [img()]), null);
});

test("imagem: com duas válidas, ganha a mais recente", () => {
  const velha = img({ image_path: "velha.png", created_at: "2026-08-29T23:17:28Z" });
  const nova = img({ image_path: "nova.png", created_at: "2026-09-03T01:37:05Z" });
  assert.equal(escolherImagem(EU, [velha, nova]), "nova.png");
  assert.equal(escolherImagem(EU, [nova, velha]), "nova.png");
});

test("imagem: lista vazia é null, não estoura", () => {
  assert.equal(escolherImagem(EU, []), null);
});

// ── Áudio ─────────────────────────────────────────────────────────────────

test("áudio: a amostra da voz DO PEDIDO passa, com a duração", () => {
  assert.deepEqual(escolherAudio(EU, VOZ_DO_PEDIDO, [aud()]), {
    key: `${EU}/${VOZ_DO_PEDIDO}/sample.wav`,
    segundos: 5.28,
  });
});

test("áudio: o caso REAL do lucas.m.arrial — 4 linhas de outra voz na mesma conta", () => {
  // Medido em 03/09: filtrar só por user_id vazaria material privado dele numa
  // página sem login; filtrar por user_id + nome pegaria a amostra da voz ANTIGA.
  const conta: LinhaAudio[] = [
    aud({ voice_id: VOZ_ANTIGA, audio_path: `${EU}/${VOZ_ANTIGA}/sample.wav`, duration_seconds: 5.92 }),
    aud({ voice_id: VOZ_ANTIGA, name: null, audio_path: `${EU}/b7e0.mp3`, duration_seconds: 43.658 }),
    aud({ voice_id: VOZ_ANTIGA, name: null, audio_path: `${EU}/80da.mp3`, duration_seconds: 36.703 }),
    aud({ voice_id: VOZ_ANTIGA, name: "Teste A/B da equipe — 2026-08-28", audio_path: `${EU}/c294.mp3` }),
    aud(), // a do pedido
  ];
  const r = escolherAudio(EU, VOZ_DO_PEDIDO, conta);
  assert.deepEqual(r, { key: `${EU}/${VOZ_DO_PEDIDO}/sample.wav`, segundos: 5.28 });
});

test("áudio: geração pessoal do aluno (sem nome de amostra) nunca passa", () => {
  assert.equal(escolherAudio(EU, VOZ_DO_PEDIDO, [aud({ name: null })]), null);
  assert.equal(escolherAudio(EU, VOZ_DO_PEDIDO, [aud({ name: "Meu vídeo de vendas" })]), null);
});

test("áudio: linha de OUTRO aluno nunca passa", () => {
  assert.equal(escolherAudio(EU, VOZ_DO_PEDIDO, [aud({ user_id: OUTRO })]), null);
});

test("áudio: sem voz no pedido, não adivinha — devolve null", () => {
  // Se a criação da voz falhou, `sgp_pedidos.voice_id` é null. Melhor nada do
  // que a voz errada.
  assert.equal(escolherAudio(EU, null, [aud()]), null);
  assert.equal(escolherAudio(EU, "", [aud()]), null);
});

test("áudio: sem conta não mostra nada", () => {
  assert.equal(escolherAudio(null, VOZ_DO_PEDIDO, [aud()]), null);
});

test("áudio: só entra quando está ready e com caminho de verdade", () => {
  assert.equal(escolherAudio(EU, VOZ_DO_PEDIDO, [aud({ status: "pending" })]), null);
  assert.equal(escolherAudio(EU, VOZ_DO_PEDIDO, [aud({ status: "failed" })]), null);
  assert.equal(escolherAudio(EU, VOZ_DO_PEDIDO, [aud({ audio_path: null })]), null);
});

test("áudio: duração ausente vira null, não vira 0 (0 seria 'áudio vazio')", () => {
  assert.deepEqual(escolherAudio(EU, VOZ_DO_PEDIDO, [aud({ duration_seconds: null })]), {
    key: `${EU}/${VOZ_DO_PEDIDO}/sample.wav`,
    segundos: null,
  });
});

test("áudio: lista vazia é null, não estoura", () => {
  assert.equal(escolherAudio(EU, VOZ_DO_PEDIDO, []), null);
});
