// Lança o pipeline TAGARELA 1.500h num pod CPU: instala deps, manda o script
// e as credenciais (via stdin, nunca em argv/log) e roda com NOHUP no pod —
// sobrevive à sessão local. No FIM (sucesso OU falha) o pod sobe o log pro R2
// e SE AUTO-DESTRÓI (lição 11/08: vigia local morreu e H100 ficou ligada).
//
// Uso: node lancar_1500h.cjs <podIp> <podPort>
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
loadEnvFile(path.join(__dirname, ".r2env"));
loadEnvFile(path.join(__dirname, "..", "..", "frontend", ".env.local"));

const [ip, port, podId] = process.argv.slice(2);
if (!ip || !port || !podId) { console.error("uso: node lancar_1500h.cjs <podIp> <podPort> <podId>"); process.exit(1); }

const script = fs.readFileSync(path.join(__dirname, "tagarela_1500h_pod.py"), "utf8");

const prelude = [
  "mkdir -p /data",
  "cat > /data/creds.env <<'EOF_CREDS'",
  `export R2_ENDPOINT='${process.env.R2_ENDPOINT}'`,
  `export R2_ACCESS_KEY_ID='${process.env.R2_ACCESS_KEY_ID}'`,
  `export R2_SECRET_ACCESS_KEY='${process.env.R2_SECRET_ACCESS_KEY}'`,
  `export RUNPOD_API_KEY='${process.env.RUNPOD_API_KEY}'`,
  // o RUNPOD_POD_ID não chega no ambiente do sshd — vai explícito (11/08)
  `export RUNPOD_POD_ID='${podId}'`,
  "EOF_CREDS",
  "chmod 600 /data/creds.env",
].join("\n") + "\n";

const remoto = `
set -euo pipefail
python3 -m pip -q install boto3 numpy pyarrow soundfile

# Retomada (11/08): pod novo puxa do R2 o estado da pausa limpa (170,9h já
# processadas) — sem isso o script recomeçaria do zero e duplicaria tars.
# Idempotente: se /data/estado.json já existe (relanço no mesmo pod), mantém.
source /data/creds.env
mkdir -p /data/tag1500
python3 - <<'EOF_RESTORE'
import os
from pathlib import Path
import boto3
s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"])
B, P = "voices-clone-ai-verse", "voxbr/dataset_tagarela_1500h"
for chave, destino in ((P + "/_estado_retomada.json", "/data/estado.json"),
                       (P + "/_train_parcial.jsonl", "/data/tag1500/train.jsonl")):
    if Path(destino).exists():
        print(destino + ": ja existe, mantendo")
        continue
    try:
        s3.download_file(B, chave, destino)
        print(destino + ": restaurado do R2")
    except Exception as e:
        print(chave + ": nao achou no R2 (" + str(e) + ") — comecando do zero")
EOF_RESTORE

cat > /data/tagarela_1500h_pod.py <<'EOF_PY'
${script}
EOF_PY

cat > /data/rodar.sh <<'EOF_SH'
#!/bin/bash
source /data/creds.env
python3 /data/tagarela_1500h_pod.py >> /data/tag1500.log 2>&1
RC=$?
# log pro R2 (prova do que aconteceu, mesmo com o pod morto)
python3 - <<PYUP
import boto3, os
s3 = boto3.client("s3", endpoint_url=os.environ["R2_ENDPOINT"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"])
s3.upload_file("/data/tag1500.log", "voices-clone-ai-verse", "voxbr/dataset_tagarela_1500h/_tag1500.log")
PYUP
# AUTO-DESTRUIÇÃO SÓ EM SUCESSO (11/08: pkill num relanço matou o python,
# o RC!=0 disparou a destruição no meio da manobra e levou o pod junto).
# Falha/kill = pod fica de pé pro diagnóstico; a vigia da sessão termina ele.
if [ $RC -eq 0 ]; then
  curl -s -X DELETE -H "Authorization: Bearer $RUNPOD_API_KEY" \
    "https://rest.runpod.io/v1/pods/$RUNPOD_POD_ID" || true
fi
EOF_SH
chmod +x /data/rodar.sh
nohup /data/rodar.sh > /data/nohup.out 2>&1 &
echo "LANCADO pid=$!"
`;

const r = spawnSync("ssh", [
  "-i", path.join(os.homedir(), ".ssh", "runpod_temp"),
  "-p", String(port),
  "-o", "StrictHostKeyChecking=no",
  "-o", "ConnectTimeout=20",
  `root@${ip}`,
  "bash -s",
], { input: prelude + remoto, encoding: "utf8", stdio: ["pipe", "inherit", "inherit"], timeout: 10 * 60 * 1000 });
process.exit(r.status ?? 1);
