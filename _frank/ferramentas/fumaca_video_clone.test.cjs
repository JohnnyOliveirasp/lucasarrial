/**
 * Testes da fumaça do Vídeo Clone. Sem banco, sem rede, sem GPU:
 *
 *   node --test _frank/ferramentas/fumaca_video_clone.test.cjs
 *
 * Cada caso aqui é uma armadilha REAL — ou já mordeu, ou morderia calada.
 * O ponto cego que estes testes cobrem: uma fumaça que mente é PIOR que
 * fumaça nenhuma, porque a casa para de olhar. Então o que se testa aqui é
 * principalmente a honestidade do medidor, não a beleza do código.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { TIERS, CLONE_FPS, creditosCusto, execTimeoutMs, montarWorkflow, medirDuracaoWav } = require("./fumaca_video_clone.cjs");

const RAIZ = path.resolve(__dirname, "..", "..");
const CONFIG_TS = path.join(RAIZ, "frontend", "src", "lib", "video-clone", "config.ts");

/* ────────────────────────── medidor de duração ─────────────────────────── */

/** Monta um WAV PCM 16-bit mono 24kHz com `dataSize` declarado no header. */
function wav({ segundos = 1, sampleRate = 24000, declararSize = null } = {}) {
  const byteRate = sampleRate * 2; // mono, 16 bits
  const bytesReais = Math.round(segundos * byteRate);
  const buf = Buffer.alloc(44 + bytesReais);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + bytesReais, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(declararSize === null ? bytesReais : declararSize, 40);
  return buf;
}

test("WAV normal: duração sai do header", () => {
  assert.equal(medirDuracaoWav(wav({ segundos: 6.71 })), 6.71);
});

test("ARMADILHA REAL (05/09): WAV de streaming da OpenAI declara data=0xFFFFFFFF", () => {
  // A API de TTS escreve o header antes de saber o tamanho e deixa o campo
  // com o placeholder 4.294.967.295. Confiar nele dava 89.478 s pra um áudio
  // de 6,71 s — a fumaça mandaria num_frames absurdo pra GPU sem reclamar.
  const b = wav({ segundos: 6.71, declararSize: 0xffffffff });
  assert.equal(medirDuracaoWav(b), 6.71, "tem que valer os bytes reais, não o placeholder");
});

test("data declarado como 0 também cai pros bytes reais", () => {
  assert.equal(medirDuracaoWav(wav({ segundos: 3, declararSize: 0 })), 3);
});

test("data declarado MENOR que o arquivo é respeitado (não é streaming)", () => {
  // Cauda de metadados depois do data é legítima: aqui o header manda.
  const byteRate = 48000;
  const b = wav({ segundos: 4, declararSize: 2 * byteRate });
  assert.equal(medirDuracaoWav(b), 2);
});

test("lixo não vira duração", () => {
  assert.equal(medirDuracaoWav(Buffer.alloc(10)), 0);
  assert.equal(medirDuracaoWav(Buffer.from("não sou um wav de jeito nenhum aaaaaaaaaaaaaaaaaaaaaa")), 0);
});

/* ──────────────────── espelho do config.ts (anti-defasagem) ────────────── */

test("TIERS espelha o config.ts do app (se divergir, a fumaça testa outro produto)", () => {
  const ts = fs.readFileSync(CONFIG_TS, "utf8");
  for (const [id, tier] of Object.entries(TIERS)) {
    // Recorta o bloco do tier no arquivo TS e confere campo a campo.
    const bloco = ts.slice(ts.indexOf(`id: "${id}"`));
    assert.ok(bloco.length > 0, `tier ${id} sumiu do config.ts`);
    const trecho = bloco.slice(0, bloco.indexOf("},"));
    const num = (campo) => {
      const m = trecho.match(new RegExp(`${campo}:\\s*(\\d+)`));
      assert.ok(m, `campo ${campo} não achado no tier ${id} do config.ts`);
      return Number(m[1]);
    };
    assert.equal(num("creditsPerSecond"), tier.creditsPerSecond, `${id}: créditos/s defasado`);
    assert.equal(num("width"), tier.width, `${id}: width defasada`);
    assert.equal(num("height"), tier.height, `${id}: height defasada`);
    const flow = trecho.match(/flow:\s*"(\w+)"/);
    assert.equal(flow && flow[1], tier.flow, `${id}: flow defasado`);
  }
});

test("não inventamos tier que o app não tem", () => {
  const ts = fs.readFileSync(CONFIG_TS, "utf8");
  for (const id of Object.keys(TIERS)) assert.ok(ts.includes(`id: "${id}"`), `${id} não existe no app`);
  assert.equal(Number((fs.readFileSync(CONFIG_TS, "utf8").match(/CLONE_FPS = (\d+)/) || [])[1]), CLONE_FPS);
});

