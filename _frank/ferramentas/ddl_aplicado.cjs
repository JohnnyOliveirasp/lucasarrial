/**
 * ddl_aplicado.cjs — "DDL commitado NÃO é DDL aplicado", virado check.
 *
 * POR QUE EXISTE (medido em 27/08, na ronda do incidente 11):
 * O padrão da casa é gravar telemetria em UPDATE separado e best-effort: se a
 * migration ainda não subiu, o UPDATE falha sozinho, um `logger.warn` registra
 * e o produto segue intacto. O desenho está certo — observabilidade não pode
 * derrubar treino nem estorno. O efeito colateral é que a coluna que NUNCA foi
 * criada se comporta EXATAMENTE como a coluna que funciona: ninguém reclama, a
 * tela não quebra, e o warn vai pro arquivo de log do servidor, que ninguém lê.
 *
 * Foi assim que duas migrations ficaram commitadas e não aplicadas sem ninguém
 * notar, as duas servindo incidente ABERTO:
 *
 *   82_generations_runpod_timing.sql   → delay_seconds, execution_seconds
 *       A instrumentação do timeout (d3d8d1b2). É ela que separaria cold start
 *       ("esperou na fila") de hang do worker ("rodou até o teto"). O incidente
 *       está `ignored` com risco aceito pelo Johnny e a condição escrita é
 *       "se voltar, instrumente" — a instrumentação existe em git e não existe
 *       no banco. A rede de proteção não estava pendurada.
 *
 *   96_training_jobs_cura_transcricao.sql → reference_cura_ramo,
 *       reference_cura_texto_antes, reference_cura_erro, worker_image
 *       A observabilidade do incidente 52. O relatório de 26/08 anotou que "a
 *       telemetria do #52 não está medindo ainda" e atribuiu à imagem do worker
 *       que ainda subia. A imagem era metade: as 4 colunas não existem, então
 *       `registrarCuraEBuild` cai no catch em TODO treino desde o PR #61.
 *
 * O CHECK: lê o que os `scripts/*.sql` mandam CRIAR (`add column`) e confere
 * uma a uma contra o `information_schema` do banco vivo. Só leitura.
 *
 * Uso:  node _frank/ferramentas/ddl_aplicado.cjs
 * Saída: lista das colunas que o git manda existir e o banco não tem,
 *        agrupadas pelo arquivo que as declara.
 * Código de saída 1 quando falta alguma — dá pra usar como portão.
 *
 * ⚠️ LIMITE DECLARADO: confere COLUNA de `alter table ... add column`. Não
 * confere tabela nova, índice, constraint, função nem RLS. Um zero aqui
 * significa "nenhuma coluna faltando", NÃO "todas as migrations aplicadas" —
 * não é para virar carimbo de que o banco está em dia.
 */
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.join(__dirname, "..", "..");
const DIR = path.join(RAIZ, "scripts");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});
const PROJECT = "yizerthyrgrajivlotcw";

/** Tira só as linhas que SÃO comentário. Não corta `--` no meio da linha, pra
 *  não picotar um `comment on ... is '... -- ...'` e esconder coluna. */
function semComentario(sql) {
  return sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");
}

function alvosDosScripts() {
  const alvos = [];
  const arquivos = fs
    .readdirSync(DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const arquivo of arquivos) {
    const sql = semComentario(fs.readFileSync(path.join(DIR, arquivo), "utf8"));
    const blocos = /alter\s+table\s+(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)([\s\S]*?);/gi;
    let bloco;
    while ((bloco = blocos.exec(sql))) {
      const tabela = bloco[1];
      const colunas = /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi;
      let col;
      while ((col = colunas.exec(bloco[2]))) {
        alvos.push({ arquivo, tabela, coluna: col[1] });
      }
    }
  }
  return alvos;
}

async function consultar(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente");
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT}/database/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    },
  );
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase HTTP ${r.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

(async () => {
  const alvos = alvosDosScripts();
  if (!alvos.length) throw new Error("nenhum 'add column' encontrado em scripts/*.sql — o parser quebrou");

  // Uma consulta só: todas as colunas das tabelas envolvidas.
  const tabelas = [...new Set(alvos.map((a) => a.tabela))];
  const lista = tabelas.map((t) => `'${t}'`).join(",");
  const linhas = await consultar(
    `select table_name, column_name from information_schema.columns
      where table_schema='public' and table_name in (${lista})`,
  );
  const existe = new Set(linhas.map((l) => `${l.table_name}|${l.column_name}`));

  // Tabela que não existe de todo é caso diferente de coluna faltando: avisa
  // separado em vez de despejar todas as colunas dela como "faltando".
  const tabelasVivas = new Set(linhas.map((l) => l.table_name));
  const semTabela = tabelas.filter((t) => !tabelasVivas.has(t));

  const faltando = alvos.filter(
    (a) => tabelasVivas.has(a.tabela) && !existe.has(`${a.tabela}|${a.coluna}`),
  );

  console.log(
    `conferidas ${alvos.length} coluna(s) declarada(s) em ${new Set(alvos.map((a) => a.arquivo)).size} script(s), ${tabelas.length} tabela(s)\n`,
  );

  if (semTabela.length) {
    console.log(`⚠️  tabela declarada em script e AUSENTE no banco: ${semTabela.join(", ")}`);
    console.log("   (colunas dessas tabelas não entram na contagem abaixo)\n");
  }

  if (!faltando.length) {
    console.log("✅ nenhuma coluna faltando.");
    console.log("   (não confere tabela/índice/constraint/função — ver o limite no topo do arquivo)");
    return;
  }

  console.log(`❌ ${faltando.length} coluna(s) que o git manda existir e o banco NÃO tem:\n`);
  const porArquivo = new Map();
  for (const f of faltando) {
    if (!porArquivo.has(f.arquivo)) porArquivo.set(f.arquivo, []);
    porArquivo.get(f.arquivo).push(f);
  }
  for (const [arquivo, cols] of porArquivo) {
    console.log(`   ${arquivo}  (NÃO APLICADA)`);
    for (const c of cols) console.log(`      ${c.tabela}.${c.coluna}`);
    console.log("");
  }
  console.log("Quem escreve nessas colunas é best-effort e cai no catch em silêncio:");
  console.log("a telemetria parece ligada e não está medindo nada. Aplicar depende de aval.");
  process.exitCode = 1;
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
