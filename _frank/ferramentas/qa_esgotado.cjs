#!/usr/bin/env node
/**
 * qa_esgotado.cjs — lista as gerações ENTREGUES cujo QA esgotou as tentativas,
 * para o time achar quem recebeu chunk reprovado ANTES do aluno reclamar
 * (incidente 702cc916).
 *
 * O QUE ESTÁ SENDO LISTADO. Quando o laço de QA do worker
 * (`runpod-worker/tts_qa/loop.py:562`) esgota as tentativas de regenerar um
 * chunk, ele NÃO falha o job: loga `inference.qa.exhausted`, dá break e entrega
 * a melhor tentativa — que por definição ainda está reprovada pelo próprio
 * critério. A linha vai pro banco com `status = 'ready'` e
 * `error_message = null`, então ela é INVISÍVEL em qualquer listagem que olhe
 * só status. Quem sabe é o jsonb `generations.qa`, campo `exhausted`.
 *
 * ⚠️ ISTO NÃO É UMA LISTA DE "ÁUDIOS RUINS". É a lista do que o worker
 * registrou: esgotou as tentativas e entregou assim mesmo. Parte desses áudios
 * está boa. E o contrário também não vale: geração FORA desta lista não é áudio
 * conferido — a medição enxerga palavra que SUMIU e é cega para palavra
 * TROCADA (geração 1425ca2f, 10/09: `coverage_min_visto = 1`, zero faltantes, e
 * mesmo assim "faz falar" no lugar de "fácil falar"). Use isto para priorizar
 * quem olhar, nunca para afirmar qualidade em nenhuma das duas direções.
 *
 * SOMENTE LEITURA: não escreve nada, não tem --confirmar, não toca em crédito.
 *
 * Uso:
 *   node _frank/ferramentas/qa_esgotado.cjs [--dias 7] [--limite 50] [--email x@y]
 *                                           [--todos] [--json]
 *     --dias    janela em dias (padrão 7)
 *     --limite  máximo de linhas (padrão 50)
 *     --email   filtra um aluno só
 *     --todos   inclui gerações não-entregues (o padrão é só `status=ready`,
 *               que é o caso que dói: o aluno RECEBEU)
 *     --json    saída crua, pra encadear com outro script
 */
const path = require("node:path");
const c = require(path.join(__dirname, "_comum.cjs"));

const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const tem = (n) => process.argv.includes(n);

const DIAS = parseInt(arg("--dias", "7"), 10);
const LIMITE = parseInt(arg("--limite", "50"), 10);
const EMAIL = arg("--email", null);
const TODOS = tem("--todos");
const JSON_OUT = tem("--json");

const dt = (iso) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "?";

// Teto REAL do PostgREST deste projeto, medido: pedir `.limit(5000)` numa
// janela de 3650 dias devolve exatamente 1000 linhas, calado. É o mesmo
// rebaixamento silencioso já documentado em `_estornos.cjs` (que enxergava 40%
// da tabela e dava verde) e em `raio_honesto.cjs` (1000 eventos onde havia
// 1373). Um `--dias 7` não bate no teto hoje, mas uma auditoria de 30/90 dias
// bate — e truncar em silêncio numa lista cujo PROPÓSITO é achar TODOS os
// alunos afetados é o pior modo de falha possível aqui. Por isso: pagina de
// verdade por `.range()` até a página vir curta.
const PASSO_PAGINA = 1000;
const TETO_VARREDURA = 500000;

/**
 * Lê a janela inteira, paginando. Erro sobe CRU e aborta: uma lista parcial
 * lida como completa é o defeito que esta função existe pra não ter.
 *
 * Ordem CRESCENTE de propósito: geração nova entra no fim da janela e não
 * empurra página já lida. Com `created_at desc` um insert no meio da varredura
 * desloca tudo e faz repetir/pular linha. O `id` é desempate — sem ele,
 * `created_at` repetido entre duas páginas tem ordem indefinida.
 */
async function lerJanela(s, desde) {
  const tudo = [];
  let de = 0;
  for (;;) {
    let q = s
      .from("generations")
      .select("id,user_id,name,status,created_at,qa")
      .gte("created_at", desde)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (!TODOS) q = q.eq("status", "ready");

    const { data, error } = await q.range(de, de + PASSO_PAGINA - 1);
    if (error) throw new Error(`consulta falhou (a partir da linha ${de}): ${error.message}`);
    const pagina = data ?? [];
    tudo.push(...pagina);
    if (pagina.length < PASSO_PAGINA) return tudo;
    de += PASSO_PAGINA;
    if (de > TETO_VARREDURA) throw new Error(`paginação sem fim em generations (passou de ${TETO_VARREDURA} linhas)`);
  }
}

