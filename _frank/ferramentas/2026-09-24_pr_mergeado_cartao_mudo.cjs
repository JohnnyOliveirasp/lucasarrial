#!/usr/bin/env node
/**
 * 2026-09-24_pr_mergeado_cartao_mudo.cjs — SO LEITURA.
 *
 * PERGUNTA: a casa mudou a producao por causa de um cartao, e o cartao soube?
 *
 * Mede: PR **MERGEADO** cujo TITULO nomeia um cartao que segue **VIVO**, e
 * separa os que NAO receberam nenhuma nota depois do merge ("MUDO").
 *
 * POR QUE PELO TITULO DO PR, E NAO PELA NOTA DO CARTAO. A primeira versao desta
 * medicao (ronda do Vigia 24/09 22hZ) lia as notas procurando "PR #N" e deu
 * **3 falsos positivos em 5**: nota que cita PR pra explicar por que pegou
 * ESTE cartao e nao outro ("d3d8d1b2 esta esperando o PR #404") casa com o
 * padrao sem ter pendencia nenhuma. Citacao em nota e historico, nao vinculo.
 * O titulo do PR e diferente: quem escreve `fix(#414): ...` esta declarando o
 * vinculo. Entao o instrumento le o lado que DECLARA, nao o lado que comenta.
 *
 * ⚠️ O QUE ESTE NUMERO **NAO** E (leia antes de usar em relatorio):
 *
 *   1. NAO e "cartao que devia estar fechado". E **ordem de visita**, mesma
 *      doutrina do `2026-09-19_aberto_mas_ja_respondido.cjs`. Um PR pode ser
 *      telemetria, guarda de teste ou passo parcial — merge nao e cura. Dois
 *      exemplos medidos hoje: o PR do #390 e `saida_por_pessoa.cjs` ("so
 *      leitura") e o do #341 e `test(credito): guarda na perna do ESTORNO`.
 *      Nenhum dos dois cura o cartao; os dois aparecem aqui, e com razao —
 *      a producao mudou e o cartao nao registrou.
 *   2. "Sem nota depois do merge" NAO e "ninguem cuidou". O aluno pode ter
 *      sido respondido por carta, e cartao `aguardando_aluno` pode estar
 *      corretamente esperando ele. O que se afirma e estreito e literal:
 *      **a producao mudou e o cartao nao aprendeu**.
 *   3. `#NNN` no titulo tambem casa com numero de PR. Por isso o numero so e
 *      aceito quando existe cartao VIVO com aquele numero — some o falso
 *      positivo de "PR #300" virar "cartao #300" quando o 300 nem existe.
 *      Residual honesto: se existir cartao vivo com o mesmo numero de um PR
 *      citado, o par sai errado. Confira lendo o titulo, que vai impresso.
 *
 * CASO QUE PROVOU A CLASSE (o #414, 9,0d): a ultima nota dele diz, com estas
 * palavras, "PR aberto nao e producao, so a main deploya" — e o PR #292
 * mergeou **6h depois** dessa nota. A premissa da nota morreu no mesmo dia e
 * o cartao carregou a premissa morta por 9 dias, com R$ 2.809,32 de queixa
 * atras.
 *
 * FALSO ALARME JA CONFERIDO E DESCARTADO, pra ninguem gastar ronda nele: o
 * PR #264 tem "NAO MERGEAR" no titulo e esta MERGEADO. Lido o corpo: o titulo
 * completo e "NAO MERGEAR **sem janela vazia**" — e condicao de merge (nao ter
 * treino em voo), nao proibicao. Nao e da familia dos branches STALE do indice.
 *
 * USO: node _frank/ferramentas/2026-09-24_pr_mergeado_cartao_mudo.cjs
 *      (precisa do `gh` autenticado; nada e escrito em lugar nenhum)
 */
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const AQUI = __dirname;
const sql = (q) => {
  const out = execFileSync("node", [path.join(AQUI, "sql.cjs"), q, "--completo"], {
    maxBuffer: 1e9,
    cwd: path.join(AQUI, "..", ".."),
  }).toString();
  const i = out.indexOf("[");
  if (i < 0) throw new Error("consulta nao devolveu linhas:\n" + out);
  return JSON.parse(out.slice(i));
};

(() => {
  const merged = JSON.parse(
    execFileSync("gh", ["pr", "list", "--state", "merged", "--limit", "400",
      "--json", "number,title,mergedAt"], { maxBuffer: 1e9 }).toString(),
  );

  const vivos = sql(`select numero, left(id::text,8) as id, status, categoria,
      left(title,70) as titulo, (agent_notes->-1->>'at') as ultima_nota_at
    from incidents where status in ('open','investigating','aguardando_aluno')`);

  const porNumero = new Map(vivos.map((r) => [r.numero, r]));
  const porFrag = new Map(vivos.map((r) => [r.id, r]));

  const achados = [];
  for (const pr of merged) {
    if (!pr.mergedAt) continue;
    const t = pr.title || "";
    const cands = new Set();
    for (const m of t.matchAll(/#(\d{1,4})\b/g)) cands.add("n:" + m[1]);
    for (const m of t.matchAll(/\b([0-9a-f]{8})\b/gi)) cands.add("f:" + m[1].toLowerCase());
    for (const c of cands) {
      const [tipo, v] = c.split(":");
      const card = tipo === "n" ? porNumero.get(Number(v)) : porFrag.get(v);
      if (!card) continue;
      const mergeEm = new Date(pr.mergedAt);
      achados.push({
        cartao: card.numero, id: card.id, status: card.status, cat: card.categoria,
        pr: pr.number, mergeado: pr.mergedAt.slice(0, 16),
        dias: +((Date.now() - mergeEm) / 864e5).toFixed(1),
        ultima_nota: (card.ultima_nota_at || "(sem nota)").slice(0, 16),
        mudo: card.ultima_nota_at ? !(new Date(card.ultima_nota_at) > mergeEm) : true,
        pr_titulo: t.slice(0, 74),
      });
    }
  }
  achados.sort((a, b) => b.dias - a.dias);
  const mudos = achados.filter((a) => a.mudo);

  console.log(`PRs mergeados lidos: ${merged.length} · cartoes vivos: ${vivos.size}`);
  console.log(`PR mergeado nomeando cartao VIVO no titulo: ${achados.length}`);
  console.log("");
  console.log("=".repeat(70));
  console.log(`🔴 MUDOS — producao mudou e o cartao nao registrou: ${mudos.length}`);
  console.log("=".repeat(70));
  for (const a of mudos) {
    console.log(`  #${a.cartao} (${a.id}) ${a.status}/${a.cat} · PR #${a.pr} mergeado ${a.mergeado} · ${a.dias}d`);
    console.log(`      ultima nota do cartao: ${a.ultima_nota}  (ANTES do merge)`);
    console.log(`      PR: ${a.pr_titulo}`);
  }
  console.log("");
  console.log(`>>> NUMERO PRO RELATORIO: ${mudos.length} cartao(oes) vivo(s) com merge nomeando-o e ZERO nota depois`);
  console.log(`    de ${achados.length} pares (cartao vivo × PR mergeado que o nomeia).`);
  console.log("    Isto e ORDEM DE VISITA, NAO veredito: merge nao e cura (ha telemetria e");
  console.log("    guarda de teste nesta lista). Leia o cartao antes de concluir qualquer coisa.");
})();
