#!/usr/bin/env node
/**
 * 2026-09-22_espera_decisao_do_johnny.cjs — separa a fila em DUAS filas:
 * a que espera ALGUÉM TRABALHAR e a que espera O JOHNNY DECIDIR.
 *
 * POR QUE EXISTE. Pedido explícito no fecho da ronda de 22/09 ~01hZ
 * (`_frank/prova/2026-09-22_rotina_falhas_01h.md`, seção 3): *"contar '48
 * cartões velhos' esconde que parte deles não é backlog de execução, é fila de
 * decisão. Vale medir isso direito numa próxima ronda."*
 *
 * O problema que ele resolve é de LEITURA, não de dado. O placar de hoje diz
 * "102 abertos · 48 com 7d+". Lido de fora, isso descreve um executor que não
 * dá conta. Mas três rondas seguidas (21/09 18hZ, 22/09 01hZ e 22/09 01h50Z)
 * pegaram os cartões mais antigos da fila e encontraram o MESMO desenho: o
 * trabalho técnico estava feito, o aluno estava avisado, e o que faltava era
 * uma decisão de dinheiro que só o Johnny toma. Medido caso a caso:
 *
 *   #254 Carlos — cancelar a perna órfã OU autorizar a ligação. No grupo desde
 *        21/09 18hZ. A cobrança renova 22/09 12:00Z.
 *   #299 Lucila — escolher o recorte do estorno: R$97 (só a duplicada) ou
 *        R$291 (tudo). Cancelamentos JÁ feitos em 14/09, aluna JÁ avisada
 *        (Enviados uid 2221). Pendente desde 07/09.
 *   #301 Simone — R$975,40 que entraram fora do nosso gateway; não existem em
 *        Hotmart nem em `payment_events`. Precisa de acesso/decisão do Johnny.
 *
 * Enquanto os dois grupos são contados juntos, cada ronda REDESCOBRE um a um
 * que o cartão que pegou está travado em decisão — gastando a ronda inteira
 * para chegar onde a anterior já tinha chegado. Separar as filas faz duas
 * coisas: devolve ao Johnny uma lista de decisões (curta, com valor e relógio)
 * em vez de um backlog, e devolve à ronda a lista do que ela PODE mover.
 *
 * ⚠️ O CRITÉRIO É A ÚLTIMA NOTA, e isso não é detalhe. É a lição medida do
 * `percepcao_travada.cjs`: varrer `agent_notes::text` inteiro mede HISTÓRICO e
 * apresenta como PENDÊNCIA. Um cartão que um dia escreveu "aguardando o
 * Johnny" casaria para sempre, mesmo depois de decidido. O estado de um cartão
 * mora na ÚLTIMA nota.
 *
 * ⚠️ BOILERPLATE DO SENSOR FICA DE FORA. O `carol` carimba "precisa de olho
 * humano, não de código" em todo chamado entregue a humano. Isso quer dizer
 * "é atendimento, não é bug" — NÃO quer dizer "o Johnny precisa decidir". Foi
 * essa frase que inflou 33 dos 41 falsos positivos de 17/09.
 *
 * ⚠️ CONTROLE POSITIVO, E O SCRIPT ABORTA SE ELE FALHAR. Os três cartões acima
 * (#254, #299, #301) foram lidos à mão e são decisão do Johnny com certeza.
 * Se a varredura não reencontra os três, o filtro quebrou e NENHUM número
 * daqui vale. "Zero de instrumento cego" já fez a casa reportar saúde onde
 * havia fila — é a armadilha registrada no cabeçalho do `garantia_na_fila.cjs`.
 *
 * ⚠️ ISTO É ORDEM DE VISITA, NÃO VEREDITO. A classificação é por marca de
 * texto na última nota; ela erra. Cada linha sai com o TRECHO que a fez casar,
 * justamente para poder ser conferida a olho. NÃO feche, não escale e não
 * cobre ninguém com base só nesta saída — vá ler o cartão.
 *
 * Só lê. Não altera nada.
 *
 * USO:
 *   node _frank/ferramentas/2026-09-22_espera_decisao_do_johnny.cjs
 *   ... --json          saída crua pra outro script
 *   ... --trabalho      lista também a fila de TRABALHO (default: só conta)
 */
