// Recicla os workers de VOZ (A, B e treino) para o RunPod subir container
// LIMPO. Motivo (10/08): o disco efêmero de 50GB dos workers quentes encheu
// com cache do torch.compile em /tmp/torchinductor_root + temporários que o
// handler nunca apaga — 3 alunos falharam em 1h15 com "[Errno 28] No space
// left on device". Reciclar é o alívio imediato; o fix definitivo (cache dir
// próprio + purge por job) é outro commit.
//
// Seguro: só recicla endpoint OCIOSO (sem job rodando/na fila) e RESTAURA o
// workersMax original (valor fixo antigo rebaixaria a produção).
const fs = require("fs");
function loadEnv(){const raw=fs.readFileSync(".env.local","utf8");for(const l of raw.split(/\r?\n/)){const m=l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);if(!m||process.env[m[1]]!==undefined)continue;let v=m[2].trim();if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'")))v=v.slice(1,-1);process.env[m[1]]=v;}}
const req=(n)=>{const v=process.env[n];if(!v)throw new Error(`Missing ${n}`);return v;};
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

const REST = "https://rest.runpod.io/v1";

async function api(path, init) {
  const res = await fetch(`${REST}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${req("RUNPOD_API_KEY")}`, "Content-Type": "application/json", ...(init?.headers||{}) },
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${txt.slice(0,200)}`);
  return txt ? JSON.parse(txt) : {};
}

async function health(id) {
  const r = await fetch(`https://api.runpod.ai/v2/${id}/health`, { headers: { Authorization: `Bearer ${req("RUNPOD_API_KEY")}` } });
  return r.json();
}

(async () => {
  loadEnv();
  const alvos = [
    ["VOX A (geração)", process.env.RUNPOD_ENDPOINT_INFERENCE_ID],
    ["VOX B (geração)", process.env.RUNPOD_ENDPOINT_INFERENCE_B_ID],
    ["TREINO", process.env.RUNPOD_ENDPOINT_TRAIN_ID],
  ].filter(([, id]) => id);

  for (const [nome, id] of alvos) {
    const h = await health(id);
    const busy = (h.jobs?.inProgress || 0) + (h.jobs?.inQueue || 0);
    const w = h.workers || {};
    console.log(`\n=== ${nome} (${id}) ===`);
    console.log(`   workers: ready=${w.ready||0} running=${w.running||0} idle=${w.idle||0} throttled=${w.throttled||0}`);
    console.log(`   jobs: rodando=${h.jobs?.inProgress||0} fila=${h.jobs?.inQueue||0}`);

    if (busy > 0) { console.log(`   ⏭️  OCUPADO (${busy} job) — NÃO reciclo agora`); continue; }

    const ep = await api(`/endpoints/${id}`);
    const maxOriginal = ep.workersMax;
    console.log(`   workersMax atual: ${maxOriginal} → derrubando para 0…`);
    await api(`/endpoints/${id}`, { method: "PATCH", body: JSON.stringify({ workersMax: 0 }) });
    await sleep(20000);
    await api(`/endpoints/${id}`, { method: "PATCH", body: JSON.stringify({ workersMax: maxOriginal }) });
    console.log(`   ✅ reciclado e restaurado para ${maxOriginal} (próximo job sobe container limpo)`);
  }
  console.log("\nPronto.");
})().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
