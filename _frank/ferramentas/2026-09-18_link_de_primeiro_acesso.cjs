/**
 * LINK DE PRIMEIRO ACESSO / RECUPERAÇÃO — gera o link pela API admin do
 * Supabase, o MESMO `generateLink` de /api/v1/admin/users/recovery-link.
 *
 *   node _frank/ferramentas/2026-09-18_link_de_primeiro_acesso.cjs aluno@x.com
 *   node _frank/ferramentas/2026-09-18_link_de_primeiro_acesso.cjs aluno@x.com --tipo magiclink
 *
 * POR QUE EXISTE (caso Walsicleia, #1a37605a, 18/09). A ronda precisava de
 * duas coisas que o endpoint HTTP não dá da linha de comando: (1) o link, sem
 * ter que logar no admin pelo navegador, e (2) o `email_otp` que vem JUNTO na
 * resposta do Supabase e que o endpoint HTTP **joga fora** — ele só devolve
 * `action_link`.
 *
 * ⚠️ DUAS COISAS MEDIDAS QUE QUEM USAR PRECISA SABER:
 *
 * 1. `generateLink` NÃO manda e-mail. Ele devolve o link e pronto. Quem
 *    entrega é a casa, pelo SMTP do suporte@ (enviar_email.cjs), que é o
 *    canal que a gente mede e cujo bounce a gente vê. O e-mail que o botão
 *    "Esqueci minha senha" dispara é OUTRA coisa:
 *    `forgot-password-form.tsx:29` chama `supabase.auth.resetPasswordForEmail`
 *    no cliente, e esse sai pelo provedor do Supabase — remetente que a casa
 *    não controla e envio que NÃO entra em `emails_enviados`. Por isso, quando
 *    o aluno diz "não chega", a casa não tem nem prova de entrega nem bounce.
 *
 * 2. O `action_link` é token de USO ÚNICO e vale ~1h. Ele é queimado por quem
 *    abrir primeiro — inclusive varredor de link de provedor (o Safe Links do
 *    Outlook/Hotmail faz prefetch). Por isso este script imprime também o
 *    `email_otp`: código não é consumido por varredor. HOJE O PRODUTO NÃO TEM
 *    TELA QUE ACEITE ESSE CÓDIGO (medido: o fluxo é só link), então o OTP é
 *    informação pra decisão, não saída pro aluno. Não mande o código pro aluno
 *    prometendo uma tela que não existe.
 *
 * NÃO imprime segredo nenhum além do próprio link/OTP do aluno em questão, e
 * nada disto pode ir pro Telegram (regra de canal de 20/08).
 */
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const argv = process.argv.slice(2);
const email = (argv.find((a) => !a.startsWith("--")) ?? "").trim().toLowerCase();
const tipoIdx = argv.indexOf("--tipo");
const tipo = tipoIdx >= 0 ? argv[tipoIdx + 1] : "recovery";

if (!email) {
  console.error(
    "uso: node _frank/ferramentas/2026-09-18_link_de_primeiro_acesso.cjs aluno@x.com [--tipo recovery|magiclink]",
  );
  process.exit(1);
}

const URL_SUPABASE =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const CHAVE_SERVICO =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
/**
 * ⚠️ NÃO LEIA `NEXT_PUBLIC_SITE_URL` DO `.env.local` DESTA MÁQUINA.
 *
 * Medido na ronda de 19hZ de 18/09: nesta máquina essa variável vale
 * `http://localhost:3000`, e o Supabase ACEITA esse destino (está na allowlist
 * do projeto, por conveniência de dev). Conferido com a conta da casa: o
 * `/auth/v1/verify` responde **303** com
 * `location: http://localhost:3000/auth/callback#access_token=...`.
 *
 * Um link desses mandado pro aluno é pior do que não mandar: o Supabase
 * VERIFICA e QUEIMA o token de uso único, e joga o navegador DELE pra
 * `localhost:3000` — a máquina dele, onde não há nada escutando. Ele vê "não
 * foi possível acessar o site", e do nosso lado a carta consta como entregue.
 *
 * Por isso o destino é FIXO aqui, e conferido: `https://fastcloner.com` é o
 * app (medido nesta ronda: `/auth/callback` sem token devolve 200 e cai em
 * `/login?error=missing_code_or_token`; `app.fastcloner.com` NÃO resolve).
 * Só se muda por `SITE_PARA_LINK`, explicitamente, por quem sabe o que está
 * fazendo.
 */
const SITE = (process.env.SITE_PARA_LINK ?? "https://fastcloner.com").replace(
  /\/+$/,
  "",
);
if (/localhost|127\.0\.0\.1/i.test(SITE)) {
  console.error(
    "RECUSADO: destino do link aponta pro localhost — isso queima o token e manda o aluno pra máquina dele.",
  );
  process.exit(1);
}

if (!URL_SUPABASE || !CHAVE_SERVICO) {
  console.error(
    "faltou NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no frontend/.env.local",
  );
  process.exit(1);
}

(async () => {
  const redirectTo = `${SITE}/auth/callback?next=${encodeURIComponent("/reset-password")}`;

  const res = await fetch(`${URL_SUPABASE}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: CHAVE_SERVICO,
      Authorization: `Bearer ${CHAVE_SERVICO}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: tipo, email, redirect_to: redirectTo }),
  });

  const corpo = await res.json().catch(() => null);

  if (!res.ok) {
    console.error(`HTTP ${res.status} — o Supabase RECUSOU. Resposta crua:`);
    console.error(JSON.stringify(corpo, null, 2));
    process.exit(2);
  }

  const link = corpo?.action_link ?? null;
  const otp = corpo?.email_otp ?? null;

  console.log(`e-mail ........ ${email}`);
  console.log(`tipo .......... ${tipo}`);
  console.log(`gerado em ..... ${new Date().toISOString()}`);
  console.log("");
  if (!link) {
    console.log("⚠️  o Supabase respondeu OK mas NAO veio action_link:");
    console.log(JSON.stringify(corpo, null, 2));
    process.exit(3);
  }
  console.log("LINK (uso unico, ~60 min):");
  console.log(link);
  console.log("");
  console.log(`email_otp ..... ${otp ?? "(nao veio)"}`);
  console.log(
    "   (o produto NAO tem tela que aceite este codigo — informacao interna,",
  );
  console.log("    nao mande pro aluno como se tivesse onde digitar)");
  console.log("");
  console.log(
    "NADA FOI ENVIADO. Quem entrega e o enviar_email.cjs, pelo SMTP do suporte@.",
  );
})().catch((e) => {
  console.error("falhou:", e?.message ?? e);
  process.exit(1);
});
