/**
 * "Esqueci a senha" — A DECISÃO. Módulo PURO, ZERO imports.
 *
 * ⚠️ PURO E SEM NENHUM IMPORT DE PROPÓSITO: o runner `node --test` não resolve
 * o alias `@/` e import relativo sem extensão quebra o type-stripping (lição do
 * PR #159). Os canais (gerar link, enviar e-mail, log) entram por PARÂMETRO,
 * então o fluxo inteiro é testável em `recuperacao-senha.test.ts` sem Supabase e
 * sem SMTP. Mesmo desenho do `sgp-boas-vindas.ts`, pelo mesmo motivo.
 *
 * O QUE ISTO CONSERTA (medido na ronda de 18/09 19hZ, incidente 1a37605a,
 * aluna walsicleia_kaka@hotmail.com, pagante, ZERO login desde 04/09):
 * o `forgot-password-form.tsx` chamava `supabase.auth.resetPasswordForEmail`,
 * que é chamada de CLIENTE — quem manda o e-mail é o provedor do próprio
 * Supabase, NÃO o `suporte@fastcloner.com`. Duas consequências, as duas medidas:
 *
 *   (a) O envio não deixa rastro NENHUM do nosso lado. Não entra em
 *       `emails_enviados`, não tem Message-ID nosso, não aparece na pasta
 *       Enviados e não tem onde o bounce cair. Quando o aluno diz "não chega",
 *       a casa não tem prova de entrega NEM de falha — só o `recovery_sent_at`
 *       em `auth.users`, que só diz "o Supabase aceitou disparar". Conferido na
 *       aluna: `recovery_sent_at` 18/09 00:27:40Z e ZERO linha correspondente
 *       em `emails_enviados`.
 *   (b) Sai de um remetente que não é o nosso domínio. E o nosso domínio
 *       ENTREGA na caixa dela: várias cartas do suporte@, zero bounce, ida e
 *       volta acontecendo. O único e-mail que não chega é o de autenticação.
 *
 * Ou seja: a casa tinha um canal PROVADO pra falar com ela e usava OUTRO, cego,
 * justamente no e-mail mais crítico que existe.
 *
 * A TROCA: o link continua sendo gerado pelo Supabase (`admin.generateLink`,
 * que NÃO dispara e-mail — só devolve a URL; é o mesmo de
 * `/api/v1/admin/users/recovery-link` e do `sgp-boas-vindas-canal.ts`), mas quem
 * ENTREGA passa a ser o `sendSupportMail`, que já registra em `emails_enviados`
 * e grava cópia em Enviados.
 */

/** Origem do envio no `emails_enviados`. Espelha `OrigemEnvio` do mail-envio.ts. */
export const ORIGEM_RECUPERACAO = "recuperacao-senha";

/**
 * Onde o link cai. NÃO SAI de `NEXT_PUBLIC_SITE_URL` de propósito.
 *
 * MEDIDO NA RONDA DE 18/09 nesta máquina: `NEXT_PUBLIC_SITE_URL` vale
 * `http://localhost:3000`, e o projeto do Supabase ACEITA esse destino (está na
 * allowlist, por conveniência de dev) — a rota de verificação responde 303
 * mandando o navegador pra localhost:3000 com a sessão no fragmento da URL. Um
 * link desses QUEIMA a credencial de uso único e joga o aluno pra máquina dele,
 * onde não há nada escutando. O aluno fica sem senha E sem link.
 *
 * Por isso a variável do site NÃO é consultada aqui: o padrão é a produção, e
 * quem quiser trocar tem que dizer isso EXPLICITAMENTE em
 * `PASSWORD_RESET_SITE_URL` — e mesmo aí passa pela peneira do
 * `destinoDeRecuperacao`, que recusa localhost e recusa http.
 */
export const DESTINO_PADRAO = "https://fastcloner.com";

