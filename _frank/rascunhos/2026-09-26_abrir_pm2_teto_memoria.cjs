/**
 * Abre o incidente: o pm2 MATA o app de producao a cada poucos minutos porque
 * o teto de memoria (600 MB) e menor do que o app consome em regime normal.
 * Medido no relatorio noturno de 25/09.
 *   node _frank/rascunhos/2026-09-26_abrir_pm2_teto_memoria.cjs [--confirmar]
 */
const path = require("path");
const RAIZ = path.resolve(__dirname, "..", "..");
const { supa } = require(path.join(RAIZ, "_frank/ferramentas/_comum.cjs"));
const db = supa();
const CONFIRMAR = process.argv.includes("--confirmar");

const TITULO =
  "O PM2 MATA O APP DE PRODUCAO A CADA ~4 MINUTOS: max_memory_restart=600MB e o aiverse opera ACIMA disso (medido 685MB no momento do kill). 172 mortes por teto desde 25/09 14:08:49Z, com SIGINT no processo que estava servindo. Dano medido HOJE: ZERO (0 falha em generations/image_generations nas 12h com as mortes contra 12h sem; video_clones 1 de 66). O defeito e a bala na agulha: todo request em voo no instante do SIGINT cai, e o app volta em 1,5s sem deixar rastro de quem caiu.";

const DESCRICAO = `A PROVA, DO LOG DO PROPRIO PM2 (ssh root@91.99.15.213, ~/.pm2/pm2.log)

  2026-09-26T01:11:50: [PM2][WORKER] Process 3 restarted because it exceeds
  --max-memory-restart value (current_memory=717971456 max_memory_limit=...)

  717971456 bytes = 685 MB. O teto configurado e 629145600 = 600 MB.
  pm2 describe aiverse -> max_memory_restart 629145600 · exec mode fork

CONTAGEM (grep "exceeds --max-memory-restart" ~/.pm2/pm2.log):
  172 mortes no total do arquivo
  1a: 2026-09-25T14:08:49Z (current_memory=660725760 = 630 MB)
  ultima: 2026-09-26T01:11:50Z (685 MB)
  por hora de 25/09: 14h=14 15h=11 17h=17 18h=24 19h=23 20h=21 21h=9 22h=1
                     23h=29 · 26/09: 00h=19 01h=4
  media ~1 morte a cada 4 minutos nas horas cheias.

⚠️ LIMITE DO INSTRUMENTO (armadilha 1 de 03_ROTINA, aplicada a este log):
o ~/.pm2/pm2.log SO COMECA em 2026-09-25T06:15:15Z e nao ha rotacionado no
diretorio. Portanto NAO afirmo que isto comecou hoje as 14:08 — afirmo que
14:08 e a primeira morte DENTRO DA JANELA QUE O LOG COBRE. Se alguem quiser a
data real de inicio, tem que achar log mais antigo ou instrumentar.

MEDICAO DE MEMORIA AO VIVO (pm2 jlist, 9 amostras de 20s em 26/09 01:07-01:10Z)
  459 → 477 → 557 → 572 → 553 → 412 → 371 → 372 → 373 MB
O app sobe rapido, raspa o teto, e o GC as vezes salva. Quando nao salva, morre.

DANO MEDIDO HOJE: ZERO — e isso e o achado, nao a absolvicao
Comparei 12h COM as mortes (25/09 14:08Z → 26/09 02:08Z) contra as 12h ANTES
(25/09 02:08Z → 14:08Z), nas tabelas de entrega:
  generations        antes: 45 total, 0 falhos | depois: 116 total, 0 falhos
  image_generations  antes: 25 total, 0 falhos | depois: 101 total, 0 falhos
  video_clones       antes: 19 total, 0 falhos | depois:  66 total, 1 falho
Nenhum aluno tem falha atribuivel as mortes. A razao provavel: o Next volta
"Ready in 1,5s" e o trabalho pesado esta no RunPod, nao no processo morto.
⚠️ O meu script ad-hoc deu ERRO em react_jobs (coluna/tabela) e eu NAO
transformei isso em zero — ali eu estou cego. O varredura_travados.cjs, que
enxerga react_jobs, acusou 1 unico item preso na casa toda e ele e
escrituracao de training_jobs, sem ninguem esperando.

POR QUE ISTO E CARTAO E NAO "ESTA TUDO BEM"
1. O SIGINT nao pede licenca: quem estava no meio de um upload de audio de voz
   naquele segundo perde o request. Nao ha log de quem caiu, entao a ausencia
   de queixa NAO e prova de ausencia de vitima — e o mesmo raciocinio do
   "silencio nao e saude".
2. 172 kills em 11h e o app reiniciando como regime, nao como excecao. Qualquer
   medicao de uptime, qualquer cache em memoria e qualquer trabalho em
   background do proprio app esta sendo zerado a cada 4 minutos.
3. A regra 5-B da casa usa "uptime do pm2 batendo com o fim do Action" como uma
   das TRES provas de deploy. Com o processo reiniciando a cada 4 min, essa
   prova virou ruido: uptime baixo deixou de significar "deploy novo".

O QUE EU NAO FIZ, DE PROPOSITO
Nao mexi no teto. Subir max_memory_restart e mexer em producao fora do fluxo
normal (regra 3/06_RELATORIO_E_LIMITES: nginx e config de servidor pedem aval),
e o teto existe por algum motivo que nao esta escrito em lugar nenhum que eu
tenha achado. A maquina TEM folga (7,7 GB no total, 2,8 GB disponiveis,
2,4 GB de swap em uso), entao subir pra 1,5 GB e viavel — mas e decisao do
Johnny, e esta na pergunta binaria do relatorio de 25/09.

Nao deployei nada, nao toquei GPU, credito, assinatura nem conta de aluno.

CONFERIDO NA MESMA RONDA (pra nao virar hipotese solta)
  Fonte no servidor == origin/main byte a byte (md5sum de contato-ficha.ts,
  contato-tentativas.ts, social/access.ts) · BUILD_ID nMgDMVmvEZDmuosacj6hn de
  25/09 20:32Z · nada sob frontend/ entrou na main depois desse build. Ou seja:
  o que esta no ar E a main, e as mortes nao sao deploy em curso.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "frank:pm2-teto-memoria-mata-producao",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 172,
    affected_emails: [],
    reported_by: "frank",
    first_seen_at: "2026-09-25T14:08:49Z",
    last_seen_at: agora,
    agent_notes: [],
  };
  if (!CONFIRMAR) {
    console.log("ENSAIO — nada gravado. Gravaria:");
    console.log(JSON.stringify({ ...linha, description: `<${DESCRICAO.length} chars>` }, null, 2));
    return;
  }
  const { data, error } = await db.from("incidents").insert(linha).select("id, numero, title, status");
  if (error) throw new Error("insert falhou: " + JSON.stringify(error));
  if (!data || data.length !== 1) throw new Error("select() devolveu " + (data ? data.length : 0) + " linhas");
  console.log("GRAVADO:", JSON.stringify({ id: data[0].id, numero: data[0].numero, status: data[0].status }, null, 2));
}
main().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
