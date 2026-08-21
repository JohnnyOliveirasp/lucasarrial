/**
 * Backfill do `voices.error_message` carimbado ANTES do fix da régua.
 *
 * POR QUE EXISTE (incidente 2c5bab42, medido em 21/08):
 * O `d12b008`/`ba0a30f` corrigiram a frase que o sistema ESCREVE de agora em
 * diante. Mas o painel do aluno lê `voices.error_message` do banco AO VIVO —
 * então quem já estava carimbado continua lendo a frase antiga, que manda
 * "grave mais áudio" quando a cura provada é "reenvie os mesmos arquivos".
 * Isso viola a regra dura 12 (dizer o que aconteceu de verdade, inclusive
 * quando a culpa é nossa) em cima de dado de produção.
 *
 * O QUE ELE FAZ: recalcula a mensagem com as MESMAS funções que a produção
 * usa hoje (importadas de `lib/voices/regua-audio.ts`, não reimplementadas) e
 * com o MESMO galho de decisão do `rescue-stuck-uploads.ts`:
 *     faltando > 0 ? mensagemEnvioIncompleto(...) : mensagemCurtoDemais(...)
 * A evidência vem do R2 (numeração do slot na chave), não de suposição.
 *
 * O QUE ELE NÃO FAZ: não toca em status, crédito, acesso, saldo, nem manda
 * e-mail. Não re-mede áudio (usa o `duration_seconds` já gravado). Não gasta
 * GPU. Só reescreve texto que a própria casa escreveu errado.
 *
 * SEGURANÇA (regra 9-A, aplicada por analogia):
 *  - ensaio seco por padrão, com os nomes na tela; só grava com `--confirmar`;
 *  - salva o valor ANTIGO de cada linha num JSON antes de gravar (reversível);
 *  - PULA qualquer linha que não consiga provar (sem duração, sem numeração
 *    legível, ou mensagem nova idêntica à antiga) — desconhecido não é escrito;
 *  - teto por rodada (`--teto N`, padrão 30): acima disso, para e reporta;
 *  - confere as linhas afetadas pelo `.select()` depois de gravar.
 *
 * USO:
 *   node _frank/ferramentas/backfill_mensagem_velha.mjs              # ensaio
 *   node _frank/ferramentas/backfill_mensagem_velha.mjs --confirmar
 *   node _frank/ferramentas/backfill_mensagem_velha.mjs --reverter <backup.json>
 */
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "..", "..");
const FRONT = path.join(RAIZ, "frontend");

// Mesma resolução de dependência do `_comum.cjs`: tudo sai do frontend/.
import { createRequire } from "node:module";
const require = createRequire(path.join(FRONT, "package.json"));

require("dotenv").config({ path: path.join(FRONT, ".env.local") });
const { createClient } = require("@supabase/supabase-js");
const s3 = require("@aws-sdk/client-s3");

// As funções REAIS da produção. Se a régua mudar, este script muda junto.
const regua = await import(path.join(FRONT, "src", "lib", "voices", "regua-audio.ts"));
const { contarSlotsDoEnvio, mensagemCurtoDemais, mensagemEnvioIncompleto, RX_EXT_AUDIO } = regua;

const MIN_BYTES = 10_000; // espelha rescue-stuck-uploads.ts:42

const args = process.argv.slice(2);
const CONFIRMAR = args.includes("--confirmar");
const REVERTER = args.includes("--reverter") ? args[args.indexOf("--reverter") + 1] : null;
const TETO = args.includes("--teto") ? Number(args[args.indexOf("--teto") + 1]) : 30;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const r2 = new s3.S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_VOICES;

/** A frase ANTIGA: cita a porta mas não traz nem o alvo nem a admissão de culpa. */
function ehMensagemVelha(msg) {
  if (!msg) return false;
  if (!/Áudio total\s+\d+min\s*<\s*mínimo de\s+\d+min/.test(msg)) return false;
  // As duas frases NOVAS têm marca própria; se tem, já foi corrigida.
  if (msg.includes("Faltam ~")) return false;
  if (msg.includes("Recebemos apenas")) return false;
  return true;
}