/** Caminho de volta: `/auth/callback?next=/reset-password`, já escapado. */
export const CAMINHO_DE_VOLTA = "/auth/callback?next=%2Freset-password";

/**
 * Validade do OTP de recovery do Supabase, como o aluno lê no texto.
 *
 * ⚠️ MESMO PRAZO do `VALIDADE_LINK_SENHA` do `sgp-boas-vindas.ts` — é o MESMO
 * OTP, com a MESMA expiração de projeto. Está escrito duas vezes porque puxar um
 * módulo de `payments` pra dentro do fluxo de autenticação acoplaria dois
 * assuntos que não têm relação; se um dia a expiração do projeto mudar, os dois
 * textos mudam juntos. Divergir aqui não quebra fluxo nenhum: é prosa do e-mail.
 */
export const VALIDADE_DO_LINK = { "pt-BR": "1 hora", en: "1 hour", es: "1 hora" } as const;

export type Idioma = "pt-BR" | "en" | "es";

const IDIOMAS: readonly Idioma[] = ["pt-BR", "en", "es"];

/** Locale do navegador → idioma da carta. Desconhecido cai em pt-BR (padrão do site). */
export function idiomaDaCarta(bruto: unknown): Idioma {
  const s = typeof bruto === "string" ? bruto.trim() : "";
  const exato = IDIOMAS.find((i) => i.toLowerCase() === s.toLowerCase());
  if (exato) return exato;
  // "pt", "pt-pt", "en-US", "es-419" → o prefixo decide.
  const prefixo = s.toLowerCase().split(/[-_]/)[0];
  if (prefixo === "en") return "en";
  if (prefixo === "es") return "es";
  return "pt-BR";
}

export type Destino =
  | { ok: true; base: string; redirectTo: string }
  | { ok: false; motivo: string };

/**
 * Hosts que NÃO podem receber um link de autenticação: máquina do dev, rede
 * interna, nomes que só resolvem dentro de uma LAN.
 *
 * Isto não é paranoia genérica — é exatamente o caso medido em (a) acima. O
 * Supabase não protege a casa disso: se o destino estiver na allowlist do
 * projeto, ele redireciona pra lá sem perguntar.
 */
function hostEhLocal(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "::1" || h === "0.0.0.0" || h === "[::1]") return true;
  if (h.endsWith(".local") || h.endsWith(".test") || h.endsWith(".localdomain")) return true;
  if (/^127\./.test(h)) return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

/**
 * Peneira do destino. `null`/vazio = usa a produção (caminho normal em prod).
 *
 * Recusa, com motivo nomeado: o que não é URL, o que não é https, e o que
 * aponta pra máquina local/rede interna. Quem chama trata `ok:false` como ERRO
 * DE CONFIGURAÇÃO e NÃO manda e-mail nenhum — mandar um link que queima a
 * credencial num destino morto é pior que não mandar.
 *
 * Usa `origin`, não a URL inteira: caminho/query/fragmento numa variável de
 * ambiente só teria como resultado um link malformado.
 */
export function destinoDeRecuperacao(bruto?: string | null): Destino {
  const cru = (bruto ?? "").trim();
  const alvo = cru || DESTINO_PADRAO;

  let u: URL;
  try {
    u = new URL(alvo);
  } catch {
    return { ok: false, motivo: `destino inválido (não é URL): ${alvo}` };
  }
  // O HOST vem antes do protocolo de propósito: o valor que aparece de verdade
  // numa máquina de dev é `http://localhost:3000`, e as duas regras o recusam.
  // Nomear o motivo certo ("local") é o que faz quem lê o log entender que a
  // variável do dev vazou pra configuração, em vez de sair caçando TLS.
  if (hostEhLocal(u.hostname)) {
    return { ok: false, motivo: `destino local recusado: ${u.host}` };
  }
  if (u.protocol !== "https:") {
    return { ok: false, motivo: `destino precisa ser https, veio ${u.protocol}//${u.host}` };
  }
  const base = u.origin;
  return { ok: true, base, redirectTo: `${base}${CAMINHO_DE_VOLTA}` };
}

