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
 * ⚠️ CONTROLE POSITIVO POR LISTA FIXA, e ABORTA. Ate 23/09 o controle daqui era
 * uma CONTAGEM que so abortava no ZERO (`if (entraram === 0)`): perder 3 de 4
 * alunos conhecidos passava calado e o script ainda imprimia numero — o mesmo
 * defeito do `esperando_johnny.cjs` ("OK (3/4)"). Agora ele compara nome por
 * nome com `CONTROLE_ESPERADOS` e morre se faltar QUALQUER UM, dizendo quem
 * sumiu. Lista vazia tambem aborta: sem piso escrito, nao imprime numero.
 *
 * uso:
 *   node 2026-09-16_porta_de_entrada_sgp.cjs --listar
 *   node 2026-09-16_porta_de_entrada_sgp.cjs --semear-controle           (le prod, so imprime a lista pra voce colar)
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

/**
 * ── O PISO DO CONTROLE POSITIVO ───────────────────────────────────────────
 * Alunos que EU SEI que estao em `sgp_pedidos` com status 'pronto' E que JA
 * ENTRARAM (`last_sign_in_at` preenchido). Nao e amostra nem contagem: e uma
 * LISTA NOMINAL, e a varredura e obrigada a reencontrar TODOS eles antes de
 * ter direito de imprimir um numero.
 *
 * `last_sign_in_at` so anda pra frente — quem ja entrou nao "desentra". Entao
 * um item desta lista faltar nunca e noticia sobre o aluno: e o instrumento
 * cego (paginacao estourada, cache envenenado, campo que parou de ser
 * preenchido, consulta que mudou de forma).
 *
 * ⚠️ BAIXAR O PISO SO POR ESCRITO, AQUI. Se voce tirar um nome desta lista
 * (ou encurta-la), REESCREVA a lista e deixe na linha o MOTIVO e a DATA —
 * ex.: "// removido 30/09: conta apagada a pedido do titular (#512)". Piso
 * que desce sem justificativa escrita e o defeito que este bloco existe pra
 * impedir: quanto menor a lista, menos o controle enxerga. Nunca esvazie "so
 * pra o script voltar a rodar" — lista vazia ABORTA de proposito.
 *
 * Como preencher: `--semear-controle` le producao e imprime as linhas prontas
 * pra colar aqui (email + id + carimbo do login). Escolha 3 ou 4 dos mais
 * ANTIGOS (coorte velha nao muda mais) e escreva a nota de cada um.
 */