/** Espelha audiosNoR2() do rescue-stuck-uploads.ts. */
async function audiosNoR2(userId, voiceId) {
  const out = await r2.send(new s3.ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${userId}/${voiceId}/` }));
  const contents = out.Contents ?? [];
  return {
    utilizaveis: contents.filter((o) => (o.Size ?? 0) > MIN_BYTES && RX_EXT_AUDIO.test(o.Key ?? "")).map((o) => o.Key).sort(),
    todas: contents.map((o) => o.Key).sort(),
  };
}

async function paginar(tabela, colunas, aplicar = (q) => q) {
  const passo = 500;
  let de = 0;
  const acc = [];
  for (;;) {
    const { data, error } = await aplicar(sb.from(tabela).select(colunas)).range(de, de + passo - 1);
    if (error) { console.log(`ERRO_CRU (${tabela}):`, JSON.stringify(error)); throw new Error(error.message); }
    acc.push(...(data ?? []));
    if (!data || data.length < passo) break;
    de += passo;
  }
  return acc;
}

if (REVERTER) {
  const backup = JSON.parse(fs.readFileSync(REVERTER, "utf8"));
  console.log(`REVERTENDO ${backup.linhas.length} linha(s) do backup ${REVERTER}`);
  let ok = 0;
  for (const l of backup.linhas) {
    const { data, error } = await sb.from("voices").update({ error_message: l.antes }).eq("id", l.voice_id).select("id");
    console.log(`  ${l.voice_id} ${error ? "ERRO " + error.message : `linhas afetadas=${(data ?? []).length}`}`);
    if (!error && (data ?? []).length === 1) ok += 1;
  }
  console.log(`REVERTIDAS ${ok}/${backup.linhas.length}`);
  process.exit(0);
}

// ---------------------------------------------------------------- levantamento
const vozes = await paginar("voices", "id, user_id, status, error_message, duration_seconds, created_at, updated_at");
console.log(`Universo: ${vozes.length} vozes lidas (paginado, sem o teto de 1000).`);

const alvo = vozes.filter((v) => ehMensagemVelha(v.error_message));
console.log(`Com a frase ANTIGA gravada: ${alvo.length}\n`);

const perfis = await paginar("profiles", "id, email, access_until, credits_subscription, credits_extra");
const porId = new Map(perfis.map((p) => [p.id, p]));
const prontasPorUser = new Map();
for (const v of vozes) {
  if (v.status === "ready") prontasPorUser.set(v.user_id, (prontasPorUser.get(v.user_id) ?? 0) + 1);
}

const planos = [];
const pulados = [];

for (const v of alvo) {
  const dono = porId.get(v.user_id);
  const total = Number(v.duration_seconds ?? 0);
  let envio;
  try {
    const { utilizaveis, todas } = await audiosNoR2(v.user_id, v.id);
    envio = contarSlotsDoEnvio(utilizaveis, todas);
  } catch (e) {
    pulados.push({ v, dono, motivo: `R2 falhou: ${e.message}` });
    continue;
  }
  if (!total || total <= 0) { pulados.push({ v, dono, motivo: "sem duration_seconds gravado — não dá pra escrever número honesto" }); continue; }
  if (envio.esperados === 0) { pulados.push({ v, dono, motivo: "numeração de slot ilegível no R2 — sem evidência" }); continue; }

  const nova = envio.faltando > 0
    ? mensagemEnvioIncompleto(total, envio.chegaram, envio.esperados)
    : mensagemCurtoDemais(total);

  if (nova === v.error_message) { pulados.push({ v, dono, motivo: "mensagem nova idêntica à antiga" }); continue; }

  planos.push({ v, dono, envio, total, nova, classe: envio.faltando > 0 ? "PERDA_NOSSA" : "CURTO_DE_VERDADE" });
}

const fmt = (p) => `${p.dono?.email ?? "(sem perfil)"} · ${((p.dono?.credits_subscription ?? 0) + (p.dono?.credits_extra ?? 0)).toLocaleString("pt-BR")} cr · acesso ${p.dono?.access_until ?? "(nenhum)"} · ${prontasPorUser.get(p.v.user_id) ?? 0} voz(es) pronta(s)`;

console.log("=".repeat(100));
console.log(`PLANO: ${planos.length} linha(s) a reescrever · ${pulados.length} pulada(s)\n`);

for (const grupo of ["PERDA_NOSSA", "CURTO_DE_VERDADE"]) {
  const g = planos.filter((p) => p.classe === grupo);
  console.log(`\n### ${grupo} — ${g.length} linha(s)`);
  if (grupo === "PERDA_NOSSA") console.log("    (a frase antiga CULPA o aluno por arquivo que a casa perdeu)");
  else console.log("    (o diagnóstico antigo está certo; falta o alvo e o 'nada foi cobrado')");
  for (const p of g) {
    console.log(`\n  voz ${p.v.id.slice(0, 8)} [${p.v.status}] · ${fmt(p)}`);
    console.log(`    slots: chegaram ${p.envio.chegaram}/${p.envio.esperados} (faltam ${p.envio.faltando}, ${p.envio.ignorados} não-áudio ignorados) · ${(p.total / 60).toFixed(1)}min`);
    console.log(`    ANTES: ${p.v.error_message}`);
    console.log(`    DEPOIS: ${p.nova}`);
  }
}

if (pulados.length) {
  console.log(`\n\n### PULADAS (${pulados.length}) — desconhecido não se escreve`);
  for (const p of pulados) console.log(`  voz ${p.v.id.slice(0, 8)} [${p.v.status}] · ${p.dono?.email ?? "?"} · ${p.motivo}`);
}

if (planos.length > TETO) {
  console.log(`\n⛔ TETO: ${planos.length} > ${TETO}. Parando e reportando, sem gravar (regra 9-A).`);
  process.exit(1);
}

if (!CONFIRMAR) {
  console.log(`\n\n🔎 ENSAIO — nada foi gravado. Para executar: --confirmar`);
  process.exit(0);
}

// ---------------------------------------------------------------- execução
const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
const destino = path.join(RAIZ, "_Bugs", `backfill_mensagem_velha_${carimbo}.json`);
fs.mkdirSync(path.dirname(destino), { recursive: true });
fs.writeFileSync(destino, JSON.stringify({
  em: new Date().toISOString(),
  linhas: planos.map((p) => ({ voice_id: p.v.id, email: p.dono?.email, antes: p.v.error_message, depois: p.nova })),
}, null, 2));
console.log(`\nBackup do estado ANTERIOR: ${destino}`);

let gravadas = 0;
for (const p of planos) {
  const { data, error } = await sb.from("voices").update({ error_message: p.nova }).eq("id", p.v.id).select("id, error_message");
  const n = (data ?? []).length;
  if (error) { console.log(`  ✗ ${p.v.id.slice(0, 8)} ERRO: ${error.message}`); continue; }
  if (n !== 1) { console.log(`  ✗ ${p.v.id.slice(0, 8)} linhas afetadas=${n} (esperado 1) — NÃO conte como feito`); continue; }
  if (data[0].error_message !== p.nova) { console.log(`  ✗ ${p.v.id.slice(0, 8)} releitura não bate`); continue; }
  gravadas += 1;
  console.log(`  ✓ ${p.v.id.slice(0, 8)} ${p.dono?.email} — linhas afetadas=1, releitura confere`);
}
console.log(`\nGRAVADAS ${gravadas}/${planos.length}. Reverter: --reverter ${destino}`);
