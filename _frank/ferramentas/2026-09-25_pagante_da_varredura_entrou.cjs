/**
 * O PAGANTE QUE A VARREDURA DO WEBHOOK ACUSOU — ELE ENTROU OU NÃO? (25/09/2026)
 *
 * ── POR QUE ESTA FERRAMENTA EXISTE ────────────────────────────────────────
 * `varrer_erros_webhook.cjs` (#324, 09/09) lê `payment_events.error` e lista
 * quem pagou e não recebeu acesso. Mas ela lista o ERRO DO DIA EM QUE
 * ACONTECEU — é um registro histórico, não o estado de hoje. Em 25/09 ela
 * acusava 10 pessoas nomeadas em 3 classes acionáveis, a mais velha de 22
 * dias, e NENHUMA delas tinha cartão na fila além das 3 do `#582`.
 *
 * Antes de tratar alguém como vítima, a regra 1 do manual manda conferir o
 * estado ATUAL: "já resolveu sozinho? é o caso mais comum". Uma carta de
 * desculpa pra quem já está usando o produto há duas semanas é pior que o
 * silêncio — e escriturar 10 vítimas sem conferir é inventar incidente.
 *
 * ⚠️ O QUE CONTA COMO "ENTROU", E POR QUE NÃO É `access_until`.
 * `access_until` vivo NÃO prova que a pessoa conseguiu entrar: o entitlement
 * é criado pelo webhook no ato do pagamento, então quem pagou e nunca
 * recebeu a senha TAMBÉM tem `access_until` no futuro. Foi assim que o
 * `prova_raio` produziu os 147 falsos de 18/08. A prova de que a porta
 * abriu é `auth.users.last_sign_in_at` — login de verdade, não direito a
 * login. `ja_pagou` não é usada aqui: medida em 25/08, é false pra 1.515 de
 * 1.515 perfis (ver README das ordens).
 *
 * Só LÊ. Não escreve, não manda e-mail, não estorna, não cria conta.
 *
 * Uso: node _frank/ferramentas/2026-09-25_pagante_da_varredura_entrou.cjs [--json]
 */
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const PROJECT = "yizerthyrgrajivlotcw";

async function consultar(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente em frontend/.env.local");
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Management API HTTP ${r.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

/**
 * Os nomes saem da saída de `varrer_erros_webhook.cjs --dias 30` rodada em
 * 25/09 22hZ. Ficam FIXOS de propósito: este script é a medição daquela
 * leitura, e precisa ser re-executável tal e qual pra conferência. Quem
 * rodar noutro dia deve regerar a lista a partir da varredura.
 */
const GRUPOS = {
  "SGP pagou e NAO recebeu o e-mail de senha": [
    ["jcesaram@gmail.com", "16d"],
    ["patricia.bp170@gmail.com", "16d"],
    ["marcio.laosa@trialseguros.com.br", "13d"],
    ["amanda.rosaleal@gmail.com", "12d"],
  ],
  "Compra orfa SEM canal de aviso": [
    ["scandovieri41@hotmail.com", "22d"],
    ["rodrigoaugusto@hotmail.com", "22d"],
    ["gabriel.pereira@p-excellence.com.br", "19d"],
    ["isaias.enf@gmail.com", "7d"],
  ],
  "Orfa calada por ja_avisado (as do #582)": [
    ["ezwaymotors@gmail.com", "9h"],
    ["josephgois@hotmail.com", "5h"],
  ],
};

(async () => {
  const jsonMode = process.argv.includes("--json");
  const todos = Object.values(GRUPOS).flat().map(([e]) => e);
  const lista = todos.map((e) => `'${e.toLowerCase()}'`).join(",");

  const usuarios = await consultar(
    `select email, id, last_sign_in_at, created_at from auth.users where lower(email) in (${lista})`,
  );
  const perfis = await consultar(
    `select email, id, access_until, credits_subscription, credits_extra, plan, last_seen_at
       from profiles where lower(email) in (${lista})`,
  );
  const direitos = await consultar(
    `select buyer_email, status, access_until, product_code, external_id, user_id, created_at
       from entitlements where lower(buyer_email) in (${lista}) order by created_at`,
  );

  const mapU = new Map(usuarios.map((r) => [r.email.toLowerCase(), r]));
  const mapP = new Map(perfis.map((r) => [r.email.toLowerCase(), r]));
  const porEmail = {};
  for (const e of direitos) {
    const k = e.buyer_email.toLowerCase();
    (porEmail[k] = porEmail[k] || []).push(e);
  }

  const agora = new Date();
  const saida = [];
  let entraram = 0;
  let nunca = 0;
  let semConta = 0;

  for (const [grupo, membros] of Object.entries(GRUPOS)) {
    if (!jsonMode) console.log(`\n══ ${grupo} ══`);
    for (const [em, idade] of membros) {
      const k = em.toLowerCase();
      const U = mapU.get(k);
      const P = mapP.get(k);
      const E = porEmail[k] || [];

      const temConta = !!U;
      const logou = temConta && U.last_sign_in_at ? U.last_sign_in_at : null;
      const acesso = P && P.access_until ? new Date(P.access_until) : null;
      const acessoVivo = !!(acesso && acesso > agora);
      const creditos = P ? (P.credits_subscription || 0) + (P.credits_extra || 0) : null;

      if (!temConta) semConta++;
      if (logou) entraram++;
      else nunca++;

      saida.push({
        grupo, email: em, idade_do_erro: idade,
        tem_conta: temConta, ja_logou: logou,
        access_until: P?.access_until ?? null, acesso_vivo: acessoVivo,
        creditos, entitlements: E.length,
      });

      if (jsonMode) continue;
      console.log(`\n  ${logou ? "✅ ENTROU" : temConta ? "🔴 TEM CONTA MAS NUNCA ENTROU" : "🔴 SEM CONTA NENHUMA"} — ${em}  (erro de ${idade})`);
      console.log(`     conta auth ...: ${temConta ? `SIM, criada ${String(U.created_at).slice(0, 10)}` : "NAO EXISTE"}`);
      console.log(`     ja logou .....: ${logou ? String(logou).slice(0, 19) + "Z" : "NUNCA"}`);
      console.log(
        `     profile ......: ${
          P
            ? `access_until=${P.access_until ? String(P.access_until).slice(0, 10) : "null"} ${acessoVivo ? "(VIVO)" : "(vencido/nulo)"} · creditos=${creditos} · plan=${P.plan || "-"}`
            : "NAO EXISTE"
        }`,
      );
      console.log(
        `     entitlements .: ${
          E.length
            ? E.map((x) => `${x.status}/${x.product_code}/ate ${x.access_until ? String(x.access_until).slice(0, 10) : "null"}${x.user_id ? "" : " [SEM user_id]"}`).join(" | ")
            : "NENHUM"
        }`,
      );
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify(saida, null, 2));
    return;
  }

  console.log(`\n${"═".repeat(70)}`);
  console.log(`>>> PLACAR: ${todos.length} acusados pela varredura · ${entraram} JA ENTRARAM · ${nunca} NUNCA ENTRARAM (${semConta} sem conta nenhuma)`);
  console.log(`    "Entrou" = auth.users.last_sign_in_at preenchido. access_until vivo NAO conta: o`);
  console.log(`    webhook cria o direito no ato do pagamento, inclusive pra quem nunca recebeu a senha.`);
  console.log("═".repeat(70));
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
