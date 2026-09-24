/**
 * A TRAVA DO HUMANO (#415) SÓ PEGA QUEM TEM A MARCA — quantos cartões VIVOS
 * ficaram de fora?
 *
 *   node _frank/ferramentas/2026-09-24_trava_do_humano_sem_marca.cjs
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE ESTA FERRAMENTA EXISTE
 *
 * O PR #295 ("a Fast cala quando o caso já está com gente") foi MERGEADO em
 * 15/09 22:30:26Z e está em produção. A trava mora em `incidents/humano.ts`:
 *
 *     travadoPorHumano(inc) = casoAtivo(inc) && entregueAoHumano(inc)
 *     entregueAoHumano(inc) = alguma nota com  tipo === "entregue_humano"
 *
 * A marca `tipo` é gravada por `entregarAoTime` (incidents/entregar.ts) NO
 * MOMENTO DA ENTREGA. Ou seja: ela só existe em cartão entregue ao time DEPOIS
 * do merge. Todo cartão entregue ANTES carrega a MESMA nota de texto ("Time
 * avisado no grupo do WhatsApp em … — precisa de olho humano, não de código"),
 * mas SEM a chave `tipo` — e a trava não casa por texto, casa por `tipo`.
 *
 * Consequência, se houver cartão vivo nessa condição: para aquele aluno a Fast
 * continua respondendo por cima de gente exatamente como respondeu 9 vezes
 * para a tuquinha36. O conserto está no ar e o aluno segue descoberto.
 *
 * Esta é a MESMA família do chamado "O CONSERTO DO DEDUPE SUBIU SEM MIGRAR OS
 * CARTÕES ABERTOS" que já está na fila (20 de 21 chamados no formato velho).
 * Conserto que não migra o acervo cura o futuro e deixa o presente no escuro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SÓ LEITURA. Não escreve, não fecha, não marca, não manda e-mail.
 *
 * ARMADILHA 1 (03_ROTINA): consulta que erra volta VAZIA e o script imprime
 * "0" alegremente. Aqui todo `error` é checado e o script MORRE em vez de
 * reportar zero. Zero de instrumento cego não é zero medido.
 *
 * ARMADILHA 2: a consulta do Supabase corta em 1000 linhas. Pagina-se.
 *
 * CONTROLE POSITIVO (o que impede este script de mentir): se o instrumento
 * está são, tem que existir PELO MENOS UM cartão COM a marca `tipo`, porque o
 * conserto está no ar há dias e a casa entrega cartão ao time todo dia. Se
 * NENHUM cartão do acervo inteiro tiver a marca, então ou eu estou lendo a
 * chave errada, ou `entregarAoTime` não está gravando — e nos dois casos o
 * número "todos descobertos" seria artefato meu, não medição. O script diz
 * isso na cara e sai com código 2 em vez de deixar a ronda citar o número.
 */
const { supa: _supaFn } = require("./_comum.cjs");
const supa = _supaFn();

const TIPO = "entregue_humano";
const TEXTO_DA_ENTREGA = "time avisado no grupo do whatsapp";
// `humano.ts`: ENCERRADOS = fixed | ignored. Todo o resto conta como ATIVO —
// é de propósito lista de encerrados e não de abertos (status novo nasce ativo).
const ENCERRADOS = new Set(["fixed", "ignored"]);
// PR #295 mergeado. Antes disto, nenhuma entrega podia carregar a marca.
const MERGE = new Date("2026-09-15T22:30:26Z");

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Não acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}

const notasDe = (i) => (Array.isArray(i.agent_notes) ? i.agent_notes : []);
const temMarca = (i) => notasDe(i).some((n) => n && n.tipo === TIPO);
const entregueNoTexto = (i) =>
  notasDe(i).some((n) => String((n && n.note) || "").toLowerCase().includes(TEXTO_DA_ENTREGA));
const ativo = (i) => !ENCERRADOS.has(String(i.status || "").trim());
/**
 * Quando a entrega QUE CARREGA A MARCA aconteceu.
 *
 * ⚠️ Era `.find()` na primeira nota de entrega, e isso fez o controle negativo
 * gritar 8 falsos em 24/09. O motivo: cartão entregue MAIS DE UMA VEZ (o aluno
 * volta a escrever) tem entrega pré-merge NUA e entrega pós-merge MARCADA. Ler
 * a primeira e atribuir a data dela à marca acusa "marca antes do merge" num
 * cartão que está perfeitamente correto. Conferido nos 8: 8/8 têm TODA marca
 * posterior ao merge. Datar a marca pela nota que de fato a carrega.
 */
const quandoMarcou = (i) => {
  const ds = notasDe(i)
    .filter((n) => n && n.tipo === TIPO && n.at)
    .map((n) => new Date(n.at))
    .sort((a, b) => a - b);
  return ds[0] || null;
};

