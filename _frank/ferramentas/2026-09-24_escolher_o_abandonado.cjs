/**
 * ESCOLHER O ITEM SERIAL: o cartao ABANDONADO, nao o mais velho de nascimento.
 *
 *   node _frank/ferramentas/2026-09-24_escolher_o_abandonado.cjs
 *
 * POR QUE EXISTE (medido hoje, 24/09 ~20hZ). A regra 8 manda pegar "o mais
 * antigo com aluno afetado". A ronda das 15hZ ja mostrou que `created_at`
 * ESCONDE cartao: nascimento velho com nota de ontem nao e trabalho
 * abandonado, e cartao em andamento. O recorte que acha trabalho parado e a
 * ULTIMA NOTA — quanto tempo faz que alguem encostou.
 *
 * E existe por um segundo motivo, que e um defeito do proprio instrumental:
 * o `2026-09-19_idade_dos_abertos.cjs` (a ferramenta que a ronda de fato roda)
 * filtra `.in("status", ["open","investigating"])` na linha 41 e NAO conhece
 * `aguardando_aluno`. O `idade_incidentes.cjs` ganhou esse conserto em 23/09 e
 * o cabecalho dele registra o tamanho do buraco (107 -> 142, 35 cartoes
 * invisiveis, o mais velho com 25,9d). O conserto nunca foi para o
 * `idade_dos_abertos`. Ou seja: a MESMA familia do #410 — conserto sobe num
 * lugar e o acervo (aqui, as outras copias) fica para tras.
 *
 * `aguardando_aluno` ENTRA, e entra com desconfianca: o rotulo MENTE sobre
 * quem deve o proximo passo (caso #214, 21 dias com o rotulo sem que nada
 * tivesse sido pedido a aluna — a bola era da casa o tempo todo).
 *
 * SO LEITURA. Nao escreve, nao fecha, nao manda e-mail.
 *
 * ARMADILHA 1 (03_ROTINA): consulta que erra volta VAZIA e o script imprime
 * "0" alegremente. Todo `error` e checado e o script MORRE em vez de reportar
 * zero. E a leitura PAGINA: o corte em 1.000 linhas do Supabase ja produziu
 * "ZERO perfis com @" falso em 13/09.
 */
const { supa } = require("./_comum.cjs");

const AGORA = new Date();
const dias = (iso) => (AGORA - new Date(iso)) / 86400000;

const ABERTOS = ["open", "investigating", "aguardando_aluno"];
const PAGINA = 1000;

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Nao acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}

/** Le TODAS as linhas, em paginas. Devolver menos que o total e mentir. */
async function lerTudo(db, tabela, colunas, aplicar) {
  const tudo = [];
  for (let de = 0; ; de += PAGINA) {
    let q = db.from(tabela).select(colunas).range(de, de + PAGINA - 1);
    if (aplicar) q = aplicar(q);
    const { data, error } = await q;
    exigir(`${tabela} pagina ${de}`, error);
    tudo.push(...data);
    if (data.length < PAGINA) break;
  }
  return tudo;
}

/** agent_notes pode ser array, string legada (acidente de 21/08) ou nulo. */
function notas(inc) {
  const cru = inc.agent_notes;
  if (Array.isArray(cru)) return cru;
  if (typeof cru === "string" && cru.trim()) return [{ at: null, texto: cru }];
  return [];
}

/** A data da nota mais recente; null se o cartao nunca foi anotado. */
function ultimaNota(inc) {
  let melhor = null;
  for (const n of notas(inc)) {
    const at = n?.at ?? n?.ts ?? n?.quando ?? n?.created_at;
    if (!at) continue;
    const d = new Date(at);
    if (!isNaN(d) && (melhor === null || d > melhor)) melhor = d;
  }
  return melhor;
}

function alunos(inc) {
  const e = inc.affected_emails;
  if (Array.isArray(e)) return e.filter(Boolean);
  if (typeof e === "string" && e.trim()) return [e.trim()];
  return [];
}

