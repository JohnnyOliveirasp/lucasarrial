/**
 * Testes do "esqueci a senha" pelo SMTP da casa. Rodar (Node ≥ 22.18):
 *   node --test src/lib/auth/recuperacao-senha.test.ts
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 *
 * As quatro provas que o cartão desta mudança exige têm seção nomeada abaixo:
 * anti-enumeração, registro em `emails_enviados`, recusa de destino local e
 * limite de taxa.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ORIGEM_RECUPERACAO,
  DESTINO_PADRAO,
  avaliarPedido,
  despacharRecuperacao,
  destinoDeRecuperacao,
  ehUsuarioInexistente,
  idiomaDaCarta,
  normalizarEmail,
  respostaDoVeredicto,
  textoDaRecuperacao,
  type CanaisRecuperacao,
  type Desfecho,
} from "./recuperacao-senha.ts";
import { linhaDoEnvio, gerarMessageId } from "../agent/mail-envio.ts";
import { criarLimitePorIp } from "../api/rate-ip.ts";

/** Uma caixa-preta no lugar do Supabase + SMTP: só quem está na lista tem conta. */
function canaisFalsos(contas: string[], enviadas: { to: string; assunto: string; texto: string }[]) {
  const chamadas = { gerarLink: 0, enviar: 0 };
  const canais: CanaisRecuperacao = {
    async gerarLink({ email, redirectTo }) {
      chamadas.gerarLink += 1;
      if (!contas.includes(email)) {
        // Como o GoTrue responde de verdade pra endereço sem usuário.
        return { link: null, semConta: ehUsuarioInexistente("User not found"), erro: "User not found" };
      }
      return {
        link: `https://projeto.supabase.co/auth/v1/verify?token=abc&type=recovery&redirect_to=${encodeURIComponent(redirectTo)}`,
        semConta: false,
        erro: null,
      };
    },
    async enviar(args) {
      chamadas.enviar += 1;
      enviadas.push(args);
    },
  };
  return { canais, chamadas };
}

/**
 * O MESMO caminho da rota, montado a partir das MESMAS funções que ela usa
 * (`avaliarPedido` → `respostaDoVeredicto` → `despacharRecuperacao`). O que a
 * rota faz a mais é só embrulhar em `NextResponse` e logar o desfecho.
 */
async function atenderComoARota(
  email: unknown,
  opcoes: {
    contas: string[];
    enviadas: { to: string; assunto: string; texto: string }[];
    idioma?: unknown;
    destinoBruto?: string | null;
    limitadoPorIp?: boolean;
    limitadoPorEmail?: (e: string) => boolean;
  },
) {
  const { canais, chamadas } = canaisFalsos(opcoes.contas, opcoes.enviadas);
  const veredicto = avaliarPedido({
    email,
    idioma: opcoes.idioma ?? "pt-BR",
    destinoBruto: opcoes.destinoBruto ?? null,
    limitadoPorIp: opcoes.limitadoPorIp ?? false,
    limitadoPorEmail: opcoes.limitadoPorEmail ?? (() => false),
  });
  const resposta = respostaDoVeredicto(veredicto);
  let desfecho: Desfecho | null = null;
  if (veredicto.acao === "despachar") {
    desfecho = await despacharRecuperacao({
      email: veredicto.email,
      idioma: veredicto.idioma,
      redirectTo: veredicto.redirectTo,
      canais,
    });
  }
  return { resposta, desfecho, chamadas };
}

// ============================================================ anti-enumeração

