/**
 * Entrega material que JÁ ESTÁ NA NOSSA MÃO pelo caminho REAL do onboarding.
 *
 * Para quê: quando o downloader automático não consegue pegar o link do aluno
 * (incidente 144 — OneDrive migrado pro SharePoint devolve 401 na API legada
 * que o `lib/onboarding/links.ts` chama), mas uma PESSOA consegue baixar os
 * arquivos no navegador. Sem isto, o material fica num /tmp e o cadastro do
 * aluno nunca anda — foi o que segurou a Luziélia por ~11h depois de ela já
 * ter compartilhado tudo (chamado 140, 5 idas e vindas, ameaça de cancelar).
 *
 * COMO funciona, e por que assim:
 *   1. Empacota os arquivos locais num .zip.
 *   2. Sobe o zip pro R2 e gera uma URL presignada terminada em `.zip`.
 *   3. POSTa o webhook REAL de produção (`/api/v1/onboarding/import`) com
 *      `audios_link` / `images_link` apontando pra essa URL.
 *
 * Ou seja: NÃO existe caminho novo de import aqui. `classificarLink` lê a URL
 * como "direto", `abrirLink` baixa e descompacta, e daí em diante roda o MESMO
 * código de produção — mesma idempotência (chave R2 por fileId), mesmas réguas
 * (20min brutos, 10min de fala), mesmos avisos ao aluno, mesmo débito. A única
 * coisa que este script substitui é o DOWNLOAD, que é justamente a peça
 * quebrada.
 *
 * ⚠️ POR QUE NÃO RODAR O IMPORT LOCALMENTE (medido em 26/08, não repita):
 * `dispararTreinoOnboarding` manda pro RunPod o webhook de callback vindo de
 * `webhookUrlFor()`, que lê `NEXT_PUBLIC_SITE_URL`. No `.env.local` desta
 * máquina isso é `http://localhost:3000`. Rodar o import daqui debitaria os
 * 10.000 créditos, dispararia a GPU e deixaria a voz presa em `training` PRA
 * SEMPRE, porque o RunPod nunca conseguiria devolver o resultado. Tem que ser
 * o servidor de produção a disparar.
 *
 * ⚠️ COBRA o aluno e GASTA GPU (treino 10.000 cr + avatares 525 cr cada), como
 * qualquer linha da planilha. Só rode quando o aluno PEDIU o material dele
 * processado. Sem `--confirmar`, ensaia: monta tudo, confere a URL de verdade
 * e mostra o payload, mas NÃO posta.
 *
 * Uso:
 *   node entregar_material_pela_planilha.cjs --email a@b.com \
 *        [--audios <dir|zip>] [--imagens <dir|zip>] [--row N] [--confirmar]
 */
const path = require("node:path");
const fs = require("node:fs");
const { execFileSync } = require("node:child_process");
const { randomUUID, createHash } = require("node:crypto");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});
const s3 = require(path.join(RAIZ, "frontend", "node_modules", "@aws-sdk", "client-s3"));
const presigner = require(path.join(RAIZ, "frontend", "node_modules", "@aws-sdk", "s3-request-presigner"));

const PROD = "https://fastcloner.com";
const TTL_SEGUNDOS = 2 * 60 * 60;
/** Mesma regex do classificarLink (links.ts:61) — se não casar, vira "nao_suportado". */
const RX_DIRETO = /^https?:\/\/\S+\.(zip|jpe?g|png|webp|heic|mp3|wav|m4a|aac|ogg|flac|mp4|mov)(\?|$)/i;
/** Teto do route.ts (MAX_LINK_BYTES). */
const MAX_LINK_BYTES = 2 * 1024 * 1024 * 1024;