const { supa } = require("./_comum.cjs");

const argv = process.argv.slice(2);
const JSON_OUT = argv.includes("--json");
const VER_TRABALHO = argv.includes("--trabalho");

const db = supa();

/** Status em que alguém ainda espera. `fixed`/`ignored` ficam fora de propósito:
 *  a pergunta é quem está ESPERANDO, não histórico. `aguardando_aluno` ENTRA —
 *  a lição de 21/09 é que esse rótulo mente sobre quem deve o próximo passo. */
const STATUS_EM_ESPERA = ["open", "investigating", "aguardando_aluno"];

/** Controle positivo: lidos à mão, são decisão do Johnny com certeza. */
const CONTROLE_POSITIVO = [254, 299, 301];

/** Controle NEGATIVO: falsos positivos MEDIDOS na 1ª versão (22/09 ~02hZ).
 *  Um instrumento que só tem controle positivo prova que acha — não prova que
 *  não infla, e inflar é exatamente como a classe de percepção virou 41 falsos
 *  em 17/09. Estes três TÊM que ficar de fora:
 *    #478 — "o 720p foi REMOVIDO por decisão do Johnny": decisão passada.
 *    #518 — "caso o Johnny ou o Lucas queiram decidir diferente": hipótese, e
 *           o próprio cartão escreve "não é irreversível".
 *    #479 — trabalhado nesta mesma ronda; o que falta é reconferir a Hotmart
 *           em 30/09, não decisão de ninguém. */
const CONTROLE_NEGATIVO = [478, 518, 479];

/** Frase do sensor que NÃO é pedido de decisão. */
const BOILERPLATE = [
  /precisa de olho humano, n[ãa]o de c[óo]digo/i,
  /o chamado fica aberto at[ée] algu[ée]m responder o aluno/i,
  /n[ãa]o marque este chamado como "?resolvido"?/i,
];

/** Marcas de "espera decisão do dono". Exige falar do JOHNNY *ou* de uma
 *  autorização/decisão de dinheiro que o manual reserva a ele.
 *
 *  ⚠️ CADA MARCA PRECISA SER DE PENDÊNCIA, NÃO DE CITAÇÃO. A primeira versão
 *  disto (medida em 22/09 ~02hZ) devolveu 39 cartões e inflava: casava em
 *  "o 720p foi REMOVIDO por decisão do Johnny" (#478 — decisão PASSADA, citada
 *  como contexto) e em "caso o Johnny ou o Lucas queiram decidir diferente"
 *  (#518 — hipótese que o próprio cartão declara não-bloqueante). É a mesma
 *  família de erro do `agent_notes::text`: medir MENÇÃO e apresentar como
 *  PENDÊNCIA. As rejeições abaixo existem por causa desses dois. */
const MARCAS_DECISAO = [
  { re: /(pendente de|aguard\w*|espera\w*|falta|depende de|segue com|est[áa] com)\s+(a\s+|o\s+)?(decis[ãa]o|aval|autoriza[çc][ãa]o)\b/i, nome: "aguarda decisão/aval/autorização" },
  { re: /\b(decis[ãa]o|aval|autoriza[çc][ãa]o)\s+(pendente|em aberto|segue pendente)\b/i, nome: "decisão pendente" },
  { re: /\bfalta\s+autoriza[çc][ãa]o\b/i, nome: "falta autorização" },
  { re: /(quem decide (é|e)|pro dono escolher|cabe ao johnny|s[óo] o johnny (decide|destrava|pode)|n[ãa]o (é|e) minha)/i, nome: "quem decide é o dono" },
  { re: /(no grupo desde|escalei ao grupo|re-?escalei|levado ao grupo|pedido ao grupo|acionei o johnny)/i, nome: "escalado ao grupo, sem resposta" },
  { re: /(dinheiro|estorno|reembolso|cobran[çc]a)\b[^.]{0,120}\b(é|e) do johnny\b/i, nome: "dinheiro é do Johnny" },
  { re: /\bn[ãa]o revogo salvaguarda\b/i, nome: "salvaguarda exige o dono" },
  // #301 escreve o bloqueio como "em que passo trava: ... decisão e acesso do
  // Johnny". Sem esta marca o controle positivo cai — foi o que aconteceu na
  // 1ª rodada do aperto, e é por isso que o controle existe.
  { re: /\b(trava|travado|emperra|bloqueia|falta)\b[^.]{0,200}\bjohnny\b/i, nome: "cartão declara que trava no Johnny" },
  { re: /\bdecis[ãa]o\s+e\s+acesso\s+do\s+johnny\b/i, nome: "decisão e acesso do Johnny" },
];