/**
 * Formato do e-mail. NÃO diz se a conta existe — ninguém além do dono da caixa
 * recebe esta função, mas manter o texto neutro é o que permite que o mesmo
 * fluxo rode pra endereço que não temos sem inventar um segundo caminho.
 */
export function normalizarEmail(bruto: unknown): string | null {
  if (typeof bruto !== "string") return null;
  const e = bruto.trim().toLowerCase();
  if (!e || e.length > 254) return null;
  // Uma arroba, nada de espaço, ponto no domínio. Peneira de forma, não de
  // existência: quem valida de verdade é o Supabase, e ele responde igual pros
  // dois casos.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) return null;
  return e;
}

export type TextoDaCarta = { assunto: string; texto: string };

/** A carta, nos três idiomas do site. Texto puro — o `sendSupportMail` manda text/plain. */
export function textoDaRecuperacao(args: { link: string; email: string; idioma: Idioma }): TextoDaCarta {
  const { link, email, idioma } = args;
  const validade = VALIDADE_DO_LINK[idioma];
  const paginaPedido = `${DESTINO_PADRAO}/forgot-password`;

  if (idioma === "en") {
    return {
      assunto: "Your FastCloner password reset link",
      texto: [
        "Hi!",
        "",
        `Someone asked to set a new password for the FastCloner account of ${email}.`,
        "If it was you, open the link below:",
        "",
        link,
        "",
        `The link works once and expires in ${validade}. If it expires, ask for another`,
        `one at ${paginaPedido} — you can request as many as you need.`,
        "",
        "If it was not you, just ignore this email. Nothing changes in the account",
        "until the link is opened.",
        "",
        "Any trouble, just reply to this email — a real person reads it.",
        "",
        "— FastCloner team",
      ].join("\n"),
    };
  }

  if (idioma === "es") {
    return {
      assunto: "Tu enlace para crear una contraseña nueva en FastCloner",
      texto: [
        "¡Hola!",
        "",
        `Alguien pidió crear una contraseña nueva para la cuenta de FastCloner de ${email}.`,
        "Si fuiste vos, abrí el enlace de abajo:",
        "",
        link,
        "",
        `El enlace es de un solo uso y vence en ${validade}. Si vence, pedí otro en`,
        `${paginaPedido} — podés pedir todos los que necesites.`,
        "",
        "Si no fuiste vos, ignorá este correo. Nada cambia en la cuenta mientras el",
        "enlace no se abra.",
        "",
        "Cualquier duda, respondé este correo — lo lee una persona de verdad.",
        "",
        "— Equipo FastCloner",
      ].join("\n"),
    };
  }

  return {
    assunto: "Seu link pra criar uma senha nova no FastCloner",
    texto: [
      "Oi!",
      "",
      `Alguém pediu pra criar uma senha nova na conta do FastCloner de ${email}.`,
      "Se foi você, é só abrir o link abaixo:",
      "",
      link,
      "",
      `O link é de uso único e vence em ${validade}. Se ele vencer, peça outro em`,
      `${paginaPedido} — você pode pedir quantos precisar.`,
      "",
      "Se não foi você, pode ignorar este e-mail: nada muda na conta enquanto o",
      "link não for aberto.",
      "",
      "Qualquer problema, é só responder este e-mail — quem lê é gente de verdade.",
      "",
      "— Equipe FastCloner",
    ].join("\n"),
  };
}

// ---------------------------------------------------------------- o pedido

/**
 * A resposta pública. UMA constante, usada nos DOIS desfechos (conta existe e
 * conta não existe) — é isto que impede o vazamento de enumeração por
 * construção, e não uma promessa de que os dois ramos "escrevem a mesma coisa".
 */
