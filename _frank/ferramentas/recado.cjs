#!/usr/bin/env node
/**
 * Caixa de recados `para_frank_*` da agent_state — listar, marcar consumo, limpar.
 *
 *   node _frank/ferramentas/recado.cjs --listar
 *       Só os recados SEM `lido_em`, do mais antigo pro mais novo, cada um com
 *       chave, dia e o incidente correspondente (número + status) quando existe.
 *
 *   node _frank/ferramentas/recado.cjs --lido CHAVE [--por QUEM]
 *       Merge de { lido_em, lido_por } DENTRO do value existente (leitura →
 *       merge → regrava → confere). NUNCA usa set_state com null: value é
 *       jsonb NOT NULL, null dá 23502 e a chave continua lá (regra medida).
 *
 *   node _frank/ferramentas/recado.cjs --limpar [--confirmar]
 *       Apaga (DELETE) SÓ chaves com lido_em há mais de 30 dias. Sem
 *       --confirmar é SIMULAÇÃO: nomeia o que apagaria e não toca em nada.
 *       Não-lido NUNCA apaga, seja qual for a idade — existe recado velho
 *       apontando pra cartão ainda aberto; idade não diz consumo.
 *
 * Por que consumo e não status de incidente: 15 dos 116 recados medidos em
 * 24/09 não derivam de incidente nenhum (para_frank_<timestamp> e
 * para_frank_orfa_<rand>) — "apagar quando o incidente fecha" nunca os
 * alcançaria. E o texto original de recado consumido é evidência (serviu em
 * 4 conferências em 23-24/09), daí a retenção de 30 dias em vez de apagar
 * na hora do consumo.
 *
 * Saída: 0 ok · 1 falha de execução/verificação · 2 uso errado.
 */
const { supa } = require("./_comum.cjs");
const R = require("./_recado.cjs");

const QUEM_PADRAO = "frank";

function uso() {
  console.log(
    [
      "uso:",
      "  recado.cjs --listar                     recados ainda não lidos, do mais antigo pro mais novo",
      "  recado.cjs --lido CHAVE [--por QUEM]    carimba lido_em/lido_por dentro do value (merge)",
      "  recado.cjs --limpar [--confirmar]       apaga só lido há +30d; sem --confirmar, simula",
    ].join("\n"),
  );
}

function argDepois(args, flag) {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : null;
}

async function carregarRecados(db) {
  const { data, error } = await db
    .from("agent_state")
    .select("key,updated_at,value")
    .like("key", "para_frank_%");
  if (error) throw new Error(`agent_state: ${error.message}`);
  return data.map((r) => ({ key: r.key, updated_at: r.updated_at, value: R.interpretarValue(r.value) }));
}

