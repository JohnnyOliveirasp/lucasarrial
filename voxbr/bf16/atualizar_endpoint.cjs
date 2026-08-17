// VoxBR (11/08) — aponta o endpoint candidato fast_cloner_vox_br pra imagem
// nova e recicla os workers. Template acoplado a endpoint dá 404 no REST —
// GraphQL saveTemplate é o único caminho (mesma lição do runpod-worker.yml).
//
// Uso: node atualizar_endpoint.cjs <tagDaImagem>
//   ex: node atualizar_endpoint.cjs 6a21302deadbeef...  (sha completo do build)
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const p = path.join(__dirname, "..", "..", "frontend", ".env.local");
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[m[1]] = v;
  }
}
loadEnv();

const ENDPOINT_ID = "fnfk3ffl9jqvow";
const TEMPLATE_ID = "gfa2maepdz";
const IMAGE_BASE = "ghcr.io/johnnyoliveirasp/lucasarrial-runpod-voxbr";

const tag = process.argv[2];
if (!tag) { console.error("uso: node atualizar_endpoint.cjs <tag>"); process.exit(1); }
const IMAGE = `${IMAGE_BASE}:${tag}`;

const GQL = `https://api.runpod.io/graphql?api_key=${process.env.RUNPOD_API_KEY}`;
async function gql(query, variables) {
  const r = await fetch(GQL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 500));
  return j.data;
}
async function rest(method, p, body) {
  const r = await fetch(`https://rest.runpod.io/v1${p}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.RUNPOD_API_KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status}: ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  // 1) lê o template atual (pra copiar os campos obrigatórios do save)
  const d = await gql(`query { myself { podTemplates { id name imageName containerDiskInGb
    dockerArgs env { key value } volumeInGb volumeMountPath ports readme } } }`);
  const tpl = d.myself.podTemplates.find((t) => t.id === TEMPLATE_ID);
  if (!tpl) throw new Error(`template ${TEMPLATE_ID} não encontrado`);
  console.log(`template ${tpl.id} (${tpl.name}) — imagem atual: ${tpl.imageName}`);

  // 2) saveTemplate com a imagem nova (⚠️ env vai junto — o path do modelo
  //    mora no ENV do Dockerfile, então env vazio aqui é o esperado)
  await gql(
    `mutation ($input: SaveTemplateInput!) { saveTemplate(input: $input) { id imageName } }`,
    { input: {
      id: tpl.id,
      name: tpl.name,
      imageName: IMAGE,
      containerDiskInGb: tpl.containerDiskInGb,
      dockerArgs: tpl.dockerArgs ?? "",
      env: (tpl.env ?? []).map(({ key, value }) => ({ key, value })),
      volumeInGb: tpl.volumeInGb ?? 0,
      ...(tpl.volumeMountPath ? { volumeMountPath: tpl.volumeMountPath } : {}),
      ...(tpl.ports ? { ports: tpl.ports } : {}),
      readme: tpl.readme ?? "",
      isServerless: true,
    } },
  );
  console.log(`template atualizado → ${IMAGE}`);

  // 3) recicla + liga 1 worker pro teste (endpoint estava 0/0)
  const ep = await rest("GET", `/endpoints/${ENDPOINT_ID}`);
  console.log(`endpoint ${ep.name}: workersMax ${ep.workersMax} → 0 → 1`);
  await rest("PATCH", `/endpoints/${ENDPOINT_ID}`, { workersMax: 0 });
  await sleep(15_000);
  await rest("PATCH", `/endpoints/${ENDPOINT_ID}`, { workersMax: 1 });
  console.log("endpoint pronto pro teste (workersMax=1). Lembrar de voltar a 0 depois!");
})();