export const RESPOSTA_PUBLICA = { ok: true } as const;

export type Veredicto =
  /** Nem chega a olhar conta nenhuma: config quebrada, formato inválido ou abuso. */
  | { acao: "recusar"; status: number; codigo: string; mensagem: string }
  /** Segue o fluxo. `publico` é o que a rota devolve — SEM esperar o envio. */
  | {
      acao: "despachar";
      email: string;
      idioma: Idioma;
      redirectTo: string;
      status: 200;
      publico: typeof RESPOSTA_PUBLICA;
    };

/**
 * DECIDE O QUE RESPONDER — e decide ANTES de qualquer consulta a conta.
 *
 * ⚠️ ESTA FUNÇÃO NÃO RECEBE NENHUMA INFORMAÇÃO SOBRE A CONTA, e isso é a
 * garantia de anti-enumeração: a resposta não PODE depender da existência do
 * usuário porque o dado não está aqui. O `resetPasswordForEmail` do Supabase
 * respondia igual nos dois casos de propósito; trocar o caminho sem reproduzir
 * essa propriedade transformaria a tela de "esqueci a senha" num verificador de
 * quem é aluno da casa.
 *
 * A ordem também importa: a peneira do DESTINO vem primeiro porque ela é
 * independente do e-mail — um destino quebrado falha igual pra todo mundo, e
 * por isso o 500 dela não conta nada sobre nenhuma conta.
 */
export function avaliarPedido(args: {
  email: unknown;
  idioma: unknown;
  destinoBruto?: string | null;
  /** Já passou do teto por IP? (o contador vive em lib/api/rate-ip.ts) */
  limitadoPorIp: boolean;
  /** Já passou do teto pra ESTE e-mail? Recebe o endereço já normalizado. */
  limitadoPorEmail: (email: string) => boolean;
}): Veredicto {
  const destino = destinoDeRecuperacao(args.destinoBruto);
  if (!destino.ok) {
    // Falha ALTA e de config: ninguém recebe link, e o motivo vai pro log de
    // quem chama. Não vaza nada — não dependeu de e-mail nenhum.
    return {
      acao: "recusar",
      status: 500,
      codigo: "destino_invalido",
      mensagem: destino.motivo,
    };
  }

  const email = normalizarEmail(args.email);
  if (!email) {
    // Erro de FORMATO, não de existência: "abc" não é endereço em lugar nenhum.
    return {
      acao: "recusar",
      status: 400,
      codigo: "bad_request",
      mensagem: "Missing or invalid 'email'",
    };
  }

  // Abuso primeiro por IP (vale pra quem varre uma lista), depois por e-mail
  // (o cooldown que o Supabase dava de graça e a gente perde ao sair do
  // caminho dele — ver forgot-password-form.tsx:38 antes deste PR).
  if (args.limitadoPorIp || args.limitadoPorEmail(email)) {
    return {
      acao: "recusar",
      status: 429,
      codigo: "rate_limited",
      mensagem: "Muitos pedidos em sequência. Espere um minuto e tente de novo.",
    };
  }

  return {
    acao: "despachar",
    email,
    idioma: idiomaDaCarta(args.idioma),
    redirectTo: destino.redirectTo,
    status: 200,
    publico: RESPOSTA_PUBLICA,
  };
}

export type RespostaHttp = { status: number; corpo: Record<string, unknown> };

/**
 * O veredicto virado resposta HTTP, no formato do `lib/api/responses.ts`.
 *
 * Existe pra que o TESTE possa afirmar sobre o MESMO objeto que a rota devolve.
 * Se o teste montasse a resposta por conta própria, ele provaria a igualdade de
 * uma cópia — e a cópia é justamente o que diverge sem ninguém ver.
 */
export function respostaDoVeredicto(v: Veredicto): RespostaHttp {
  if (v.acao === "recusar") {
    return { status: v.status, corpo: { error: { code: v.codigo, message: v.mensagem } } };
  }
  return { status: v.status, corpo: { ...v.publico } };
}

