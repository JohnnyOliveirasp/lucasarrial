#!/usr/bin/env node
/**
 * OUVIR O QUE VAZOU — transcreve um áudio entregue e mostra, EM PALAVRAS, o
 * trecho da REFERÊNCIA que entrou nele sem o aluno ter pedido.
 *
 * ── POR QUE EXISTE (ronda de 26/09, caso `#530`) ──────────────────────────
 * O `qa` do banco guarda a CONTAGEM do eco (`echo_flagged/echo_checked`), e
 * NÃO guarda amostra do texto que vazou — conferido imprimindo o `qa` cru em
 * `2026-09-26_intrusao_o_que_entrou_no_audio.cjs`. Então a pergunta "o que,
 * literalmente, o aluno ouviu que ele não escreveu?" não tem resposta no banco:
 * só sai transcrevendo o arquivo.
 *
 * A ordem de 17/09 manda DESPACHAR percepção em vez de declarar parada. O
 * despacho pro `olho` falhou hoje às 07:45Z (card 05c59ff0, mesma natureza de
 * tarefa: ouvir áudio). Este script é o caminho independente: usa a MESMA
 * receita do QA do worker (whisper sobre o áudio) e aplica a MESMA definição de
 * eco do código de produção — bigrama que existe na referência e NÃO existe no
 * texto pedido (`tts_qa/metrics.py:127`, `echo_leak_count`).
 *
 * Não é "eu achei que soou mal": é o texto ouvido, comparado com o texto pedido
 * e com o texto da referência, pelas três listas na tela.
 *
 * NÃO escreve no banco. NÃO move crédito. Só lê e transcreve.
 *
 * ⚠️ LIMITE: o whisper erra grafia e pode omitir pontuação — por isso a
 * comparação é por palavra normalizada, e a saída mostra o trecho CRU pra quem
 * for conferir. Ausência de bigrama suspeito não prova áudio limpo: prova que
 * ref e texto não tinham bigrama distinto (é o `echo_none` do worker).
 *
 * USO: node _frank/ferramentas/2026-09-26_ouvir_o_que_vazou.cjs <prefixo-da-geracao>
 */
const fs = require("node:fs");
const path = require("node:path");
const { supa, r2, BUCKETS } = require("./_comum.cjs");

const RAIZ = path.resolve(__dirname, "..", "..");
const PREFIXO = process.argv[2];
if (!PREFIXO) {
  console.error("uso: node _frank/ferramentas/2026-09-26_ouvir_o_que_vazou.cjs <prefixo-da-geracao>");
  process.exit(1);
}

function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/).filter(Boolean);
}
function bigramas(ws) {
  const out = new Set();
  for (let i = 0; i + 1 < ws.length; i++) if (ws[i].length >= 3 && ws[i + 1].length >= 3) out.add(`${ws[i]} ${ws[i + 1]}`);
  return out;
}