(async () => {
  let todos = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await supa
      .from("incidents")
      .select("id,numero,created_at,status,title,affected_emails,agent_notes")
      .range(p * 500, p * 500 + 499);
    exigir(`página ${p}`, error);
    todos = todos.concat(data);
    if (data.length < 500) break;
  }
  console.log(`acervo varrido: ${todos.length} incidentes\n`);

  // ── CONTROLE POSITIVO ───────────────────────────────────────────────────
  const comMarca = todos.filter(temMarca);
  if (comMarca.length === 0) {
    console.error("❌ CONTROLE POSITIVO FALHOU: NENHUM cartão do acervo tem a marca");
    console.error(`   tipo="${TIPO}". O conserto está no ar desde ${MERGE.toISOString()},`);
    console.error("   então zero aqui é cegueira do instrumento (chave errada) ou");
    console.error("   `entregarAoTime` não está gravando a marca — que é chamado novo.");
    console.error("   NÃO cite o número de descobertos: ele seria artefato, não medição.");
    process.exit(2);
  }
  const maisNovaComMarca = comMarca
    .map(quandoMarcou)
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  console.log(
    `✔ controle positivo OK: ${comMarca.length} cartão(ões) COM a marca "${TIPO}"` +
      (maisNovaComMarca ? ` · entrega marcada mais recente ${maisNovaComMarca.toISOString().slice(0, 16)}` : ""),
  );

  // ── CONTROLE NEGATIVO ───────────────────────────────────────────────────
  //
  // ⚠️ ESTE CONTROLE FOI APOSENTADO PELA PRÓPRIA RONDA DE 24/09, e fica aqui
  // escrito para ninguém o ressuscitar sem saber o que ele mede.
  //
  // A ideia original era: "nenhuma marca pode ser anterior ao merge do #295,
  // porque a marca só nasce em entrega feita depois dele". Isso valeu até
  // 24/09 17:48Z, quando o retrofit (`2026-09-24_marcar_entrega_ao_humano.cjs`)
  // pôs a marca em 21 cartões PRESERVANDO o `at` original da nota de entrega —
  // de propósito, porque a entrega aconteceu naquele dia e reescrever a data
  // seria falsificar quando o caso chegou à mão de gente.
  //
  // Resultado: a partir de 24/09 existem, corretamente, marcas com `at`
  // anterior ao merge. Manter o alarme faria o instrumento gritar defeito em
  // cima do próprio conserto, toda ronda, para sempre — e alarme que sempre
  // toca é alarme que ninguém escuta.
  //
  // O que substitui: o controle POSITIVO acima (tem que existir marca nascida
  // do código) somado à contagem de descobertos abaixo, que é o número que
  // interessa. Se um dia alguém quiser reativar a checagem de data, ela tem
  // que descontar os 21 do retrofit — e aí ela não mede mais nada útil.
  console.log(
    `— controle negativo por data: APOSENTADO em 24/09 (o retrofit preserva o \`at\` da entrega, então marca pré-merge passou a ser legítima)`,
  );

  // ── A MEDIÇÃO ───────────────────────────────────────────────────────────
  const vivosEntregues = todos.filter((i) => ativo(i) && entregueNoTexto(i));
  const descobertos = vivosEntregues.filter((i) => !temMarca(i));
  const cobertos = vivosEntregues.filter(temMarca);

  console.log(`\n${"═".repeat(70)}`);
  console.log("👤 CARTÕES VIVOS QUE JÁ FORAM ENTREGUES AO TIME");
  console.log("═".repeat(70));
  console.log(`   ${vivosEntregues.length} vivo(s) entregue(s)`);
  console.log(`   ${cobertos.length} COM a marca  → a Fast cala (trava pega)`);
  console.log(`   ${descobertos.length} SEM a marca → a Fast AINDA responde por cima de gente`);

  const alunos = new Set();
  for (const i of descobertos) for (const e of i.affected_emails || []) alunos.add(e);

  if (descobertos.length) {
    descobertos.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const maisVelho = (Date.now() - new Date(descobertos[0].created_at)) / 86400000;
    console.log(`\n   alunos nomeados descobertos: ${alunos.size}`);
    console.log(`   mais velho descoberto: ${maisVelho.toFixed(1)}d (#${descobertos[0].numero})`);
    console.log("\n   ── os 15 mais velhos ──");
    for (const i of descobertos.slice(0, 15)) {
      const d = ((Date.now() - new Date(i.created_at)) / 86400000).toFixed(1);
      console.log(
        `   #${String(i.numero).padEnd(4)} ${i.id.slice(0, 8)} · ${d.padStart(5)}d · ${i.status.padEnd(14)} · ${(i.affected_emails || []).join(",").slice(0, 34).padEnd(34)} · ${String(i.title).slice(0, 52)}`,
      );
    }
  }

  console.log(`\n>>> NÚMERO PRO RELATÓRIO: ${descobertos.length} cartão(ões) vivo(s) entregue(s) ao time`);
  console.log(`    SEM a marca da trava do #415 · ${alunos.size} aluno(s) nomeado(s) descoberto(s).`);
  console.log(`    O conserto (PR #295) está em produção e NÃO alcança nenhum deles:`);
  console.log(`    ele casa por agent_notes[].tipo="${TIPO}", que só nasce em entrega`);
  console.log(`    feita DEPOIS de ${MERGE.toISOString()}.`);
})();