test("conta que EXISTE e conta que NÃO existe devolvem a resposta idêntica", async () => {
  const enviadas: { to: string; assunto: string; texto: string }[] = [];
  const contas = ["aluna@exemplo.com"];

  const existe = await atenderComoARota("aluna@exemplo.com", { contas, enviadas });
  const naoExiste = await atenderComoARota("ninguem@exemplo.com", { contas, enviadas });

  assert.deepEqual(
    existe.resposta,
    naoExiste.resposta,
    "a resposta HTTP não pode diferir — é ela que viraria verificador de quem é aluno",
  );
  assert.equal(existe.resposta.status, 200);
  assert.deepEqual(existe.resposta.corpo, { ok: true });

  // E o que MUDA fica só do lado de dentro, no log da ronda.
  assert.equal(existe.desfecho?.passo, "enviado");
  assert.equal(naoExiste.desfecho?.passo, "sem-conta");
  assert.equal(enviadas.length, 1, "só quem tem conta recebe carta");
  assert.equal(enviadas[0].to, "aluna@exemplo.com");
});

test("a decisão da resposta não recebe NADA sobre a conta (garantia estrutural)", () => {
  // `avaliarPedido` não tem parâmetro nenhum que fale de usuário: a resposta não
  // PODE depender da existência porque o dado não chega até ela. Este teste pina
  // essa propriedade — se alguém acrescentar um "contaExiste" aqui, ele quebra.
  const veredicto = avaliarPedido({
    email: "quem-quer-que-seja@exemplo.com",
    idioma: "pt-BR",
    destinoBruto: null,
    limitadoPorIp: false,
    limitadoPorEmail: () => false,
  });
  assert.equal(veredicto.acao, "despachar");
  if (veredicto.acao !== "despachar") return;
  assert.deepEqual(respostaDoVeredicto(veredicto), { status: 200, corpo: { ok: true } });
});

test("falha ao GERAR o link também não muda a resposta pública", async () => {
  const enviadas: { to: string; assunto: string; texto: string }[] = [];
  const veredicto = avaliarPedido({
    email: "aluna@exemplo.com",
    idioma: "pt-BR",
    destinoBruto: null,
    limitadoPorIp: false,
    limitadoPorEmail: () => false,
  });
  assert.equal(veredicto.acao, "despachar");
  if (veredicto.acao !== "despachar") return;

  const desfecho = await despacharRecuperacao({
    email: veredicto.email,
    idioma: veredicto.idioma,
    redirectTo: veredicto.redirectTo,
    canais: {
      async gerarLink() {
        throw new Error("supabase fora do ar");
      },
      async enviar(a) {
        enviadas.push(a);
      },
    },
  });
  assert.deepEqual(respostaDoVeredicto(veredicto), { status: 200, corpo: { ok: true } });
  assert.deepEqual(desfecho, {
    passo: "falhou",
    email: "aluna@exemplo.com",
    etapa: "link",
    erro: "supabase fora do ar",
  });
  assert.equal(enviadas.length, 0);
});

test("falha no ENVIO vira desfecho, não exceção (senão vira unhandled rejection no pm2)", async () => {
  const desfecho = await despacharRecuperacao({
    email: "aluna@exemplo.com",
    idioma: "pt-BR",
    redirectTo: `${DESTINO_PADRAO}/auth/callback?next=%2Freset-password`,
    canais: {
      async gerarLink() {
        return { link: "https://projeto.supabase.co/auth/v1/verify?token=abc", semConta: false, erro: null };
      },
      async enviar() {
        throw new Error("SMTP esperava 250, veio 550");
      },
    },
  });
  assert.equal(desfecho.passo, "falhou");
  if (desfecho.passo !== "falhou") return;
  assert.equal(desfecho.etapa, "envio");
  assert.match(desfecho.erro, /550/);
});

// ================================================== registro em emails_enviados

test("o único caminho de entrega é o `enviar` da casa, chamado UMA vez", async () => {
  // Este é o ponto do cartão: o caminho antigo (`resetPasswordForEmail`) saía
  // pelo provedor do Supabase e não registrava nada. Agora o despacho tem UM
  // canal de saída só, e a rota liga esse canal no `sendSupportMail` — que
  // chama `registrarEnvio` logo depois do SMTP aceitar (mail-smtp.ts:183).
  const enviadas: { to: string; assunto: string; texto: string }[] = [];
  const { chamadas } = await atenderComoARota("aluna@exemplo.com", {
    contas: ["aluna@exemplo.com"],
    enviadas,
  });
  assert.equal(chamadas.enviar, 1);
  assert.equal(chamadas.gerarLink, 1);
});