(async () => {
  const db = supa();

  const { data: todas, error } = await db
    .from("generations")
    .select("id,user_id,status,created_at,text_raw,reference_transcript,audio_path,qa")
    .gte("created_at", "2026-09-01");
  if (error) { console.error("ERRO generations:", error.message); process.exit(1); }
  const achadas = (todas ?? []).filter((g) => g.id.startsWith(PREFIXO));
  if (achadas.length !== 1) { console.error(`esperava 1 geração com prefixo ${PREFIXO}, achei ${achadas.length} — PARE.`); process.exit(1); }
  const g = achadas[0];
  const qa = g.qa ?? {};
  console.log(`geração ${g.id} · ${g.status} · ${g.created_at}`);
  console.log(`eco no banco: ${qa.echo_flagged ?? "?"}/${qa.echo_checked ?? "?"} · intrusão ${qa.intrusion_flagged ?? "?"}/${qa.intrusion_checked ?? "?"}`);
  console.log(`arquivo: ${g.audio_path}\n`);

  // 1. baixa o mp3 do R2 (bucket de gerações)
  const { GetObjectCommand } = require(path.join(RAIZ, "frontend", "node_modules", "@aws-sdk", "client-s3"));
  const local = `/tmp/ouvir_${PREFIXO}.mp3`;
  if (!fs.existsSync(local)) {
    const out = await r2().send(new GetObjectCommand({ Bucket: BUCKETS.geracoes(), Key: g.audio_path }));
    const buf = Buffer.concat(await out.Body.toArray());
    fs.writeFileSync(local, buf);
    console.log(`baixado: ${local} (${buf.length} bytes)`);
  } else {
    console.log(`já baixado: ${local}`);
  }

  // 2. transcreve com o whisper da OpenAI (a chave sai do .env.local, como em
  //    toda ferramenta da casa; nada é impresso dela)
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) { console.error("faltou OPENAI_API_KEY no frontend/.env.local — não transcrevo e não finjo que ouvi."); process.exit(1); }
  const cacheT = `/tmp/ouvir_${PREFIXO}.txt`;
  let ouvido;
  if (fs.existsSync(cacheT)) {
    ouvido = fs.readFileSync(cacheT, "utf8");
    console.log("transcrição em cache.");
  } else {
    const fd = new FormData();
    fd.append("file", new Blob([fs.readFileSync(local)]), path.basename(local));
    fd.append("model", "whisper-1");
    fd.append("language", "pt");
    const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: fd,
    });
    if (!resp.ok) {
      console.error(`whisper devolveu ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
      console.error("NÃO transcrevi. Não digo que ouvi.");
      process.exit(1);
    }
    ouvido = (await resp.json()).text ?? "";
    fs.writeFileSync(cacheT, ouvido);
  }
  console.log(`transcrição: ${ouvido.length} chars\n`);

  // 3. aplica a definição de eco DO CÓDIGO DE PRODUÇÃO
  const pedido = norm(g.text_raw);
  const ref = norm(g.reference_transcript);
  const got = norm(ouvido);
  const suspeitos = [...bigramas(ref)].filter((b) => !bigramas(pedido).has(b));
  const vazados = suspeitos.filter((b) => bigramas(got).has(b));

  console.log(`texto pedido: ${pedido.length} palavras · referência: ${ref.length} palavras · ouvido: ${got.length} palavras`);
  console.log(`bigramas SUSPEITOS (estão na referência e NÃO no texto pedido): ${suspeitos.length}`);
  console.log(`bigramas VAZADOS (suspeitos que APARECERAM no áudio): ${vazados.length}\n`);

  if (!vazados.length) {
    console.log("⚠️  ZERO bigrama vazado nesta medição do áudio INTEIRO.");
    console.log("    Isto NÃO contradiz o banco: o worker mede POR PEDAÇO, com a");
    console.log("    transcrição de cada chunk, e o eco pode estar diluído no todo.");
  } else {
    console.log("O QUE VAZOU DA REFERÊNCIA PARA DENTRO DO ÁUDIO (bigramas):");
    for (const b of vazados.slice(0, 40)) console.log(`   "${b}"`);
    if (vazados.length > 40) console.log(`   ... e mais ${vazados.length - 40}`);
  }

  // 4. o começo dos dois textos, pra confrontar com a queixa do aluno
  console.log("\n── COMEÇO DA REFERÊNCIA (o que o aluno diz que se repete) ──");
  console.log(`"${(g.reference_transcript ?? "").trim().slice(0, 240).replace(/\s+/g, " ")}"`);
  console.log("\n── COMEÇO DO QUE FOI OUVIDO NO ÁUDIO ENTREGUE ──");
  console.log(`"${ouvido.trim().slice(0, 240).replace(/\s+/g, " ")}"`);
  console.log("\n── COMEÇO DO TEXTO QUE O ALUNO PEDIU ──");
  console.log(`"${(g.text_raw ?? "").trim().slice(0, 240).replace(/\s+/g, " ")}"`);
})();