// ---------------------------------------------------------------- o despacho

export type CanaisRecuperacao = {
  /**
   * `admin.auth.admin.generateLink({type:'recovery'})`. NÃO dispara e-mail do
   * Supabase — só devolve a URL (ver o comentário em sgp-boas-vindas-canal.ts).
   * `semConta: true` quando o Supabase diz que o endereço não tem usuário.
   */
  gerarLink: (args: {
    email: string;
    redirectTo: string;
  }) => Promise<{ link: string | null; semConta: boolean; erro: string | null }>;
  /** `sendSupportMail` — é ELE que registra em `emails_enviados`. Lança em falha. */
  enviar: (args: { to: string; assunto: string; texto: string }) => Promise<void>;
};

export type Desfecho =
  | { passo: "enviado"; email: string }
  /** Endereço sem conta: nada é enviado. O aluno vê a MESMA tela do caso de sucesso. */
  | { passo: "sem-conta"; email: string }
  | { passo: "falhou"; email: string; etapa: "link" | "envio"; erro: string };

/**
 * FAZ o trabalho: gera o link e manda pelo SMTP da casa.
 *
 * ⚠️ O DESFECHO DAQUI NUNCA VAI PRA RESPOSTA HTTP. Ele existe pro LOG, que é o
 * outro metade do conserto: hoje, quando um aluno diz "não chega", a ronda não
 * tem onde olhar. Quem chama roda isto SEM esperar (`void ... .catch`), pelos
 * dois motivos: (1) o SMTP leva segundos e a conta inexistente não leva nada —
 * esperar transformaria o TEMPO da resposta no oráculo que o corpo da resposta
 * não é; (2) a tela não tem o que fazer com o resultado, porque ela não pode
 * contar o resultado pro visitante de qualquer jeito.
 *
 * NUNCA LANÇA: devolve `falhou` com a etapa. Exceção solta aqui viraria
 * unhandled rejection no processo do pm2.
 */
export async function despacharRecuperacao(args: {
  email: string;
  idioma: Idioma;
  redirectTo: string;
  canais: CanaisRecuperacao;
}): Promise<Desfecho> {
  const { email, idioma, redirectTo, canais } = args;

  let link: string | null = null;
  try {
    const r = await canais.gerarLink({ email, redirectTo });
    if (r.semConta) return { passo: "sem-conta", email };
    if (r.erro || !r.link) {
      return { passo: "falhou", email, etapa: "link", erro: r.erro ?? "generateLink sem action_link" };
    }
    link = r.link;
  } catch (e) {
    return { passo: "falhou", email, etapa: "link", erro: e instanceof Error ? e.message : String(e) };
  }

  const { assunto, texto } = textoDaRecuperacao({ link, email, idioma });
  try {
    await canais.enviar({ to: email, assunto, texto });
  } catch (e) {
    return { passo: "falhou", email, etapa: "envio", erro: e instanceof Error ? e.message : String(e) };
  }
  return { passo: "enviado", email };
}

/**
 * O Supabase diz "não existe usuário com esse e-mail" de mais de um jeito
 * (mensagem muda entre versões do GoTrue). Fica aqui, com o resto da decisão,
 * pra não virar regex solta dentro da rota.
 *
 * ⚠️ Isto NÃO muda o que o visitante vê — `sem-conta` e `enviado` dão a mesma
 * resposta. Serve só pra separar, no log, "não tem conta" de "quebrou", que são
 * dois problemas diferentes pra quem faz a ronda.
 */
export function ehUsuarioInexistente(mensagem: string | null | undefined): boolean {
  const m = (mensagem ?? "").toLowerCase();
  if (!m) return false;
  return (
    m.includes("user not found") ||
    m.includes("user_not_found") ||
    m.includes("no user found") ||
    m.includes("unable to find user")
  );
}
