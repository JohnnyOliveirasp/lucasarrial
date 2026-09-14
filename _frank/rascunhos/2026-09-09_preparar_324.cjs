#!/usr/bin/env node
/**
 * #324 — prepara (NAO envia) a reparacao dos 2 compradores do SGP que pagaram
 * em 09/09 e nunca receberam o e-mail de boas-vindas.
 *
 * O TEXTO NAO E INVENTADO: sai da MESMA `montarBoasVindas` que a producao usa
 * (carregada por jiti), com os dados REAIS do payload da Hotmart. O que muda e
 * so o link de senha, que e gerado novo — o original viajava no e-mail que nao
 * chegou e a essa altura ja venceu.
 *
 * Escreve em /tmp: <email>.txt (o texto exato) e <email>.html (o mesmo texto
 * pro enviar_email.cjs, que manda text/html). Nao toca em SMTP.
 */
const path = require("node:path");
const fs = require("node:fs");
const { supa, RAIZ } = require("../ferramentas/_comum.cjs");

const createJiti = require(path.join(RAIZ, "frontend", "node_modules", "jiti"));
const jiti = (createJiti.default ?? createJiti)(__filename, { interopDefault: true });
const puro = jiti(path.join(RAIZ, "frontend", "src", "lib", "payments", "sgp-boas-vindas.ts"));

const ALVOS = [
  { email: "jcesaram@gmail.com", tx: "HP0150302636" },
  { email: "patricia.bp170@gmail.com", tx: "HP1390733090" },
];

const escapar = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Texto puro -> HTML: preserva quebras e deixa os links clicaveis. */
function paraHtml(texto) {
  const corpo = escapar(texto)
    .split("\n")
    .map((l) => l.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>'))
    .join("<br>\n");
  return [
    '<!doctype html><html><head><meta charset="utf-8"></head>',
    '<body><div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">',
    corpo,
    "</div></body></html>",
  ].join("\n");
}

(async () => {
  const db = supa();

  for (const alvo of ALVOS) {
    console.log("=".repeat(70));
    console.log(alvo.email, alvo.tx);

    // 1. Os dados REAIS da compra, do payload guardado.
    const { data: evs, error } = await db
      .from("payment_events")
      .select("event_type,buyer_email,payload")
      .ilike("buyer_email", alvo.email);
    if (error) throw new Error(`payment_events: ${error.message}`);
    const ev = (evs ?? []).find(
      (e) => e?.payload?.data?.purchase?.transaction === alvo.tx,
    ) ?? evs?.[0];
    if (!ev) throw new Error(`sem payment_event para ${alvo.email}`);

    const p = ev.payload?.data ?? {};
    const compra = {
      eventType: ev.event_type,
      buyerEmail: ev.buyer_email,
      buyerName: p.buyer?.name ?? null,
      productCode: String(p.product?.id ?? ""),
      productName: p.product?.name ?? null,
      transaction: p.purchase?.transaction ?? alvo.tx,
      externalId: p.purchase?.transaction ?? alvo.tx,
      purchaseStatus: String(p.purchase?.status ?? "").toUpperCase(),
    };
    console.log(
      `  nome=${compra.buyerName} produto=${compra.productCode} (${compra.productName}) status=${compra.purchaseStatus}`,
    );

    // 2. Ele tem a assinatura da plataforma? (a mesma pergunta que a producao faz)
    const produtoPlataforma = process.env.HOTMART_PRODUCT_ID ?? "7851642";
    const { data: ents } = await db
      .from("entitlements")
      .select("status,access_until")
      .ilike("buyer_email", alvo.email)
      .eq("product_code", produtoPlataforma);
    const agoraIso = new Date().toISOString();
    const temAssinatura = (ents ?? []).some((e) =>
      puro.entitlementValeAcesso
        ? puro.entitlementValeAcesso(e, agoraIso)
        : false,
    );
    console.log(`  entitlements da plataforma: ${ents?.length ?? 0} -> temAssinatura=${temAssinatura}`);

    // 3. Link de senha NOVO (o antigo venceu). generateLink NAO manda e-mail.
    //
    // ⚠️ O SITE VAI NA MAO, NAO PELO ENV. O `.env.local` desta maquina e de
    // DESENVOLVIMENTO e traz `NEXT_PUBLIC_SITE_URL=http://localhost:3000`: a 1a
    // versao deste script gerou os dois links apontando pra localhost:3000, que
    // teria mandado os dois alunos pra um link morto. Producao usa o default do
    // `siteUrl()` (canal.ts:68-70), que e este:
    const SITE = "https://fastcloner.com";
    const { data: linkData, error: erroLink } = await db.auth.admin.generateLink({
      type: "recovery",
      email: alvo.email,
      options: {
        redirectTo: `${SITE}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      },
    });
    if (erroLink) throw new Error(`generateLink ${alvo.email}: ${erroLink.message}`);
    const link = linkData?.properties?.action_link ?? null;
    if (!link) throw new Error(`generateLink nao devolveu action_link para ${alvo.email}`);
    console.log(`  link de senha: OK (${link.slice(0, 60)}...)`);

    // 4. O texto, pela funcao de PRODUCAO.
    const { assunto, texto } = puro.montarBoasVindas(
      compra,
      { situacao: "criada", linkDefinirSenha: link, erro: null },
      temAssinatura,
    );

    const base = path.join("/tmp", `324_${alvo.email.replace(/[^a-z0-9]/gi, "_")}`);
    fs.writeFileSync(`${base}.txt`, `ASSUNTO: ${assunto}\n\n${texto}\n`, "utf8");
    fs.writeFileSync(`${base}.html`, paraHtml(texto), "utf8");
    console.log(`  assunto: ${assunto}`);
    console.log(`  escrito: ${base}.txt / ${base}.html`);
  }
  console.log("=".repeat(70));
  console.log("PRONTO. Nada foi enviado. Revise os .txt antes de mandar.");
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