/** Busca os incidentes citados numa tacada só e devolve Map id → {numero,status}. */
async function incidentesDe(db, recados) {
  const ids = [...new Set(recados.map((r) => R.incidenteDe(r.value)).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await db.from("incidents").select("id,numero,status").in("id", ids);
  if (error) throw new Error(`incidents: ${error.message}`);
  return new Map(data.map((i) => [i.id, i]));
}

function rotuloIncidente(value, mapa) {
  const id = R.incidenteDe(value);
  if (!id) return "sem incidente";
  const i = mapa.get(id);
  if (!i) return `incidente INEXISTENTE (${id.slice(0, 8)})`;
  return `#${i.numero ?? id.slice(0, 8)} [${i.status}]`;
}

async function listar(db, agora) {
  const todos = await carregarRecados(db);
  const pendentes = todos
    .filter((r) => R.apareceNoListar(r.value, agora))
    .sort((a, b) => new Date(R.diaDe(a.value, a.updated_at)) - new Date(R.diaDe(b.value, b.updated_at)));
  const mapa = await incidentesDe(db, pendentes);

  console.log(`RECADOS NÃO LIDOS: ${pendentes.length} (de ${todos.length} chaves para_frank_*)`);
  for (const r of pendentes) {
    const dia = String(R.diaDe(r.value, r.updated_at) ?? "?").slice(0, 10);
    const assunto = String(r.value.subject ?? r.value.assunto ?? "").slice(0, 70);
    console.log(`  ${dia} · ${r.key} · ${rotuloIncidente(r.value, mapa)} · ${assunto}`);
  }
  if (!pendentes.length) console.log("  (caixa em dia)");
}

async function lido(db, chave, por, agora) {
  const { data, error } = await db
    .from("agent_state")
    .select("key,value")
    .eq("key", chave)
    .maybeSingle();
  if (error) throw new Error(`agent_state: ${error.message}`);
  if (!data) {
    console.log(`NÃO EXISTE a chave '${chave}' — nada marcado. (recado.cjs --listar mostra as vigentes)`);
    process.exit(1);
  }

  const atual = R.interpretarValue(data.value);
  const { value: novo, jaLido } = R.marcarLido(atual, new Date(agora).toISOString(), por);
  if (jaLido) {
    console.log(`JÁ ESTAVA LIDO: ${chave} (lido_em=${atual.lido_em}${atual.lido_por ? `, por ${atual.lido_por}` : ""}) — relógio dos 30d preservado.`);
    return;
  }

  // merge → regrava (UPDATE do value inteiro mesclado; nunca null, nunca substitui por objeto novo)
  const { error: eUp } = await db.from("agent_state").update({ value: novo }).eq("key", chave);
  if (eUp) throw new Error(`update falhou: ${eUp.message}`);

  // escrita conferida: lê de volta e confere o carimbo (saída otimista não é prova)
  const { data: depois, error: eRe } = await db
    .from("agent_state")
    .select("value")
    .eq("key", chave)
    .maybeSingle();
  if (eRe) throw new Error(`releitura falhou: ${eRe.message}`);
  const conferido = R.interpretarValue(depois?.value);
  if (R.lidoEm(conferido) === null) {
    console.log(`FALHOU A CONFERÊNCIA: gravei mas a releitura de '${chave}' veio sem lido_em legível. Nada garantido.`);
    process.exit(1);
  }
  console.log(`LIDO: ${chave} · lido_em=${conferido.lido_em} · por=${conferido.lido_por ?? "(não informado)"}`);
}

async function limpar(db, confirmar, agora) {
  const todos = await carregarRecados(db);
  const alvos = todos.filter((r) => R.podeApagar(r.value, agora));
  const protegidos = todos.length - alvos.length;

  console.log(
    `${confirmar ? "LIMPEZA" : "SIMULAÇÃO (sem --confirmar, nada será apagado)"}: ` +
      `${alvos.length} chave(s) com lido_em há mais de ${R.RETENCAO_DIAS_PADRAO}d · ${protegidos} ficam (não lidas ou lidas há menos de ${R.RETENCAO_DIAS_PADRAO}d)`,
  );
  for (const r of alvos) {
    console.log(`  ${confirmar ? "APAGAR" : "apagaria"}: ${r.key} · lido_em=${r.value.lido_em} · por=${r.value.lido_por ?? "?"}`);
  }
  if (!alvos.length || !confirmar) return;

  // apaga uma a uma e depois confere contra a LISTA esperada, nomeando quem
  // sobrou — controle que só aborta no zero é defeito (regra medida da casa).
  for (const r of alvos) {
    const { error } = await db.from("agent_state").delete().eq("key", r.key);
    if (error) console.log(`  FALHOU o delete de ${r.key}: ${error.message}`);
  }
  const { data: restantes, error: eRe } = await db
    .from("agent_state")
    .select("key")
    .in("key", alvos.map((r) => r.key));
  if (eRe) throw new Error(`conferência pós-delete falhou: ${eRe.message} — NÃO dou a limpeza como feita.`);
  const sobraram = (restantes ?? []).map((r) => r.key);
  if (sobraram.length) {
    console.log(`FALHOU: ${sobraram.length} de ${alvos.length} NÃO foram apagadas:`);
    for (const k of sobraram) console.log(`  ainda existe: ${k}`);
    process.exit(1);
  }
  console.log(`APAGADAS ${alvos.length}/${alvos.length}, conferido por releitura.`);
}

(async () => {
  const args = process.argv.slice(2);
  const agora = Date.now();
  const db = supa();

  if (args.includes("--listar")) return listar(db, agora);
  if (args.includes("--lido")) {
    const chave = argDepois(args, "--lido");
    if (!chave) {
      uso();
      process.exit(2);
    }
    return lido(db, chave, argDepois(args, "--por") ?? QUEM_PADRAO, agora);
  }
  if (args.includes("--limpar")) return limpar(db, args.includes("--confirmar"), agora);

  uso();
  process.exit(2);
})().catch((e) => {
  console.log("ERRO:", e.message);
  process.exit(1);
});