const CONTROLE_ESPERADOS = [
  // SEMEADO em 23/09 pelo Frank, com `--semear-controle` rodado contra producao.
  //
  // POR QUE ESTES QUATRO: sao contas que JA ENTRARAM (tem login), e escolhi as
  // de entrada mais ANTIGA de proposito — quanto mais velha a entrada, menor a
  // chance de o estado mudar e o controle abortar por motivo legitimo em vez de
  // por filtro quebrado. Controle que pisca sozinho vira ruido e acaba comentado.
  // Peguei duas do inicio de setembro e duas de 19/09 para a ancora nao ficar
  // toda no mesmo dia: se um so dia sumir da consulta, ainda sobra quem acuse.
  //
  // O QUE ELES PROVAM: que a varredura ainda enxerga quem entrou. Eles atravessam
  // o MESMO caminho da lista `fora`, entao perder um conhecido significa estar
  // perdendo desconhecidos junto — e o vies e sempre pra baixo (parece que tem
  // menos gente presa do lado de fora do que realmente tem).
  { email: "contatogrupoavip@gmail.com", id: "89f57f2e-f0b9-4739-acf4-5edf68ef9a90", entrou_em: "2026-09-06T16:55:00.17924Z", nota: "entrada mais antiga da amostra (06/09) — ancora que nao deve mudar" },
  { email: "ritabernardino71@gmail.com", id: "5cee2e1a-8725-40cd-ae38-d5c36bbf37c3", entrou_em: "2026-09-07T10:26:06.36353Z", nota: "segunda mais antiga (07/09) — ancora que nao deve mudar" },
  { email: "mauro.inforsato@prouddigital.com.br", id: "15577d40-5b27-4b3c-9feb-f7a53fa37cbe", entrou_em: "2026-09-19T02:48:28.94716Z", nota: "19/09 — segunda data, pra ancora nao ficar toda no mesmo dia" },
  { email: "unternehmerdigital@gmail.com", id: "e9602a39-42cd-4869-a3f6-c1b731ccb99b", entrou_em: "2026-09-19T12:48:13.322557Z", nota: "19/09 — segunda data, pra ancora nao ficar toda no mesmo dia" },
];

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
  let entraram = 0;
  let semConta = 0;
  let pulados = 0;
  // UM laco so. Antes eram dois (um pra `fora`, outro pra contar `entraram`) e
  // o segundo nao tinha o filtro de e-mail invalido — as duas contagens nem
  // varriam o mesmo conjunto. Contar aqui dentro faz o denominador ser o mesmo
  // por construcao. Os baldes `semConta`/`pulados` existem pra que
  // entraram + fora + semConta + pulados feche com totalPronto: `continue`
  // mudo ja derrubou aluno da conta sem ninguem notar.
  for (const p of pedidos) {
    if (!p.email || /\.invalid$/i.test(p.email)) {
      pulados++;
      continue;
    }
    const u = await acharUsuario(p.email);
    if (!u) {
      semConta++;
      continue;
    }
    if (u.last_sign_in_at) {
      entraram++;
      continue;
    }
    fora.push({
      email: p.email,
      voz_pronta_em: p.voz_pronta_em,
      criada: u.created_at,
      recovery_sent_at: u.recovery_sent_at ?? null,
    });
  }
  fora.sort((a, b) => String(a.voz_pronta_em).localeCompare(String(b.voz_pronta_em)));

  const controle = await conferirControle(pedidos);
  return { fora, entraram, semConta, pulados, controle, totalPronto: pedidos.length };
}

/**
 * CONTROLE POSITIVO: reencontrar NOMINALMENTE cada item de CONTROLE_ESPERADOS.
 * Aborta se faltar QUALQUER UM — nao no zero, no PRIMEIRO que sumir.
 *
 * Duas exigencias por item, checadas em separado pra que o erro diga onde
 * quebrou: (1) o e-mail tem que estar na fatia 'pronto' que a consulta
 * devolveu; (2) `acharUsuario` tem que devolver a conta COM `last_sign_in_at`.
 *
 * A busca aqui vai com `semCache: true` de proposito: o cache memoriza null, e
 * um controle que le o mesmo null envenenado da medicao nao e controle — ele
 * degrada junto com o instrumento que deveria vigiar.
 */
