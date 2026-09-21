/**
 * PAR CEGO da PALAVRA DECAPITADA (#234, f8587cef) — a régua contra o ouvido.
 *
 *   node _frank/ferramentas/2026-09-21_par_cego_decapitada.cjs [--n=5] [--dir=...]
 *
 * POR QUE EXISTE
 * --------------
 * O cartão f8587cef afirma que 13,1% das fronteiras ENTREGUES saem decapitadas
 * (telemetria `tail_interno_entregue`). Esse número nunca foi confrontado com
 * um ouvido. E a nota de 18/09 do #226 deixou a pergunta escrita com todas as
 * letras: *"o que fica em aberto é QUANTO daquele número está inflado por esta
 * mesma régua. Quem pegar o f8587cef re-mede com a régua consertada antes de
 * acreditar no 609."*
 *
 * O despacho de percepção de 20/09 (card 561e1685) NÃO respondeu isso, por um
 * motivo que só aparece quando se confere: as 3 gerações que foram ao `olho`
 * são de **01/09**, e a telemetria `tail_interno_*` só nasceu em **02/09
 * 17:08Z** (PR #153). Ou seja, os 3 áudios ouvidos são ANTERIORES ao
 * instrumento — não existe veredito de régua para eles, então o laudo do ouvido
 * não podia concordar nem discordar de nada. Ouvir sem par é anedota.
 *
 * O QUE ESTA FERRAMENTA FAZ
 * -------------------------
 * Monta um teste CEGO: N gerações que a régua REPROVOU (entregue>=1) e N que a
 * régua diz estarem LIMPAS (entregue=0 com pelo menos 3 fronteiras julgadas,
 * pra "limpo" não ser "não mediu nada"). Baixa os mp3, embaralha de forma
 * DETERMINÍSTICA e nomeia AUDIO_01..AUDIO_2N. Quem ouve não sabe qual é qual.
 *
 * O gabarito sai só no stdout (vai pro log da ronda). O manifesto que acompanha
 * os arquivos é CEGO de propósito — se o gabarito vazar junto, o teste morre.
 *
 * COMO SE LÊ O RESULTADO
 * ----------------------
 *   ouvido concorda com a régua nos dois baldes -> os 13,1% são reais
 *   ouvido acha corte nos "limpos"              -> a régua SUBESTIMA
 *   ouvido não acha corte nos "reprovados"      -> a régua INFLA (é o medo do #226)
 *
 * SÓ LEITURA no banco e no R2. Não escreve linha, não fecha cartão, não gasta
 * GPU, não gasta crédito de aluno, não manda e-mail. O custo é o download e o
 * modelo que ouve.
 *
 * ARMADILHA CONHECIDA (03_ROTINA): consulta que erra volta VAZIA e o script
 * imprime "0" alegremente. Aqui todo `error` mata o processo — zero de
 * instrumento cego não é zero medido. E `existe()` confere o objeto no R2 antes
 * de contar com ele: linha no banco não é prova de arquivo.
 */
const fs = require("node:fs");
const path = require("node:path");
const { supa, r2, s3, BUCKETS, existe } = require("./_comum.cjs");

const arg = (nome, padrao) => {
  const hit = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return hit ? hit.split("=").slice(1).join("=") : padrao;
};

const N = parseInt(arg("n", "5"), 10);
const DIR = arg("dir", "/tmp/par_cego_decapitada");
const DESDE = arg("desde", "2026-09-12T00:00:00Z");
const DUR_MIN = parseFloat(arg("dur-min", "15"));
const DUR_MAX = parseFloat(arg("dur-max", "70"));

function exigir(rotulo, error) {
  if (error) {
    console.error(`\n❌ CONSULTA FALHOU (${rotulo}): ${error.message}`);
    console.error("   Nao acredite em nenhum zero desta rodada.");
    process.exit(1);
  }
}

/** Embaralho DETERMINÍSTICO: ordena pelo id invertido. Sem Math.random —
 *  a rodada tem que ser reproduzível por quem for conferir depois. */
const embaralhoDeterministico = (a, b) =>
  a.id.split("").reverse().join("").localeCompare(b.id.split("").reverse().join(""));

