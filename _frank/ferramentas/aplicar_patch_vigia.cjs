#!/usr/bin/env node
/**
 * aplicar_patch_vigia.cjs — tira do banco o patch que o Vigia escreveu e
 * deixa ele pronto pro `git am`.
 *
 * POR QUE EXISTE (21/08). O Vigia mora no Claude cloud e NÃO consegue subir
 * código: o repo `lucasarrial` é público, então o sandbox dele clona sem
 * credencial nenhuma — e é por isso que ninguém percebeu que lá dentro não
 * existe credencial de ESCRITA. Medido: `git ls-remote --heads origin
 * 'refs/heads/agent/*'` volta VAZIO. Em um mês inteiro nenhuma branch dele
 * chegou ao GitHub. Na rodada de 21/08 12:04 ele escreveu um fix completo,
 * verde no tsc e no eslint, commitou — e perdeu tudo quando o sandbox morreu.
 *
 * Desde então ele entrega PATCH: grava o `git format-patch` em
 * `agent_state`, chave `patch_<incidente>`, via `set_state` (que grava o
 * value inteiro em jsonb — `add_note` NÃO serve, corta em 2000 chars).
 * Esta ferramenta é o outro lado dessa ponte.
 *
 * ⚠️ Ela NÃO aplica nada e NÃO mexe no git. Só extrai e confere. Aplicar é
 * passo seu, consciente, numa branch `vigia/<incidente>` — ver regra 14-B.
 *
 * USO (de qualquer pasta):
 *   node _frank/ferramentas/aplicar_patch_vigia.cjs                 # lista o que tem
 *   node _frank/ferramentas/aplicar_patch_vigia.cjs --chave patch_72e054ee
 *   node _frank/ferramentas/aplicar_patch_vigia.cjs --chave X --seco  # só mostra
 *   node _frank/ferramentas/aplicar_patch_vigia.cjs --chave X --apagar
 *
 * Depois de extrair:
 *   git checkout -b vigia/<incidente> origin/main
 *   git am <arquivo que esta ferramenta imprimir>
 */
const path = require("node:path");
const fs = require("node:fs");
const { supa } = require("./_comum.cjs");

const argv = process.argv.slice(2);
const flag = (n) => {
  const i = argv.indexOf(n);
  return i >= 0 ? argv[i + 1] : null;
};
const CHAVE = flag("--chave");
const SECO = argv.includes("--seco");
const APAGAR = argv.includes("--apagar");

const RAIZ = path.resolve(__dirname, "..", "..");
const DESTINO = path.join(RAIZ, "_Bugs", "patches_vigia");
const db = supa();

/** Lista tudo que está esperando, mais novo primeiro. */
async function listar() {
  const r = await db.from("agent_state").select("key, value, updated_at").like("key", "patch\\_%");
  if (r.error) {
    console.error("ERRO ao ler agent_state:", r.error.message);
    process.exit(1);
  }
  const vivos = (r.data ?? []).filter((x) => x.value && x.value.patch);
  if (!vivos.length) {
    console.log("nenhum patch do Vigia esperando.");
    return [];
  }
  vivos.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  console.log(`\n${vivos.length} patch(es) esperando:\n`);
  for (const p of vivos) {
    const v = p.value;
    const idade = ((Date.now() - new Date(p.updated_at)) / 3600000).toFixed(1);
    console.log(`  ${p.key}   (há ${idade}h)`);
    console.log(`     incidente:    ${v.incident_id ?? "(não informado)"}`);
    console.log(`     assunto:      ${v.assunto ?? "(sem assunto)"}`);
    console.log(`     verificações: ${v.verificacoes ?? "(não informou)"}`);
    console.log(`     arquivos:     ${(v.arquivos ?? []).join(", ") || "(não listou)"}`);
    console.log();
  }
  return vivos;
}

/**
 * Confere o que dá pra conferir SEM aplicar. Patch truncado é o risco real:
 * o `set_state` grava inteiro, mas se o Vigia montar errado o `git am` falha
 * no meio e deixa a árvore suja.
 */