(async () => {
  const db = supa();

  const inc = await lerTudo(
    db,
    "incidents",
    "id,numero,status,title,occurrences,created_at,first_seen_at,last_seen_at,agent_notes,affected_emails",
    (q) => q.in("status", ABERTOS),
  );

  const porStatus = (s) => inc.filter((i) => i.status === s).length;
  console.log(`\n📋 ABERTOS (filtro CERTO, com aguardando_aluno): ${inc.length}`);
  console.log(
    `   open ${porStatus("open")} · investigating ${porStatus("investigating")} · aguardando_aluno ${porStatus("aguardando_aluno")}`,
  );

  // O tamanho do buraco do instrumento velho, dito em numero.
  const cegos = inc.filter((i) => i.status === "aguardando_aluno");
  console.log(
    `\n⚠️  INVISIVEIS pro \`2026-09-19_idade_dos_abertos.cjs\` (linha 41, sem aguardando_aluno): ${cegos.length}`,
  );
  if (cegos.length) {
    const nasc = (i) => i.first_seen_at || i.created_at;
    const maisVelho = cegos.reduce((a, b) => (new Date(nasc(a)) < new Date(nasc(b)) ? a : b));
    const comAluno = cegos.filter((i) => alunos(i).length).length;
    console.log(
      `   mais velho: ${dias(nasc(maisVelho)).toFixed(1)}d · #${maisVelho.numero} · ${comAluno} de ${cegos.length} com aluno nomeado`,
    );
  }

  const nasc = (i) => i.first_seen_at || i.created_at;
  const comAluno = inc.filter((i) => alunos(i).length);
  console.log(`\n👤 com aluno nomeado: ${comAluno.length} de ${inc.length}`);

  // ── O RECORTE QUE IMPORTA: quem esta ABANDONADO ──
  // Sem nota nenhuma = abandonado desde o nascimento (pior caso, nao melhor).
  const idadeDoAbandono = (i) => {
    const u = ultimaNota(i);
    return u ? dias(u) : dias(nasc(i));
  };

  const fila = comAluno.slice().sort((a, b) => {
    const d = idadeDoAbandono(b) - idadeDoAbandono(a);
    if (Math.abs(d) > 1e-9) return d;
    return alunos(b).length - alunos(a).length; // empate: mais gente sofrendo
  });

  console.log(`\n═══ OS 20 MAIS ABANDONADOS (ultima nota mais velha) ═══`);
  console.log(`   (nunca anotado = conta a idade de nascimento)\n`);
  for (const i of fila.slice(0, 20)) {
    const u = ultimaNota(i);
    console.log(
      `  parado ${idadeDoAbandono(i).toFixed(1).padStart(5)}d` +
        ` · vive ${dias(nasc(i)).toFixed(1).padStart(5)}d` +
        ` · #${String(i.numero).padStart(3)} ${i.id.slice(0, 8)}` +
        ` [${i.status}]` +
        ` ${String(alunos(i).length).padStart(3)} aluno(s)` +
        ` ${String(i.occurrences ?? 0).padStart(4)}x` +
        ` ${u ? "" : "SEM NOTA "}` +
        `· ${String(i.title).replace(/\s+/g, " ").slice(0, 70)}`,
    );
  }

  const semNota = comAluno.filter((i) => !ultimaNota(i));
  console.log(`\n🕳️  com aluno e SEM NOTA NENHUMA: ${semNota.length}`);
  console.log(
    "   (investigating sem nota e o mesmo que nao ter olhado — regra 5 do manual)",
  );

  const topo = fila[0];
  if (topo) {
    console.log(`\n═══ ESCOLHIDO ═══`);
    console.log(`  #${topo.numero} · ${topo.id}`);
    console.log(`  ${topo.title}`);
    console.log(
      `  parado ${idadeDoAbandono(topo).toFixed(1)}d · vive ${dias(nasc(topo)).toFixed(1)}d · ${alunos(topo).length} aluno(s) · ${topo.occurrences ?? 0}x`,
    );
    console.log(`  alunos: ${alunos(topo).join(", ")}`);
  }
})();
