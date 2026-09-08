/**
 * ENSAIO do sweeper de compra órfã COM o dedupe cíclico (08/09/2026).
 *
 * POR QUE ESTE ENSAIO EXISTE, ANTES DO PR
 * O `orphan-ciclo.ts` troca o dedupe "por e-mail e pra sempre" por "por
 * COBRANÇA". Isso é o conserto certo, mas tem um efeito de borda caro: na
 * PRIMEIRA varredura depois do deploy, todo comprador com pagamento mais novo
 * que a âncora do ciclo vira convite NO MESMO DIA. Se forem dezenas, isso é
 * e-mail EM MASSA, que pela regra 8 de 21/08 precisa do "pode" do Johnny —
 * e-mail individual eu decido sozinho, rajada não.
 *
 * Então mede-se ANTES: quem exatamente recebe, quantos, e por quê.
 *
 * NÃO MANDA NADA. Não escreve no banco. Não toca no agent_state.
 * As funções de DECISÃO são as DE PRODUÇÃO (`orphan-ciclo`, `acesso-regra`),
 * importadas de verdade — o que este arquivo reimplementa é só a parte de
 * CONSULTA do sweep, espelhada linha a linha de `sweepOrphanPurchases`.
 *
 * Rodar:  cd frontend && npx tsx ../_frank/rascunhos/medir_convite_ciclico.ts
 */
import { createRequire } from "node:module";
import * as path from "node:path";
// Este arquivo mora em _frank/rascunhos/, então o Node procuraria node_modules
// a partir DAQUI e não acharia nada. Resolve-se a partir do frontend, que é
// onde as dependências vivem.
const req = createRequire(path.join(__dirname, "..", "..", "frontend", "package.json"));
const { createClient } = req("@supabase/supabase-js");
const dotenv = req("dotenv");
import {
  decidirAcaoConvite,
  type RegistroConvite,
} from "../../frontend/src/lib/payments/orphan-ciclo";
import {
  compradorMereceConvite,
  eventoEhPagamento,
} from "../../frontend/src/lib/payments/acesso-regra";

dotenv.config({ path: path.join(__dirname, "..", "..", "frontend", ".env.local") });

// —— constantes copiadas de orphan-outreach.ts (se lá mudar, aqui mente) ——
const PRODUCT_ID = "7851642";
const STATE_KEY = "orphan_invites";
const MIN_AGE_MS = 60 * 60 * 1000;
const REMINDER_AFTER_MS = 3 * 24 * 60 * 60 * 1000;
const TEST_EMAILS = new Set([
  "teste@fastcloner.com",
  "test@example.com",
]);
const isTestEmail = (e: string) =>
  !e || e.includes("@example.com") || e.endsWith("@fastcloner.com") || TEST_EMAILS.has(e);

type ApprovedRow = {
  buyer_email: string | null;
  received_at: string;
  payload: { data?: Record<string, any> } | null;
};

