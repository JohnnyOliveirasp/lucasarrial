// VoxBR TREINO TAGARELA (13/08) — caçador de A100 80GB.
// Ordem do Johnny: H100 a US$3,29/h é caro demais — SÓ A100 80GB (~US$1,59/h);
// se não tiver disponível, ESPERA ter. Loop infinito: tenta criar, sem vaga
// dorme 3min e tenta de novo. Quando conseguir IP, imprime POD_PRONTO e sai.
// Baseado em smoke/_pod.cjs (create).
const fs = require("fs");
const os = require("os");
const path = require("path");
function loadEnv() {
  const p = path.join(__dirname, "..", "..", "frontend", ".env.local");
  const raw = fs.readFileSync(p, "utf8");
  for (const l of raw.split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
const BASE = "https://rest.runpod.io/v1";
async function api(method, p, body) {
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tentar() {
  const pub = fs.readFileSync(path.join(os.homedir(), ".ssh", "runpod_temp.pub"), "utf8").trim();
  const pod = await api("POST", "/pods", {
    name: "voxbr-treino-tagarela",
    imageName: "runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04",
    gpuTypeIds: ["NVIDIA A100-SXM4-80GB", "NVIDIA A100 80GB PCIe"], // SÓ A100 80GB
    gpuCount: 1,
    cloudType: "SECURE",
    containerDiskInGb: 300,
    ports: ["22/tcp"],
    supportPublicIp: true,
    env: { PUBLIC_KEY: pub },
  });
  for (let i = 0; i < 24; i++) {
    await sleep(10_000);
    const st = await api("GET", `/pods/${pod.id}`);
    const ssh = (st.portMappings || {})["22"];
    if (st.publicIp && ssh) {
      console.log(`POD_PRONTO ${JSON.stringify({ id: pod.id, ip: st.publicIp, sshPort: ssh, gpu: st.machine?.gpuTypeId, costPerHr: st.costPerHr })}`);
      return true;
    }
  }
  console.log(`pod ${pod.id} sem IP após 4min — terminando e tentando de novo`);
  await api("DELETE", `/pods/${pod.id}`);
  return false;
}

(async () => {
  loadEnv();
  for (let n = 1; ; n++) {
    try {
      if (await tentar()) return;
    } catch (e) {
      // "no instances available" e afins caem aqui — é o caso ESPERADO
      if (n % 10 === 1) console.log(`tentativa ${n}: ainda sem A100 80GB (${e.message.slice(0, 120)})`);
    }
    await sleep(180_000);
  }
})().catch((e) => { console.error("ERRO_FATAL:", e.message); process.exit(1); });