/** Rejeições: o trecho casou, mas NÃO é pendência. Aplicadas ao contexto local
 *  do match. Cada uma nasceu de um falso positivo medido. */
const REJEICOES = [
  { re: /\bpor\s+decis[ãa]o\s+d[oe]\s+(johnny|lucas)\b/i, nome: "decisão PASSADA citada como justificativa (#478)" },
  { re: /\bdecis[ãa]o\s+d[oe]\s+(johnny|lucas)\s+(de|em)\s+\d{1,2}\/\d{1,2}/i, nome: "decisão passada, datada" },
  { re: /\bcaso\s+(o\s+)?(johnny|lucas)\b/i, nome: "hipótese, não bloqueio (#518)" },
  { re: /\bn[ãa]o\s+(é|e)\s+irrevers[íi]vel\b/i, nome: "cartão declara que não bloqueia" },
  { re: /\bordem\s+d[oe]\s+(johnny|lucas)\b/i, nome: "cita ordem vigente, não pede decisão" },
  { re: /\b(fechado|encerrado|resolvido)\s+por\s+(decis[ãa]o|ordem)\b/i, nome: "já fechado por decisão" },
];

const idade = (iso) => (Date.now() - Date.parse(iso)) / 86400000;

function ultimaNota(inc) {
  const n = inc.agent_notes;
  if (!Array.isArray(n) || n.length === 0) return null;
  return n[n.length - 1];
}

function semBoilerplate(txt) {
  let t = txt;
  for (const b of BOILERPLATE) t = t.replace(b, " ");
  return t;
}

function classificar(inc) {
  const nota = ultimaNota(inc);
  if (!nota) return { decisao: false, motivo: null, trecho: null, quando: null };
  const cru = String(nota.note || "");
  const limpo = semBoilerplate(cru);
  let rejeitadoPor = null;
  for (const m of MARCAS_DECISAO) {
    const hit = limpo.match(m.re);
    if (!hit) continue;
    const ini = Math.max(0, hit.index - 90);
    const ctx = limpo.slice(ini, hit.index + hit[0].length + 110);
    // O match vale só se o CONTEXTO LOCAL não for citação/hipótese/ordem antiga.
    const rej = REJEICOES.find((r) => r.re.test(ctx));
    if (rej) { rejeitadoPor = rejeitadoPor || `${m.nome} ⟂ ${rej.nome}`; continue; }
    return {
      decisao: true,
      motivo: m.nome,
      trecho: ctx.replace(/\s+/g, " ").trim(),
      quando: nota.at || nota.ts || null,
      por: nota.by || "?",
    };
  }
  return {
    decisao: false, motivo: null, trecho: null, rejeitadoPor,
    quando: nota.at || nota.ts || null, por: nota.by || "?",
  };
}

