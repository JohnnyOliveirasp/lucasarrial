/**
 * "QUANTAS VOZES EM PRODUCAO FORAM CLONADAS A PARTIR DO FINAL DA GRAVACAO?"
 *
 * POR QUE EXISTE (incidente fcd379d2, medido 23/09).
 * A Aline (alipersonal.andrade@gmail.com) gravou 58min46s e treinou CINCO
 * vezes o mesmo arquivo, gastando 50.000 creditos. Quatro das cinco vozes
 * sairam com EXATAMENTE a mesma referencia, recortada do FIM da gravacao,
 * onde ela esta se despedindo e cansada:
 *   "...mas e isso. Eu acho que eu vou finalizar, que ja esta dando ate um
 *    pouquinho de enjoo. Acho que ja esta bom. Entao eu fecho aqui, agradeco."
 * O VoxCPM clona o ESTILO da referencia. O modelo da voz dela era ela querendo
 * parar de gravar. Treinar de novo com o mesmo arquivo cai no mesmo trecho e
 * sai igual — foi exatamente isso que ela viveu quatro vezes antes de pedir
 * pra importar voz de fora.
 *
 * ⚠️ ISTO NAO E O MESMO DEFEITO da "palavra decapitada" (#f8587cef) nem do
 * "corte no meio da frase" (#100e7ace, ignored). Aqueles sao sobre ONDE o
 * corte cai dentro da fala. Este e sobre QUAL PEDACO da gravacao vira modelo:
 * a referencia pode estar impecavel de pontuacao e ainda assim ser o trecho
 * em que a pessoa esta encerrando, entediada ou lendo lista.
 *
 * O QUE ELE MEDE: roda a heuristica do worker (voice_pipeline/reference.py,
 * portada 1:1 no _heal_ref_boundary.cjs) sobre a referencia de TODA voz
 * `ready` da base, e separa as ruins. Alem do score, marca a familia
 * "despedida" por vocabulario de encerramento.
 *
 * ⚠️ ELE NAO DECIDE NADA E NAO CURA NADA. Score alto e CANDIDATA, nao
 * veredito: a unica prova de que a voz saiu ruim e ouvir. A saida e fila de
 * verificacao.
 *
 * ── CONTROLE POSITIVO OBRIGATORIO ──────────────────────────────────────────
 * As tres vozes da Aline que AINDA carregam a cauda de despedida (42fe4302,
 * b265951f, d43ba768) TEM que aparecer na familia "despedida". Se nao
 * aparecerem, o instrumento esta cego e o script sai com codigo != 0 em vez de
 * imprimir um zero mentiroso. (Licao de 18/09: o dump_enviada devolveu "0
 * cartas" so porque nao decodificava base64, e o zero falso concordava com a
 * hipotese de quem media.)
 * CONTROLE NEGATIVO: 20269220 e 46ab5f25, as duas vozes DELA JA CURADAS, NAO
 * podem aparecer na familia despedida — se aparecerem, a marca casa com
 * qualquer coisa e o numero nao vale.
 *
 * uso: node _frank/ferramentas/2026-09-23_referencia_de_despedida.cjs [--limite 40]
 */
const { supa } = require("./_comum.cjs");

// ── heuristica do worker, portada 1:1 do _heal_ref_boundary.cjs ────────────
const BAD_EDGE = new Set(["entao", "então", "nao", "não", "ta", "tá", "ne", "né"]);
function scoreTranscript(text) {
  text = (text || "").trim();
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);
  if (!words.length) return 9999;
  let score = 0;
  if (!/[.!?…]\s*$/.test(text)) score += 30;
  if (text && text[0] === text[0].toLowerCase() && /\p{L}/u.test(text[0])) score += 8;
  const first = words[0];
  const last = words[words.length - 1].replace(/[.,!?;:]+$/, "");
  if (BAD_EDGE.has(first)) score += 25;
  if (BAD_EDGE.has(last)) score += 40;
  score += (lower.match(/\b(entao|então)\b/g) ?? []).length * 8;
  score += (lower.match(/\b(nao|não)\b/g) ?? []).length * 10;
  score += (lower.match(/\b(ta|tá|ne|né)\b/g) ?? []).length * 6;
  const tokens = words.map((w) => w.replace(/[.,!?;:…]+$/, ""));
  for (const n of [3, 2]) {
    if (tokens.length >= n * 2 + 2) {
      const tail = tokens.slice(-n).join(" ");
      const body = tokens.slice(0, -n).join(" ");
      if (tail && body.includes(tail)) { score += 60; break; }
    }
  }
  score += Math.abs(words.length - 85) * 0.1;
  return Math.round(score * 10) / 10;
}

