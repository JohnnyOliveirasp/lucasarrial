/**
 * PORTA DE ENTRADA DO SGP (#435) — gera o link de PRIMEIRO ACESSO para quem a
 * casa criou conta e nunca conseguiu entrar, e manda pelo NOSSO SMTP.
 *
 * Por que existe: o aluno do SGP nunca escolheu senha (a casa cria a conta com
 * email_confirmed_at preenchido no mesmo instante) e os 3 e-mails de fim de
 * onboarding so dizem "Acesse: fastcloner.com/login". A unica saida dele e o
 * "Esqueci a senha" — que dispara pelo mailer do Supabase, e o mailer do
 * Supabase esta configurado em Resend com remetente `support@cvpunch.ai`
 * (dominio ANTIGO, outra marca). O proprio cabecalho do `enviar_email.cjs` ja
 * proibe esse canal pra falar com aluno: "NUNCA use Resend pra falar com
 * aluno: chega como 'AI Clone Verse' (dominio antigo) e queima a confianca".
 * Ou seja: a unica porta do aluno passa pelo canal que a casa proibiu.
 *
 * Este script NAO usa aquele canal. Ele:
 *   1. gera o link de recuperacao pelo ADMIN do Supabase (generateLink) — isso
 *      NAO dispara e-mail nenhum;
 *   2. entrega o link pelo SMTP do suporte@, que e o canal com ficha de bounce.
 *
 * ⚠️ O link do Supabase tem validade (padrao 1h para recovery). Nao gere em
 * lote de madrugada esperando que sirva de manha — gere e mande na hora.
 *
 * uso:
 *   node 2026-09-16_porta_de_entrada_sgp.cjs --listar
 *   node 2026-09-16_porta_de_entrada_sgp.cjs --link aluno@x.com          (so gera, nao manda)
 *   node 2026-09-16_porta_de_entrada_sgp.cjs --enviar aluno@x.com --dry-run
 *   node 2026-09-16_porta_de_entrada_sgp.cjs --enviar aluno@x.com --confirmar
 *
 * Sem --confirmar nao manda nada. Sem --dry-run tambem nao: a flag de envio
 * real e explicita de proposito.
 */
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");

const RAIZ = path.join(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});
const { createClient } = require(path.join(RAIZ, "frontend", "node_modules", "@supabase/supabase-js"));

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes");
const db = createClient(URL, KEY, { auth: { persistSession: false } });

const SITE = "https://fastcloner.com";
const REDIRECT = `${SITE}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

/** Quem esta do lado de fora: pedido SGP pronto + conta que nunca logou. */
async function listar() {
  const { data, error } = await db.rpc("exec_sql_json", {}).then(
    () => ({ data: null, error: null }),
    () => ({ data: null, error: null }),
  );
  // sem RPC: usa a mesma consulta do cartao via PostgREST em duas pernas
  const { data: pedidos, error: e1 } = await db
    .from("sgp_pedidos")
    .select("email,status,voz_pronta_em")
    .eq("status", "pronto");
  if (e1) throw new Error(`sgp_pedidos: ${e1.message}`);

  const fora = [];
  for (const p of pedidos) {
    if (!p.email || /\.invalid$/i.test(p.email)) continue;
    const u = await acharUsuario(p.email);
    if (!u) continue;
    if (u.last_sign_in_at) continue;
    fora.push({
      email: p.email,
      voz_pronta_em: p.voz_pronta_em,
      criada: u.created_at,
      recovery_sent_at: u.recovery_sent_at ?? null,
    });
  }
  fora.sort((a, b) => String(a.voz_pronta_em).localeCompare(String(b.voz_pronta_em)));

  // CONTROLE POSITIVO: se ninguem do 'pronto' tiver last_sign_in_at, o campo
  // parou de ser preenchido e a lista acima e lixo. Aborta em vez de mentir.
  let entraram = 0;
  for (const p of pedidos) {
    const u = await acharUsuario(p.email);
    if (u?.last_sign_in_at) entraram++;
  }
  if (entraram === 0) {
    throw new Error(
      "CONTROLE POSITIVO ZEROU: nenhum pedido 'pronto' tem last_sign_in_at. " +
        "O campo parou de ser preenchido — a medicao inteira e lixo. Nao use.",
    );
  }
  return { fora, entraram, totalPronto: pedidos.length };
}

const _cache = new Map();
async function acharUsuario(email) {
  const k = String(email || "").toLowerCase();
  if (_cache.has(k)) return _cache.get(k);
  let achado = null;
  // listUsers pagina de 50 em 50; filtramos no cliente porque o filtro por
  // email do admin nao e exato em todas as versoes.
  for (let page = 1; page <= 40 && !achado; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    if (!data.users.length) break;
    for (const u of data.users) {
      if (String(u.email || "").toLowerCase() === k) achado = u;
      if (!_cache.has(String(u.email || "").toLowerCase()))
        _cache.set(String(u.email || "").toLowerCase(), u);
    }
    if (data.users.length < 200) break;
  }
  _cache.set(k, achado);
  return achado;
}

async function gerarLink(email) {
  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: REDIRECT },
  });
  if (error) throw new Error(`generateLink(${email}): ${error.message}`);
  const link = data?.properties?.action_link;
  if (!link) throw new Error(`generateLink(${email}): sem action_link na resposta`);
  return link;
}

function corpo(nome, link) {
  const ola = nome ? `Olá, ${nome}!` : "Olá!";
  return `<p>${ola}</p>
