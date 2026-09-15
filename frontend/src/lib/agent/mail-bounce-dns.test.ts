/**
 * Testes da leitura do DNS (#402). Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/agent/mail-bounce-dns.test.ts
 *
 * O resolvedor é INJETADO em todos os casos menos o último: teste de
 * classificação não pode depender de rede, nem de um domínio de terceiro
 * continuar publicando hoje o que publicava ontem. As RESPOSTAS abaixo, porém,
 * não são inventadas — são o que o `node:dns` devolveu de verdade em 14/09 pra
 * cada um desses domínios:
 *
 *   gmail.com.br            → MX [{ exchange: "", priority: 0 }] + A 142.251.34.133
 *   pradocomunicacao.com.br → MX [{ exchange: "pradocomunicacao.com.br", priority: 0 }]
 *   pradocomunicacao.com    → ENOTFOUND no MX e no A   ← o bounce do #402
 *
 * O primeiro é a armadilha inteira num caso só: MX NULO (RFC 7505) COM registro
 * A. Quem tratar "não achei MX" e cair no A implícito (RFC 5321) vai jurar que
 * esse domínio recebe e-mail — e ele é justamente o que declara que não recebe.
 *
 * Pra conferir contra o DNS de verdade (não roda por padrão, depende de rede):
 *   DNS_AO_VIVO=1 node --test src/lib/agent/mail-bounce-dns.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { veredictoDoDominio, refinarPorDns, resolvedorReal, type Resolvedor } from "./mail-bounce-dns.ts";
import type { Bounce, DestinatarioQueFalhou } from "./mail-bounce.ts";

/** Erro do `node:dns`, que é o que o código lê: o `.code` é a informação. */
function erroDns(code: string): Error {
  return Object.assign(new Error(code), { code });
}

/** Resolvedor de mentira, montado a partir de respostas reais. */
function fake(respostas: Record<string, { mx?: Array<{ exchange: string; priority: number }> | string; ips?: string[] | string }>): Resolvedor & { chamadas: string[] } {
  const chamadas: string[] = [];
  return {
    chamadas,
    async mx(dominio) {
      chamadas.push(`mx:${dominio}`);
      const r = respostas[dominio]?.mx;
      if (typeof r === "string") throw erroDns(r);
      return r ?? [];
    },
    async ips(dominio) {
      chamadas.push(`ips:${dominio}`);
      const r = respostas[dominio]?.ips;
      if (typeof r === "string") throw erroDns(r);
      return r ?? [];
    },
  };
}

// ------------------------------------------------------------ o veredito

test("ARMADILHA: MX NULO com registro A é 'sem-registro' — não pode cair no A implícito", async () => {
  // gmail.com.br, medido: MX `0 .` E A 142.251.34.133. Foi o que a Sheila
  // digitou no checkout. Se o A valesse aqui, a casa concluiria que ela recebe
  // e-mail e ficaria reenviando pra um domínio que declara que não aceita.
  const r = fake({ "gmail.com.br": { mx: [{ exchange: "", priority: 0 }], ips: ["142.251.34.133"] } });
  assert.equal(await veredictoDoDominio("gmail.com.br", r), "sem-registro");
  // E nem chega a perguntar pelo A: o MX nulo já respondeu.
  assert.deepEqual(r.chamadas, ["mx:gmail.com.br"]);
  // O alvo também aparece como "." dependendo do resolvedor.
  assert.equal(
    await veredictoDoDominio("x.com.br", fake({ "x.com.br": { mx: [{ exchange: ".", priority: 0 }] } })),
    "sem-registro",
  );
});

test("REGRESSÃO: MX auto-apontado ('0 dominio.com.br.') RECEBE e-mail, não é MX nulo", async () => {
  // Essa leitura errada já quase declarou um aluno inalcançável numa ronda: o
  // ponto final do FQDN foi lido como se fosse o alvo `.` do MX nulo. São
  // coisas diferentes — null MX é a RAIZ SOZINHA. Sete mensagens nossas
  // chegaram nesse domínio.
  const r = fake({ "pradocomunicacao.com.br": { mx: [{ exchange: "pradocomunicacao.com.br", priority: 0 }] } });
  assert.equal(await veredictoDoDominio("pradocomunicacao.com.br", r), "resolve");
  // Com ponto final explícito, idem — o alvo não é a raiz.
  const comPonto = fake({ "d.com.br": { mx: [{ exchange: "d.com.br.", priority: 0 }] } });
  assert.equal(await veredictoDoDominio("d.com.br", comPonto), "resolve");
});

test("#402: domínio sem MX E sem A é 'sem-registro' — o bounce do guitaschetti@", async () => {
  const r = fake({ "pradocomunicacao.com": { mx: "ENOTFOUND", ips: "ENOTFOUND" } });
  assert.equal(await veredictoDoDominio("pradocomunicacao.com", r), "sem-registro");
});

test("sem MX mas com A: é o MX implícito do RFC 5321 — recebe e-mail", async () => {
  const r = fake({ "so-a.com": { mx: "ENODATA", ips: ["203.0.113.10"] } });
  assert.equal(await veredictoDoDominio("so-a.com", r), "resolve");
});

test("MX de verdade responde na hora, sem consultar A", async () => {
  const r = fake({ "gmail.com": { mx: [{ exchange: "gmail-smtp-in.l.google.com", priority: 5 }] } });
  assert.equal(await veredictoDoDominio("gmail.com", r), "resolve");
  assert.deepEqual(r.chamadas, ["mx:gmail.com"]);
});