// Vocabulario de ENCERRAMENTO. Deliberadamente estreito: prefiro perder caso
// a inflar o numero. "obrigado" sozinho NAO entra (aparece em qualquer fala).
//
// ⚠️ CORRIGIDO NA RONDA DE 24/09 ~12hZ — a versao de 23/09 INFLAVA o numero.
// Auditei as 10 marcadas lendo o transcript INTEIRO e vendo qual regra disparou:
// so 4 eram encerramento de verdade. As outras 6 eram falso positivo, e 5 delas
// vieram de UMA regra sozinha, /\bcansad[ao]\b/ — que marcou 5 e acertou ZERO:
//   27f22432 "voltou para casa menos cansado"      (narrando uma viagem)
//   2ec55e46 "cheguei bem cansada em casa"          (roteiro de rotina do dia)
//   f2496819 "Tem gente que chega cansada"          (descrevendo alunos)
//   c176dfe5 "voce ja acordou cansado e pensou"     (copy de anuncio)
//   8f640ad4 "so fiquei cansada no final"           (contando um passeio)
// "cansado" e palavra de CONTEUDO, nao de encerramento. SAIU.
// A 6a era /\bvou finaliz/ solta: 1477c630 "vou finalizar semana que vem com
// voces, depois do feriado" — ele fala de terminar um FEEDBACK, nao a gravacao.
// Por isso "vou finalizar/encerrar" agora exige a GRAVACAO por perto (<=30 chars).
//
// LICAO DE INSTRUMENTO QUE FICA: o controle positivo (as 3 vozes da Aline) NAO
// pegou nada disso, porque o texto dela casa em TRES regras boas ao mesmo tempo
// — o controle passava verde com a regra podre do lado. Controle positivo em um
// caso so valida o caminho daquele caso, nao a marca inteira. Por isso o
// CTRL_NEG abaixo agora carrega os 6 falsos positivos nomeados: eles sao a
// unica trava que impede a marca de voltar a casar com qualquer coisa.
const PERTO_DA_GRAVACAO = "(?=.{0,30}\\b(grava|gravac|gravaç|audio|áudio|leitura|v[ií]deo|aqui)\\b)";
const DESPEDIDA = [
  new RegExp("\\bvou finaliz\\w*\\b" + PERTO_DA_GRAVACAO, "i"),
  new RegExp("\\bvou encerr\\w*\\b" + PERTO_DA_GRAVACAO, "i"),
  /\bfecho aqui\b/i, /\bja esta bom\b/i, /\bjá está bom\b/i,
  /\be isso (ai|a[ií])?\b.{0,40}\b(acabou|fim|final)\b/i, /\bpor hoje e so\b/i, /\bpor hoje é só\b/i,
  /\bdando.{0,12}enjoo\b/i, /\bultima (gravacao|gravação|leitura)\b/i,
  /\bacho que (ja|já) (esta|está|deu)\b/i, /\bterminando aqui\b/i, /\bfinalizo\b/i,
];
const ehDespedida = (t) => DESPEDIDA.some((r) => r.test(t || ""));

const LIMITE = (() => { const i = process.argv.indexOf("--limite"); return i > 0 ? Number(process.argv[i + 1]) : 30; })();
const RUIM = 25; // score acima disto = candidata. O da Aline media 12,5 e era pessimo
                 // pra OUVIR: por isso a familia "despedida" e contada separada do score.

// CTRL_POS: encerramento REAL, conferido lendo o transcript inteiro (24/09).
//   42fe4302/b265951f/d43ba768 = as 3 da Aline ainda com cauda ("fecho aqui")
//   8225f199 = CHRIS 03, 2o aluno da classe, achado em 24/09:
//              "vou encerrar essa gravacao ja se foram 28 minutos, tudo bem eu
//               vou juntar esses 28 minutos com os outros 20" — ele nao esta
//              falando, esta administrando arquivo. Entrou no controle porque e
//              o UNICO caso que exercita a regra "vou encerr + gravacao perto";
//              sem ele, a regra nova podia morrer sem ninguem notar.
const CTRL_POS = ["42fe4302", "b265951f", "d43ba768", "8225f199"];
// CTRL_NEG: 20269220/46ab5f25 = as 2 da Aline JA CURADAS. Os 6 seguintes sao os
// falsos positivos medidos em 24/09 (5 da regra "cansado", 1 do "vou finalizar"
// solto). Se QUALQUER um deles voltar a aparecer, a marca voltou a inflar.
const CTRL_NEG = ["20269220", "46ab5f25",
  "27f22432", "2ec55e46", "f2496819", "c176dfe5", "8f640ad4", "1477c630"];