test("a origem do envio vira linha válida de `emails_enviados`", () => {
  // `linhaDoEnvio` é o que o `registrarEnvio` grava. Se a origem nova não
  // produzisse linha, o envio sairia e continuaria invisível — que é o defeito
  // que este PR existe pra fechar.
  const linha = linhaDoEnvio({
    messageId: gerarMessageId(1_758_000_000_000, "abc123"),
    toEmail: "Aluna@Exemplo.com",
    assunto: textoDaRecuperacao({ link: "https://x", email: "aluna@exemplo.com", idioma: "pt-BR" }).assunto,
    origem: ORIGEM_RECUPERACAO,
  });
  assert.ok(linha, "sem linha o bounce não teria onde cair");
  assert.equal(linha.message_id, "<fast-1758000000000-abc123@fastcloner.com>");
  assert.equal(linha.to_email, "aluna@exemplo.com");
  assert.equal(linha.origem, "recuperacao-senha");
  assert.equal(linha.assunto, "Seu link pra criar uma senha nova no FastCloner");
});

// ================================================= destino (o link que queima)

test("destino localhost é RECUSADO, em todas as formas que aparecem em .env de dev", () => {
  const locais = [
    "http://localhost:3000", // ← o valor REAL do NEXT_PUBLIC_SITE_URL desta máquina
    "https://localhost:3000",
    "https://127.0.0.1:3000",
    "https://0.0.0.0",
    "https://[::1]:3000",
    "https://app.localhost",
    "https://macbook.local",
    "https://192.168.0.10",
    "https://10.0.0.5",
    "https://172.20.1.1",
    "https://169.254.1.1",
  ];
  for (const alvo of locais) {
    const d = destinoDeRecuperacao(alvo);
    assert.equal(d.ok, false, `deixou passar ${alvo}`);
  }
});

test("destino http em domínio público também é recusado (link de auth não anda em claro)", () => {
  const d = destinoDeRecuperacao("http://fastcloner.com");
  assert.equal(d.ok, false);
  if (d.ok) return;
  assert.match(d.motivo, /https/);
});

test("destino vazio cai na produção, e não na variável da máquina", () => {
  for (const vazio of [null, undefined, "", "   "]) {
    const d = destinoDeRecuperacao(vazio);
    assert.equal(d.ok, true);
    if (!d.ok) return;
    assert.equal(d.base, "https://fastcloner.com");
    assert.equal(d.redirectTo, "https://fastcloner.com/auth/callback?next=%2Freset-password");
  }
});

test("destino com caminho/porta/barra sobrando vira origin limpo", () => {
  const d = destinoDeRecuperacao("https://fastcloner.com/app/?x=1#y");
  assert.equal(d.ok, true);
  if (!d.ok) return;
  assert.equal(d.redirectTo, "https://fastcloner.com/auth/callback?next=%2Freset-password");
});

test("lixo que não é URL é recusado com motivo", () => {
  const d = destinoDeRecuperacao("fastcloner.com");
  assert.equal(d.ok, false);
});

test("destino inválido devolve 500 e NÃO manda e-mail nenhum", async () => {
  const enviadas: { to: string; assunto: string; texto: string }[] = [];
  const r = await atenderComoARota("aluna@exemplo.com", {
    contas: ["aluna@exemplo.com"],
    enviadas,
    destinoBruto: "http://localhost:3000",
  });
  assert.equal(r.resposta.status, 500);
  assert.deepEqual(r.resposta.corpo, {
    error: { code: "destino_invalido", message: "destino local recusado: localhost:3000" },
  });
  assert.equal(enviadas.length, 0, "link que queima a credencial num destino morto é pior que link nenhum");
  assert.equal(r.chamadas.gerarLink, 0, "nem chega a queimar o OTP");
});

