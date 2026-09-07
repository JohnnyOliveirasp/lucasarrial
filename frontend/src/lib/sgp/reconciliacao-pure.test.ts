/**
 * O que estes testes protegem, em ordem de gravidade:
 *  1. o caso dos 7 (incidente #282): resgate SEM exceção que mesmo assim deixou
 *     compra paga órfã TEM que virar chamado — é o silêncio que motivou o fix;
 *  2. o aluno normal do SGP (comprou o curso, não assina o FastCloner) NÃO pode
 *     gerar chamado: seriam ~349 falsos por lote, enterrando os 7 verdadeiros;
 *  3. valor > 0 não é pagamento (régua de 18/08): OVERDUE, boleto impresso e Pix
 *     aguardando não contam, e trial R$0 muito menos;
 *  4. o chamado nasce com assinatura própria, para não sobrescrever o
 *     atendimento vivo do aluno (estrago do #213).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/reconciliacao-pure.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diagnosticarClaim,
  detalheDoErro,
  entitlementFoiPago,
  statusDaCompra,
  valorDaCompra,
  type EntitlementOrfa,
} from "./reconciliacao-pure.ts";

const EMAIL = "aluno-de-teste@example.com";
const USER = "3f1a6b02-0000-4000-8000-aaaaaaaaaaaa";

/** Payload no formato que o webhook grava em `raw_event` (o `data` do evento). */
function raw(p: { valor?: number | string | null; status?: string | null; trx?: string } = {}): unknown {
  const purchase: Record<string, unknown> = {};
  if (p.valor !== null && p.valor !== undefined) purchase.price = { value: p.valor };
  if (p.status) purchase.status = p.status;
  if (p.trx) purchase.transaction = p.trx;
  return { purchase };
}

function orfa(o: Partial<EntitlementOrfa> = {}): EntitlementOrfa {
  return {
    external_id: "HP3248282838",
    status: "active",
    access_until: "2099-01-01T00:00:00Z",
    buyer_email: EMAIL,
    raw_event: raw({ valor: 97, status: "APPROVED", trx: "HP3248282838" }),
    ...o,
  };
}

function entrada(o: Partial<Parameters<typeof diagnosticarClaim>[0]> = {}) {
  return { email: EMAIL, userId: USER, contaCriada: true, erro: null, orfas: [], ...o };
}

// ── 1. o caso dos 7 ─────────────────────────────────────────────────────────

test("silencioso: sem exceção, mas sobrou compra paga órfã ⇒ abre chamado", () => {
  const d = diagnosticarClaim(entrada({ erro: null, orfas: [orfa()] }));
  assert.ok(d, "o modo de falha do #282 não pode devolver null");
  assert.equal(d.categoria, "tecnico");
  assert.deepEqual(d.affectedEmails, [EMAIL]);
  assert.match(d.title, /compra paga não entrou na conta/);
  // O texto tem que dizer, para quem for ler, que NÃO houve exceção — senão o
  // próximo a investigar procura um erro que não existe.
  assert.match(d.description, /NÃO lançou exceção/);
  assert.match(d.description, /HP3248282838/);
});

test("silencioso: a descrição começa pelo O QUE FAZER e só depois vai ao TÉCNICO", () => {
  const d = diagnosticarClaim(entrada({ orfas: [orfa()] }));
  assert.ok(d);
  assert.ok(d.description.startsWith("O QUE FAZER"), "quem atende lê primeiro, e não sabe ler código");
  assert.ok(d.description.indexOf("O QUE FAZER") < d.description.indexOf("TÉCNICO"));
  // Nada de caminho de arquivo antes do bloco técnico.
  const parteDeQuemAtende = d.description.slice(0, d.description.indexOf("TÉCNICO"));
  assert.ok(!/\.ts\b|claimPurchasesOnLogin|user_id/.test(parteDeQuemAtende));
  // E não pode mandar o atendente prometer dinheiro (estorno só quando o
  // cliente pede, ordem do Lucas de 03/09).
  assert.match(parteDeQuemAtende, /Não prometa estorno/);
});

test("exceção do resgate ⇒ abre chamado com o erro cru, mesmo sem órfã", () => {
  const erro = Object.assign(new Error("permission denied for table entitlements"), {
    code: "42501",
    details: "RLS",
  });
  const d = diagnosticarClaim(entrada({ erro, orfas: [] }));
  assert.ok(d);
  assert.match(d.title, /erro ao resgatar compras/);
  assert.match(d.description, /permission denied for table entitlements/);
  assert.match(d.description, /code=42501/);
  assert.match(d.sampleError ?? "", /permission denied/);
});

// ── 2. o que NÃO pode virar chamado ─────────────────────────────────────────

test("aluno normal do SGP (sem compra do FastCloner) NÃO gera chamado", () => {
  assert.equal(diagnosticarClaim(entrada({ erro: null, orfas: [] })), null);
});

test("conta que já existia e resgatou tudo NÃO gera chamado", () => {
  assert.equal(diagnosticarClaim(entrada({ contaCriada: false, erro: null, orfas: [] })), null);
});

// ── 3. valor > 0 não é pagamento (18/08) ────────────────────────────────────

test("trial R$0 órfão não é vítima ⇒ nada a relatar", () => {
  const t = orfa({ raw_event: raw({ valor: 0, status: "APPROVED" }) });
  assert.equal(entitlementFoiPago(t.raw_event), false);
  assert.equal(diagnosticarClaim(entrada({ orfas: [t] })), null);
});