test("SERVFAIL/timeout é 'indeterminado' — ignorância não vira veredito", async () => {
  // A diferença que decide tudo: SERVFAIL é "não consegui perguntar", NXDOMAIN
  // é "perguntei e não existe". Só o segundo pode condenar um endereço.
  assert.equal(await veredictoDoDominio("x.com", fake({ "x.com": { mx: "ESERVFAIL" } })), "indeterminado");
  assert.equal(await veredictoDoDominio("y.com", fake({ "y.com": { mx: "ETIMEOUT" } })), "indeterminado");
  // Resolvedor que some no meio do caminho (MX ausente, A não responde).
  assert.equal(
    await veredictoDoDominio("z.com", fake({ "z.com": { mx: "ENODATA", ips: "ESERVFAIL" } })),
    "indeterminado",
  );
});

test("domínio ilegível não vira consulta nem veredito", async () => {
  const r = fake({});
  assert.equal(await veredictoDoDominio("", r), "indeterminado");
  assert.equal(await veredictoDoDominio("semponto", r), "indeterminado");
  assert.deepEqual(r.chamadas, []);
});

// ------------------------------------------------------- o refino do bounce

function dest(p: Partial<DestinatarioQueFalhou> & { email: string }): DestinatarioQueFalhou {
  return { classe: "desconhecida", diagnostico: "", acao: "failed", interno: false, ...p };
}
function bounceCom(destinatarios: DestinatarioQueFalhou[]): Bounce {
  return { tipo: "falha", destinatarios, messageIdOriginal: null, assuntoOriginal: null };
}

const TEXTO_GOOGLE =
  "smtp; DNS Error: DNS error occurred while resolving the Mail Exchange (MX) server for the specified domain (pradocomunicacao.com). No MX server found";

test("refino: o bounce do #402 sai 'inexistente' e carrega a PROVA do DNS", async () => {
  const r = fake({ "pradocomunicacao.com": { mx: "ENOTFOUND", ips: "ENOTFOUND" } });
  const b = await refinarPorDns(
    bounceCom([dest({ email: "guitaschetti@pradocomunicacao.com", diagnostico: TEXTO_GOOGLE })]),
    r,
  );
  assert.equal(b.destinatarios[0].classe, "inexistente");
  assert.equal(b.destinatarios[0].dns, "sem-registro");
});

test("refino: bounce que NÃO culpa MX/DNS não gasta consulta nenhuma", async () => {
  // O caso comum (caixa cheia, spam de saída) continua custando zero rede.
  const r = fake({});
  const b = await refinarPorDns(
    bounceCom([dest({ email: "a@b.com", classe: "caixa-cheia", diagnostico: "smtp; 452-4.2.2 out of storage space" })]),
    r,
  );
  assert.deepEqual(r.chamadas, []);
  assert.equal(b.destinatarios[0].classe, "caixa-cheia");
  assert.equal(b.destinatarios[0].dns, undefined);
});

test("refino: uma consulta por DOMÍNIO, não por destinatário", async () => {
  const r = fake({ "pradocomunicacao.com": { mx: "ENOTFOUND", ips: "ENOTFOUND" } });
  const b = await refinarPorDns(
    bounceCom([
      dest({ email: "um@pradocomunicacao.com", diagnostico: TEXTO_GOOGLE }),
      dest({ email: "dois@pradocomunicacao.com", diagnostico: TEXTO_GOOGLE }),
      dest({ email: "tres@outro.com", classe: "caixa-cheia", diagnostico: "452-4.2.2 mailbox full" }),
    ]),
    r,
  );
  assert.deepEqual(r.chamadas, ["mx:pradocomunicacao.com", "ips:pradocomunicacao.com"]);
  assert.deepEqual(b.destinatarios.map((d) => d.classe), ["inexistente", "inexistente", "caixa-cheia"]);
});

test("refino NUNCA lança: DNS quebrado devolve o bounce como estava", async () => {
  // Esta função roda dentro da varredura, que não pode parar por causa de um
  // resolvedor — detector que trava a fila é pior que detector nenhum.
  const explode: Resolvedor = {
    async mx() {
      throw new Error("resolvedor pegou fogo");
    },
    async ips() {
      throw new Error("resolvedor pegou fogo");
    },
  };
  const original = bounceCom([dest({ email: "a@pradocomunicacao.com", diagnostico: TEXTO_GOOGLE })]);
  const b = await refinarPorDns(original, explode);
  // Erro "duro" (sem code de ausência) vira indeterminado, que não muda classe.
  assert.equal(b.destinatarios[0].classe, "desconhecida");
  assert.equal(b.destinatarios[0].dns, "indeterminado");
});

// ------------------------------------------------------------- ao vivo (opt-in)

test("AO VIVO: o DNS de verdade concorda com as respostas gravadas acima", { skip: process.env.DNS_AO_VIVO !== "1" }, async () => {
  assert.equal(await veredictoDoDominio("gmail.com.br", resolvedorReal), "sem-registro");
  assert.equal(await veredictoDoDominio("pradocomunicacao.com", resolvedorReal), "sem-registro");
  assert.equal(await veredictoDoDominio("pradocomunicacao.com.br", resolvedorReal), "resolve");
  assert.equal(await veredictoDoDominio("gmail.com", resolvedorReal), "resolve");
});
