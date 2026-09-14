/**
 * BOUNCE: a resposta que voltou. Módulo PURO (zero IO, zero import) —
 * o lado que grava incidente vive em `mail-bounce-registro.ts`.
 *
 * POR QUE EXISTE (chamado #201, medido 30/08). A gente manda por submission
 * autenticada na 587 e só espera o `250` do fim do DATA. Esse 250 significa
 * "aceitei a mensagem para entrega", NÃO "o aluno recebeu": o filtro de saída
 * do Private Email/Namecheap roda DEPOIS e devolve 550 por BOUNCE, que chega
 * como e-mail normal na INBOX do suporte@. Ninguém triava esse e-mail:
 * `SKIP_FROM` casava `mailer-daemon` e a mensagem ia direto pro `markSeen`.
 *
 * O estrago é uma FALHA SILENCIOSA, que é a única que sobrevive: a fila
 * acredita que o aluno foi respondido (a Fast marcou como lida, o incidente
 * fechou) e o aluno está em silêncio. Medido: 21 bounces de 07/08 a 30/08, 7
 * destinatários distintos, nenhum tratado. O Tulio Canella gastou 10.000
 * créditos retreinando a voz porque a explicação nunca chegou nele.
 *
 * ⚠️ TRÊS ARMADILHAS que este parser existe pra não cair (todas medidas nos
 * bounces reais da caixa, não imaginadas):
 *
 *  1. `Action: delayed` NÃO É BOUNCE. O jellyfish manda "Delivery Status
 *     Notification (Delay)" com `451 Temporarily unable to process` e a frase
 *     "Delivery will be retried". Tratar isso como falha reabriria caso de
 *     aluno que RECEBEU a mensagem dez minutos depois.
 *
 *  2. O `Status:` do DSN MENTE sobre a classe. No bounce de caixa cheia
 *     (uid 259) o `Status:` é `5.0.0` — permanente — mas o `Diagnostic-Code`
 *     é `452-4.2.2 out of storage space`, que é TEMPORÁRIO. Quem classifica
 *     aqui é o Diagnostic-Code; o Status só decide permanente vs temporário
 *     quando não há diagnóstico nenhum.
 *
 *  3. UM BOUNCE PODE NÃO SER DO ALUNO. Toda resposta sai com cópia oculta pros
 *     admins, então o bounce lista VÁRIOS destinatários — no uid 380 vieram
 *     `tuliocanella@hotmail.com` E `suporte@lucasarrial.com` no mesmo relatório.
 *     Se a gente não separasse, o bounce da CÓPIA INTERNA reabriria o caso de
 *     um aluno que recebeu a mensagem sem problema nenhum. E o `Final-Recipient`
 *     do jellyfish às vezes traz a lista inteira separada por vírgula num campo
 *     só (uid 277), então não dá pra confiar em "um campo, um endereço".
 */

// O histórico de contato é o único import daqui, e continua sem IO: o
// `contato-tentativas.ts` também é puro, então este módulo segue testável com
// `node --test` sem Supabase. Extensão `.ts` explícita porque é assim que o
// type-stripping nativo resolve (mesmo padrão de `failure-alert.ts`).
import { blocoDeTentativas, passoDoHistorico, type ResumoDeContato } from "./contato-tentativas.ts";

// ---------- o que é bounce ----------

/** Daemons que já vimos escrevendo pra caixa do suporte@. */
const REMETENTE_DAEMON =
  /(^|<|\s)(mailer-daemon|postmaster)@|@bounces\.[\w.-]+$|mail delivery (system|subsystem)/i;

/** Assuntos padronizados de relatório de entrega (Postfix e ZoneMTA/jellyfish). */
const ASSUNTO_BOUNCE =
  /undelivered mail returned to sender|delivery status notification|returned mail|delivery (failure|incomplete)|mail delivery failed|undeliverable/i;

/**
 * É um relatório de entrega? Vale pro DELAY também — quem decide o que fazer
 * é `parseBounce`, olhando a Action. Detectar aqui e descartar depois é de
 * propósito: um delay silencioso também é informação (ver `tipo`).
 *
 * Reconhece por TRÊS caminhos independentes, porque nenhum é confiável
 * sozinho: `Content-Type: multipart/report` é o sinal forte (RFC 3464) mas
 * some quando a mensagem vem truncada só com cabeçalhos; remetente e assunto
 * cobrem esse caso.
 */
export function pareceBounce(args: { raw: string; fromEmail?: string; subject?: string }): boolean {
  const { raw } = args;
  const de = args.fromEmail ?? "";
  const assunto = args.subject ?? "";
  if (/^content-type:\s*multipart\/report/im.test(raw) && /report-type=delivery-status/i.test(raw)) {
    return true;
  }
  if (REMETENTE_DAEMON.test(de)) return true;
  if (ASSUNTO_BOUNCE.test(assunto) && (REMETENTE_DAEMON.test(raw.slice(0, 4000)) || /^x-failed-recipients:/im.test(raw))) {
    return true;
  }
  return false;
}

