#!/usr/bin/env node
/**
 * anotar_incidente.cjs — a UNICA maneira segura de anotar/fechar incidente.
 *
 * POR QUE EXISTE: anotar incidente e a operacao que Vigia e Frank repetem toda
 * ronda, cada um com um script de uma linha em `_Bugs/`. Em menos de 24h isso
 * destruiu dado DUAS vezes, das duas maneiras possiveis:
 *
 *   1. 21/08 03h (Frank): `update({resolution_note})` direto APAGOU o historico
 *      de 4 incidentes. Recuperado do dump da propria ronda, por sorte.
 *   2. 21/08 (Vigia): concatenou STRING em cima do jsonb `agent_notes`, que e
 *      ARRAY. O array virou "[object Object],[object Object],..." e o conteudo
 *      de 21 notas em 3 incidentes (5c3f1f8b, ce6e157d, 100e7ace) foi perdido —
 *      esse nao teve dump, nao deu pra recuperar.
 *
 * As tres armadilhas medidas viram regra AQUI, pra ninguem mais tropecar:
 *
 *   - NOTA SE CONCATENA, NUNCA SE SOBRESCREVE. `resolution_note` recebe
 *     `historico + separador + nova`; `agent_notes` recebe um item NOVO no
 *     array (nunca string em cima do array).
 *   - UPDATE POR ID INEXISTENTE AFETA 0 LINHAS EM SILENCIO. Aqui o id e
 *     resolvido por prefixo ANTES, recusa se nao achar ou se for ambiguo, e a
 *     escrita confere o numero de linhas devolvidas pelo `.select()`.
 *   - ENSAIO NAO E ENTREGA. Sem `--confirmar` ele SIMULA e mostra o diff.
 *
 * USO:
 *   node _frank/ferramentas/anotar_incidente.cjs <id|prefixo> --nota "texto"
 *        [--por frank|vigia]        quem assina a nota (default: frank)
 *        [--status investigating|fixed|ignored|open]
 *        [--resolucao "texto"]      CONCATENA em resolution_note
 *        [--commit <sha>]           grava resolved_commit
 *        [--confirmar]              sem isso, so ensaia
 *
 * ⚠️ `--status fixed` sem ter resolvido de verdade viola a regra 14. A
 * ferramenta grava o que voce mandar; a honestidade da nota e sua.
 */
const { supa, STATUS_FECHADO } = require("./_comum.cjs");
const { resolverIncidente } = require("./_incidente_nota.cjs");

// `aguardando_aluno` ja existia no banco (incidentes 120 e 124) e esta lista o
// recusava — o que empurrava quem fechasse um caso desses pro `fixed`,
// carimbando "resolvido" num incidente que so espera o aluno responder.
// NAO entra em STATUS_FECHADO de proposito: assim nao carimba resolved_at,
// porque nada foi resolvido ainda. (medido 25/08, ao fechar o #65)
const STATUS_VALIDOS = ["open", "investigating", "fixed", "ignored", "fixing", "aguardando_aluno"];

