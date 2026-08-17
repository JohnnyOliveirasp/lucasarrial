// VoxBR BF16 (11/08) — orquestra a conversão do checkpoint da VALIDAÇÃO
// (voxbr/ckpt_valida/latest, F32) para BF16 num pod CPU descartável, e sobe o
// resultado pro R2 em voxbr/ckpt_valida_bf16/ (prefixo que o workflow
// runpod-worker-voxbr.yml assa na imagem candidata).
//
// Uso: node preparar_bf16.cjs <podIp> <podPort>
//
// As credenciais R2 saem do frontend/.env.local e vão pro pod via STDIN do
// ssh (nunca em argv nem em log). O pod instala rclone + numpy/safetensors,
// baixa o model.safetensors (~9GB), converte, valida, sobe o BF16 (~4,6GB) e
// copia os 5 arquivos pequenos server-side (R2→R2, sem passar pelo pod).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function loadEnvFile(p) {
  const raw = fs.readFileSync(p, "utf8");
  for (const l of raw.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
// ⚠️ ORDEM IMPORTA: a key do frontend NÃO escreve no prefixo voxbr/ (403 no
// upload, 11/08). A credencial certa é a do .r2env (mesma do TAGARELA) —
// carrega ela PRIMEIRO, o .env.local só completa o que faltar (RUNPOD etc).
loadEnvFile(path.join(__dirname, "..", "tagarela", ".r2env"));
loadEnvFile(path.join(__dirname, "..", "..", "frontend", ".env.local"));

const [ip, port] = process.argv.slice(2);
if (!ip || !port) {
  console.error("uso: node preparar_bf16.cjs <podIp> <podPort>");
  process.exit(1);
}

const BUCKET = process.env.R2_BUCKET_VOICES || "voices-clone-ai-verse";
// Parametrizado em 15/08 pro checkpoint do TAGARELA (step_0047075, treino
// cheio). Sem argumento, segue valendo o da validação de 11/08.
//   node preparar_bf16.cjs <ip> <porta> [srcPrefix] [dstPrefix]
const SRC_PREFIX = process.argv[4] || "voxbr/ckpt_valida/latest";
const DST_PREFIX = process.argv[5] || "voxbr/ckpt_valida_bf16";
console.log(`origem: ${SRC_PREFIX}\ndestino: ${DST_PREFIX}`);

const sshBase = [
  "-i", path.join(os.homedir(), ".ssh", "runpod_temp"),
  "-p", String(port),
  "-o", "StrictHostKeyChecking=no",
  "-o", "ConnectTimeout=20",
  "-o", "ServerAliveInterval=30",
  `root@${ip}`,
];

function sshRun(script, stdinText) {
  const r = spawnSync("ssh", [...sshBase, "bash -s"], {
    input: (stdinText ?? "") + script,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    timeout: 55 * 60 * 1000,
  });
  if (r.status !== 0) throw new Error(`ssh saiu com ${r.status}`);
}

// 1) Credenciais via stdin (heredoc/export) — nunca tocam argv/log.
//    rclone só pro DOWNLOAD; o UPLOAD vai de boto3: o rclone no pod devolve
//    AccessDenied no multipart do R2 (11/08 — a MESMA key funciona via boto3
//    e via PUT local, então não é permissão).
const rcloneConf = [
  "mkdir -p /root/.config/rclone /work",
  "cat > /root/.config/rclone/rclone.conf <<'EOF_CONF'",
  "[r2]",
  "type = s3",
  "provider = Other",
  `access_key_id = ${process.env.R2_ACCESS_KEY_ID}`,
  `secret_access_key = ${process.env.R2_SECRET_ACCESS_KEY}`,
  `endpoint = ${process.env.R2_ENDPOINT}`,
  "EOF_CONF",
  `export AWS_ACCESS_KEY_ID='${process.env.R2_ACCESS_KEY_ID}'`,
  `export AWS_SECRET_ACCESS_KEY='${process.env.R2_SECRET_ACCESS_KEY}'`,
  `export R2_ENDPOINT='${process.env.R2_ENDPOINT}'`,
].join("\n") + "\n";

// 2) converter_bf16.py vai inteiro por heredoc também (sem scp: 1 conexão só).
const converter = fs.readFileSync(path.join(__dirname, "converter_bf16.py"), "utf8");

const script = `
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

command -v rclone >/dev/null || curl -fsSL https://rclone.org/install.sh | bash >/dev/null
python3 -m pip -q install numpy safetensors boto3

cat > /work/converter_bf16.py <<'EOF_PY'
${converter}
EOF_PY

if [ ! -f /work/bf16/model.safetensors ]; then
  echo "== baixando model.safetensors (~9GB) =="
  rclone copy --stats-one-line "r2:${BUCKET}/${SRC_PREFIX}/model.safetensors" /work/
  echo "== convertendo F32 -> BF16 =="
  SRC=/work/model.safetensors DST=/work/bf16/model.safetensors python3 /work/converter_bf16.py
else
  echo "== BF16 já convertido — indo direto pro upload =="
fi

echo "== subindo BF16 + copiando pequenos (boto3, igual ao TAGARELA) =="
python3 - <<'EOF_UP'
import os, boto3
from boto3.s3.transfer import TransferConfig
s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"])
B, SRC, DST = "${BUCKET}", "${SRC_PREFIX}", "${DST_PREFIX}"
cfg = TransferConfig(multipart_chunksize=64 * 1024 * 1024)
s3.upload_file("/work/bf16/model.safetensors", B, f"{DST}/model.safetensors", Config=cfg)
print("model.safetensors OK")
for f in ["audiovae.pth", "config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json"]:
    s3.copy({"Bucket": B, "Key": f"{SRC}/{f}"}, B, f"{DST}/{f}")
    print(f, "OK")
for o in s3.list_objects_v2(Bucket=B, Prefix=DST + "/")["Contents"]:
    print(o["Size"], o["Key"])
EOF_UP
echo "BF16_PRONTO"
`;

console.log(`pod ${ip}:${port} — convertendo ${SRC_PREFIX} -> ${DST_PREFIX}`);
sshRun(script, rcloneConf);
console.log("conversão concluída.");
