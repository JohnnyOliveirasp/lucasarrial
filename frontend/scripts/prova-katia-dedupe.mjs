/**
 * PROVA DO TESTE DE ACEITE (card do dedupe por queixa, 20/08) — SÓ LEITURA.
 *
 * Puxa AO VIVO do banco o incidente ce6e157d (caso Katia) e roda a lógica
 * NOVA (mail-incident.ts) sobre os textos reais das duas ocorrências:
 *   - ocorrência 1 (19/08 12:10): eco/corte  → title do incidente
 *   - ocorrência 2 (20/08 17:05): pacing     → description + sample_error
 * Imprime as assinaturas que cada uma geraria na lógica nova. Se saírem
 * IGUAIS, a lógica está errada e o script sai com código 1.
 *
 * Rodar da pasta frontend/ (Node ≥ 22.18):
 *   node scripts/prova-katia-dedupe.mjs
 */
import { createRequire } from "node:module";
import { classifyComplaint, decideDedupe, incidentSignature } from "../src/lib/agent/mail-incident.ts";

const require = createRequire(import.meta.url);
// .env.local da pasta frontend; rodando de um worktree (sem .env.local, que é
// untracked), cai no do repo canônico.
require("dotenv").config({ path: new URL("../.env.local", import.meta.url).pathname });
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  require("dotenv").config({ path: "/mnt/Data/Projetos/PlatformLucasArrial/frontend/.env.local" });
}
const { createClient } = require("@supabase/supabase-js");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: inc, error } = await db
  .from("incidents")
  .select("id, signature, status, title, description, sample_error, occurrences, first_seen_at, last_seen_at, resolved_at")
  .eq("id", "ce6e157d-9fdf-4c70-ad24-8ab74d5da998")
  .single();
if (error) {
  console.error("ERRO ao ler o incidente:", error.message);
  process.exit(1);
}

console.log("=== incidente real (produção) ===");
console.log(`id: ${inc.id}`);
console.log(`signature ATUAL (legada): ${inc.signature}`);
console.log(`status: ${inc.status} | occurrences: ${inc.occurrences}`);
console.log(`title (ocorrência 1, eco/corte): ${inc.title}`);
console.log(`description (ocorrência 2, pacing — SOBRESCREVEU a 1): ${inc.description}`);
console.log();

// Ocorrência 1: o resumo da Fast está preservado no title (prefixo "Fast (e-mail): ").
const reasonEco = inc.title.replace(/^Fast \(e-mail[^)]*\): /, "");
// Ocorrência 2: o resumo da Fast é a description atual; o cru está em sample_error.
const reasonPacing = inc.description;
const excerptPacing = inc.sample_error ?? "";

const classeEco = classifyComplaint(reasonEco);
const classePacing = classifyComplaint(reasonPacing, excerptPacing);
const sigEco = incidentSignature(true, "katiasalvador32@gmail.com", classeEco);
const sigPacing = incidentSignature(true, "katiasalvador32@gmail.com", classePacing);

console.log("=== lógica NOVA aplicada aos textos reais ===");
console.log(`ocorrência 1 (eco)    → classe: ${classeEco}  → assinatura: ${sigEco}`);
console.log(`ocorrência 2 (pacing) → classe: ${classePacing} → assinatura: ${sigPacing}`);
console.log();

const separou = sigEco !== sigPacing;
console.log(`separou as duas queixas? ${separou ? "SIM" : "NAO"}`);
console.log(
  `replay 20/08 17:05: busca por "${sigPacing}" não acharia nada → decideDedupe(null) = "${decideDedupe(null, classePacing)}" (incidente NOVO, visível)`,
);
console.log(
  `e se o card de pacing já existisse fechado (fixed): decideDedupe("fixed") = "${decideDedupe("fixed", classePacing)}" (reabre com nota, nunca soma calado)`,
);

process.exit(separou && classeEco !== null && classePacing !== null ? 0 : 1);
