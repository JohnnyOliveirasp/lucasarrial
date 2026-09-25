/**
 * _pr_cartao.cjs — ligar PR MERGEADO ao CARTAO que o titulo dele nomeia,
 * com regua de ESCRITA (mais conservadora que a de medicao).
 *
 * POR QUE EXISTE (incidente 0398d161, medido 24/09). Quando um PR mergeia,
 * NADA volta pro cartao que ele nomeia. Medido: 30 pares (cartao vivo × PR
 * mergeado que o nomeia no titulo) e 8 sem NENHUMA nota depois do merge — o
 * cartao segue carregando premissa morta. Custo ja visto: o #314 ficou na
 * fila de decisao do Johnny pedindo um merge que JA tinha acontecido (PR #355).
 *
 * A HEURISTICA E A MESMA do instrumento de leitura
 * `2026-09-24_pr_mergeado_cartao_mudo.cjs` (titulo DECLARA vinculo; nota so
 * comenta — 3 falsos positivos em 5 quando se leu pelo lado da nota), MAS com
 * TRES filtros a mais, porque aqui o resultado vira ESCRITA em cartao e falso
 * positivo vira nota errada em cartao de aluno:
 *
 *   1. AUTO-REFERENCIA: `#N` igual ao numero do PROPRIO PR nao conta.
 *   2. REFERENCIA A OUTRO PR: `#N` precedido de "PR"/"PRs" ("revert do PR
 *      #300") e vinculo com PR, nao com cartao. Nao conta.
 *   3. FRAGMENTO SO-DIGITOS: `[0-9a-f]{8}` tambem casa "20260924" (data) e
 *      qualquer numerao de 8 digitos. Fragmento sem NENHUMA letra a-f nao
 *      conta como uuid.
 *
 * E a regra de ouro herdada do pedido: NA DUVIDA, NAO POSTA. Candidato que
 * nao casa cartao VIVO morre em silencio — melhor um mudo a mais (a medicao
 * pega) que uma nota no cartao errado.
 *
 * MERGE NAO E CURA. Nada aqui fecha cartao, nunca. Ha PR que e so telemetria
 * (`saida_por_pessoa.cjs`, "so leitura") e PR que e so guarda de teste
 * (`test(credito): guarda na perna do ESTORNO`) — medidos em 24/09. A nota e
 * ORDEM DE VISITA: "a producao mudou por sua causa; alguem confira".
 *
 * ⚠️ QUEM ANOTA, ESCONDE (cabecalho do esperando_johnny.cjs, e o acidente do
 * retrofit #415 que cegou a fila em 21 cartoes de uma vez). A nota pos-merge
 * vira a ULTIMA nota do cartao; se a varredura da fila do Johnny nao a tratar
 * como NOTA NEUTRA, este mecanismo esconderia da fila exatamente os cartoes
 * que mais precisam de visita. Por isso a nota comeca SEMPRE com o marcador
 * fixo `[pos-merge PR #N]` — e ele esta registrado em NOTA_NEUTRA no
 * `2026-09-22_esperando_johnny.cjs`. Mudar o formato do marcador aqui sem
 * mudar la reabre a cegueira. (Ha teste amarrando os dois.)
 *
 * db-free e gh-free nas funcoes puras, de proposito: tudo testavel sem rede.
 * Testes: node --test _frank/ferramentas/_pr_cartao.test.cjs
 */
const { anexarNota, normalizarNotas } = require("./_incidente_nota.cjs");

/** Status em que um cartao conta como VIVO (mesmo universo da medicao). */
const STATUS_VIVO = ["open", "investigating", "aguardando_aluno"];

/**
 * Marcador de idempotencia + da regra NOTA_NEUTRA. NAO mude o formato sem
 * mudar o padrao correspondente no esperando_johnny.cjs (ver cabecalho).
 */
