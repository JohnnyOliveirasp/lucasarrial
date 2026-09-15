#!/usr/bin/env node
/**
 * Abre o incidente medido na rotina das falhas de 15/09 23h40Z:
 * falha TRANSITORIA de treino de voz nao tem retentativa — vira estado
 * terminal e o aluno so e resgatado se uma ronda passar por ali.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const AFETADOS = ["ricardoolito@gmail.com", "franwd82@gmail.com"];

const TITULO =
  "FALHA TRANSITORIA DE TREINO DE VOZ VIRA ESTADO TERMINAL E O ALUNO SO E RESGATADO POR ACASO: " +
  "finalize-training.ts:416 escreve status='failed' direto, sem nenhuma retentativa no backend nem no worker. " +
  "Medido na 4a ocorrencia do #11 (15/09 21:46Z): OOM de VRAM com o NOSSO processo segurando so 11,93 GiB de " +
  "um cartao de 94,97 GiB — e os MESMOS 3 arquivos treinaram em 296s uma hora depois. Repetir resolveu nas " +
  "DUAS vezes em que alguem repetiu (franwd82 27/08, ricardoolito 15/09), sempre a mao";

const DESCRICAO = `MEDIDO POR MIM (FRANK) NA ROTINA DAS FALHAS DE 15/09 23h40Z, EM PRODUCAO.
Saiu de dentro do #11 (9ac03612, "Treino de voz: trainer failed") e o defeito NAO
e do caso do Ricardo: e a casa nao ter retentativa para uma falha que ela mesma
sabe ser transitoria.

O QUE ESTE CARTAO AFIRMA, E O QUE ELE NAO AFIRMA
AFIRMA: nao existe retentativa. Conferido em codigo, nao por impressao:
  - frontend/src/lib/voices/finalize-training.ts:416
      const nextStatus = success ? "ready" : "failed";
    e o unico destino da falha. Nao ha reenfileiramento, nao ha contador de
    tentativa, nao ha backoff. grep por retry/retentativa/reenfileir/requeue no
    arquivo devolve so comentario e nome de campo de QA (time_retry, que e outra
    coisa: e o snap da referencia).
  - runpod-worker/jobs/train.py e voice_pipeline/training.py: grep por
    retry/retries/max_attempts/tentativa devolve 1 linha, e e comentario do
    snap da referencia. O worker tambem nao repete.
NAO AFIRMA que toda falha merece retentativa. Falha de INSUMO (ex.:
"no usable speech segments after VAD/chunk", 3 casos em 22/08) repetir nao cura
— repetir aquilo e so queimar GPU. O recorte deste cartao e falha TRANSITORIA
DE RECURSO, identificavel por trainer_returncode + traceback desde a migration
97: rc=1 com torch.OutOfMemoryError, rc=137 (OOM-killer), rc=139 (SIGSEGV).

A EVIDENCIA DE QUE REPETIR CURA (duas medicoes independentes, nenhuma minha
hipotese)
  1. franwd82@gmail.com, 27/08: os MESMOS 6 arquivos .m4a, os MESMOS 131,5 min,
     sem tocar em nada, treinaram em 604s ~8h depois da falha.
  2. ricardoolito@gmail.com, 15/09: os MESMOS 3 arquivos .ogg, os MESMOS 1696s,
     treinaram em 296s ~1h depois (job dc768762, RunPod 683f0d28-...-u2).
Nos dois casos quem repetiu foi um AGENTE, a mao, porque passou por ali. Nao ha
caminho de produto que faca isso.

QUEM PAGA A CONTA HOJE, e por que o estorno nao resolve
Para quem foi cobrado, finalize-training.ts:165 estorna automatico ("culpa NOSSA,
nao do usuario") — o aluno fica sem a voz mas com o credito de volta.
O COMPRADOR DO SGP NAO TEM NEM ISSO: ele nunca e cobrado (o clone e entrega do
produto que ele ja pagou), entao nao ha estorno para amaciar nada
(finalize-training.ts:519: "sem linha de debito para esta voz, nao ha o que
estornar" — conferido no extrato do Ricardo: ZERO linhas em credit_transactions).
Ele simplesmente fica sem a voz. E, pelo #421, ele tambem NAO consegue refazer o
pedido sozinho. As duas lacunas se somam: falha transitoria + nenhuma
retentativa + nenhuma porta de refazer = aluno parado por tempo indeterminado.

TAXA DE BASE, MEDIDA (importa pro custo da decisao)
Desde a migration 97 (28/08 18:05Z): 370 treinos, 369 completed, 1 failed.
0,27%. Uma retentativa automatica nesse recorte custaria, na media observada,
UM treino extra a cada ~370 — nao e gasto continuo de GPU, e um caso raro.
Registro isso porque a objecao permanente contra retentativa e "gasta GPU sem o
aluno pedir", e o tamanho real do gasto e parte da decisao.

DECISAO QUE E DO JOHNNY, NAO MINHA
Ordem permanente: nada que gaste GPU sem aval. Por isso este cartao esta ABERTO
com o diagnostico pronto e SEM codigo escrito. Nao implementei retentativa e nao
abri PR. O que esta na mesa dele: autorizar UMA retentativa automatica, so para
rc=1/137/139 com OOM no traceback, por conta da casa, com teto de 1 tentativa.

O QUE NAO DEPENDE DE APROVACAO DE GPU (se ele preferir o caminho barato)
Mesmo sem retentativa, hoje a falha transitoria nao gera nenhum aviso acionavel
para a casa: ela vira voz failed e some. Um alerta que diga "treino morreu com
OOM, candidato a repetir" ja tiraria o resgate do acaso de horario, que foi como
os DOIS casos conhecidos foram salvos.

COMO REPRODUZIR / CONFERIR
  SELECT id, voice_id, trainer_returncode, trainer_stderr, created_at
    FROM training_jobs WHERE status='failed' AND created_at >= '2026-08-28T18:05Z';
Devolve hoje 1 linha (c90ff577, rc=1, 2000 chars de stderr com
torch.OutOfMemoryError). Controle positivo: se devolver ZERO, o instrumento
quebrou — as 3 falhas anteriores a migration tem rc e stderr NULL e NAO servem
de controle.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "frank:treino-transitorio-sem-retentativa",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 1,
    affected_emails: AFETADOS,
    reported_by: "frank",
    first_seen_at: agora,
    last_seen_at: agora,
    agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: "<" + DESCRICAO.length + " chars>" }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify(data[0], null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