function conferir(texto) {
  const problemas = [];
  if (!/^From [0-9a-f]{7,40} /m.test(texto)) {
    problemas.push("não começa com cabeçalho 'From <sha>' — não parece format-patch");
  }
  if (!/^---$/m.test(texto)) problemas.push("sem separador '---' do corpo");
  if (!/^diff --git /m.test(texto)) problemas.push("nenhum 'diff --git' — patch sem mudança");
  const fim = /^-- $/m.test(texto) || /\n2\.\d+\.\d+\s*$/.test(texto.trim());
  if (!fim) problemas.push("não termina com rodapé de patch — TRUNCADO, provavelmente");
  const arquivos = [...texto.matchAll(/^diff --git a\/(\S+) b\//gm)].map((m) => m[1]);
  return { problemas, arquivos };
}

(async () => {
  if (!CHAVE) {
    await listar();
    console.log("passe --chave <patch_xxxxxxxx> pra extrair um.");
    return;
  }

  const r = await db.from("agent_state").select("key, value, updated_at").eq("key", CHAVE).maybeSingle();
  if (r.error) {
    console.error("ERRO:", r.error.message);
    process.exit(1);
  }
  if (!r.data) {
    console.error(`chave "${CHAVE}" não existe. Rode sem --chave pra ver a lista.`);
    process.exit(1);
  }

  const v = r.data.value ?? {};

  if (APAGAR) {
    // ⚠️ DELETE de verdade, não `update({value:null})`.
    // `agent_state.value` é NOT NULL: a versão anterior tentava zerar o campo
    // e o Postgres devolvia 23502 ("null value in column value ... violates
    // not-null constraint"). Ou seja: --apagar NUNCA apagou nada desde que
    // existe. Medido em 03/09 — as 3 chaves de patch da fila recusaram as 3.
    // Consequência real: a fila de patches do Vigia não drenava, e as rondas
    // vinham contando "3 patches parados" como dívida crescente enquanto os
    // três já tinham sido resolvidos por outro caminho. O mesmo defeito já
    // tinha aparecido em 29/08 nas chaves `para_frank_orfa_*`, curado na mão
    // com DELETE em vez de na ferramenta.
    const u = await db.from("agent_state").delete().eq("key", CHAVE).select("key");
    if (u.error) {
      console.error("ERRO ao apagar:", u.error.message);
      process.exit(1);
    }
    // `.select()` depois de gravar: DELETE por chave inexistente afeta 0 linhas
    // EM SILÊNCIO, e "apagada" impresso em cima de 0 linhas é fechamento falso.
    const n = (u.data ?? []).length;
    if (n !== 1) {
      console.error(`ERRO: o DELETE afetou ${n} linha(s), esperado 1. NÃO considere apagada.`);
      process.exit(1);
    }
    console.log(`${CHAVE} apagada (1 linha) — não volta na próxima ronda.`);
    return;
  }

  const texto = v.patch;
  if (!texto) {
    console.error(`${CHAVE} não tem campo "patch". Conteúdo:`, JSON.stringify(v).slice(0, 400));
    process.exit(1);
  }

  console.log(`\n=== ${CHAVE} ===`);
  console.log(`incidente:    ${v.incident_id ?? "(não informado)"}`);
  console.log(`assunto:      ${v.assunto ?? "(sem assunto)"}`);
  console.log(`base:         ${v.base ?? "(não informou)"}`);
  console.log(`verificações: ${v.verificacoes ?? "(não informou)"}`);
  console.log(`\ndiagnóstico dele:\n  ${String(v.diagnostico ?? "(vazio)").replace(/\n/g, "\n  ")}`);

  const { problemas, arquivos } = conferir(texto);
  console.log(`\narquivos tocados (${arquivos.length}): ${arquivos.join(", ") || "(nenhum!)"}`);
  console.log(`tamanho: ${texto.length.toLocaleString()} chars`);
  if (problemas.length) {
    console.log("\n⚠️  PROBLEMAS NO PATCH:");
    for (const p of problemas) console.log(`   - ${p}`);
    console.log("   Patch torto falha no meio do `git am` e suja a árvore.");
    console.log("   Recuse e anote no incidente em vez de remendar no escuro.");
  } else {
    console.log("\nestrutura do patch: ok (cabeçalho, diff e rodapé presentes)");
  }

  if (SECO) {
    console.log("\n--seco: nada foi gravado em disco.");
    return;
  }

  fs.mkdirSync(DESTINO, { recursive: true });
  const arq = path.join(DESTINO, `${CHAVE}.patch`);
  fs.writeFileSync(arq, texto, "utf8");
  console.log(`\ngravado em: ${arq}`);
  console.log("\npróximo passo (LEIA O CÓDIGO antes de mergear — regra 14-B):");
  console.log(`  git checkout -b vigia/${(v.incident_id ?? CHAVE).slice(0, 8)} origin/main`);
  console.log(`  git am "${arq}"`);
})();