(async () => {
  // Pagina: a consulta ao Supabase corta em 1000 linhas (armadilha medida).
  let todos = [], from = 0;
  for (;;) {
    const { data, error } = await db
      .from("incidents")
      .select("id,numero,status,created_at,last_seen_at,signature,affected_emails,agent_notes")
      .range(from, from + 999);
    if (error) throw new Error(`Supabase: ${JSON.stringify(error)}`);
    todos = todos.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }

  // ---- CONTROLE POSITIVO: roda no universo INTEIRO, antes de filtrar. ----
  const faltou = [];
  for (const num of CONTROLE_POSITIVO) {
    const c = todos.find((i) => i.numero === num);
    if (!c) { faltou.push(`#${num} não existe na base`); continue; }
    if (!classificar(c).decisao) faltou.push(`#${num} não foi reconhecido como decisão`);
  }
  for (const num of CONTROLE_NEGATIVO) {
    const c = todos.find((i) => i.numero === num);
    if (!c) { faltou.push(`#${num} (negativo) não existe na base`); continue; }
    const cl = classificar(c);
    if (cl.decisao) faltou.push(`#${num} INFLOU: voltou como decisão por "${cl.motivo}" — a rejeição não pegou`);
  }
  if (faltou.length) {
    console.error("❌ CONTROLE FALHOU — o filtro quebrou, o número não vale:");
    faltou.forEach((f) => console.error("   ·", f));
    console.error("   Conserte MARCAS_DECISAO/REJEICOES antes de confiar em qualquer saída daqui.");
    process.exit(1);
  }

  const emEspera = todos.filter((i) => STATUS_EM_ESPERA.includes(i.status));
  const decisao = [], trabalho = [];
  for (const i of emEspera) {
    const c = classificar(i);
    (c.decisao ? decisao : trabalho).push({ inc: i, c });
  }
  decisao.sort((a, b) => Date.parse(a.inc.created_at) - Date.parse(b.inc.created_at));
  trabalho.sort((a, b) => Date.parse(a.inc.created_at) - Date.parse(b.inc.created_at));

  if (JSON_OUT) {
    console.log(JSON.stringify({
      em_espera: emEspera.length,
      decisao: decisao.map((d) => ({ numero: d.inc.numero, id: d.inc.id, status: d.inc.status, dias: +idade(d.inc.created_at).toFixed(1), motivo: d.c.motivo, trecho: d.c.trecho })),
      trabalho: trabalho.map((d) => ({ numero: d.inc.numero, id: d.inc.id, status: d.inc.status, dias: +idade(d.inc.created_at).toFixed(1) })),
    }, null, 2));
    return;
  }

  const velho7 = (arr) => arr.filter((d) => idade(d.inc.created_at) >= 7).length;

  console.log("=".repeat(78));
  console.log(`FILA DE DECISÃO × FILA DE TRABALHO — ${new Date().toISOString()}`);
  console.log(`${todos.length} incidentes na base · ${emEspera.length} em espera (${STATUS_EM_ESPERA.join("/")})`);
  console.log(`controle positivo: OK (${CONTROLE_POSITIVO.map((n) => "#" + n).join(", ")} reencontrados)`);
  console.log("=".repeat(78));

  console.log(`\n🟡 ESPERANDO O JOHNNY DECIDIR — não é backlog de execução  [${decisao.length}]`);
  console.log(`   (${velho7(decisao)} com 7d+)`);
  for (const d of decisao) {
    const dias = idade(d.inc.created_at).toFixed(1);
    console.log(`\n   #${d.inc.numero}  ${d.inc.status}  ·  aberto há ${dias}d`);
    console.log(`      marca: ${d.c.motivo}   (última nota: ${d.c.quando || "?"} por ${d.c.por})`);
    const em = (d.inc.affected_emails || []).slice(0, 3).join(", ");
    if (em) console.log(`      aluno(s): ${em}`);
    console.log(`      “…${d.c.trecho}…”`);
  }

  console.log(`\n\n🔵 ESPERANDO ALGUÉM TRABALHAR — esta é a fila da ronda  [${trabalho.length}]`);
  console.log(`   (${velho7(trabalho)} com 7d+)`);
  if (VER_TRABALHO) {
    for (const d of trabalho) {
      console.log(`   #${d.inc.numero}  ${d.inc.status}  ${idade(d.inc.created_at).toFixed(1)}d  ${(d.inc.signature || "").slice(0, 70)}`);
    }
  } else {
    console.log("   (use --trabalho pra listar)");
  }

  console.log(`\n${"=".repeat(78)}`);
  console.log(`>>> NÚMEROS PRO RELATÓRIO:`);
  console.log(`    ${emEspera.length} em espera = ${decisao.length} esperando DECISÃO + ${trabalho.length} esperando TRABALHO`);
  console.log(`    com 7d+: ${velho7(decisao)} de decisão · ${velho7(trabalho)} de trabalho`);
  console.log(`    ⚠️  ordem de visita, não veredito — confira o cartão antes de agir.`);
  console.log(`    Nada foi alterado: esta ferramenta só lê.`);
})();