function arg(nome, obrigatorio = false) {
  const i = process.argv.indexOf(`--${nome}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  if (obrigatorio && !v) throw new Error(`falta --${nome}`);
  return v;
}

function r2() {
  return new s3.S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

/**
 * Devolve o caminho de um .zip com o conteúdo de `origem`.
 * Diretório → zipa ACHATADO (`-j`): o unzip do servidor recursa em subpasta
 * (links.ts:219), mas achatar evita nome de pasta com acento no meio do
 * caminho. Arquivo .zip → usa como está.
 */
function comoZip(origem, rotulo) {
  const st = fs.statSync(origem);
  if (st.isFile()) {
    if (path.extname(origem).toLowerCase() !== ".zip") throw new Error(`${rotulo}: arquivo solto precisa ser .zip`);
    return origem;
  }
  const destino = path.join("/tmp", `entrega_${rotulo}_${randomUUID().slice(0, 8)}.zip`);
  const arquivos = [];
  (function anda(dir) {
    for (const n of fs.readdirSync(dir)) {
      if (n.startsWith(".") || n === "__MACOSX") continue;
      const p = path.join(dir, n);
      fs.statSync(p).isDirectory() ? anda(p) : arquivos.push(p);
    }
  })(origem);
  if (arquivos.length === 0) throw new Error(`${rotulo}: nenhum arquivo em ${origem}`);
  execFileSync("zip", ["-j", "-q", destino, ...arquivos]);
  return destino;
}

/** Sobe o zip e devolve a URL presignada, JÁ CONFERIDA contra o servidor. */
async function publicar(zipPath, rotulo) {
  const bucket = process.env.R2_BUCKET_GENERATIONS;
  if (!bucket) throw new Error("R2_BUCKET_GENERATIONS ausente");
  const bytes = fs.readFileSync(zipPath);
  if (bytes.length > MAX_LINK_BYTES) throw new Error(`${rotulo}: ${bytes.length} bytes passa do teto do webhook`);
  // Nome do objeto termina em .zip de propósito: o servidor decide a extensão
  // por `extname(url.split("?")[0])` (links.ts) pra saber que tem que descompactar.
  const key = `_entrega_suporte/${createHash("sha1").update(bytes).digest("hex").slice(0, 12)}_${rotulo}.zip`;
  const cli = r2();
  await cli.send(new s3.PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: "application/zip" }));

  const url = await presigner.getSignedUrl(
    cli,
    new s3.GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: TTL_SEGUNDOS },
  );

  // CONFERÊNCIA, não fé: o servidor tem que ver um zip de verdade nesta URL.
  if (!RX_DIRETO.test(url)) throw new Error(`${rotulo}: a URL não casa com classificarLink — viraria "nao_suportado"`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${rotulo}: a URL presignada respondeu ${r.status}`);
  const baixado = Buffer.from(await r.arrayBuffer());
  if (baixado.length !== bytes.length) throw new Error(`${rotulo}: baixou ${baixado.length} de ${bytes.length} bytes`);
  // PK\x03\x04 — o mesmo `ehZipDeArquivos` que o servidor usa olha estes bytes.
  if (baixado.subarray(0, 4).toString("hex") !== "504b0304") throw new Error(`${rotulo}: o que baixou não é zip`);

  return { url, key, bucket, bytes: bytes.length, arquivos: execFileSync("unzip", ["-l", zipPath]).toString() };
}

(async () => {
  const email = arg("email", true).trim().toLowerCase();
  const audios = arg("audios");
  const imagens = arg("imagens");
  const row = arg("row");
  const confirmar = process.argv.includes("--confirmar");
  if (!audios && !imagens) throw new Error("informe --audios e/ou --imagens");

  const segredo = process.env.ONBOARDING_WEBHOOK_SECRET;
  if (!segredo) throw new Error("ONBOARDING_WEBHOOK_SECRET ausente");

  const payload = {
    email,
    // A conta JÁ EXISTE nos casos deste script; `ensureUser` acha o profile
    // pelo e-mail e devolve antes de olhar a senha (route.ts). Este valor
    // nunca é usado — mas a validação exige 6+ chars.
    password: randomUUID(),
  };
  if (row) payload.row = Number(row);

  const publicados = [];
  for (const [rotulo, origem, campo] of [
    ["audios", audios, "audios_link"],
    ["imagens", imagens, "images_link"],
  ]) {
    if (!origem) continue;
    const zip = comoZip(origem, rotulo);
    const p = await publicar(zip, rotulo);
    payload[campo] = p.url;
    publicados.push({ rotulo, ...p });
  }

  console.log(`\n=== MATERIAL PUBLICADO (conferido baixando de volta) ===`);
  for (const p of publicados) {
    console.log(`\n[${p.rotulo}] ${p.bytes} bytes → ${p.bucket}/${p.key}`);
    console.log(p.arquivos.trim());
  }
  console.log(`\n=== PAYLOAD PRO WEBHOOK ${PROD}/api/v1/onboarding/import ===`);
  console.log(JSON.stringify({ ...payload, password: "<descartado>", audios_link: payload.audios_link ? "<presignada .zip>" : undefined, images_link: payload.images_link ? "<presignada .zip>" : undefined }, null, 2));

  if (!confirmar) {
    console.log(`\n🧪 ENSAIO — nada foi postado. Rode com --confirmar pra valer.`);
    console.log(`   ⚠️ Ao confirmar: COBRA o aluno (treino 10.000cr, avatar 525cr cada) e DISPARA GPU.`);
    return;
  }

  console.log(`\n🚀 POSTANDO no webhook de produção…`);
  const t0 = Date.now();
  const res = await fetch(`${PROD}/api/v1/onboarding/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Onboarding-Secret": segredo },
    body: JSON.stringify(payload),
  });
  const txt = await res.text();
  console.log(`HTTP ${res.status} em ${Math.round((Date.now() - t0) / 1000)}s`);
  console.log(txt);
  if (!res.ok) process.exitCode = 1;
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