<p>Sua plataforma está pronta — a voz e as imagens já estão na sua conta.</p>
<p>O problema não foi você: a conta foi criada por nós e você nunca chegou a
escolher uma senha, então a tela de login não tinha como deixar você entrar.
Isso é falha nossa e já estamos corrigindo.</p>
<p><strong>Use este link para criar a sua senha e entrar:</strong></p>
<p><a href="${link}">Criar minha senha e entrar</a></p>
<p>Ele vale por 1 hora. Se expirar, é só responder este e-mail que eu mando outro
na hora.</p>
<p>Um detalhe importante: a plataforma <strong>não envia código de verificação</strong>.
Se você ficou esperando um número chegar, ele não existe — é sempre um link como
o de cima. Sinto muito pela volta que isso te fez dar.</p>
<p>Qualquer coisa, responda aqui.</p>
<p>Equipe FastCloner</p>`;
}

(async () => {
  const argv = process.argv.slice(2);
  const tem = (f) => argv.includes(f);
  const valor = (f) => {
    const i = argv.indexOf(f);
    return i >= 0 ? argv[i + 1] : null;
  };

  if (tem("--listar")) {
    const { fora, entraram, totalPronto } = await listar();
    console.log(`pedidos 'pronto': ${totalPronto} · JA ENTRARAM: ${entraram} (controle positivo) · FORA: ${fora.length}`);
    for (const f of fora) {
      const dias = ((Date.now() - new Date(f.voz_pronta_em)) / 86400000).toFixed(1);
      console.log(
        `  ${f.email.padEnd(36)} pronto ha ${dias.padStart(5)}d · recovery ${f.recovery_sent_at ?? "NUNCA"}`,
      );
    }
    return;
  }

  const alvoLink = valor("--link");
  if (alvoLink) {
    console.log(await gerarLink(alvoLink));
    return;
  }

  const alvo = valor("--enviar");
  if (!alvo) {
    console.log("uso: --listar | --link <email> | --enviar <email> [--dry-run|--confirmar]");
    process.exit(1);
  }
  const u = await acharUsuario(alvo);
  if (!u) throw new Error(`sem conta auth para ${alvo}`);
  if (u.last_sign_in_at) {
    console.log(`SKIP ${alvo}: ja entrou em ${u.last_sign_in_at} — nao precisa de carta.`);
    return;
  }

  const { data: ped } = await db
    .from("sgp_pedidos")
    .select("nome")
    .ilike("email", alvo)
    .limit(1);
  const nomeBruto = String(ped?.[0]?.nome || "").trim();
  // Armadilha do #338 (processar.ts:87-94 aceita qualquer nome com 3+ chars):
  // tem pedido cujo campo `nome` e o PROPRIO E-MAIL. Duas formas de estragar a
  // carta: "Olá, aluno@x.com" (nome com @) e "Olá, walsicleia_kaka" (nome que e
  // o local-part). As duas foram vistas — a segunda passou pelo primeiro filtro
  // no ensaio desta ronda. Na duvida, carta sem nome: "Olá!" nao ofende
  // ninguem, "Olá, walsicleia_kaka" avisa a pessoa que a casa nao sabe quem ela e.
  const localPart = alvo.split("@")[0].toLowerCase();
  const primeiro = nomeBruto.split(/\s+/)[0] || "";
  const suspeito =
    !nomeBruto ||
    /@/.test(nomeBruto) ||
    primeiro.toLowerCase() === localPart ||
    localPart.startsWith(primeiro.toLowerCase()) ||
    /[._\d]/.test(primeiro); // local-part costuma trazer ponto, underline ou digito
  const nome = suspeito ? "" : primeiro;

  const link = await gerarLink(alvo);
  const html = corpo(nome, link);
  const arq = path.join(os.tmpdir(), `porta_${alvo.replace(/[^a-z0-9]/gi, "_")}.html`);
  fs.writeFileSync(arq, html);

  const args = [
    path.join(__dirname, "enviar_email.cjs"),
    alvo,
    "Sua plataforma está pronta — crie sua senha e entre",
    arq,
    "--chave",
    "sgp-primeiro-acesso-senha",
  ];
  if (!tem("--confirmar")) args.push("--dry-run");

  const out = execFileSync("node", args, { encoding: "utf8" });
  console.log(out);
  if (tem("--confirmar")) console.log(`ENVIADO: ${alvo}`);
  else console.log(`ENSAIO (nada saiu). Para mandar de verdade: --enviar ${alvo} --confirmar`);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