// ---------- classes de falha ----------

/**
 * Classes DIFERENTES pedem tratamento DIFERENTE — tratar tudo como "não
 * entregou" perderia justamente a informação que decide o que fazer:
 * `spam-saida` é problema NOSSO e nenhum reenvio pelo mesmo caminho resolve;
 * `caixa-cheia` é temporário e reenviar amanhã funciona; `inexistente` é
 * endereço errado e reenviar NUNCA funciona.
 */
export type ClasseBounce =
  /** 550 JFE0400xx — o filtro de SAÍDA do Namecheap barrou a NOSSA mensagem. */
  | "spam-saida"
  /** 550 5.7.x — o destino barrou nosso IP/domínio (ex.: S3150 da Microsoft). */
  | "bloqueio-destino"
  /** 550 5.1.1 — endereço não existe. Reenviar pra ele é jogar fora. */
  | "inexistente"
  /** 452/552 4.2.2 — caixa do destinatário cheia. Temporário. */
  | "caixa-cheia"
  /** 4.x.x — falha temporária; o servidor ainda vai tentar. */
  | "temporaria"
  /** Não deu pra classificar: NUNCA vira silêncio, vira caso pra olho humano. */
  | "desconhecida";

export type TipoRelatorio = "falha" | "atraso";

/**
 * O que o DNS REAL do domínio do destinatário respondeu.
 *
 * POR QUE EXISTE (chamado #402, medido 14/09). Julgar falha de MX pela FRASE do
 * bounce é corrida perdida: cada provedor escreve do seu jeito e a gente sempre
 * chega atrasado. Este arquivo foi remendado DUAS vezes em 13/09 pelo mesmo
 * motivo e furou de novo no dia seguinte — o Google escreve "No MX server
 * found" e o padrão daqui exigia "no mx record|hosts", então um bounce
 * PERMANENTE (`pradocomunicacao.com`, sem MX e sem A) caiu em `desconhecida`.
 *
 * A saída não é um terceiro remendo: quando o bounce culpa a resolução de
 * MX/DNS, a gente PERGUNTA AO DNS em vez de interpretar prosa. Isso é
 * determinístico, vale pra qualquer provedor e não depende de redação.
 *
 * Quem produz este veredito é o `mail-bounce-dns.ts` (tem IO); aqui só mora o
 * que ele SIGNIFICA para a classe, que é a parte que precisa ser testável.
 */
export type VeredictoDns =
  /**
   * O domínio não recebe e-mail de ninguém: nem MX utilizável, nem A/AAAA (que
   * por RFC 5321 §5.1 serve de MX implícito), OU publica MX NULO (RFC 7505).
   */
  | "sem-registro"
  /** Publica MX utilizável (ou A/AAAA): é alcançável, a falha foi de momento. */
  | "resolve"
  /** SERVFAIL, timeout, resolvedor fora do ar. NÃO carimba nada — é ignorância, não prova. */
  | "indeterminado";

export type DestinatarioQueFalhou = {
  email: string;
  classe: ClasseBounce;
  /** O texto cru do servidor remoto — a prova, sem interpretação nossa. */
  diagnostico: string;
  /** `Action:` do DSN: "failed", "delayed", "expanded"... */
  acao: string;
  /** true = endereço nosso/da equipe (cópia oculta), não é o aluno. */
  interno: boolean;
  /**
   * Veredito do DNS do domínio deste endereço, quando foi consultado. Ausente
   * no parse puro: é o `mail-bounce-dns.ts` que preenche, e só quando o
   * diagnóstico culpa MX/DNS. Vai pro chamado como PROVA do que decidiu a
   * classe — sem isso o humano lê "inexistente" e não sabe se foi frase ou fato.
   */
  dns?: VeredictoDns;
};

export type Bounce = {
  tipo: TipoRelatorio;
  /** Destinatários que falharam, com a classe de cada um. */
  destinatarios: DestinatarioQueFalhou[];
  /** Message-ID da mensagem que a gente mandou (pra casar com o envio). */
  messageIdOriginal: string | null;
  /** Assunto do que a gente mandou — é o que identifica o caso pro humano. */
  assuntoOriginal: string | null;
};

/**
 * Evidência de CAIXA que não existe — o defeito está no endereço, não no
 * domínio. Separado de `pareceFalhaDeMx` porque as duas coisas chegam ao mesmo
 * `inexistente` por caminhos diferentes, e na hora de reavaliar com o DNS a
 * diferença decide: domínio que resolve não desmente "user unknown".
 *
 * Note que `address (does not|doesn't) exist` NÃO casa aqui: o Gmail escreve
 * "account that you tried to reach does not exist", e "no such user" não casa
 * "NoSuchUser" (sem espaços) da URL de ajuda.
 */