(async () => {
  const db = supa();
  const linhas = [];
  // ⚠️ PostgREST corta em 1000. Pagina, sempre. (armadilha do README)
  for (let de = 0; ; de += 500) {
    const { data, error } = await db
      .from("voices")
      .select("id,user_id,name,status,created_at,reference_transcript")
      .eq("status", "ready")
      .not("reference_transcript", "is", null)
      .order("created_at", { ascending: true })
      .range(de, de + 499);
    if (error) throw new Error(`voices: ${error.message}`);
    linhas.push(...data);
    if (data.length < 500) break;
  }

  const avaliadas = linhas.map((v) => ({
    ...v,
    score: scoreTranscript(v.reference_transcript),
    despedida: ehDespedida(v.reference_transcript),
  }));

  const despedidas = avaliadas.filter((v) => v.despedida);
  const ruins = avaliadas.filter((v) => v.score >= RUIM);
  const uniao = avaliadas.filter((v) => v.despedida || v.score >= RUIM);

  // ── controles, ANTES de imprimir qualquer numero ──
  const achou = (pref, lista) => lista.some((v) => String(v.id).startsWith(pref));
  const posFalhou = CTRL_POS.filter((p) => !achou(p, despedidas));
  const negFalhou = CTRL_NEG.filter((p) => achou(p, despedidas));
  if (posFalhou.length || negFalhou.length) {
    console.error("❌ INSTRUMENTO CEGO — nao confie em numero nenhum desta rodada.");
    if (posFalhou.length) console.error(`   controle POSITIVO nao apareceu: ${posFalhou.join(", ")}`);
    if (negFalhou.length) console.error(`   controle NEGATIVO apareceu (marca casa com qualquer coisa): ${negFalhou.join(", ")}`);
    process.exit(1);
  }
  console.log(`controle positivo OK (${CTRL_POS.join(", ")}) · controle negativo OK (${CTRL_NEG.join(", ")}) · ${avaliadas.length} vozes varridas\n`);

  const donos = new Set(uniao.map((v) => v.user_id));
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`🎙  REFERENCIA DE DESPEDIDA (vocabulario de encerramento): ${despedidas.length}`);
  console.log(`📉  SCORE RUIM (>= ${RUIM} na heuristica do worker):        ${ruins.length}`);
  console.log(`∪   UNIAO (uma das duas):                                 ${uniao.length} · ${donos.size} dono(s)`);
  console.log("══════════════════════════════════════════════════════════════════════\n");

  const mostrar = [...uniao].sort((a, b) => Number(b.despedida) - Number(a.despedida) || b.score - a.score).slice(0, LIMITE);
  for (const v of mostrar) {
    const marca = v.despedida ? "DESPEDIDA" : "score    ";
    console.log(`  ${String(v.id).slice(0, 8)} · ${marca} · score ${String(v.score).padStart(6)} · ${v.created_at.slice(0, 10)} · ${(v.name || "").slice(0, 26)}`);
    console.log(`     "${(v.reference_transcript || "").replace(/\s+/g, " ").slice(0, 118)}"`);
  }
  if (uniao.length > mostrar.length) console.log(`\n  (+${uniao.length - mostrar.length} nao listadas — use --limite)`);

  console.log("\n>>> NUMERO PRO RELATORIO:");
  console.log(`    ${despedidas.length} voz(es) clonadas a partir de trecho de ENCERRAMENTO da gravacao`);
  console.log(`    ${uniao.length} candidata(s) no total, de ${donos.size} aluno(s)`);
  console.log("    Candidata NAO e veredito: so ouvir prova que a voz saiu ruim.");
  console.log("    Cura manual provada: node frontend/_Bugs/_correcoes/_heal_ref_boundary.cjs <voice_id>");
})();
