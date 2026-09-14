#!/usr/bin/env node
/** Abre o incidente do defeito de produto medido na ronda das falhas de 14/09 ~15hZ. */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "NAO EXISTE PAUSA ENTRE FRASES A NAO SER QUE O ALUNO DEIXE LINHA EM BRANCO: " +
  "split_text_for_tts emenda frases ate 160 chars no mesmo chunk e o silencio entre chunks " +
  "(inference.py:561) exige crossfade==0, que em producao e 60 — o ramo nunca dispara e o " +
  "pacing por voz (080dd74) e codigo morto. 1.671 de 2.041 geracoes (81,9%) e 441 de 489 alunos (90,2%) " +
  "receberam audio com frase colada";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA RONDA DAS FALHAS DE 14/09 ~15hZ, EM PRODUCAO.
Nasceu do ce6e157d (Katia, 26 dias de queixa). Aquele cartao trata O CASO DELA;
este e o DEFEITO DE PRODUTO, que continua em producao para todo mundo.

NAO E O #234 (f8587cef) E NAO E PACING. Sao defeitos diferentes:
  #234  = palavra DECAPITADA na fronteira (release curto, plato alto).
  este  = a pausa simplesmente NAO EXISTE. O audio esta integro, so emendado.
A regua do #234 NAO marca as geracoes da Katia: medi ed61d09c (13/09),
60cf27fa (13/09) e b6df1a7e (09/09) com cauda_decepada.cjs (ensaio aprovado
nos 3 arquivos de referencia antes de apontar pra base). Cada uma tem UMA
fronteira, a do fim do arquivo, e todas limpas: release 125/175/190ms,
plato -49,4/-56,4/-51,5dB. Por 26 dias a casa perseguiu decapitacao e pacing
num caso que nao era nem um nem outro.

O DEFEITO, no codigo
1. runpod-worker/tts_text.py:split_text_for_tts(max_chars=160)
   Empacotamento GULOSO: enquanto a proxima frase couber em 160 chars, ela e
   grudada no mesmo chunk. Texto curto com varias frases vira UM chunk so.
2. runpod-worker/jobs/inference.py:561
   O silencio entre chunks so e aplicado se
       silence_ms > 0 AND crossfade_samples == 0
   Em producao (jobs/tts_settings.py) silence_ms=0 (:236) e crossfade_ms=60
   (:237). As duas condicoes falham. O ramo NUNCA dispara.
   CONSEQUENCIA: o pacing por voz (080dd74, voice_pipeline/pacing.py,
   train.py:86) e CODIGO MORTO em producao. Nenhuma voz consegue pausa por
   esse caminho, tenha tts_silence_ms medido ou nao. Todo o trabalho de 21/08
   de "a voz nasce com a pausa de quem gravou" nao podia ter efeito nenhum.
3. runpod-worker/jobs/inference.py:555 (par_pause_ms, default 300)
   UNICO mecanismo vivo. So dispara em ends_paragraph, ou seja, so quando o
   aluno digitou LINHA EM BRANCO (\\n\\n).

A MEDICAO ACUSTICA (corridas de silencio digital, piso -90dB, janela 20ms)
Previsao feita a partir do TEXTO, conferida no AUDIO. Bate nos 4 casos:
  1498fbe5 Katia 02/09  texto com 5 quebras de paragrafo -> 5 pausas ~760ms
  ed61d09c Katia 13/09  4 frases em linha unica          -> ZERO pausa
  879a9a0e outro  14/09 2 frases, sem quebra             -> ZERO pausa
  06e8c51e outro  14/09 2 frases, sem quebra             -> ZERO pausa
pausas = numero de quebras de paragrafo. Nada mais no sistema produz pausa.

CONFIRMACAO NO SPLITTER REAL (nao e leitura de codigo, e execucao)
Texto da Katia, 121 chars, 4 frases:
  como ela digitou (linha unica)      -> 1 chunk  -> 0 pausas
  com quebra de linha SIMPLES (\\n)    -> 1 chunk  -> 0 pausas
  com LINHA EM BRANCO (\\n\\n)          -> 4 chunks -> 3 pausas
Quebra simples NAO resolve: paragrafo e separado ANTES do empacotamento
guloso, entao so \\n\\n sobrevive. Isso importa porque e o contorno que a casa
passa pro aluno; passar "quebre a linha" seria instrucao errada.

ALCANCE, MEDIDO (nao estimado)
Rodei o splitter REAL sobre as 2.041 geracoes ready com texto desde 15/08
(paginado de 1000 em 1000 — PostgREST corta em 1000 em silencio):
  1.671 geracoes = 81,9% tem ao menos uma fronteira de frase sem pausa
  441 de 489 alunos = 90,2%
  8.434 fronteiras de frase mudas
Compare com o #234: 14,3% das entregas e 237 alunos. Este e ~6x mais amplo e
e o que de fato sustenta a queixa historica de "audio corrido/emendado".

ALUNOS JA TENTARAM CONTORNAR SOZINHOS, e isso esta no dado: ha texto com
"[pausa]" digitado no meio das frases e ha texto com quebra de linha simples
(que nao funciona). Eles perceberam o defeito antes da casa.

CORRECAO: NAO APLIQUEI, E O MOTIVO E CUSTO
O conserto obvio e parar de emendar frases (uma frase por chunk). Isso
MULTIPLICA chamadas de generate: so no texto da Katia vai de 1 para 4. Em
2.041 geracoes isso e decisao de custo de GPU e de tempo de resposta, que e do
Johnny, nao minha. Existe ainda uma variante barata que NAO resolve este caso
mas destrava o pacing morto: fazer o silencio entre chunks ser anexado ao
proprio segmento, do jeito que a pausa de paragrafo ja faz (inference.py:555
comenta "sobrevive ao crossfade"), em vez de exigir crossfade==0. Isso reviveria
080dd74 para textos multi-chunk, mas nao poe pausa DENTRO de um chunk — ou
seja, nao cobre texto curto, que e justamente o caso da Katia.
Ambos os caminhos estao descritos aqui para o Johnny decidir; nenhum foi subido.

CONTORNO QUE FUNCIONA HOJE, ja passado a aluna (14/09, uid 2250 nos enviados):
deixar LINHA EM BRANCO entre as frases. Foi dito a ela explicitamente que e
contorno e que quebra simples nao serve.

O QUE ESTE CARTAO NAO COBRE: a troca de palavra ("Bem-vinda" saindo
"Bem-vindo", "para" virando "pra"). A telemetria de QA da Katia lista
faltantes ["para","vinda","vinda"] com coverage 0,875 passando no gate de
0,85. Defeito separado, segue aberto.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system", cause: "bug", categoria: "tecnico", status: "investigating",
    signature: "frank:tts-sem-pausa-entre-frases-fora-de-paragrafo",
    title: TITULO, description: DESCRICAO,
    occurrences: 1671,
    affected_emails: ["katiasalvador32@gmail.com"],
    reported_by: "frank", first_seen_at: agora, last_seen_at: agora, agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify({ id: data[0].id, numero: data[0].numero, status: data[0].status }, null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