test("a recusa de destino é IGUAL pra conta que existe e pra que não existe", async () => {
  const enviadas: { to: string; assunto: string; texto: string }[] = [];
  const a = await atenderComoARota("aluna@exemplo.com", {
    contas: ["aluna@exemplo.com"],
    enviadas,
    destinoBruto: "http://localhost:3000",
  });
  const b = await atenderComoARota("ninguem@exemplo.com", {
    contas: ["aluna@exemplo.com"],
    enviadas,
    destinoBruto: "http://localhost:3000",
  });
  assert.deepEqual(a.resposta, b.resposta);
});

// ==================================================== limite de taxa (abuso)

test("estourou o teto por IP → 429, e nada é gerado nem enviado", async () => {
  const enviadas: { to: string; assunto: string; texto: string }[] = [];
  const r = await atenderComoARota("aluna@exemplo.com", {
    contas: ["aluna@exemplo.com"],
    enviadas,
    limitadoPorIp: true,
  });
  assert.equal(r.resposta.status, 429);
  assert.deepEqual(r.resposta.corpo, {
    error: {
      code: "rate_limited",
      message: "Muitos pedidos em sequência. Espere um minuto e tente de novo.",
    },
  });
  assert.equal(r.chamadas.gerarLink, 0);
  assert.equal(enviadas.length, 0);
});

test("estourou o teto pro E-MAIL → 429 (é o cooldown de 60s que o Supabase dava)", async () => {
  const enviadas: { to: string; assunto: string; texto: string }[] = [];
  const r = await atenderComoARota("aluna@exemplo.com", {
    contas: ["aluna@exemplo.com"],
    enviadas,
    limitadoPorEmail: (e) => e === "aluna@exemplo.com",
  });
  assert.equal(r.resposta.status, 429);
  assert.equal(enviadas.length, 0);
});

test("o 429 não distingue conta existente de inexistente", async () => {
  const enviadas: { to: string; assunto: string; texto: string }[] = [];
  const a = await atenderComoARota("aluna@exemplo.com", {
    contas: ["aluna@exemplo.com"],
    enviadas,
    limitadoPorIp: true,
  });
  const b = await atenderComoARota("ninguem@exemplo.com", { contas: ["aluna@exemplo.com"], enviadas, limitadoPorIp: true });
  assert.deepEqual(a.resposta, b.resposta);
});

test("o contador de verdade (rate-ip.ts) trava no segundo pedido do mesmo e-mail", () => {
  // O mesmo módulo que a rota usa, com os tetos que a rota passa: 1 por minuto.
  const limite = criarLimitePorIp({ porMinuto: 1, porDia: 8 });
  assert.equal(limite.limitado("aluna@exemplo.com"), false, "o primeiro pedido passa");
  assert.equal(limite.limitado("aluna@exemplo.com"), true, "o segundo no mesmo minuto trava");
  assert.equal(limite.limitado("outra@exemplo.com"), false, "e o de outra pessoa não é afetado");
});

test("o contador de verdade trava no teto DIÁRIO do IP", () => {
  const limite = criarLimitePorIp({ porMinuto: 500, porDia: 3 });
  assert.equal(limite.limitado("203.0.113.9"), false);
  assert.equal(limite.limitado("203.0.113.9"), false);
  assert.equal(limite.limitado("203.0.113.9"), false);
  assert.equal(limite.limitado("203.0.113.9"), true, "o quarto no mesmo dia trava");
});

// ============================================================== formato/idioma