(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("credenciais ausentes no .env.local");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // 1) payment_events PAGINADO (teto silencioso de 1000 do PostgREST)
  const approved: ApprovedRow[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("payment_events")
      .select("buyer_email, received_at, payload")
      .eq("event_type", "PURCHASE_APPROVED")
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`payment_events falhou: ${error.message}`);
    approved.push(...((data ?? []) as ApprovedRow[]));
    if (!data || data.length < PAGE) break;
  }
  console.log(`contraprova: ${approved.length} PURCHASE_APPROVED lidos (paginado)`);

  const buyers = new Map<string, { at: string; name: string; pagou: boolean; pagoEm: string | null }>();
  for (const row of approved) {
    const email = (row.buyer_email ?? "").toLowerCase();
    const d = row.payload?.data;
    if (isTestEmail(email) || String(d?.product?.id ?? "") !== PRODUCT_ID) continue;
    const pagouNesta = eventoEhPagamento({
      valor: d?.purchase?.price?.value,
      status: d?.purchase?.status,
    });
    const cur = buyers.get(email);
    if (!cur) {
      buyers.set(email, {
        at: row.received_at,
        name: (d?.buyer?.name ?? "").split(" ")[0],
        pagou: pagouNesta,
        pagoEm: pagouNesta ? row.received_at : null,
      });
    } else {
      if (pagouNesta) {
        cur.pagou = true;
        if (!cur.pagoEm || Date.parse(row.received_at) > Date.parse(cur.pagoEm)) {
          cur.pagoEm = row.received_at;
        }
      }
      if (row.received_at > cur.at) {
        cur.at = row.received_at;
        cur.name = (d?.buyer?.name ?? "").split(" ")[0];
      }
    }
  }
  console.log(`compradores do produto ${PRODUCT_ID}: ${buyers.size}`);

  // 2) guardas
  const buyerEmails = [...buyers.keys()];
  const CHUNK = 500;
  const hasAccount = new Set<string>();
  for (let i = 0; i < buyerEmails.length; i += CHUNK) {
    const { data, error } = await admin
      .from("profiles").select("email").in("email", buyerEmails.slice(i, i + CHUNK));
    if (error) throw new Error(`guarda hasAccount falhou: ${error.message}`);
    for (const p of (data ?? []) as { email: string | null }[]) {
      if (p.email) hasAccount.add(p.email.toLowerCase());
    }
  }

  const nowIso = new Date().toISOString();
  const now = Date.now();
  const ultimoEnt = new Map<string, { status: string; access_until: string | null; at: string }>();
  const jaTemDono = new Set<string>();
  for (let i = 0; i < buyerEmails.length; i += CHUNK) {
    const { data, error } = await admin
      .from("entitlements")
      .select("buyer_email, status, access_until, updated_at, created_at, user_id")
      .in("buyer_email", buyerEmails.slice(i, i + CHUNK));
    if (error) throw new Error(`guarda entitlements falhou: ${error.message}`);
    for (const e of (data ?? []) as any[]) {
      const em = (e.buyer_email ?? "").toLowerCase();
      if (!em) continue;
      if (e.user_id) jaTemDono.add(em);
      const at = e.updated_at ?? e.created_at ?? "";
      const cur = ultimoEnt.get(em);
      if (!cur || at > cur.at) {
        ultimoEnt.set(em, { status: e.status ?? "", access_until: e.access_until, at });
      }
    }
  }

  // 3) estado do dedupe
  const { data: st, error: stErr } = await admin
    .from("agent_state").select("value").eq("key", STATE_KEY).maybeSingle();
  if (stErr) throw new Error(`agent_state falhou: ${stErr.message}`);
  const state = (st?.value ?? {}) as Record<string, RegistroConvite>;
  console.log(`agent_state.${STATE_KEY}: ${Object.keys(state).length} e-mails com registro\n`);

  // 4) decisão — REGRA NOVA x REGRA VELHA, lado a lado
  const convitesNovo: string[] = [];
  const lembretesNovo: string[] = [];
  const convitesVelho: string[] = [];
  const lembretesVelho: string[] = [];
  const reabertos: string[] = [];

  for (const [email, info] of buyers) {
    if (hasAccount.has(email)) continue;
    if (jaTemDono.has(email)) continue;
    const ent = ultimoEnt.get(email) ?? null;
    if (!compradorMereceConvite(ent, info.pagou, nowIso)) continue;
    if (now - new Date(info.at).getTime() < MIN_AGE_MS) continue;

    const record = state[email];

    // regra NOVA (a do PR)
    const acao = decidirAcaoConvite({
      registro: record,
      ultimoPagamentoIso: info.pagoEm,
      agoraMs: now,
      lembreteAposMs: REMINDER_AFTER_MS,
    });
    if (acao === "convite") convitesNovo.push(email);
    if (acao === "lembrete") lembretesNovo.push(email);

    // regra VELHA (a que está em produção agora)
    let acaoVelha: string = "nada";
    if (!record) acaoVelha = "convite";
    else if (!record.reminder && now - new Date(record.first).getTime() > REMINDER_AFTER_MS) {
      acaoVelha = "lembrete";
    }
    if (acaoVelha === "convite") convitesVelho.push(email);
    if (acaoVelha === "lembrete") lembretesVelho.push(email);

    // o DELTA: quem só fala por causa do ciclo novo
    if (acao !== "nada" && acaoVelha === "nada") {
      reabertos.push(
        `${email}  [ciclo reaberto] convite=${record?.first ?? "-"} lembrete=${record?.reminder ?? "-"} pagoEm=${info.pagoEm ?? "-"} -> ${acao}`,
      );
    }
  }

  const fmt = (n: number) => String(n).padStart(3);
  console.log("═══ O QUE A VARREDURA FARIA NA PRIMEIRA RODADA ═══\n");
  console.log(`               REGRA VELHA (produção hoje)   REGRA NOVA (o PR)`);
  console.log(`  convites          ${fmt(convitesVelho.length)}                      ${fmt(convitesNovo.length)}`);
  console.log(`  lembretes         ${fmt(lembretesVelho.length)}                      ${fmt(lembretesNovo.length)}`);
  console.log(`  TOTAL de e-mails  ${fmt(convitesVelho.length + lembretesVelho.length)}                      ${fmt(convitesNovo.length + lembretesNovo.length)}`);

  console.log(`\n═══ O DELTA: ${reabertos.length} pessoa(s) que só falam por causa do ciclo novo ═══`);
  for (const l of reabertos.sort()) console.log(`  ${l}`);

  console.log(`\n═══ LISTA COMPLETA, REGRA NOVA ═══`);
  console.log(`convites (${convitesNovo.length}):`);
  for (const e of convitesNovo.sort()) console.log(`  ${e}`);
  console.log(`lembretes (${lembretesNovo.length}):`);
  for (const e of lembretesNovo.sort()) console.log(`  ${e}`);

  console.log(`\nNADA FOI ENVIADO E NADA FOI GRAVADO — isto é ensaio.`);
})();