async function conferirControle(pedidos) {
  if (!CONTROLE_ESPERADOS.length) {
    throw new Error(
      "CONTROLE POSITIVO SEM PISO: `CONTROLE_ESPERADOS` esta VAZIA, entao a " +
        "comparacao passaria por vacuidade e eu imprimiria um numero que nada " +
        "sustenta. Rode `--semear-controle`, escolha 3 ou 4 dos alunos 'pronto' " +
        "MAIS ANTIGOS que ja entraram e cole as linhas no topo deste arquivo, " +
        "com a nota de cada um. Enquanto nao houver piso escrito, nao imprimo.",
    );
  }

  const naFatia = new Set(pedidos.map((p) => String(p.email || "").toLowerCase()));
  const sumiram = [];
  const reencontrados = [];

  for (const esp of CONTROLE_ESPERADOS) {
    const k = String(esp.email || "").toLowerCase();
    const rotulo = `${esp.email} (id ${esp.id ?? "?"}${esp.nota ? ` · ${esp.nota}` : ""})`;
    if (!naFatia.has(k)) {
      sumiram.push(`${rotulo}\n      -> sumiu de sgp_pedidos status='pronto': a consulta nao o devolveu`);
      continue;
    }
    let u = null;
    try {
      u = await acharUsuario(k, { semCache: true });
    } catch (e) {
      sumiram.push(`${rotulo}\n      -> acharUsuario LANCOU: ${e.message}`);
      continue;
    }
    if (!u) {
      sumiram.push(`${rotulo}\n      -> acharUsuario devolveu null: a varredura do auth nao achou a conta`);
      continue;
    }
    if (!u.last_sign_in_at) {
      sumiram.push(
        `${rotulo}\n      -> conta achada (id ${u.id}) mas last_sign_in_at VAZIO ` +
          `(entrou em ${esp.entrou_em ?? "?"}): o campo parou de ser preenchido`,
      );
      continue;
    }
    reencontrados.push({ email: k, id: u.id, last_sign_in_at: u.last_sign_in_at });
  }

  if (sumiram.length) {
    throw new Error(
      `CONTROLE POSITIVO FALHOU: reencontrei ${reencontrados.length} de ` +
        `${CONTROLE_ESPERADOS.length} conhecidos. SUMIRAM ${sumiram.length}:\n` +
        sumiram.map((s) => `  - ${s}`).join("\n") +
        "\n\n  POR QUE ISSO MATA A VARREDURA: esses nomes atravessam exatamente o " +
        "mesmo caminho da lista FORA (sgp_pedidos 'pronto' -> acharUsuario -> " +
        "last_sign_in_at). Se o caminho perdeu quem eu SEI que esta la, ele " +
        "tambem esta perdendo quem eu nao sei — e o vies e SEMPRE PRA BAIXO: " +
        "quem some da varredura some da lista FORA, nunca entra nela. Entao " +
        "qualquer numero impresso agora seria OTIMISTA — menos aluno preso do " +
        "lado de fora do que a realidade, e aluno que ninguem vai procurar. " +
        "Conserte o instrumento (ou, se a perda for legitima, reescreva " +
        "CONTROLE_ESPERADOS com o motivo e a data) antes de rodar de novo.",
    );
  }
  return reencontrados;
}

const _cache = new Map();
const TETO_PAGINAS = 40;
const POR_PAGINA = 200;
/**
 * `semCache: true` ignora o que ja esta memorizado e varre de novo. Serve ao
 * controle positivo: o cache guarda tambem os MISS (null), entao um miss virava
 * permanente e qualquer segundo laco reusava o mesmo null.
 */
async function acharUsuario(email, { semCache = false } = {}) {
  const k = String(email || "").toLowerCase();
  if (!semCache && _cache.has(k)) return _cache.get(k);
  let achado = null;
  let listaAcabou = false;
  // listUsers pagina de 50 em 50; filtramos no cliente porque o filtro por
  // email do admin nao e exato em todas as versoes.
  for (let page = 1; page <= TETO_PAGINAS && !achado; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: POR_PAGINA });
    if (error) throw new Error(`listUsers: ${error.message}`);
    if (!data.users.length) {
      listaAcabou = true;
      break;
    }
    for (const u of data.users) {
      if (String(u.email || "").toLowerCase() === k) achado = u;
      if (!_cache.has(String(u.email || "").toLowerCase()))
        _cache.set(String(u.email || "").toLowerCase(), u);
    }
    if (data.users.length < POR_PAGINA) {
      listaAcabou = true;
      break;
    }
  }
  // Teto estourado SEM a lista ter acabado: "nao tem conta" aqui seria
  // ignorancia vendida como medicao — e null silencioso derruba o aluno do
  // relatorio sem ruido, sempre pra baixo. Lanca.
  if (!achado && !listaAcabou) {
    throw new Error(
      `VARREDURA DO AUTH ESTOUROU O TETO procurando ${k || "(email vazio)"}: ` +
        `${TETO_PAGINAS} paginas x ${POR_PAGINA} = ${TETO_PAGINAS * POR_PAGINA} contas e a ` +
        `lista NAO acabou. Nao sei se a conta existe, e "nao existe" seria mentira ` +
        `otimista (o aluno sumiria da lista FORA em silencio). Suba TETO_PAGINAS ` +
        `neste arquivo ou troque a varredura por busca direta antes de confiar em ` +
        `qualquer numero daqui.`,
    );
  }
  _cache.set(k, achado);
  return achado;
}