test("OVERDUE / boleto impresso / Pix aguardando com valor cheio não contam como pago", () => {
  for (const status of ["OVERDUE", "BILLET_PRINTED", "WAITING_PAYMENT", "PROCESSING_TRANSACTION"]) {
    const o = orfa({ raw_event: raw({ valor: 97, status }) });
    assert.equal(entitlementFoiPago(o.raw_event), false, `${status} não é pagamento`);
    assert.equal(diagnosticarClaim(entrada({ orfas: [o] })), null, `${status} não pode abrir chamado`);
  }
});

test("APPROVED e COMPLETE com valor > 0 são pagamento", () => {
  for (const status of ["APPROVED", "COMPLETE", "COMPLETED", "approved"]) {
    assert.equal(entitlementFoiPago(raw({ valor: 97, status })), true, status);
  }
});

test("status desconhecido com valor > 0 vira suspeita (falso negativo é o defeito daqui)", () => {
  assert.equal(entitlementFoiPago(raw({ valor: 97, status: "ALGUM_STATUS_NOVO" })), true);
  assert.equal(entitlementFoiPago(raw({ valor: 97 })), true, "sem status = ainda relata");
  const d = diagnosticarClaim(entrada({ orfas: [orfa({ raw_event: raw({ valor: 97, status: "XPTO" }) })] }));
  assert.ok(d);
  assert.match(d.description, /purchase\.status=XPTO/, "o status suspeito tem que ir escrito, pra gente julgar");
});

test("raw_event lixo/ausente não estoura e não inventa pagamento", () => {
  for (const lixo of [null, undefined, "", 7, [], {}, { purchase: null }, { purchase: { price: {} } }]) {
    assert.equal(entitlementFoiPago(lixo), false, JSON.stringify(lixo) ?? "undefined");
    assert.equal(valorDaCompra(lixo), null);
    assert.equal(statusDaCompra(lixo), null);
  }
  assert.equal(valorDaCompra(raw({ valor: "97.00" })), 97, "valor vem como string em parte dos payloads");
});

// ── 4. o chamado não pode atropelar o atendimento do aluno ──────────────────

test("assinatura é de namespace próprio (não colide com sgp:tec / help:*)", () => {
  const d = diagnosticarClaim(entrada({ orfas: [orfa()] }));
  assert.ok(d);
  assert.equal(d.signature, `sgp:claim:${EMAIL}`);
  assert.notEqual(d.signature, `sgp:tec:${EMAIL}`);
  assert.notEqual(d.signature, `sgp:atend:${EMAIL}`);
  assert.notEqual(d.signature, `help:atend:${EMAIL}`);
});

test("mesma pessoa, mesma assinatura nas duas rodadas (dedupe soma ocorrência)", () => {
  const a = diagnosticarClaim(entrada({ orfas: [orfa()] }));
  const b = diagnosticarClaim(entrada({ erro: new Error("outro erro"), orfas: [orfa()] }));
  assert.ok(a && b);
  assert.equal(a.signature, b.signature);
});

test("título cabe na coluna (120)", () => {
  const longo = `${"a".repeat(200)}@example.com`;
  const d = diagnosticarClaim(entrada({ email: longo, orfas: [orfa({ buyer_email: longo })] }));
  assert.ok(d);
  assert.ok(d.title.length <= 120, `título com ${d.title.length} chars`);
});

test("sampleError cabe na coluna (1000)", () => {
  const d = diagnosticarClaim(entrada({ erro: new Error("x".repeat(5000)) }));
  assert.ok(d);
  assert.ok((d.sampleError ?? "").length <= 1000);
});

// ── detalheDoErro ───────────────────────────────────────────────────────────

test("detalheDoErro: null/undefined = não houve erro", () => {
  assert.equal(detalheDoErro(null), null);
  assert.equal(detalheDoErro(undefined), null);
});

test("detalheDoErro: objeto do Supabase (sem ser Error) também é lido", () => {
  const texto = detalheDoErro({ message: "row-level security", code: "42501", hint: "check policy" });
  assert.match(texto ?? "", /row-level security/);
  assert.match(texto ?? "", /code=42501/);
  assert.match(texto ?? "", /hint=check policy/);
});

test("detalheDoErro: string solta e erro sem mensagem não viram texto vazio", () => {
  assert.equal(detalheDoErro("deu ruim"), "deu ruim");
  assert.ok((detalheDoErro(new Error("")) ?? "").length > 0);
});

// ── órfãs múltiplas ─────────────────────────────────────────────────────────

test("várias órfãs: só as pagas entram, e todas aparecem na descrição", () => {
  const d = diagnosticarClaim(
    entrada({
      orfas: [
        orfa({ external_id: "PAGA-1", raw_event: raw({ valor: 97, status: "APPROVED" }) }),
        orfa({ external_id: "TRIAL-0", raw_event: raw({ valor: 0, status: "APPROVED" }) }),
        orfa({ external_id: "PAGA-2", raw_event: raw({ valor: 297, status: "COMPLETE" }) }),
      ],
    }),
  );
  assert.ok(d);
  assert.match(d.description, /Sobraram 2 entitlement\(s\) PAGO\(s\)/);
  assert.match(d.description, /PAGA-1/);
  assert.match(d.description, /PAGA-2/);
  assert.ok(!d.description.includes("TRIAL-0"), "trial R$0 não é vítima e não entra no chamado");
});
