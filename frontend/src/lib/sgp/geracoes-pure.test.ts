/**
 * Régua do painel "o que já foi gerado" de /admin/sgp.
 *
 * O que estes testes protegem, na ordem do estrago que o erro causa:
 *  1. NÃO MOSTRAR MATERIAL DE OUTRA PESSOA. O painel é de suporte, mas o
 *     atendente repassa o que vê pro aluno — mostrar a linha errada é o
 *     atendente afirmando uma entrega que não existe.
 *  2. A VOZ É A DO PEDIDO, não "a voz mais recente do aluno". O caso real está
 *     medido em previa-pure.ts: um aluno com 5 gerações, 4 de OUTRA voz.
 *  3. IMAGEM SÓ DO AVATAR DO ONBOARDING E SÓ `ready` — o que o aluno gerou
 *     depois na plataforma não é entrega do SGP.
 *  4. VÍDEO QUE FALHOU APARECE (sem link). É justamente o que faz o aluno
 *     chamar o suporte; escondê-lo deixa a tela dizendo "nada aqui".
 *  5. TETO CONTA O QUE CORTOU. Corte silencioso faz o atendente dizer "só
 *     saíram 12" pra quem tem 30.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/geracoes-pure.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  amostraDaVoz,
  imagensDoPedido,
  videoLegivel,
  videosDoAluno,
  vozDoPedido,
  vozLegivel,
  MAX_IMAGENS,
  SGP_IDEA_AVATAR,
  SGP_NOME_AMOSTRA,
  type LinhaAudioGerado,
  type LinhaImagemGerada,
  type LinhaVideoClone,
  type LinhaVideoHeygen,
  type LinhaVoz,
} from "./geracoes-pure.ts";

const EU = "aluno-1";
const OUTRO = "aluno-2";
const VOZ_DO_PEDIDO = "voz-do-pedido";
const VOZ_PESSOAL = "voz-pessoal";

// ───────────────────────────── 1 e 2. A VOZ ─────────────────────────────

const VOZES: LinhaVoz[] = [
  { id: VOZ_DO_PEDIDO, user_id: EU, status: "ready", trained_at: "2026-09-10T10:00:00Z" },
  { id: VOZ_PESSOAL, user_id: EU, status: "failed", created_at: "2026-09-12T10:00:00Z" },
  { id: "voz-alheia", user_id: OUTRO, status: "ready", trained_at: "2026-09-14T10:00:00Z" },
];

test("voz: pega a voz DO PEDIDO, não a mais recente do aluno", () => {
  const v = vozDoPedido(EU, VOZ_DO_PEDIDO, VOZES);
  assert.equal(v?.status, "ready");
  assert.equal(v?.data, "2026-09-10T10:00:00Z", "trained_at manda quando existe");
});

test("voz: nunca devolve a voz de outro aluno, mesmo pedindo pelo id dela", () => {
  assert.equal(vozDoPedido(EU, "voz-alheia", VOZES), null);
});

test("voz: pedido sem voice_id não tem voz — e não chuta uma", () => {
  assert.equal(vozDoPedido(EU, null, VOZES), null);
  assert.equal(vozDoPedido(EU, "  ", VOZES), null);
});

test("voz: sem user_id não devolve nada", () => {
  assert.equal(vozDoPedido(null, VOZ_DO_PEDIDO, VOZES), null);
});

test("voz: cai pra created_at quando ainda não treinou", () => {
  const v = vozDoPedido(EU, VOZ_PESSOAL, VOZES);
  assert.equal(v?.data, "2026-09-12T10:00:00Z");
});

test("voz: erro em branco vira null, não string vazia na tela", () => {
  const linhas: LinhaVoz[] = [
    { id: VOZ_DO_PEDIDO, user_id: EU, status: "failed", error_message: "   " },
  ];
  assert.equal(vozDoPedido(EU, VOZ_DO_PEDIDO, linhas)?.erro, null);
});

// ───────────────────── 2. A AMOSTRA (o player da voz) ─────────────────────

const AUDIOS: LinhaAudioGerado[] = [
  // A certa, e há duas: re-treino gera amostra nova.
  {
    user_id: EU,
    voice_id: VOZ_DO_PEDIDO,
    name: SGP_NOME_AMOSTRA,
    status: "ready",
    audio_path: "amostra-nova.wav",
    duration_seconds: 9,
    created_at: "2026-09-11T10:00:00Z",
  },
  {
    user_id: EU,
    voice_id: VOZ_DO_PEDIDO,
    name: SGP_NOME_AMOSTRA,
    status: "ready",
    audio_path: "amostra-velha.wav",
    duration_seconds: 8,
    created_at: "2026-09-10T10:00:00Z",
  },
  // Geração PESSOAL do aluno, da outra voz: não é amostra do pedido.
  {
    user_id: EU,
    voice_id: VOZ_PESSOAL,
    name: SGP_NOME_AMOSTRA,
    status: "ready",
    audio_path: "pessoal.wav",
    created_at: "2026-09-14T10:00:00Z",
  },
  // Voz certa, mas é um áudio que o aluno gerou na mão (outro nome).
  {
    user_id: EU,
    voice_id: VOZ_DO_PEDIDO,
    name: "Teste A/B da equipe",
    status: "ready",
    audio_path: "manual.wav",
    created_at: "2026-09-15T10:00:00Z",
  },
];

test("amostra: escolhe a MAIS RECENTE da voz do pedido", () => {
  assert.equal(amostraDaVoz(EU, VOZ_DO_PEDIDO, AUDIOS)?.key, "amostra-nova.wav");
});

test("amostra: ignora a geração pessoal do aluno, mesmo com o nome da amostra", () => {
  const so = amostraDaVoz(EU, VOZ_PESSOAL, AUDIOS);
  assert.equal(so?.key, "pessoal.wav", "pedindo a voz pessoal, é ela que vem");
  const doPedido = amostraDaVoz(EU, VOZ_DO_PEDIDO, AUDIOS);
  assert.equal(doPedido?.key, "amostra-nova.wav", "pedindo a do pedido, a pessoal não entra");
});

test("amostra: áudio gerado na mão (outro nome) não vira a amostra", () => {
  const r = amostraDaVoz(EU, VOZ_DO_PEDIDO, AUDIOS);
  assert.notEqual(r?.key, "manual.wav");
});

test("amostra: caminho vazio não vira player quebrado", () => {
  const linhas: LinhaAudioGerado[] = [
    { user_id: EU, voice_id: VOZ_DO_PEDIDO, name: SGP_NOME_AMOSTRA, status: "ready", audio_path: "" },
  ];
  assert.equal(amostraDaVoz(EU, VOZ_DO_PEDIDO, linhas), null);
});

test("amostra: linha de OUTRO aluno não passa nem com voice_id igual", () => {
  const linhas: LinhaAudioGerado[] = [
    {
      user_id: OUTRO,
      voice_id: VOZ_DO_PEDIDO,
      name: SGP_NOME_AMOSTRA,
      status: "ready",
      audio_path: "alheio.wav",
    },
  ];
  assert.equal(amostraDaVoz(EU, VOZ_DO_PEDIDO, linhas), null);
});

// ───────────────────────────── 3. AS IMAGENS ─────────────────────────────

const IMAGENS: LinhaImagemGerada[] = [
  { id: "i1", user_id: EU, idea: SGP_IDEA_AVATAR, status: "ready", image_path: "a.png", created_at: "2026-09-10T00:00:00Z" },
  { id: "i2", user_id: EU, idea: SGP_IDEA_AVATAR, status: "ready", image_path: "b.png", created_at: "2026-09-12T00:00:00Z" },
  // Gerada pelo aluno depois, na plataforma: não é entrega do SGP.
  { id: "i3", user_id: EU, idea: "post_instagram", status: "ready", image_path: "c.png", created_at: "2026-09-13T00:00:00Z" },
  // Ainda gerando: não tem o que mostrar.
  { id: "i4", user_id: EU, idea: SGP_IDEA_AVATAR, status: "generating", image_path: null, created_at: "2026-09-14T00:00:00Z" },
  // ⚠️ NÃO-`ready` COM CAMINHO PREENCHIDO. Este caso é o que dá trabalho: sem
  // ele o teste passa mesmo se a trava de `ready` for removida, porque as outras
  // linhas não-`ready` do fixture já caíam pelo caminho vazio. (Descoberto
  // mutando a régua: a versão anterior deste teste não testava nada aqui.)
  { id: "i6", user_id: EU, idea: SGP_IDEA_AVATAR, status: "failed", image_path: "meia-feita.png", created_at: "2026-09-16T00:00:00Z" },
  // De outro aluno.
  { id: "i5", user_id: OUTRO, idea: SGP_IDEA_AVATAR, status: "ready", image_path: "d.png", created_at: "2026-09-15T00:00:00Z" },
];

test("imagens: só avatar do onboarding, só ready, só do próprio aluno", () => {
  const { itens } = imagensDoPedido(EU, IMAGENS);
  assert.deepEqual(
    itens.map((i) => i.key),
    ["b.png", "a.png"],
    "mais recente primeiro",
  );
});

test("imagens: sem user_id devolve vazio, não a lista toda", () => {
  assert.deepEqual(imagensDoPedido(null, IMAGENS), { itens: [], total: 0 });
});

test("imagens: teto corta mas CONTA o que existia", () => {
  const muitas: LinhaImagemGerada[] = Array.from({ length: 30 }, (_, n) => ({
    id: `x${n}`,
    user_id: EU,
    idea: SGP_IDEA_AVATAR,
    status: "ready",
    image_path: `x${n}.png`,
    created_at: `2026-09-${String(1 + (n % 28)).padStart(2, "0")}T00:00:00Z`,
  }));
  const r = imagensDoPedido(EU, muitas);
  assert.equal(r.itens.length, MAX_IMAGENS);
  assert.equal(r.total, 30, "o total é o que existe, não o que coube");
});

test("imagens: linha sem data vai pro FIM, nunca pro topo", () => {
  const linhas: LinhaImagemGerada[] = [
    { id: "sem", user_id: EU, idea: SGP_IDEA_AVATAR, status: "ready", image_path: "sem.png" },
    { id: "com", user_id: EU, idea: SGP_IDEA_AVATAR, status: "ready", image_path: "com.png", created_at: "2026-01-01T00:00:00Z" },
  ];
  assert.deepEqual(
    imagensDoPedido(EU, linhas).itens.map((i) => i.key),
    ["com.png", "sem.png"],
  );
});

// ───────────────────────────── 4 e 5. OS VÍDEOS ─────────────────────────────

const CLONES: LinhaVideoClone[] = [
  { id: "c1", user_id: EU, name: "Meu clone", status: "ready", video_path: "c1.mp4", created_at: "2026-09-10T00:00:00Z" },
  // ⚠️ FALHOU MAS TEM CAMINHO GRAVADO. É o caso que prova a trava de `ready`:
  // com `video_path: null` o teste passaria mesmo sem trava nenhuma, porque o
  // caminho vazio já barraria sozinho. (Descoberto mutando a régua.)
  { id: "c2", user_id: EU, name: null, status: "failed", video_path: "meio-gerado.mp4", created_at: "2026-09-13T00:00:00Z" },
  { id: "c3", user_id: OUTRO, name: "alheio", status: "ready", video_path: "c3.mp4", created_at: "2026-09-14T00:00:00Z" },
];

const HEYGEN: LinhaVideoHeygen[] = [
  { id: "h1", user_id: EU, title: "Avatar", status: "ready", video_path: "h1.mp4", created_at: "2026-09-12T00:00:00Z" },
];

test("vídeos: junta as duas origens e ordena por data, mais novo primeiro", () => {
  const { itens } = videosDoAluno(EU, CLONES, HEYGEN);
  assert.deepEqual(
    itens.map((v) => v.id),
    ["c2", "h1", "c1"],
  );
});

test("vídeos: a ORIGEM vem marcada — ela decide o bucket, não é enfeite", () => {
  const { itens } = videosDoAluno(EU, CLONES, HEYGEN);
  assert.equal(itens.find((v) => v.id === "c1")?.origem, "clone");
  assert.equal(itens.find((v) => v.id === "h1")?.origem, "heygen");
});

test("vídeo que FALHOU aparece na lista, com status e SEM link", () => {
  const falho = videosDoAluno(EU, CLONES, HEYGEN).itens.find((v) => v.id === "c2");
  assert.ok(falho, "o vídeo que quebrou é o motivo do chamado — não pode sumir");
  assert.equal(falho?.status, "failed");
  // Ele TEM caminho gravado no banco (`meio-gerado.mp4`) e mesmo assim não ganha
  // link: entregar um arquivo de um vídeo marcado como falho faria o atendente
  // mandar pro aluno um vídeo quebrado dizendo que ficou pronto.
  assert.equal(falho?.key, null, "não é o caminho vazio que barra — é o status");
});

test("vídeos: nada de outro aluno entra", () => {
  const ids = videosDoAluno(EU, CLONES, HEYGEN).itens.map((v) => v.id);
  assert.equal(ids.includes("c3"), false);
});

test("vídeos: pronto porém sem arquivo não vira link quebrado", () => {
  const capenga: LinhaVideoClone[] = [
    { id: "c9", user_id: EU, name: "x", status: "ready", video_path: null, created_at: "2026-09-10T00:00:00Z" },
  ];
  assert.equal(videosDoAluno(EU, capenga, []).itens[0].key, null);
});

test("vídeos: teto corta mas CONTA o que existia", () => {
  const muitos: LinhaVideoClone[] = Array.from({ length: 9 }, (_, n) => ({
    id: `v${n}`,
    user_id: EU,
    name: null,
    status: "ready",
    video_path: `v${n}.mp4`,
    created_at: `2026-09-0${n + 1}T00:00:00Z`,
  }));
  const r = videosDoAluno(EU, muitos, []);
  assert.equal(r.itens.length, 6);
  assert.equal(r.total, 9);
});

test("vídeos: sem user_id devolve vazio", () => {
  assert.deepEqual(videosDoAluno(null, CLONES, HEYGEN), { itens: [], total: 0 });
});

// ─────────────── O STATUS QUE O ATENDENTE VAI REPETIR PRO ALUNO ───────────────

test("status da voz sai em português — o enum cru nunca chega na tela", () => {
  // Quem lê é o time de suporte, que não tem acesso ao código e REPETE isto pro
  // aluno. "awaiting_training" não é resposta que se dê pra ninguém.
  assert.equal(vozLegivel("awaiting_training"), "na fila pra treinar");
  assert.equal(vozLegivel("rejected_too_short"), "áudio curto demais — recusado");
  assert.equal(vozLegivel("ready"), "voz pronta");
  assert.equal(vozLegivel("failed"), "o treino falhou");
  for (const cru of ["uploading", "validating", "training"]) {
    assert.notEqual(vozLegivel(cru), cru, `"${cru}" não pode chegar cru na tela`);
  }
});

test("status desconhecido não é traduzido no chute — vem cru", () => {
  // Se o sistema passar a emitir um estado novo, inventar um texto bonito seria
  // pior: o atendente repassaria uma informação que ninguém escreveu.
  assert.equal(vozLegivel("algum_estado_novo"), "algum_estado_novo");
  assert.equal(vozLegivel(null), "desconhecido");
  assert.equal(vozLegivel("  "), "desconhecido");
});

test("status de vídeo: as duas origens falam a mesma língua na tela", () => {
  // heygen diz "processing", video_clones diz "generating" — pro atendente é a
  // mesma coisa, e duas palavras pro mesmo estado viram dúvida.
  assert.equal(videoLegivel("processing"), "gerando");
  assert.equal(videoLegivel("generating"), "gerando");
  assert.equal(videoLegivel("ready"), "pronto");
  assert.equal(videoLegivel("failed"), "falhou");
  assert.equal(videoLegivel(null), "desconhecido");
});