/* ───────────────────────────── custo e tetos ───────────────────────────── */

test("custo é o MESMO da rota (cloneCreditsCost) — impresso, nunca debitado", () => {
  assert.equal(creditosCusto(TIERS["480p-v3"], 6.71), 7 * 105); // 735
  assert.equal(creditosCusto(TIERS["480p-v2"], 6.71), 7 * 80); // 560
});

test("piso de 5s de cobrança vale igual ao app", () => {
  assert.equal(creditosCusto(TIERS["480p-v3"], 1), 5 * 105);
  assert.equal(creditosCusto(TIERS["480p-v3"], 0.2), 5 * 105);
});

test("execTimeout espelha cloneExecutionTimeoutMs (20min + 30s por segundo de áudio)", () => {
  assert.equal(execTimeoutMs(TIERS["480p-v3"], 6.71), (20 * 60 + 7 * 30) * 1000);
  assert.equal(execTimeoutMs(TIERS["480p-v2"], 6.71), (20 * 60 + 7 * 30) * 1000);
});

/* ─────────────────────────── montagem do workflow ──────────────────────── */

const ENTRADA = {
  imageUrl: "https://exemplo/foto.jpg?sig=1",
  audioUrl: "https://exemplo/audio.wav?sig=2",
  s3Key: "_casa/fumaca-video-clone/saida/x.mp4",
  duracaoSegundos: 6.71,
};

test("v3 injeta os mesmos nós que buildInfiniteTalkWorkflow", () => {
  const { workflow, numFrames } = montarWorkflow({ ...ENTRADA, tier: TIERS["480p-v3"] });
  assert.equal(numFrames, Math.floor(6.71) * 25 + 25, "fórmula do v3: floor(s)*25+25");
  assert.equal(workflow["133"].inputs.url, ENTRADA.imageUrl);
  assert.equal(workflow["125"].inputs.url, ENTRADA.audioUrl);
  assert.equal(workflow["900"].inputs.s3_key, ENTRADA.s3Key);
  assert.equal(workflow["194"].inputs.num_frames, numFrames);
});

test("o nó 194 (MultiTalkWav2VecEmbeds) está no caminho — é o que caiu em 05/09", () => {
  // Se este nó sumir do template, a fumaça deixa de cobrir a panne que a
  // originou e vira teatro. O teste existe pra isso ser barulhento.
  const { workflow } = montarWorkflow({ ...ENTRADA, tier: TIERS["480p-v3"] });
  assert.equal(workflow["194"].class_type, "MultiTalkWav2VecEmbeds");
});

test("v2 injeta resolução e seed FIXA (fumaça é medição, não sorteio)", () => {
  const { workflow, numFrames } = montarWorkflow({ ...ENTRADA, tier: TIERS["480p-v2"] });
  assert.equal(numFrames, Math.max(50, Math.ceil(6.71 * 25) + 25));
  assert.equal(workflow["171"].inputs.width, 480);
  assert.equal(workflow["171"].inputs.height, 832);
  assert.equal(workflow["128"].inputs.seed, 20260905);
  const outra = montarWorkflow({ ...ENTRADA, tier: TIERS["480p-v2"] });
  assert.equal(outra.workflow["128"].inputs.seed, workflow["128"].inputs.seed, "seed não pode variar entre execuções");
});

test("montar duas vezes não contamina o template em memória", () => {
  const a = montarWorkflow({ ...ENTRADA, tier: TIERS["480p-v3"] });
  const b = montarWorkflow({ ...ENTRADA, imageUrl: "https://outra/foto.jpg", tier: TIERS["480p-v3"] });
  assert.equal(a.workflow["133"].inputs.url, ENTRADA.imageUrl, "a 2ª montagem vazou pra 1ª");
  assert.equal(b.workflow["133"].inputs.url, "https://outra/foto.jpg");
});

test("a saída NUNCA cai sob prefixo de aluno", () => {
  // O s3Key é montado no main, mas o contrato vale aqui: qualquer chave que a
  // fumaça escreva tem que morar em _casa/. Se alguém trocar por
  // `${user_id}/...` isso polui o histórico — o que o requisito 6 proíbe.
  const { workflow } = montarWorkflow({ ...ENTRADA, tier: TIERS["480p-v3"] });
  assert.ok(workflow["900"].inputs.s3_key.startsWith("_casa/"), "saída de fumaça fora de _casa/");
});
