/**
 * Tripwire da PONTE chat de ajuda → chamados (incidente #150).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/incidents/ponte-help.test.ts
 *
 * CONTEXTO: até 27/08 o chat de ajuda dentro do app (public.help_messages,
 * 4.261 linhas) era o único dos três canais da Fast sem caminho até
 * `incidents`. O bot prometia "vou chamar alguém da equipe" e o pedido morria
 * num e-mail best-effort para uma caixa atendida pela própria Fast. Medido em
 * 27/08: 11 alunos com promessa e zero chamado. A Zethe (#151) pediu 4x em 1h,
 * ouviu 3 promessas, e ninguém soube.
 *
 * O mesmo defeito já tinha acontecido no e-mail (caso Viviana, 19/08) e no zap
 * (caso Carol, 22/08). Três canais, um de cada vez, sempre porque quem
 * escreveu o caminho de um não replicou no outro. Estes testes existem pra que
 * a quarta vez não seja neste arquivo.
 *
 * São testes DE FONTE de propósito: o alvo é uma rota Next (`POST` com
 * autenticação, Supabase e a LLM no caminho), cara demais pra instanciar aqui,
 * e o que precisa ser travado não é o retorno — é a EXISTÊNCIA da chamada e o
 * formato da assinatura de dedup. Fonte é o que prova as duas coisas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url));
const ROTA = resolve(AQUI, "../../app/api/v1/help/route.ts");
const fonte = readFileSync(ROTA, "utf8");

test("o chat do app ABRE chamado quando a Fast escala", () => {
  assert.ok(
    fonte.includes("abrirChamadoReportado"),
    "a rota do help parou de abrir chamado — é literalmente o buraco do #150 de volta",
  );
  assert.ok(
    /const numero = await abrirChamadoDoChat\(/.test(fonte),
    "o chamado saiu do caminho da escalação; sem essa chamada o aluno ouve 'a equipe foi avisada' e ninguém é avisado",
  );
});

test("o chamado vem ANTES do e-mail — o e-mail é aviso, não memória", () => {
  const iChamado = fonte.indexOf("await abrirChamadoDoChat(");
  const iEmail = fonte.indexOf("await emailEscalation(");
  assert.ok(iChamado > 0 && iEmail > 0, "sumiu uma das duas chamadas do caminho da escalação");
  assert.ok(
    iChamado < iEmail,
    "o e-mail voltou a vir primeiro: o Resend é best-effort e cai calado, então o registro tem que ser gravado antes",
  );
});

test("a assinatura de dedup é help:<fila>:<email> — 1 aluno = 1 chamado por fila", () => {
  assert.ok(
    /signature: `help:\$\{args\.technical \? "tec" : "atend"\}:\$\{args\.email\}`/.test(fonte),
    "a assinatura mudou de forma. Ela espelha a do e-mail (fast-email:tec|atend:<email>) de propósito: " +
      "no chat do app a identidade é 1 aluno = 1 conversa, então o aluno que insiste 3x tem que somar 3 " +
      "ocorrências no MESMO chamado (o que faltou pra Zethe), e um pedido novo depois de fixed REABRE. " +
      "Assinar por mensagem faria cada insistência virar chamado novo — o #110, '1 problema virava 6 chamados'.",
  );
  assert.ok(
    fonte.includes('reportedBy: "fast-help"'),
    "o reported_by identifica o canal na fila do Frank; sem ele não dá pra medir o chat separado do e-mail",
  );
});

test("as duas filas viram chamado — atendimento também, não só técnico", () => {
  // Regressão do caso Viviana (19/08): quando só o técnico abria chamado, o
  // pedido de cobrança/cancelamento/reembolso não gerava NADA além de um log,
  // com a Fast já tendo prometido que a equipe olharia.
  assert.ok(
    /categoria: args\.technical \? "tecnico" : "atendimento"/.test(fonte),
    "voltou a existir escalação que não abre chamado. Se a Fast escalou é porque não resolveu: " +
      "o que muda entre técnico e atendimento é o RÓTULO, nunca a existência do chamado",
  );
  assert.ok(
    !/if \(technical\)[\s\S]{0,120}abrirChamadoDoChat/.test(fonte),
    "o chamado ficou condicionado a ser técnico — exatamente o bug da Viviana",
  );
});

test("ATENDIMENTO é entregue ao time (grupo avisado, chamado fica aberto); TÉCNICO nunca passa pela entrega", () => {
  // 28/08: pedido de gente vai pro grupo. 29/08 (#153): o chamado não fecha
  // mais na entrega — fica aberto até o time responder. A entrega segue
  // guardada por `!technical`: falha de plataforma não é "olho humano".
  assert.ok(
    /import[^;]*\bentregarAoTime\b[^;]*;/.test(fonte),
    "entregarAoTime não é mais importado — atendimento voltaria a acumular na fila",
  );
  assert.ok(
    /if \(numero != null && !technical\) \{[\s\S]{0,200}await entregarAoTime\(/.test(fonte),
    "a entrega ao time precisa ser SÓ para atendimento (!technical) e SÓ com chamado aberto (numero != null)",
  );
  assert.ok(
    /canal: "chat do app"/.test(fonte),
    "o aviso ao grupo tem que dizer de onde o aluno falou (chat do app)",
  );
});