const tagPosMerge = (prNumero) => `[pos-merge PR #${prNumero}]`;
const RE_TAG = /^\[pos-merge PR #\d+\]/;

/**
 * Extrai do TITULO do PR os candidatos a cartao, ja com os filtros de
 * escrita. Devolve { numeros: number[], fragmentos: string[] } — ainda sao
 * CANDIDATOS: so viram vinculo se existir cartao VIVO correspondente.
 */
function extrairCandidatosDoTitulo(titulo, prNumero) {
  const t = String(titulo || "");
  const numeros = new Set();
  const fragmentos = new Set();

  for (const m of t.matchAll(/#(\d{1,4})\b/g)) {
    const n = Number(m[1]);
    // filtro 1: auto-referencia (PR citando o proprio numero).
    if (Number(prNumero) === n) continue;
    // filtro 2: "#N" precedido de PR/PRs e referencia a PR, nao a cartao.
    const antes = t.slice(Math.max(0, m.index - 12), m.index);
    if (/\bPRs?\s*[:.]?\s*$/i.test(antes)) continue;
    numeros.add(n);
  }

  for (const m of t.matchAll(/\b([0-9a-f]{8})\b/gi)) {
    const f = m[1].toLowerCase();
    // filtro 3: sem letra a-f nao e prefixo de uuid criavel — e data/numero.
    if (!/[a-f]/.test(f)) continue;
    fragmentos.add(f);
  }

  return { numeros: [...numeros], fragmentos: [...fragmentos] };
}

/**
 * Casa PRs mergeados com cartoes VIVOS.
 *
 * `prs`: [{number, title, mergedAt, body?, url?}] (so os com mergedAt contam)
 * `cartoes`: linhas de incidents com PELO MENOS {id, numero, status}
 *
 * Devolve Map< String(cartao.id) -> [{pr, cartao}] > com pr unico por cartao.
 * So entra cartao cujo status esteja em STATUS_VIVO — postar em cartao
 * fechado nao e ordem de visita, e ruido em historico encerrado.
 */
function casarPrsComCartoes(prs, cartoes) {
  const vivos = (cartoes || []).filter((c) => STATUS_VIVO.includes(c.status));
  const porNumero = new Map(vivos.filter((c) => c.numero != null).map((c) => [Number(c.numero), c]));
  const porFrag = new Map(vivos.map((c) => [String(c.id).slice(0, 8).toLowerCase(), c]));

  const pares = new Map();
  for (const pr of prs || []) {
    if (!pr || !pr.mergedAt) continue;
    const { numeros, fragmentos } = extrairCandidatosDoTitulo(pr.title, pr.number);
    const alvos = new Map(); // id -> cartao (dedup quando numero E fragmento apontam pro mesmo)
    for (const n of numeros) {
      const c = porNumero.get(n);
      if (c) alvos.set(String(c.id), c);
    }
    for (const f of fragmentos) {
      const c = porFrag.get(f);
      if (c) alvos.set(String(c.id), c);
    }
    for (const [id, cartao] of alvos) {
      if (!pares.has(id)) pares.set(id, []);
      const ja = pares.get(id);
      if (!ja.some((p) => p.pr.number === pr.number)) ja.push({ pr, cartao });
    }
  }
  return pares;
}

/** O cartao JA tem a nota deste PR? (idempotencia: rodar 2x = 1 nota) */
function jaTemNotaDoPr(agentNotes, prNumero) {
  const tag = tagPosMerge(prNumero);
  return normalizarNotas(agentNotes).some(
    (n) => n && typeof n.note === "string" && n.note.includes(tag),
  );
}

/**
 * O texto da nota. Regra (b) do pedido: dizer O QUE o PR fez, nao so que
 * mergeou — titulo sempre, corpo quando houver. E dizer com todas as letras
 * que merge nao e cura e que o cartao NAO deve ser fechado por isso.
 */
function montarNota(pr) {
  const titulo = String(pr.title || "").trim();
  const corpoCru = String(pr.body || "").replace(/\s+/g, " ").trim();
  const corpo = corpoCru.slice(0, 400) + (corpoCru.length > 400 ? " (...)" : "");
  return (
    `${tagPosMerge(pr.number)} ORDEM DE VISITA: o PR #${pr.number}, que nomeia este cartao ` +
    `no titulo, MERGEOU em ${pr.mergedAt}. O que o PR fez, pelo proprio PR — ` +
    `titulo: "${titulo}"` +
    (corpo ? `; descricao: ${corpo}` : " (sem descricao no corpo do PR)") +
    (pr.url ? ` [${pr.url}]` : "") +
    `. MERGE NAO E CURA (pode ser telemetria ou guarda de teste): alguem precisa ` +
    `conferir se isso resolve o caso deste cartao. NAO fechar automaticamente.`
  );
}

/**
 * O passo inteiro, com o db entrando por parametro (testavel com banco de
 * mentira, mesmo desenho do _incidente_nota). NUNCA muda status; so anexa.
 *
 * Devolve { postadas: [...], puladas: [...], ensaio: bool } — `puladas` com o
 * motivo ("ja tem nota do PR #N"), pra saida do CLI nao esconder nada.
 */
async function postarNotasPosMerge(db, prs, cartoes, opts = {}) {
  const confirmar = !!opts.confirmar;
  const agora = opts.agora; // testes injetam; producao deixa o anexarNota datar
  const pares = casarPrsComCartoes(prs, cartoes);

  const postadas = [];
  const puladas = [];
  for (const [id, lista] of pares) {
    for (const { pr, cartao } of lista) {
      if (jaTemNotaDoPr(cartao.agent_notes, pr.number)) {
        puladas.push({ id, numero: cartao.numero, pr: pr.number, motivo: "ja tem nota deste PR" });
        continue;
      }
      const nota = montarNota(pr);
      if (confirmar) {
        // Caminho seguro da casa: anexa (nunca sobrescreve) e CONFERE a escrita.
        await anexarNota(db, id, nota, { por: "pos-merge", agora });
      }
      postadas.push({ id, numero: cartao.numero, pr: pr.number, nota });
    }
  }
  return { postadas, puladas, ensaio: !confirmar };
}

module.exports = {
  STATUS_VIVO,
  tagPosMerge,
  RE_TAG,
  extrairCandidatosDoTitulo,
  casarPrsComCartoes,
  jaTemNotaDoPr,
  montarNota,
  postarNotasPosMerge,
};
