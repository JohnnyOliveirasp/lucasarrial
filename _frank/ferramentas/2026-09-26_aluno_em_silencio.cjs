/**
 * ALUNO EM SILENCIO: cartao vivo, aluno nomeado, e NENHUMA carta nossa pra ele.
 *
 *   node _frank/ferramentas/2026-09-26_aluno_em_silencio.cjs
 *
 * POR QUE EXISTE. O #229 ficou 19,9 dias com a resposta PRONTA dentro do
 * cartao e o aluno nunca soube — o rotulo `aguardando_aluno` dizia que a bola
 * era dele quando nada estava sendo esperado. O detector de percepcao (17/09)
 * pega so quem trava por VER/OUVIR. Este pega a familia maior: a casa sabe de
 * alguma coisa e o aluno nao.
 *
 * O QUE ELE MEDE, E SO ISSO: cartao em open/investigating/aguardando_aluno,
 * com affected_emails, cujo aluno NAO TEM NENHUMA LINHA em emails_enviados.
 * Silencio total e inequivoco. NAO tenta julgar "carta velha demais" — isso
 * depende de ler o conteudo da nota e produz falso positivo em massa (as notas
 * de manutencao do retrofit #415 de 24/09 tocaram 21 cartoes sem informacao
 * nova nenhuma; contar isso como "novidade nao contada" seria medir HISTORICO
 * e apresentar como PENDENCIA, o erro que a correcao de 21/09 documentou).
 *
 * LIMITE DECLARADO (leia antes de acreditar no numero): a fonte e a tabela
 * `emails_enviados`, que so cobre o que foi escriturado. A reconciliacao de
 * 18/09 alinhou a tabela com a pasta Enviados do IMAP, mas o piso da pasta
 * limita o alcance: carta anterior ao piso nao esta em lugar nenhum. O script
 * IMPRIME o piso e marca quem foi criado antes dele como NAO-CONCLUSIVO, em
 * vez de acusar silencio que ele nao tem como ver.
 *
 * SO LEITURA. Nao escreve, nao fecha, nao manda carta.
 */
const { supa } = require("./_comum.cjs");
const db = supa();
const AGORA = new Date();
const dias = (iso) => Math.floor((AGORA - new Date(iso)) / 86400000);
const VIVOS = ["open", "investigating", "aguardando_aluno"];

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Nao acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}

(async () => {
  const { data: inc, error: e1 } = await db
    .from("incidents")
    .select("numero,id,created_at,status,title,affected_emails")
    .in("status", VIVOS);
  exigir("incidents", e1);

  // ⚠️ O Supabase corta em 1000 linhas. A tabela ja passou disso (1249 em
  // 26/09) e a versao NAO paginada desta ferramenta perdeu 249 cartas e
  // acusou aluno de silencio que TINHA sido respondido — inclusive o #263,
  // que eu sabia de cor ter recebido carta em 14/09. Por isso pagina, e por
  // isso confere o total no fim: se o lido nao bater com o count exato, morre.
  const { count: totalCartas, error: e2c } = await db
    .from("emails_enviados")
    .select("*", { count: "exact", head: true });
  exigir("emails_enviados/count", e2c);

  const cartas = [];
  const PAGINA = 1000;
  for (let ini = 0; ; ini += PAGINA) {
    const { data: pag, error: e2 } = await db
      .from("emails_enviados")
      .select("to_email,enviado_em")
      .order("enviado_em", { ascending: true })
      .range(ini, ini + PAGINA - 1);
    exigir(`emails_enviados/pagina@${ini}`, e2);
    cartas.push(...pag);
    if (pag.length < PAGINA) break;
  }
  if (cartas.length !== totalCartas) {
    console.error(`\n❌ PAGINACAO INCOMPLETA: li ${cartas.length} de ${totalCartas} cartas.`);
    console.error("   Qualquer 'silencio' daqui seria invencao do instrumento.");
    process.exit(1);
  }
  console.log(`cartas lidas: ${cartas.length}/${totalCartas} (paginado, conferido)`);

  const escritos = new Map();
  let piso = null;
  for (const c of cartas) {
    const e = String(c.to_email || "").toLowerCase().trim();
    if (!e) continue;
    if (!escritos.has(e) || new Date(c.enviado_em) > new Date(escritos.get(e))) escritos.set(e, c.enviado_em);
    if (!piso || new Date(c.enviado_em) < new Date(piso)) piso = c.enviado_em;
  }

  // CONTROLE POSITIVO: um aluno que comprovadamente RECEBEU carta tem de casar.
  const ctrl = "drpaulomartin@gmail.com"; // #229, carta uid 3141 em 21/09
  if (!escritos.has(ctrl)) {
    console.error(`❌ CONTROLE POSITIVO FALHOU: ${ctrl} deveria ter carta e nao tem.`);
    console.error("   O indice de cartas nao esta enxergando. Zero daqui seria cego.");
    process.exit(1);
  }
  console.log(`controle positivo OK (${ctrl} tem carta em ${escritos.get(ctrl).slice(0,10)})`);
  console.log(`piso da escrituracao: ${piso} — cartao criado ANTES disso e NAO-CONCLUSIVO`);
  console.log(`${inc.length} cartoes vivos · ${escritos.size} alunos com ao menos 1 carta`);

  const mudos = [], naoConclusivo = [];
  for (const i of inc) {
    const emails = (i.affected_emails || []).map((x) => String(x).toLowerCase().trim()).filter(Boolean);
    if (!emails.length) continue;
    if (emails.some((e) => escritos.has(e))) continue; // alguem daquele cartao recebeu carta
    (new Date(i.created_at) < new Date(piso) ? naoConclusivo : mudos).push(i);
  }
  mudos.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  naoConclusivo.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  console.log("\n" + "=".repeat(70));
  console.log(`🔇 ALUNO NOMEADO E NENHUMA CARTA NOSSA: ${mudos.length}`);
  console.log("=".repeat(70));
  for (const i of mudos) {
    console.log(`#${String(i.numero).padEnd(4)} ${String(dias(i.created_at)).padStart(2)}d [${i.status.padEnd(16)}] ${(i.affected_emails||[]).join(",").slice(0,36).padEnd(36)} ${String(i.title||"").slice(0,54)}`);
  }
  console.log(`\n🕳️ NAO-CONCLUSIVO (cartao anterior ao piso da escrituracao): ${naoConclusivo.length}`);
  for (const i of naoConclusivo.slice(0, 10)) {
    console.log(`   #${i.numero} ${dias(i.created_at)}d [${i.status}] ${(i.affected_emails||[]).join(",").slice(0,36)}`);
  }
  console.log(`\n>>> PRO RELATORIO: ${mudos.length} aluno(s) em silencio medido · mais velho ${mudos.length ? dias(mudos[0].created_at) : 0}d · ${naoConclusivo.length} nao-conclusivo(s)`);
})();