/**
 * ⛔ NAO USE `action_link` AQUI. Esta ferramenta MANDA E-MAIL PRO ALUNO, e ate
 * 18/09/2026 ela mandava o `action_link` — que aponta pro `/auth/v1/verify` do
 * Supabase, responde 303 com a sessao no FRAGMENTO (`#access_token=...`), e
 * portanto nao entrega nada pro nosso servidor: o `/auth/callback` so le
 * `code`/`token_hash` da QUERY, cai no ramo final e manda o aluno pra
 * `/login?error=missing_code_or_token` com o token de uso unico JA QUEIMADO.
 * Esse e o incidente #438.
 *
 * O formato que funciona (medido em producao, 307 -> /reset-password com
 * Set-Cookie) e o `hashed_token` na QUERY. A versao canonica desta montagem,
 * com a medicao completa, vive em
 * `frontend/src/lib/auth/link-de-acesso.ts` — aqui esta repetida porque este
 * script e CommonJS e nao importa TypeScript. Se mudar la, mude aqui.
 */
async function gerarLink(email) {
  const { data, error } = await db.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: REDIRECT },
  });
  if (error) throw new Error(`generateLink(${email}): ${error.message}`);
  const hashed = data?.properties?.hashed_token;
  if (!hashed) throw new Error(`generateLink(${email}): sem hashed_token na resposta`);
  const q = new URLSearchParams({
    token_hash: hashed,
    type: "recovery",
    next: "/reset-password",
  });
  return `${SITE}/auth/callback?${q.toString()}`;
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

  // Le producao e imprime as linhas prontas pra colar em CONTROLE_ESPERADOS.
  // Nao escreve nada, nao manda nada: quem fixa o piso e a pessoa, no arquivo.
  if (tem("--semear-controle")) {
    const { data: pedidos, error } = await db
      .from("sgp_pedidos")
      .select("email,status,voz_pronta_em")
      .eq("status", "pronto");
    if (error) throw new Error(`sgp_pedidos: ${error.message}`);
    const linhas = [];
    for (const p of pedidos) {
      if (!p.email || /\.invalid$/i.test(p.email)) continue;
      const u = await acharUsuario(p.email);
      if (!u?.last_sign_in_at) continue;
      linhas.push({ email: p.email.toLowerCase(), id: u.id, entrou_em: u.last_sign_in_at, pronto: p.voz_pronta_em });
    }
    linhas.sort((a, b) => String(a.pronto).localeCompare(String(b.pronto)));
    console.log(`// candidatos a CONTROLE_ESPERADOS (${linhas.length}), do mais ANTIGO pro mais novo.`);
    console.log("// Pegue 3 ou 4 do topo, escreva a nota de cada um e cole no arquivo.");
    for (const l of linhas) {
      console.log(
        `  { email: ${JSON.stringify(l.email)}, id: ${JSON.stringify(l.id)}, ` +
          `entrou_em: ${JSON.stringify(l.entrou_em)}, nota: "pronto em ${l.pronto} — ESCREVA AQUI o porque" },`,
      );
    }
    return;
  }

  if (tem("--listar")) {
    const { fora, entraram, semConta, pulados, controle, totalPronto } = await listar();
    console.log(
      `pedidos 'pronto': ${totalPronto} · JA ENTRARAM: ${entraram} · FORA: ${fora.length}` +
        ` · sem conta no auth: ${semConta} · e-mail invalido/vazio: ${pulados}` +
        `\ncontrole positivo: ${controle.length}/${CONTROLE_ESPERADOS.length} conhecidos reencontrados (qualquer falta aborta)`,
    );
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
    console.log(
      "uso: --listar | --semear-controle | --link <email> | --enviar <email> [--dry-run|--confirmar]",
    );
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
