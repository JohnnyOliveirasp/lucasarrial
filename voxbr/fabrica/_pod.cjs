// VoxBR FÁBRICA (09/08) — pod com GPU barata + volume de rede montado em
// /workspace. GPU só faz identificação de idioma (leve); gargalo é rede/CPU,
// então 1 GPU basta (mais não acelera — ver PLANO.md).
// Uso: node _pod.cjs create [volumeId] | status <id> | terminate <id>
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
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function create(volumeId) {
  const pub = fs.readFileSync(path.join(os.homedir(), ".ssh", "runpod_temp.pub"), "utf8").trim();
  for (let tentativa = 1; tentativa <= 6; tentativa++) {
    const pod = await api("POST", "/pods", {
      name: "voxbr-fabrica",
      imageName: "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
      // Barata: o trabalho de GPU é só o ID de idioma. Ordem de preferência
      // por custo; qualquer uma serve.
      gpuTypeIds: ["NVIDIA RTX A5000", "NVIDIA A40", "NVIDIA RTX A4000", "NVIDIA RTX A6000", "NVIDIA L40S", "NVIDIA GeForce RTX 4090", "NVIDIA L4", "NVIDIA A100 80GB PCIe", "NVIDIA A100-SXM4-80GB", "NVIDIA H100 PCIe", "NVIDIA H100 80GB HBM3"],
      gpuCount: 1,
      cloudType: "SECURE",
      // sem volume: qualquer regiao serve (dataset vai pro R2)
      containerDiskInGb: 250,
      networkVolumeId: volumeId || undefined,
      ports: ["22/tcp"],
      supportPublicIp: true,
      env: { PUBLIC_KEY: pub },
    });
    console.log(`tentativa ${tentativa}: pod ${pod.id} — esperando IP público...`);
    for (let i = 0; i < 24; i++) {
      await sleep(10_000);
      const st = await api("GET", `/pods/${pod.id}`);
      const ssh = (st.portMappings || {})["22"];
      if (st.publicIp && ssh) {
        console.log(JSON.stringify({ id: pod.id, ip: st.publicIp, sshPort: ssh, gpu: st.machine?.gpuTypeId, costPerHr: st.costPerHr }, null, 2));
        return;
      }
    }
    console.log("  sem IP em 4min — recriando...");
    await api("DELETE", `/pods/${pod.id}`);
    await sleep(5000);
  }
  throw new Error("6 tentativas sem IP público");
}

(async () => {
  loadEnv();
  const [cmd, arg] = process.argv.slice(2);
  if (cmd === "create") return create(arg);
  if (cmd === "status" && arg) {
    const p = await api("GET", `/pods/${arg}`);
    return console.log(JSON.stringify({ id: p.id, status: p.desiredStatus, ip: p.publicIp, ports: p.portMappings, costPerHr: p.costPerHr, gpu: p.machine?.gpuTypeId }, null, 2));
  }
  if (cmd === "terminate" && arg) { await api("DELETE", `/pods/${arg}`); return console.log(`pod ${arg} terminado.`); }
  console.log("uso: create [volumeId] | status <podId> | terminate <podId>");
  process.exit(1);
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
