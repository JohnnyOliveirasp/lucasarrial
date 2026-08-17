// VoxBR LIMPEZA (11/08) — pod descartável p/ cortar caudas de silêncio do
// dataset_v1 (a causa nº1 do "geração não para" segundo a doc oficial do
// VoxCPM; nosso fabrica.py cortava pelo timestamp da LEGENDA, sem olhar onde
// a fala termina). CPU basta: é decode/encode de FLAC, sem GPU.
// Uso: node _pod_cpu.cjs create | status <podId> | terminate <podId>
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
  const common = {
    name: "voxbr-limpeza",
    cloudType: "SECURE",
    containerDiskInGb: 150, // 1 tar por worker por vez (~0,5GB cada): 150GB sobra; limite CPU é 160
    ports: ["22/tcp"],
    supportPublicIp: true,
    env: { PUBLIC_KEY: pub },
  };
  // 1ª escolha: instância CPU (ordens de grandeza mais barata que GPU)
  try {
    return await api("POST", "/pods", {
      ...common,
      computeType: "CPU",
      // cpu5c = compute-optimized atual; cpu3c = geração anterior (fallback)
      cpuFlavorIds: ["cpu5c", "cpu3c"],
      vcpuCount: 16,
      imageName: "runpod/base:0.6.2-cpu",
    });
  } catch (e) {
    console.log("CPU recusou (" + e.message.slice(0, 160) + ") — caindo pra GPU barata");
    return await api("POST", "/pods", {
      ...common,
      imageName: "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
      gpuTypeIds: ["NVIDIA GeForce RTX 4090", "NVIDIA RTX 4000 Ada Generation", "NVIDIA RTX A4000", "NVIDIA L4"],
      gpuCount: 1,
    });
  }
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
        console.log(JSON.stringify({ id: pod.id, ip: st.publicIp, sshPort: ssh, costPerHr: st.costPerHr, machine: st.machine?.gpuTypeId || "cpu" }, null, 2));
        return;
      }
    }
    console.log("  sem IP após 4min — terminando e recriando...");
    await api("DELETE", `/pods/${pod.id}`);
    await sleep(5000);
  }
  throw new Error("6 tentativas sem IP público");
}

async function status(id) {
  const pod = await api("GET", `/pods/${id}`);
  console.log(JSON.stringify({ id: pod.id, desiredStatus: pod.desiredStatus, publicIp: pod.publicIp, portMappings: pod.portMappings, costPerHr: pod.costPerHr }, null, 2));
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
