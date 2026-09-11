#!/usr/bin/env node
/**
 * SEMEIA o dedupe do aviso de portal do SGP (`agent_state.orphan_invites_sgp`)
 * com quem JÁ FOI AVISADO À MÃO.
 *
 * POR QUE ISTO EXISTE, e por que é OBRIGATÓRIO rodar antes de o varredor com o
 * caminho do SGP entrar em produção:
 *
 * O varredor deduplica por duas fontes — o `sgp_boas_vindas` (e-mail que o
 * webhook manda na compra) e o `orphan_invites_sgp` (o aviso do próprio
 * varredor). Quem foi escrito À MÃO pelo suporte não aparece em NENHUMA das
 * duas: a caixa de saída não é lida por nenhum dedupe. Então, no primeiro dia,
 * o varredor escreveria de novo pra essa gente.
 *
 * Medido em 08/09/2026: dos 19 órfãos do SGP, 15 estão calados pelo
 * `sgp_boas_vindas` e 4 seriam escritos de novo — exatamente os 4 que o suporte
 * já tinha escrito à mão naquele mesmo dia. É a "leva dupla" de 06/09 de novo,
 * quando o mesmo aviso saiu 2× por ninguém conferir o que já tinha sido enviado.
 *
 * ⚠️ NÃO recebe e-mail embutido de propósito: este repositório é PÚBLICO e
 * e-mail de aluno é dado pessoal. Os endereços entram por argumento.
 *
 * USO:
 *   node semear_orfao_sgp.cjs a@x.com b@y.com          # DRY RUN (não grava)
 *   node semear_orfao_sgp.cjs --confirmar a@x.com ...  # grava de verdade
 *
 * É idempotente: quem já está registrado não é sobrescrito (o `at` original é
 * preservado, pra não fabricar histórico).
 */
const path = require("node:path");
const { supa } = require(path.join(__dirname, "_comum.cjs"));

const CHAVE = "orphan_invites_sgp";

(async () => {
  const args = process.argv.slice(2);
  const confirmar = args.includes("--confirmar");
  const emails = args
    .filter((a) => !a.startsWith("--"))
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (emails.length === 0) {
    console.error("uso: node semear_orfao_sgp.cjs [--confirmar] <email> [email...]");
    process.exit(1);
  }
  for (const e of emails) {
    if (!e.includes("@")) {
      console.error(`ERRO: "${e}" não parece um e-mail. Nada foi gravado.`);
      process.exit(1);
    }
  }

  const db = supa();
  const { data, error } = await db
    .from("agent_state")
    .select("value")
    .eq("key", CHAVE)
    .maybeSingle();
  if (error) throw new Error(`não deu pra ler ${CHAVE}: ${error.message}`);

  const estado = data?.value ?? {};
  const agora = new Date().toISOString();
  const novos = [];
  const jaTinha = [];

  for (const email of emails) {
    if (estado[email]) {
      jaTinha.push(email);
      continue;
    }
    estado[email] = { at: agora, compraEm: null, origem: "aviso manual do suporte" };
    novos.push(email);
  }

  console.log(`chave: ${CHAVE}`);
  console.log(`já registrados (intocados): ${jaTinha.length}`, jaTinha);
  console.log(`a registrar: ${novos.length}`, novos);

  if (!confirmar) {
    console.log("\nDRY RUN — nada foi gravado. Repita com --confirmar pra valer.");
    return;
  }
  if (novos.length === 0) {
    console.log("\nnada novo a gravar.");
    return;
  }

  const { error: errGrav } = await db
    .from("agent_state")
    .upsert({ key: CHAVE, value: estado, updated_at: agora });
  if (errGrav) throw new Error(`não deu pra gravar ${CHAVE}: ${errGrav.message}`);
  console.log(`\nGRAVADO. ${novos.length} e-mail(s) agora estão calados pro varredor do SGP.`);
})().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