function arg(nome) {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const tem = (nome) => process.argv.includes(nome);

/**
 * Resolve o alvo (NUMERO do chamado ou uuid/prefixo) -> incidente.
 *
 * ⚠️ POR QUE ISTO NAO E MAIS FEITO AQUI (medido 20/09, chamado #496).
 * A versao antiga deste arquivo so casava PREFIXO DE UUID. Quem passava o
 * numero visivel do chamado caia numa armadilha calada: "427" e prefixo de
 * EXATAMENTE UM uuid (42741499-..., que e o #138), entao a checagem de
 * ambiguidade nao disparava, o UPDATE ia pro cartao errado e o script imprimia
 * "✅ GRAVADO". O Vigia caiu nisso ao vivo na ronda das 12hZ.
 *
 * Medido na base inteira, 482 numeros:
 *    65  sao prefixo de EXATAMENTE 1 uuid  -> escrita errada SILENCIOSA
 *    64  sao prefixo de mais de 1          -> recusa (ruidosa, segura)
 *   353  nao sao prefixo de nada           -> recusa (ruidosa, segura)
 * Ou seja: a ferramenta recusava alto no caso seguro e escrevia baixo no caso
 * perigoso. Pior combinacao possivel.
 *
 * ⚠️ E A CURA JA EXISTIA. `_incidente_nota.cjs` foi escrito em 15/09 com o
 * resolvedor certo (numero PRIMEIRO, prefixo depois, e recusa quando os dois
 * apontam pra cartoes diferentes), justamente porque o MESMO bug tinha mordido
 * com "407" -> 4071ee9a (#399). Ele tem 26 testes. So o cancelar_assinatura.cjs
 * tinha adotado. A ferramenta mais usada da casa ficou cinco dias com o defeito
 * que ja tinha conserto escrito. Nao duplicar regra: importar.
 */
async function resolverId(db, alvo) {
  const { incidente, via, avisos } = await resolverIncidente(db, alvo);
  // Os avisos sao o ponto: e aqui que o "427 tambem e prefixo de 42741499"
  // aparece na tela em vez de virar nota no cartao de outra pessoa.
  for (const a of avisos) console.log(`⚠️  ${a}`);
  console.log(`alvo resolvido por ${via.toUpperCase()}: #${incidente.numero} ${String(incidente.id).slice(0, 8)}`);
  return incidente;
}

/** agent_notes ja corrompido (string) vira UMA nota legada, sem perder o texto. */
function normalizarNotas(atual) {
  if (Array.isArray(atual)) return atual;
  if (atual === null || atual === undefined) return [];
  if (typeof atual === "string") {
    return [
      {
        at: null,
        by: "desconhecido",
        note:
          "[HISTORICO RECUPERADO DE STRING CORROMPIDA — o array jsonb foi " +
          "sobrescrito por concatenacao de string; os objetos originais ja " +
          "estavam perdidos neste ponto] " + atual,
        legado: true,
      },
    ];
  }
  return [atual];
}

(async () => {
  const alvo = process.argv[2];
  const nota = arg("--nota");
  const status = arg("--status");
  const resolucao = arg("--resolucao");
  const commit = arg("--commit");
  const por = arg("--por") || "frank";
  const confirmar = tem("--confirmar");

  if (!alvo || alvo.startsWith("--") || (!nota && !status && !resolucao)) {
    console.log(require("node:fs").readFileSync(__filename, "utf8").split("*/")[0]);
    process.exit(1);
  }
  if (status && !STATUS_VALIDOS.includes(status)) {
    console.error(`ERRO: status "${status}" invalido. Validos: ${STATUS_VALIDOS.join(", ")}`);
    process.exit(1);
  }
  // FECHAR EXIGE MOTIVO (incidente #560, 24/09). Antes, `--status fixed --nota
  // "..."` fechava o cartao com resolution_note VAZIO: a nota vai pro historico
  // (agent_notes), mas o campo que o painel /admin/falhas e o health-report
  // exibem como O MOTIVO DO FECHAMENTO ficava em branco — 37 cartoes fechados
  // assim. A recusa vem ANTES de qualquer acesso ao banco, e a mensagem diz
  // exatamente o que fazer, porque esta ferramenta roda em ronda automatica as
  // 3h da manha: recusa muda sem instrucao = ronda quebrada sem ninguem
  // entender. So fixed/ignored (STATUS_FECHADO, importado de _comum.cjs — nao
  // redeclarar a lista); aguardando_aluno e os demais seguem como sempre.
  if (status && STATUS_FECHADO.includes(status) && !(resolucao && resolucao.trim())) {
    console.error(
      `ERRO: fechar exige --resolucao dizendo o que era e o que foi feito.\n` +
        `  Voce pediu --status ${status} (fechamento) sem --resolucao com texto.\n` +
        `  A --nota NAO substitui: nota e historico de trabalho; --resolucao e o motivo\n` +
        `  do fechamento que o painel /admin/falhas e o health-report exibem.\n` +
        `  Exemplo:\n` +
        `    --status ${status} --resolucao "o que era o problema; o que foi feito" [--nota "..."]`,
    );
    process.exit(1);
  }

  const db = supa();
  const alvoInc = await resolverId(db, alvo);
  const { data: antes, error: e0 } = await db
    .from("incidents")
    .select("id,title,status,resolution_note,agent_notes,resolved_at,resolved_commit,occurrences,last_seen_at")
    .eq("id", alvoInc.id)
    .single();
  if (e0) {
    console.error("ERRO CRU na leitura:", JSON.stringify(e0, null, 2));
    process.exit(1);
  }

  const agora = new Date().toISOString();
  const patch = {};

  const notasAntes = normalizarNotas(antes.agent_notes);
  if (nota) patch.agent_notes = [...notasAntes, { at: agora, by: por, note: nota }];

  if (resolucao) {
    const hist = antes.resolution_note || "";
    // CONCATENA. A ronda das 03h perdeu 4 historicos fazendo isto direto.
    patch.resolution_note = hist
      ? `${hist}\n\n--- ${agora} (${por}) ---\n${resolucao}`
      : `--- ${agora} (${por}) ---\n${resolucao}`;
  }
  if (status) {
    patch.status = status;
    // Quem decide se carimba a data é o STATUS ANTERIOR, não o campo estar
    // vazio. A guarda antiga (`!antes.resolved_at`) fazia um card REABERTO
    // e fechado de novo guardar a data e o autor do fechamento ANTIGO —
    // aconteceu no ce6e157d: fechado 18:41, reaberto 19:20 pela aluna,
    // fechado de novo às 22h com outro commit, e o banco continuava dizendo
    // 18:41. O relatório passa a mentir sobre quando o problema acabou.
    // Ainda assim não re-carimba quem só re-anota um card JÁ fechado no
    // mesmo status — nesse caso a data original é a verdadeira.
    // Sair de um status FECHADO pra um ABERTO tem que APAGAR o carimbo, senao
    // o incidente anda com uma data de "resolvido" que nao vale mais e todo
    // relatorio que le resolved_at mente. Aconteceu no #65 em 25/08: fechado
    // 21/08 18:41, movido pra aguardando_aluno, e o banco seguia dizendo que
    // tinha sido resolvido em 21/08.
    // Os TRES campos de fechamento saem JUNTOS. Limpar so `resolved_at` e
    // `resolved_by` deixa o `resolved_commit` ORFAO: o incidente volta pra
    // `investigating` carregando o sha de um fechamento que nao vale mais, e
    // quem ler o card depois acredita que aquele commit resolveu o caso.
    // Medido no #226 em 02/09: fechado as 16:59Z com `resolved_commit=e4cc692`
    // (enquadramento de rosto no clone de VIDEO, outro subsistema) e o defeito
    // seguia entregando; reabrir pela versao antiga desta ferramenta manteria o
    // e4cc692 colado num chamado aberto. E' o mesmo defeito que o PR #150 (#232)
    // corrigiu no lado do app, em `lib/incidents/closure.ts:limparFechamento()`
    // — que limpa os tres. Esta ferramenta ficou de fora daquele PR e era o
    // unico caminho de reabertura que o dono da fila usa na mao.
    //
    // A guarda olha os TRES campos, nao so `resolved_at`: um `resolved_commit`
    // orfao (ja gravado por alguma rota antiga) precisa sair mesmo quando a
    // data ja esta nula, senao a limpeza nunca alcanca quem mais precisa dela.
    const temCarimbo = antes.resolved_at || antes.resolved_by || antes.resolved_commit;
    if (!STATUS_FECHADO.includes(status) && temCarimbo) {
      patch.resolved_at = null;
      patch.resolved_by = null;
      patch.resolved_commit = null;
    }
    if (STATUS_FECHADO.includes(status)) {
      const jaEstavaFechado = STATUS_FECHADO.includes(antes.status);
      if (!jaEstavaFechado || !antes.resolved_at) {
        patch.resolved_at = agora;
        patch.resolved_by = por;
      }
    }
  }
  if (commit) patch.resolved_commit = commit;

  console.log(`INCIDENTE ${antes.id}`);
  console.log(`  titulo: ${antes.title.slice(0, 90)}`);
  console.log(`  status: ${antes.status}${status ? ` -> ${status}` : " (sem mudanca)"}`);
  console.log(`  occurrences=${antes.occurrences} last_seen_at=${antes.last_seen_at}`);
  if (nota) {
    console.log(`  agent_notes: ${notasAntes.length} -> ${patch.agent_notes.length} notas`);
    if (!Array.isArray(antes.agent_notes)) {
      console.log(`  ⚠️  agent_notes estava CORROMPIDO (${typeof antes.agent_notes}); preservado como nota legada`);
    }
  }
  if (resolucao) {
    console.log(
      `  resolution_note: ${(antes.resolution_note || "").length} -> ${patch.resolution_note.length} chars (concatenado)`,
    );
  }
  // A reabertura precisa aparecer no ENSAIO. Sem esta linha, apagar o carimbo
  // era efeito invisivel: quem roda sem --confirmar nao via que o
  // `resolved_commit` ia embora e so descobria depois de gravar.
  if ("resolved_commit" in patch && patch.resolved_commit === null) {
    console.log(
      `  reabertura: LIMPA resolved_at/resolved_by/resolved_commit (era commit=${antes.resolved_commit || "-"}, em=${antes.resolved_at || "-"})`,
    );
  }

  if (!confirmar) {
    console.log("\n🔎 ENSAIO — nada gravado. Repita com --confirmar.");
    return;
  }

  const { data: depois, error: e1 } = await db
    .from("incidents")
    .update(patch)
    .eq("id", antes.id)
    .select("id,status,resolution_note,agent_notes,resolved_at,resolved_commit");
  if (e1) {
    console.error("ERRO CRU na escrita:", JSON.stringify(e1, null, 2));
    process.exit(1);
  }
  // O ponto do `.select()`: UPDATE por id inexistente devolve [] SEM erro.
  if (!depois || depois.length !== 1) {
    console.error(`FALHOU: o UPDATE afetou ${depois ? depois.length : 0} linhas, esperava 1. NADA foi confirmado.`);
    process.exit(1);
  }

  const d = depois[0];
  console.log("\n✅ GRAVADO (conferido na releitura, 1 linha afetada):");
  console.log(`  status = ${d.status}`);
  console.log(`  agent_notes = ${Array.isArray(d.agent_notes) ? d.agent_notes.length + " notas (array)" : "⚠️ NAO E ARRAY"}`);
  console.log(`  resolution_note = ${(d.resolution_note || "").length} chars`);
  if (d.resolved_at) console.log(`  resolved_at = ${d.resolved_at}`);
  if (d.resolved_commit) console.log(`  resolved_commit = ${d.resolved_commit}`);
})().catch((e) => {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
});