(async () => {
  if (!Number.isFinite(DIAS) || DIAS <= 0) throw new Error("--dias tem que ser um número > 0");
  if (!Number.isFinite(LIMITE) || LIMITE <= 0) throw new Error("--limite tem que ser um número > 0");

  // Importar um .ts de dentro de um .cjs faz o Node cuspir um aviso de
  // MODULE_TYPELESS_PACKAGE_JSON de 4 linhas ANTES do relatório — o pessoal do
  // suporte lê isso como erro. O aviso é sobre performance de parse, não sobre
  // correção, e só este é filtrado: qualquer outro aviso continua aparecendo.
  const avisosPadrao = process.listeners("warning");
  process.removeAllListeners("warning");
  process.on("warning", (w) => {
    // O identificador vem em `code`; o `name` deste aviso é só "Warning".
    if (w.code === "MODULE_TYPELESS_PACKAGE_JSON") return;
    for (const l of avisosPadrao) l(w);
  });

  // MESMA fonte de verdade do contexto da Fast — o veredito não é reimplementado
  // aqui de propósito. Se as duas leituras divergissem, o time acharia numa
  // lista o que a atendente não vê na conta. Node ≥ 22.18 faz o type-stripping.
  const { qaVeredito } = await import(
    path.join(c.RAIZ, "frontend", "src", "lib", "generations", "qa-veredito.ts")
  );

  const s = c.supa();
  const desde = new Date(Date.now() - DIAS * 86400000).toISOString();

  // O filtro de `exhausted > 0` é feito no veredito, em JS, e não no PostgREST:
  // `qa->>'exhausted'` volta texto e a comparação numérica no filtro silencia
  // linha com jsonb fora do formato em vez de reclamar. Ler e decidir em JS usa
  // exatamente a mesma régua que a Fast usa.
  const data = await lerJanela(s, desde);

  const linhas = [];
  for (const g of data) {
    const v = qaVeredito(g.qa);
    if (!v) continue;
    linhas.push({ ...g, veredito: v });
  }
  // A varredura sobe em ordem crescente (ver `lerJanela`); o relatório é lido
  // do mais recente pro mais antigo.
  linhas.reverse();

  // E-mail do aluno: uma consulta só pros ids que sobraram, não uma por linha.
  const ids = [...new Set(linhas.map((l) => l.user_id).filter(Boolean))];
  const emails = new Map();
  for (let i = 0; i < ids.length; i += 100) {
    const { data: ps } = await s.from("profiles").select("id,email,display_name").in("id", ids.slice(i, i + 100));
    for (const p of ps ?? []) emails.set(p.id, p);
  }

  let saida = linhas;
  if (EMAIL) {
    const alvo = EMAIL.trim().toLowerCase();
    saida = saida.filter((l) => (emails.get(l.user_id)?.email ?? "").toLowerCase() === alvo);
  }
  const cortadas = Math.max(0, saida.length - LIMITE);
  saida = saida.slice(0, LIMITE);

  if (JSON_OUT) {
    console.log(JSON.stringify(
      saida.map((l) => ({
        id: l.id,
        email: emails.get(l.user_id)?.email ?? null,
        nome: l.name,
        status: l.status,
        criada_em: l.created_at,
        chunks_esgotados: l.veredito.chunks,
        cobertura_minima: l.veredito.coberturaMinima,
        faltantes: l.veredito.faltantes,
      })),
      null, 2,
    ));
    return;
  }

  const escopo = TODOS ? "todas as gerações" : "gerações ENTREGUES (status=ready)";
  console.log(`\nQA esgotado — ${escopo}, últimos ${DIAS} dia(s)${EMAIL ? ` · aluno ${EMAIL}` : ""}`);
  console.log(`Lidas ${data.length} gerações na janela (janela inteira, paginada) · ${linhas.length} com ressalva de QA\n`);

  if (!saida.length) {
    console.log("  nenhuma geração com QA esgotado na janela.");
    console.log("  ⚠️ isso NÃO quer dizer que os áudios da janela estão conferidos: a medição");
    console.log("     enxerga palavra que sumiu e é cega para palavra trocada.\n");
    return;
  }

  for (const l of saida) {
    const p = emails.get(l.user_id);
    console.log(`  ${dt(l.created_at)} · ${p?.email ?? "(aluno ?)"}${p?.display_name ? ` (${p.display_name})` : ""}`);
    console.log(`    geração ${l.id} "${l.name ?? "?"}" · status ${l.status}`);
    console.log(`    ${l.veredito.linha}`);
    console.log("");
  }

  // Corte SEMPRE anunciado: uma lista truncada em silêncio lê-se como "é só
  // isso" e vira decisão em cima de meia medida.
  // (Não existe mais aviso de "teto da consulta": a janela é lida inteira por
  // paginação. O único corte possível é este `--limite`, que é do usuário e é
  // anunciado acima.)
  if (cortadas > 0) console.log(`  [+${cortadas} linha(s) além do --limite ${LIMITE}. Rode com --limite maior pra ver o resto.]\n`);
})().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