test("e-mail é normalizado e o que não tem forma de endereço é 400", async () => {
  assert.equal(normalizarEmail("  Aluna@Exemplo.COM "), "aluna@exemplo.com");
  for (const ruim of ["", "   ", "abc", "a@b", "a b@c.com", "sem-arroba.com", null, 42, undefined]) {
    assert.equal(normalizarEmail(ruim), null, `deixou passar ${String(ruim)}`);
  }
  const enviadas: { to: string; assunto: string; texto: string }[] = [];
  const r = await atenderComoARota("abc", { contas: [], enviadas });
  assert.equal(r.resposta.status, 400);
  assert.equal(r.chamadas.gerarLink, 0);
});

test("idioma do site decide a carta; desconhecido cai em pt-BR", () => {
  assert.equal(idiomaDaCarta("pt-BR"), "pt-BR");
  assert.equal(idiomaDaCarta("PT-br"), "pt-BR");
  assert.equal(idiomaDaCarta("en"), "en");
  assert.equal(idiomaDaCarta("en-US"), "en");
  assert.equal(idiomaDaCarta("es"), "es");
  assert.equal(idiomaDaCarta("es-419"), "es");
  assert.equal(idiomaDaCarta("fr"), "pt-BR");
  assert.equal(idiomaDaCarta(null), "pt-BR");
  assert.equal(idiomaDaCarta(7), "pt-BR");
});

test("a carta sai nos TRÊS idiomas, sempre com o link e sem dizer se a conta existe", () => {
  const link = "https://projeto.supabase.co/auth/v1/verify?token=abc&type=recovery";
  for (const idioma of ["pt-BR", "en", "es"] as const) {
    const { assunto, texto } = textoDaRecuperacao({ link, email: "aluna@exemplo.com", idioma });
    assert.ok(assunto.length > 0, `${idioma} sem assunto`);
    assert.ok(texto.includes(link), `${idioma} sem o link`);
    assert.ok(texto.includes("fastcloner.com/forgot-password"), `${idioma} sem a saída pro link vencido`);
    assert.ok(/FastCloner/.test(texto), `${idioma} sem assinatura da casa`);
    // Nada de markdown/HTML: o sendSupportMail manda text/plain.
    assert.ok(!/[<>]/.test(texto.replace(link, "")), `${idioma} com marcação no corpo`);
  }
  const pt = textoDaRecuperacao({ link, email: "a@b.com", idioma: "pt-BR" });
  const en = textoDaRecuperacao({ link, email: "a@b.com", idioma: "en" });
  const es = textoDaRecuperacao({ link, email: "a@b.com", idioma: "es" });
  assert.notEqual(pt.assunto, en.assunto);
  assert.notEqual(en.assunto, es.assunto);
});

test("a carta diz que o link vence (o erro de 04/09 foi não dizer)", () => {
  // Lição registrada: 349 contas criadas em 04/09 e 2,3% de entrada, porque o
  // e-mail dizia "válido por tempo limitado" e não dizia o que fazer se vencesse.
  const link = "https://x";
  assert.match(textoDaRecuperacao({ link, email: "a@b.com", idioma: "pt-BR" }).texto, /vence em 1 hora/);
  assert.match(textoDaRecuperacao({ link, email: "a@b.com", idioma: "en" }).texto, /expires in 1 hour/);
  assert.match(textoDaRecuperacao({ link, email: "a@b.com", idioma: "es" }).texto, /vence en 1 hora/);
});

test("reconhece o 'usuário não existe' do GoTrue sem confundir com outro erro", () => {
  assert.equal(ehUsuarioInexistente("User not found"), true);
  assert.equal(ehUsuarioInexistente("user_not_found"), true);
  assert.equal(ehUsuarioInexistente("Unable to find user with that email"), true);
  assert.equal(ehUsuarioInexistente("Database error querying schema"), false);
  assert.equal(ehUsuarioInexistente("For security purposes, you can only request this after 43 seconds"), false);
  assert.equal(ehUsuarioInexistente(null), false);
  assert.equal(ehUsuarioInexistente(""), false);
});
