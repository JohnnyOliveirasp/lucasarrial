// VoxBR SMOKE (08/08) — pod descartável p/ 1º fine-tune pt-BR do VoxCPM2.
// Sem network volume (dado pequeno; tudo morre com o pod — resultados são
// baixados via scp antes do terminate). Padrão copiado de _longcat_pod.cjs.
// Uso: node _pod.cjs create | status <podId> | terminate <podId>
const fs = require("fs");
const os = require("os");
const path = require("path");
function loadEnv(){const p=path.join(__dirname,"..","..","frontend",".env.local");const raw=fs.readFileSync(p,"utf8");for(const l of raw.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m||process.env[m[1]]!==undefined)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]=v;}}

const BASE = "https://rest.runpod.io/v1";
async function api(method, p, body) {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createOnce() {
  const pub = fs.readFileSync(path.join(os.homedir(), ".ssh", "runpod_temp.pub"), "utf8").trim();
  return api("POST", "/pods", {
    name: "voxbr-treino",
    imageName: "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
    // ⚠️ MEDIDO 11/08: L40S 46GB NÃO serve pro full FT do 2B — OOM até com
    // batch_size 1 (o AdamW sozinho pesa ~18GB). SÓ placas de 80GB.
    gpuTypeIds: ["NVIDIA A100 80GB PCIe", "NVIDIA A100-SXM4-80GB", "NVIDIA H100 PCIe", "NVIDIA H100 80GB HBM3"],
    gpuCount: 1,
    cloudType: "SECURE",
    containerDiskInGb: 300,
    ports: ["22/tcp"],
    supportPublicIp: true,
    env: { PUBLIC_KEY: pub },
  });
}

async function create() {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const pod = await createOnce();
    console.log(`tentativa ${attempt}: pod ${pod.id} criado — esperando IP público...`);
    for (let i = 0; i < 24; i++) {
      await sleep(10_000);
      const st = await api("GET", `/pods/${pod.id}`);
      const ssh = (st.portMappings || {})["22"];
      if (st.publicIp && ssh) {
        console.log(JSON.stringify({ id: pod.id, ip: st.publicIp, sshPort: ssh, gpu: st.machine?.gpuTypeId, costPerHr: st.costPerHr }, null, 2));
        return;
      }
    }
    console.log("  sem IP após 4min — terminando e recriando...");
    await api("DELETE", `/pods/${pod.id}`);
    await sleep(5000);
  }
  throw new Error("6 tentativas sem IP público — tentar outro horário");
}

async function status(id) {
  const pod = await api("GET", `/pods/${id}`);
  console.log(JSON.stringify({ id: pod.id, desiredStatus: pod.desiredStatus, publicIp: pod.publicIp, portMappings: pod.portMappings, costPerHr: pod.costPerHr, gpu: pod.machine?.gpuTypeId }, null, 2));
}

async function terminate(id) {
  await api("DELETE", `/pods/${id}`);
  console.log(`pod ${id} terminado.`);
}

(async () => {
  loadEnv();
  const [cmd, id] = process.argv.slice(2);
  if (cmd === "create") return create();
  if (cmd === "status" && id) return status(id);
  if (cmd === "terminate" && id) return terminate(id);
  console.log("uso: create | status <podId> | terminate <podId>");
  process.exit(1);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