(async () => {
  const db = supa();

  // ── 1. Universo: gerações entregues COM veredito de régua ────────────────
  // Pagina: a consulta corta em 1000 linhas e um corte silencioso viraria
  // amostra enviesada sem ninguém perceber.
  let todas = [];
  for (let pag = 0; pag < 10; pag++) {
    const { data, error } = await db
      .from("generations")
      .select("id, user_id, created_at, duration_seconds, audio_path, qa, text_raw")
      .eq("status", "ready")
      .not("runpod_job_id", "is", null)
      .gte("created_at", DESDE)
      .order("created_at", { ascending: false })
      .range(pag * 1000, pag * 1000 + 999);
    exigir(`geracoes pag ${pag}`, error);
    todas = todas.concat(data);
    if (data.length < 1000) break;
  }

  const comVeredito = todas.filter((g) => {
    const qa = g.qa || {};
    return (
      typeof qa.tail_interno_entregue === "number" &&
      typeof qa.tail_interno_entregue_n === "number" &&
      qa.tail_interno_entregue_n > 0 &&
      g.duration_seconds >= DUR_MIN &&
      g.duration_seconds <= DUR_MAX &&
      g.audio_path
    );
  });

  const reprovadas = comVeredito
    .filter((g) => g.qa.tail_interno_entregue >= 1)
    .sort((a, b) => a.id.localeCompare(b.id));
  // "limpo" exige fronteiras julgadas o bastante: entregue_n>=3. Sem isso,
  // "0 reprovadas de 1 julgada" entraria como limpo e não é a mesma coisa.
  const limpas = comVeredito
    .filter((g) => g.qa.tail_interno_entregue === 0 && g.qa.tail_interno_entregue_n >= 3)
    .sort((a, b) => a.id.localeCompare(b.id));

  console.log(`universo desde ${DESDE}: ${todas.length} geracoes entregues`);
  console.log(`  com veredito de regua e ${DUR_MIN}-${DUR_MAX}s: ${comVeredito.length}`);
  console.log(`  REPROVADAS pela regua (entregue>=1): ${reprovadas.length}`);
  console.log(`  LIMPAS pela regua (entregue=0, n>=3): ${limpas.length}`);

  if (reprovadas.length < N || limpas.length < N) {
    console.error(`\n❌ amostra insuficiente para N=${N}. Baixe o --n ou alargue a janela.`);
    process.exit(1);
  }

  // Espaçamento determinístico ao longo da lista (não pega só as N primeiras,
  // que seriam vizinhas de id e podem ser do mesmo aluno/lote).
  const espacar = (lista, k) => {
    const passo = Math.floor(lista.length / k);
    return Array.from({ length: k }, (_, i) => lista[i * passo]);
  };

  const escolhidas = [
    ...espacar(reprovadas, N).map((g) => ({ ...g, classe: "REPROVADA" })),
    ...espacar(limpas, N).map((g) => ({ ...g, classe: "LIMPA" })),
  ].sort(embaralhoDeterministico);

  // ── 2. Baixa (conferindo o objeto no R2 antes de contar com ele) ─────────
  fs.mkdirSync(DIR, { recursive: true });
  const bucket = BUCKETS.geracoes();
  const cliente = r2();
  const manifesto = [];
  const gabarito = [];
  let i = 0;

  for (const g of escolhidas) {
    i++;
    const rotulo = `AUDIO_${String(i).padStart(2, "0")}`;
    if (!(await existe(bucket, g.audio_path))) {
      console.log(`  ⚠️  ${rotulo} ${g.id}: objeto NAO existe no R2 (${g.audio_path}) — fora do teste`);
      continue;
    }
    const obj = await cliente.send(new s3.GetObjectCommand({ Bucket: bucket, Key: g.audio_path }));
    const destino = path.join(DIR, `${rotulo}.mp3`);
    fs.writeFileSync(destino, Buffer.from(await obj.Body.transformToByteArray()));

    manifesto.push({
      rotulo,
      arquivo: destino,
      duracao_s: g.duration_seconds,
      texto_pedido: (g.text_raw || "").trim(),
    });
    gabarito.push({
      rotulo,
      id: g.id,
      classe: g.classe,
      entregue: g.qa.tail_interno_entregue,
      entregue_n: g.qa.tail_interno_entregue_n,
      exhausted: g.qa.exhausted,
      criado: g.created_at,
    });
  }

  // O manifesto é CEGO de propósito: sem classe, sem id, sem contagem da régua.
  const caminhoManifesto = path.join(DIR, "MANIFESTO_CEGO.json");
  fs.writeFileSync(caminhoManifesto, JSON.stringify(manifesto, null, 2));

  console.log(`\n✔ ${manifesto.length} audio(s) baixado(s) em ${DIR}`);
  console.log(`  manifesto CEGO (é este que vai pro ouvido): ${caminhoManifesto}`);

  console.log(`\n${"=".repeat(70)}`);
  console.log("🔑 GABARITO — NAO MANDE ISTO PARA QUEM VAI OUVIR");
  console.log("=".repeat(70));
  for (const g of gabarito) {
    console.log(
      `  ${g.rotulo}  ${g.classe.padEnd(10)}  entregue=${g.entregue}/${g.entregue_n}  exhausted=${g.exhausted}  ${g.id}  ${g.criado.slice(0, 10)}`
    );
  }
  const nRep = gabarito.filter((g) => g.classe === "REPROVADA").length;
  console.log(`\n  ${nRep} reprovada(s) e ${gabarito.length - nRep} limpa(s) no teste.`);
})();
