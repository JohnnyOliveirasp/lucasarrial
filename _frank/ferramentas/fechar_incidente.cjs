/**
 * FECHAR INCIDENTE — a ÚNICA forma certa de fechar incidente por script.
 *
 * Nasceu do card 20/08: cada ronda escrevia seu próprio update ad-hoc e
 * parte deles esquecia resolved_at/resolved_by — o incidente fechado sem
 * data fica PERMANENTEMENTE invisível pro detector de zumbi (que compara
 * last_seen_at > resolved_at). Foi assim que o 8d370ef5 escondeu 14
 * ocorrências de bug nosso. Esta ferramenta recusa fechar sem autor e sem
 * nota, e SEMPRE relê a linha depois de gravar (o que vale é o que o banco
 * confirma, não o que o script planejava).
 *
 * Uso:
 *   node _frank/ferramentas/fechar_incidente.cjs <id-ou-prefixo8> \
 *     --status fixed|ignored --por frank --nota "por que fechou" \
 *     [--commit sha] [--confirmar]
 *
 * Sem --confirmar, SIMULA (mostra o que faria e sai).
 * NÃO reabre incidente (status open/investigating/fixing são recusados) —
 * reabrir é decisão de quem investiga, não desta ferramenta.
 */
const { supa } = require("./_comum.cjs");

function arg(nome) {
  const i = process.argv.indexOf(`--${nome}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}

(async () => {
  const alvo = process.argv[2];
  const status = arg("status");
  const por = arg("por");
  const nota = arg("nota");
  const commit = arg("commit");
  const CONFIRMA = process.argv.includes("--confirmar");

  const erros = [];
  if (!alvo || alvo.startsWith("--")) erros.push("faltou o <id-ou-prefixo8> como 1º argumento");
  if (status !== "fixed" && status !== "ignored")
    erros.push("--status tem que ser 'fixed' ou 'ignored' (esta ferramenta NÃO reabre)");
  if (!por) erros.push("--por é obrigatório (quem fechou: frank, claude, e-mail...)");
  if (!nota || nota.trim().length < 20)
    erros.push("--nota é obrigatória (mín. 20 caracteres): só o que o BANCO confirma, nunca plano/ensaio");
  if (erros.length) {
    console.error("RECUSADO:\n  - " + erros.join("\n  - "));
    process.exit(1);
  }

  const db = supa();

  // uuid não aceita ilike — resolve prefixo comparando os ids em memória.
  const { data: todos, error: eL } = await db.from("incidents").select("id, status, signature, title");
  if (eL) {
    console.error("ERRO ao listar incidentes:", JSON.stringify(eL));
    process.exit(1);
  }
  const candidatos = (todos || []).filter((i) => String(i.id).startsWith(alvo));
  if (candidatos.length !== 1) {
    console.error(
      `RECUSADO: prefixo '${alvo}' bateu com ${candidatos.length} incidentes (precisa bater com exatamente 1):`,
    );
    for (const c of candidatos.slice(0, 10)) console.error(`  ${c.id} [${c.status}] ${c.signature}`);
    process.exit(1);
  }
  const inc = candidatos[0];
  console.log(`ALVO: ${inc.id}\n  [${inc.status}] ${inc.signature}\n  ${inc.title}`);

  const agora = new Date().toISOString();
  const patch = {
    status,
    resolved_by: por,
    resolved_at: agora,
    resolution_note: nota.slice(0, 4000),
    ...(commit ? { resolved_commit: commit.slice(0, 64) } : {}),
  };
  console.log("\nPATCH:", JSON.stringify({ ...patch, resolution_note: patch.resolution_note.slice(0, 120) + "…" }, null, 2));

  if (!CONFIRMA) {
    console.log("\n[ENSAIO] Nada gravado. Rode de novo com --confirmar.");
    return;
  }

  const { data: gravado, error: eU } = await db
    .from("incidents")
    .update(patch)
    .eq("id", inc.id)
    .select("id, status, resolved_at, resolved_by, resolved_commit");
  if (eU) {
    console.error("ERRO ao gravar:", JSON.stringify(eU));
    process.exit(1);
  }
  if (!gravado || gravado.length !== 1) {
    console.error(`ERRO: update afetou ${gravado ? gravado.length : 0} linhas (esperava 1). NADA confirmado.`);
    process.exit(1);
  }

  // Releitura independente — o que vale é o que o banco devolve.
  const { data: rel, error: eR } = await db
    .from("incidents")
    .select("id, status, resolved_at, resolved_by, resolved_commit, resolution_note")
    .eq("id", inc.id)
    .single();
  if (eR) {
    console.error("ERRO na releitura:", JSON.stringify(eR));
    process.exit(1);
  }
  console.log("\nRELEITURA (banco):");
  console.log(`  status=${rel.status} resolved_at=${rel.resolved_at} resolved_by=${rel.resolved_by} commit=${rel.resolved_commit}`);
  if (!rel.resolved_at || !rel.resolved_by) {
    console.error("FALHA: fechamento gravado SEM resolved_at/resolved_by — investigar antes de confiar.");
    process.exit(1);
  }
  console.log("\n✓ Fechado com auditoria completa.");
})();