export function pareceCaixaInexistente(diagnostico: string): boolean {
  const d = diagnostico || "";
  return (
    /\b5\.1\.[01]\b/.test(d) ||
    /(user unknown|no such user|address (does not|doesn't) exist|recipient (address )?rejected|unknown recipient)/i.test(d) ||
    /account that you tried to reach (does not exist|is disabled)/i.test(d) ||
    /\bNoSuchUser\b/i.test(d)
  );
}

/**
 * Frases ESTREITAS de falha de MX que, sozinhas, já bastam pra carimbar
 * permanente. Fica como REDE, não como regra: se o DNS responder, quem manda é
 * ele (ver `classeComDns`) — inclusive pra DESMENTIR isto aqui, que é o caso da
 * queda transitória de resolvedor que o comentário abaixo sempre temeu.
 */
// `servers?` entra junto de `record|hosts?` porque a main ganhou essa palavra
// enquanto este PR esperava: quando o DNS NAO responde, sobra so esta rede, e
// ela nao pode ser mais fraca do que o que ja esta em producao hoje.
const MX_FALHOU_ESTREITO = /failed to resolve any ip addresses for the mail exchange|\bno mx (record|hosts?|servers?)\b/i;

/**
 * O bounce culpa a RESOLUÇÃO de MX/DNS do domínio do destinatário?
 *
 * ⚠️ Este padrão é LARGO de propósito, ao contrário de tudo o mais neste
 * arquivo — e só pode ser largo porque ele NÃO decide nada: ele só manda
 * perguntar ao DNS. Acertar de menos aqui devolve a classe de hoje; acertar de
 * mais custa uma consulta de DNS que responde "resolve" e não muda nada.
 * É exatamente a inversão que tira a gente da corrida contra a redação de cada
 * provedor — a que perdemos três vezes neste mesmo arquivo em dois dias.
 */
export function pareceFalhaDeMx(diagnostico: string): boolean {
  const d = diagnostico || "";
  return (
    MX_FALHOU_ESTREITO.test(d) ||
    // "No MX server found" (Google), "no MX for domain", "No MX hosts".
    /\bno mx\b/i.test(d) ||
    /\bmx (record|server|host)s?\b/i.test(d) ||
    /mail exchange/i.test(d) ||
    /dns (error|problem|failure)/i.test(d) ||
    /(host or domain name not found|domain (name )?not found|name service error|unrouteable address)/i.test(d) ||
    /(failed to resolve|unable to resolve|could ?n.t resolve|cannot resolve)/i.test(d)
  );
}

/**
 * Reavalia a classe à luz do DNS REAL do domínio do destinatário.
 *
 * Só opina quando o próprio bounce culpou MX/DNS — em bounce de caixa cheia ou
 * de spam de saída o DNS do destino não diz nada sobre a causa, e deixar ele
 * "corrigir" essas classes apagaria a prova que já temos.
 *
 * As três saídas, e por que cada uma:
 *  - `sem-registro`: o domínio não recebe e-mail de NINGUÉM (sem MX/A, ou MX
 *    nulo). Isso é fato verificável, não redação: reenviar nunca vai funcionar.
 *  - `resolve`: o domínio é alcançável AGORA, então a falha de resolução foi de
 *    momento. Aqui o DNS DESMENTE um `inexistente` que tenha vindo só da frase
 *    — é este caso que o padrão estreito nunca conseguiu distinguir sozinho.
 *    Mas evidência de CAIXA inexistente ganha: "user unknown" continua sendo
 *    sobre o endereço, e um domínio que resolve não o contradiz.
 *  - `indeterminado`: a gente não sabe. Não mexe. Ignorância não vira veredito.
 */
export function classeComDns(atual: ClasseBounce, diagnostico: string, veredito: VeredictoDns): ClasseBounce {
  if (!pareceFalhaDeMx(diagnostico)) return atual;
  // Classes com prova própria e alheia ao DNS do destino não se tocam.
  if (atual !== "desconhecida" && atual !== "temporaria" && atual !== "inexistente") return atual;
  if (veredito === "sem-registro") return "inexistente";
  if (veredito === "resolve") return pareceCaixaInexistente(diagnostico) ? atual : "temporaria";
  return atual;
}

/** Domínio de um endereço, normalizado pra consulta de DNS. */
export function dominioDoEmail(email: string): string {
  const i = (email || "").lastIndexOf("@");
  if (i < 0) return "";
  // O ponto final aqui é o do FQDN do ENDEREÇO (`fulano@dominio.com.`), que é
  // só notação. NÃO confundir com o alvo `.` de um MX nulo (RFC 7505), que é
  // outra coisa e se mede em `mail-bounce-dns.ts`.
  return email.slice(i + 1).trim().toLowerCase().replace(/\.+$/, "");
}

/**
 * Classifica pelo texto do servidor remoto.
 *
 * A ORDEM IMPORTA e não é arbitrária: `JFE` vem primeiro porque a mensagem do
 * Namecheap também casa "high probability of spam" e a gente precisa saber que
 * o barramento foi NOSSO, não do destino. `4.2.2` vem antes da regra genérica
 * de 4.x.x porque caixa cheia tem tratamento próprio (avisar por outro canal),
 * e vem antes de 5.x.x porque o Status do DSN mente (ver armadilha 2 no topo).
 */
export function classificarDiagnostico(diagnostico: string, status?: string | null): ClasseBounce {
  const d = (diagnostico || "").replace(/\s+/g, " ").trim();
  if (!d) {
    if (status && /^4\./.test(status)) return "temporaria";
    if (status && /^5\./.test(status)) return "desconhecida";
    return "desconhecida";
  }
  // Filtro de SAÍDA do Namecheap/jellyfish: a culpa é do nosso lado.
  //
  // ⚠️ A FRASE SOZINHA BASTA, e isso é correção de 13/09 (uid 608). A versão
  // anterior exigia o código `JFE\d{6}`, sob a premissa de que o Namecheap
  // sempre o carimba. Ele NÃO sempre: o bounce de `luctec@gmail.com` veio com
  // "smtp; 550 Rejected due to high probability of spam" e mais nada, caiu em
  // `desconhecida`, e com isso a casa não soube que o barramento tinha sido
  // DELA. Prova de que é saída e não destino, no mesmo relatório: o MESMO
  // bounce derrubou o aluno E a nossa cópia interna (`suporte@lucasarrial.com`).
  // Se quem tivesse recusado fosse o Gmail, só o endereço do aluno falharia —
  // os dois falhando significa que a mensagem não passou do nosso próprio relay.
  if (/\bJFE\d{6}\b/i.test(d) || /jellyfish-error-codes/i.test(d) || /high probability of spam/i.test(d)) {
    return "spam-saida";
  }
  // Caixa cheia — 4.2.2 (gmail manda como 452-4.2.2, alguns como 552).
  if (/\b[45]\.2\.2\b/.test(d) || /(out of storage space|mailbox (is )?full|quota exceeded|over quota)/i.test(d)) {
    return "caixa-cheia";
  }
  // Endereço não existe.
  //
  // ⚠️ A PROSA DO GMAIL SEM CÓDIGO, corrigida em 13/09. O Gmail manda a MESMA
  // frase com e sem o `550-5.1.1` na frente, e a casa classificava as duas
  // DIFERENTE: uid 607 (com o código) virava `inexistente`, uid 588/589/590/
  // 591/606 (sem o código) viravam `desconhecida`. Mesma mensagem, mesmo
  // defeito, dois destinos — só porque um trecho numérico veio junto. Note que
  // `address (does not|doesn't) exist` NÃO casa aqui: o Gmail escreve "account
  // that you tried to reach does not exist", e "no such user" não casa
  // "NoSuchUser" (sem espaços) da URL de ajuda.
  //
  // ⚠️ DOMÍNIO QUE NÃO RECEBE E-MAIL NENHUM (uid 605, Sheila, 13/09). Ela
  // digitou "gmail.com.br" no checkout. Esse domínio publica MX NULO
  // (`0 .`, RFC 7505), que é a forma de um domínio declarar que NÃO aceita
  // e-mail — conferido com `dig MX gmail.com.br` nesta ronda. Logo é PERMANENTE
  // e a orientação de `inexistente` ("reenviar NUNCA vai funcionar, confirme o
  // e-mail real no cadastro/Hotmart") é exatamente a certa. O DSN também veio
  // com `Action: failed`, não `delayed`, que por RFC 3464 já é permanente.
  //
  // ⚠️ AQUI A FRASE NÃO DECIDE MAIS SOZINHA (chamado #402, 14/09). O padrão de
  // MX continua ESTREITO pra não carimbar como definitiva uma queda transitória
  // de resolvedor — mas ele virou REDE, não juiz: quem julga falha de MX é o
  // DNS de verdade, em `classeComDns`, depois do parse. Dois efeitos:
  //   · a frase que ninguém previu ("No MX server found", do Google) não cai
  //     mais em `desconhecida` por uma palavra fora do regex;
  //   · a frase prevista, quando o domínio ESTÁ no ar, é DESMENTIDA em vez de
  //     virar "endereço não existe".
  // Sem o DNS responder (resolvedor fora do ar), sobra esta rede, que é o
  // comportamento de antes — nunca menos que hoje.
  if (pareceCaixaInexistente(d) || MX_FALHOU_ESTREITO.test(d)) {
    return "inexistente";
  }
  // Destino bloqueou a gente (S3150 da Microsoft e parentes).
  if (/\b5\.7\.\d+\b/.test(d) || /\bS\d{4}\b/.test(d) || /(blocked|banned|blacklist|not authorized|policy)/i.test(d)) {
    return "bloqueio-destino";
  }
  if (/(^|\s)5\d\d[\s-]/.test(d) || /\b5\.\d\.\d\b/.test(d)) return "desconhecida";
  if (/(^|\s)4\d\d[\s-]/.test(d) || /\b4\.\d\.\d\b/.test(d)) return "temporaria";
  return "desconhecida";
}

// ---------- parse ----------

/** Desdobra cabeçalho MIME quebrado em várias linhas (continuação com espaço). */
function desdobrar(bloco: string): string {
  return bloco.replace(/\r?\n[ \t]+/g, " ");
}

/** Desfaz quoted-printable — o jellyfish manda o relatório assim. */
function desQuotedPrintable(s: string): string {
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Desfaz encoded-word (RFC 2047). O assunto original vem assim quando tem
 * acento — e ele vai pro TÍTULO do chamado: sem isto o time lê
 * "=?UTF-8?B?RGV2b2x2ZW1vcy..." no quadro e não faz ideia de qual caso é.
 */
function decodificarPalavra(s: string): string {
  return s.replace(/=\?([^?]+)\?([BQ])\?([^?]*)\?=/gi, (m, _cs, enc, dados) => {
    try {
      if (String(enc).toUpperCase() === "B") return Buffer.from(dados, "base64").toString("utf8");
      const bytes = String(dados)
        .replace(/_/g, " ")
        .replace(/=([0-9A-F]{2})/gi, (_x, h) => String.fromCharCode(parseInt(h, 16)));
      return Buffer.from(bytes, "latin1").toString("utf8");
    } catch {
      return m;
    }
  });
}

/** Um cabeçalho simples do topo da mensagem. */
function cabecalho(raw: string, nome: string): string | null {
  const m = raw.match(new RegExp(`^${nome}:[ \\t]*(.*(?:\\r?\\n[ \\t].*)*)`, "mi"));
  return m ? desdobrar(m[1]).trim() : null;
}

/** Endereços de um texto livre (lista separada por vírgula, `<x@y>`, etc.). */
function enderecosDe(texto: string): string[] {
  const achados = texto.match(/[\w.!#$%&'*+/=?^`{|}~-]+@[\w-]+(?:\.[\w-]+)+/g) ?? [];
  return achados.map((e) => e.toLowerCase());
}

/**
 * Só a parte `message/delivery-status` (RFC 3464), que é a fonte ESTRUTURADA.
 * O texto humano do começo do bounce muda de servidor pra servidor; este bloco
 * não. Quando ele não existe, caímos no texto — mas preferimos sempre este.
 */
function blocoDeliveryStatus(raw: string): string | null {
  const i = raw.search(/content-type:\s*message\/delivery-status/i);
  if (i < 0) return null;
  const resto = raw.slice(i);
  const inicio = resto.search(/\r?\n\r?\n/);
  if (inicio < 0) return null;
  let corpo = resto.slice(inicio);
  // Termina no próximo boundary MIME.
  const fim = corpo.search(/\r?\n--[-=_a-zA-Z0-9]{6,}/);
  if (fim > 0) corpo = corpo.slice(0, fim);
  return desQuotedPrintable(corpo);
}

/**
 * Lê os grupos `Final-Recipient / Action / Status / Diagnostic-Code` do DSN.
 * Um grupo por destinatário — e o `Final-Recipient` pode trazer uma LISTA
 * separada por vírgula (jellyfish, uid 277), então cada grupo pode render
 * vários endereços com a MESMA classe.
 */
function lerGruposDsn(bloco: string): Array<{ emails: string[]; acao: string; status: string; diagnostico: string }> {
  const grupos: Array<{ emails: string[]; acao: string; status: string; diagnostico: string }> = [];
  // Quebra em pedaços que começam num Final-Recipient.
  const partes = desdobrar(bloco).split(/^(?=Final-Recipient:)/mi).filter((p) => /^Final-Recipient:/i.test(p.trim()));
  for (const parte of partes) {
    const emails = enderecosDe(parte.match(/^Final-Recipient:[^\n]*/im)?.[0] ?? "");
    if (!emails.length) continue;
    grupos.push({
      emails,
      acao: (parte.match(/^Action:[ \t]*(\S+)/im)?.[1] ?? "").toLowerCase(),
      status: (parte.match(/^Status:[ \t]*([\d.]+)/im)?.[1] ?? "").trim(),
      diagnostico: (parte.match(/^Diagnostic-Code:[ \t]*([^\n]*)/im)?.[1] ?? "").trim(),
    });
  }
  return grupos;
}

/** O Message-ID/assunto do que A GENTE mandou, vindo da cópia anexada. */
function original(raw: string): { messageId: string | null; assunto: string | null } {
  // Postfix anexa `message/rfc822`; o jellyfish anexa `text/rfc822-headers`.
  const i = raw.search(/content-type:\s*(message\/rfc822|text\/rfc822-headers)/i);
  if (i >= 0) {
    const anexo = desQuotedPrintable(raw.slice(i));
    const messageId = cabecalho(anexo, "Message-ID")?.match(/<[^>]+>/)?.[0] ?? null;
    const assuntoCru = cabecalho(anexo, "Subject");
    const assunto = assuntoCru ? decodificarPalavra(assuntoCru) : null;
    if (messageId || assunto) return { messageId, assunto };
  }
  // O jellyfish também devolve o Message-ID original no In-Reply-To do bounce.
  const emResposta = cabecalho(raw, "In-Reply-To")?.match(/<[^>]+>/)?.[0] ?? null;
  return { messageId: emResposta, assunto: null };
}

/**
 * Endereço NOSSO (cópia oculta, encaminhamento pro time) e não do aluno.
 * Recebe a lista por parâmetro pra este módulo continuar puro — quem chama
 * monta a lista a partir do BCC de admin e do domínio do suporte.
 */
export function ehInterno(email: string, internos: string[]): boolean {
  const e = email.toLowerCase();
  return internos.some((i) => {
    const alvo = i.toLowerCase().trim();
    if (!alvo) return false;
    return alvo.startsWith("@") ? e.endsWith(alvo) : e === alvo;
  });
}

/**
 * Extrai o que interessa de um relatório de entrega.
 *
 * `internos` são os endereços/domínios nossos — os destinatários deles são
 * marcados, nunca descartados: um bounce que pegou SÓ a cópia interna ainda é
 * um sinal (nosso IP está sujo), só não é motivo pra reabrir caso de aluno.
 *
 * Devolve `null` quando não é bounce nenhum.
 */
export function parseBounce(raw: string, internos: string[] = []): Bounce | null {
  const assunto = cabecalho(raw, "Subject") ?? "";
  const de = cabecalho(raw, "From") ?? "";
  if (!pareceBounce({ raw, fromEmail: de, subject: assunto })) return null;

  const bloco = blocoDeliveryStatus(raw);
  const grupos = bloco ? lerGruposDsn(bloco) : [];

  const destinatarios: DestinatarioQueFalhou[] = [];
  for (const g of grupos) {
    for (const email of g.emails) {
      destinatarios.push({
        email,
        acao: g.acao,
        diagnostico: g.diagnostico.replace(/\s+/g, " ").trim(),
        classe: classificarDiagnostico(g.diagnostico, g.status),
        interno: ehInterno(email, internos),
      });
    }
  }

  // Sem DSN estruturado: o cabeçalho X-Failed-Recipients (jellyfish) é a única
  // pista que sobrevive quando a mensagem vem truncada só com cabeçalhos.
  if (destinatarios.length === 0) {
    const falhos = enderecosDe(cabecalho(raw, "X-Failed-Recipients") ?? "");
    for (const email of falhos) {
      destinatarios.push({
        email,
        acao: "failed",
        diagnostico: "",
        classe: "desconhecida",
        interno: ehInterno(email, internos),
      });
    }
  }

  // ATRASO ≠ FALHA. Basta UM destinatário com `Action: failed` pra isto ser
  // um bounce de verdade; se todos vieram "delayed", o servidor ainda vai
  // tentar e reabrir caso agora seria alarme falso (ver armadilha 1).
  const houveFalha = destinatarios.some((d) => d.acao === "failed");
  const soAtraso =
    destinatarios.length > 0 && destinatarios.every((d) => d.acao === "delayed" || d.acao === "delivered");
  const pareceAtrasoPeloAssunto = /\(delay\)|delivery incomplete|will be retried/i.test(assunto + " " + raw.slice(0, 3000));

  const tipo: TipoRelatorio = houveFalha ? "falha" : soAtraso || pareceAtrasoPeloAssunto ? "atraso" : "falha";

  const o = original(raw);
  return {
    tipo,
    // No relatório de FALHA, quem veio "delayed" no meio não é vítima.
    destinatarios: tipo === "falha" ? destinatarios.filter((d) => d.acao !== "delayed") : destinatarios,
    messageIdOriginal: o.messageId,
    assuntoOriginal: o.assunto,
  };
}

// ---------- o que fazer com cada classe (texto, não ação) ----------

/**
 * O que a classe SIGNIFICA e qual é o próximo passo humano. Fica aqui, junto
 * da classificação, pra descrição do chamado nunca divergir da regra que o
 * produziu — e pra quem abrir o quadro não precisar saber o que é um 550.
 */
export const ORIENTACAO: Record<ClasseBounce, { resumo: string; passo: string; nossa: boolean }> = {
  "spam-saida": {
    resumo: "o filtro de saída do nosso próprio provedor (Namecheap/jellyfish) recusou a mensagem como spam",
    passo:
      "NÃO adianta reenviar pelo mesmo caminho — sai o mesmo 550. Falar com o aluno por outro canal (WhatsApp) e tratar a reputação da saída do suporte@.",
    nossa: true,
  },
  "bloqueio-destino": {
    resumo: "o servidor do destinatário bloqueou nosso IP/domínio",
    passo: "Reenviar não resolve enquanto o bloqueio durar. Avisar o aluno por outro canal e registrar o destino bloqueado.",
    nossa: true,
  },
  inexistente: {
    resumo: "o endereço não existe no servidor de destino",
    passo:
      "Reenviar para este endereço NUNCA vai funcionar. Confirmar o e-mail real do aluno no cadastro/Hotmart antes de qualquer novo envio.",
    nossa: false,
  },
  "caixa-cheia": {
    resumo: "a caixa do destinatário está sem espaço (falha temporária)",
    passo: "Tentar de novo mais tarde costuma funcionar. Se persistir, avisar por outro canal — ele não recebe NADA enquanto estiver cheia.",
    nossa: false,
  },
  temporaria: {
    resumo: "falha temporária na entrega",
    passo: "O servidor ainda tenta sozinho. Só virar caso se repetir.",
    nossa: false,
  },
  desconhecida: {
    resumo: "a entrega falhou e o motivo não foi reconhecido",
    passo: "Ler o diagnóstico cru abaixo e classificar na mão — não presumir que o aluno recebeu.",
    nossa: false,
  },
};

// ---------- o PLANO (decisão pura; quem grava é o mail-bounce-registro) ----------

export type AcaoDeBounce = {
  email: string;
  classe: ClasseBounce;
  /** Dedupe do chamado. */
  signature: string;
  /** Fila do chamado: "tecnico" = ação nossa resolve; "atendimento" = precisa de gente. */
  categoria: "tecnico" | "atendimento";
  titulo: string;
  descricao: string;
  /** Nota que vai no chamado REABERTO — explica por que ele voltou. */
  motivoReabertura: string;
  diagnostico: string;
};

export type PlanoDeBounce = {
  tipo: TipoRelatorio;
  /** O que fazer por ALUNO que ficou sem a resposta. */
  alunos: AcaoDeBounce[];
  /** Quando SÓ a cópia interna quicou: sinal nosso, sem vítima do lado do aluno. */
  interno: AcaoDeBounce | null;
};

/**
 * A PROVA de DNS, em texto, quando ela participou da classe. Vai pro chamado
 * junto do diagnóstico cru pelo mesmo motivo que ele: quem abre o quadro tem
 * que poder conferir o que decidiu a classe, em vez de acreditar na palavra do
 * classificador.
 */
function provaDns(email: string, dns: VeredictoDns | undefined): string | null {
  if (!dns) return null;
  const dominio = dominioDoEmail(email) || "(domínio ilegível)";
  if (dns === "sem-registro") {
    return `DNS conferido no momento do bounce: "${dominio}" não publica MX utilizável nem A/AAAA (ou publica MX nulo, RFC 7505) — não recebe e-mail de ninguém.`;
  }
  if (dns === "resolve") {
    return `DNS conferido no momento do bounce: "${dominio}" resolve normalmente — a falha de resolução do relatório foi de momento, não definitiva.`;
  }
  return `DNS conferido no momento do bounce: não deu pra saber se "${dominio}" resolve (SERVFAIL/timeout) — a classe veio só do texto do servidor.`;
}

function descrever(a: {
  email: string;
  classe: ClasseBounce;
  diagnostico: string;
  assuntoOriginal: string | null;
  messageIdOriginal: string | null;
  /** Histórico de contato já resumido. Ausente = ficha nasce como antes. */
  contato?: ResumoDeContato | null;
  agoraMs?: number;
  dns?: VeredictoDns;
}): string {
  const o = ORIENTACAO[a.classe];
  const agoraMs = a.agoraMs ?? Date.now();
  // O PASSO DEIXA DE SER CONSTANTE (b32af5ff). A frase fixa da classe é correta
  // no PRIMEIRO bounce e vira mentira operacional a partir do segundo: ela
  // mandava "tentar de novo mais tarde" mesmo depois da mensagem ter entrado,
  // e foi ela que produziu quatro ordens de reenvio no mesmo caso.
  const passo = (a.contato ? passoDoHistorico(a.contato, agoraMs) : null) ?? o.passo;
  const bloco = a.contato ? blocoDeTentativas(a.contato, agoraMs) : [];
  return [
    `A resposta do suporte@ para ${a.email} NÃO foi entregue: ${o.resumo}.`,
    "",
    'O 250 do SMTP só disse "aceitei pra entrega" — a recusa veio depois, por bounce, e a fila',
    "considerou o aluno respondido. Ele está em silêncio SEM saber, e não adianta esperar retorno dele.",
    "",
    // Vem ANTES do próximo passo de propósito: quem bate o olho na ficha lê o
    // que já foi tentado antes de ler o que fazer.
    ...(bloco.length ? [...bloco, ""] : []),
    `PRÓXIMO PASSO: ${passo}`,
    "",
    a.assuntoOriginal ? `Assunto que não chegou: ${a.assuntoOriginal}` : null,
    a.messageIdOriginal ? `Message-ID do envio: ${a.messageIdOriginal}` : null,
    a.diagnostico ? `Diagnóstico cru do servidor: ${a.diagnostico}` : "Sem diagnóstico do servidor no relatório.",
    provaDns(a.email, a.dns),
  ]
    .filter((l): l is string => l !== null)
    .join("\n");
}

/**
 * Traduz o bounce em DECISÕES, sem tocar em banco — é aqui que mora a regra
 * que erra em silêncio, então ela precisa ser testável sem Supabase.
 *
 * Devolve plano VAZIO para atraso: `Action: delayed` significa que o servidor
 * ainda vai tentar, e transformar isso em chamado seria alarme falso.
 *
 * `contatoPorEmail` (b32af5ff) é o histórico de tentativas JÁ RESUMIDO, por
 * e-mail em minúsculas — quem lê o banco é o `mail-bounce-registro.ts`, pra
 * este módulo continuar testável sem Supabase. Ausente = comportamento
 * idêntico ao de antes, que é o que mantém os testes de bounce puro válidos.
 */
export function planoDoBounce(
  bounce: Bounce,
  contatoPorEmail?: Record<string, ResumoDeContato>,
  agoraMs: number = Date.now(),
): PlanoDeBounce {
  if (bounce.tipo === "atraso") return { tipo: "atraso", alunos: [], interno: null };

  const falharam = bounce.destinatarios.filter((d) => d.acao !== "delayed");
  const alunos = falharam.filter((d) => !d.interno);
  const internos = falharam.filter((d) => d.interno);

  const acaoDe = (d: DestinatarioQueFalhou): AcaoDeBounce => {
    const o = ORIENTACAO[d.classe];
    return {
      email: d.email,
      classe: d.classe,
      // A CLASSE entra na assinatura: um aluno que hoje quica por caixa cheia
      // e amanhã por endereço inexistente são DOIS problemas e precisam de dois
      // chamados. A mesma classe repetindo continua somando ocorrência no
      // mesmo chamado, que é o certo.
      signature: `fast-bounce:${d.classe}:${d.email}`,
      categoria: o.nossa ? "tecnico" : "atendimento",
      titulo: `E-mail não chegou no aluno (${d.classe}): ${d.email}`.slice(0, 120),
      descricao: descrever({
        email: d.email,
        classe: d.classe,
        diagnostico: d.diagnostico,
        assuntoOriginal: bounce.assuntoOriginal,
        messageIdOriginal: bounce.messageIdOriginal,
        contato: contatoPorEmail?.[d.email.toLowerCase()] ?? null,
        agoraMs,
        dns: d.dns,
      }),
      motivoReabertura:
        `Bounce (${d.classe}): ${o.resumo}.` +
        (d.diagnostico ? ` Servidor disse: ${d.diagnostico.slice(0, 200)}` : ""),
      diagnostico: d.diagnostico,
    };
  };

  if (alunos.length > 0) {
    return { tipo: "falha", alunos: alunos.map(acaoDe), interno: null };
  }

  // Nenhum aluno: só a cópia oculta quicou. Ainda é sinal QUANDO a culpa é
  // nossa (saída suja) — a próxima mensagem de qualquer aluno corre o mesmo
  // risco. Um chamado técnico por classe, e nenhum caso de aluno é tocado.
  const primeiro = internos.find((d) => ORIENTACAO[d.classe].nossa);
  if (!primeiro) return { tipo: "falha", alunos: [], interno: null };
  const o = ORIENTACAO[primeiro.classe];
  return {
    tipo: "falha",
    alunos: [],
    interno: {
      email: internos.map((d) => d.email).join(", "),
      classe: primeiro.classe,
      signature: `fast-bounce:interno:${primeiro.classe}`,
      categoria: "tecnico",
      titulo: `Bounce na saída do suporte@ (cópia interna): ${primeiro.classe}`.slice(0, 120),
      descricao:
        `A cópia interna da resposta do suporte@ voltou (${o.resumo}). ` +
        `Nenhum aluno ficou sem resposta NESTE bounce, mas a saída está recusando.\n\n` +
        `PRÓXIMO PASSO: ${o.passo}\n\n` +
        `Destinatários internos: ${internos.map((d) => d.email).join(", ")}\n` +
        `Diagnóstico: ${primeiro.diagnostico || "(sem diagnóstico)"}`,
      motivoReabertura: "",
      diagnostico: primeiro.diagnostico,
    },
  };
}
