#!/usr/bin/env node
/**
 * Abre o incidente medido na ronda do Vigia de 13/09 00hZ:
 * a RECUSA do gate de rosto do Video Clone nao deixa rastro nenhum no banco.
 * Sem --confirmar, so imprime o que gravaria.
 */
const { supa } = require("../ferramentas/_comum.cjs");
const db = supa();

const CONFIRMAR = process.argv.includes("--confirmar");

// VAZIO DE PROPOSITO: a aluna medida (alicearnaldo@gmail.com) ja esta no #371.
// O garantia_na_fila.cjs conta por par (cartao, e-mail) e repetir o nome criaria
// linha duplicada no instrumento de reembolso — foi o que inflou 6 -> 24 em 12/09.
const AFETADOS = [];

const TITULO =
  "A RECUSA DO GATE DE ROSTO NAO DEIXA RASTRO NENHUM: route.ts:157 barra o aluno com console.log e " +
  "SEM criar linha em video_clones, sem contador e sem assinatura, entao a casa so descobre que alguem " +
  "ficou travado se ele abrir chat. Medido: aluna barrada em 5 de 6 imagens por ~6h (18:07->23:54Z) e " +
  "o unico registro disso no sistema e o #371, que ela abriu na mao";

const DESCRICAO = `MEDIDO POR MIM (VIGIA) NA RONDA DE 13/09 00hZ, EM PRODUCAO.
Nasceu do #371 (aberto pela Fast em 12/09 23:57Z), mas o defeito NAO e do caso dela:
e de o bloqueio ser MUDO para nos.

O DEFEITO, com arquivo:linha
frontend/src/app/api/v1/video-clone/route.ts:

  150-160  o gate roda ANTES de cobrar e ANTES de qualquer INSERT
  155      const gate = await checkFrontalFace(gateUrl)
  157      console.log("[video-clone] face-gate bloqueou", {...})   <- UNICO registro
  158      return jsonError("face_not_frontal", ..., 400)           <- devolve e acaba

Consequencia exata: quando o gate barra, NAO nasce linha em video_clones, NAO
sobe contador em lugar nenhum, NAO existe assinatura de incidente e NAO ha
tabela de auditoria. O bloqueio existe so no stdout do pm2. Uma consulta ao
banco nao consegue responder "quantos alunos o gate barrou hoje" — nem "quantas
vezes o mesmo aluno bateu na mesma parede".

A MEDICAO (o que eu rodei, e com que recorte)
Ferramenta: _frank/prova/2026-09-13_medir_face_gate_falso_positivo.cjs (leitura
pura; nao escreve, nao cria clone, nao cobra). Ela LE as constantes MODEL e
SYSTEM do proprio face-gate.ts em tempo de execucao, em vez de copia-las, pra
medicao e producao nao poderem divergir.

Sobre alicearnaldo@gmail.com (#371), as 6 imagens 'ready' mais novas, 2 passadas
cada, URL assinada do R2 igual a producao:
  5 de 6 BLOQUEIAM — veredito ESTAVEL (mesmo resultado nas 2 passadas de cada
  uma), motivo sempre da mesma familia ("a pessoa esta olhando para baixo").
  1 de 6 PASSA.
Janela das imagens dela: 18:07Z -> 23:54Z. Ela abriu o chat as 23:57Z, 3 minutos
depois de gerar a ultima.

A CORRECAO DE PREMISSA (importante, pra ninguem cacar bug que nao existe)
O titulo do #371 diz "nem as geradas pela propria plataforma". MEDIDO, isso esta
ERRADO e ao contrario: a UNICA imagem dela que veio do Gerador de Imagem com
prompt e custo (4100fc07, 20:35Z, 525 cr) e justamente a UNICA que PASSA no gate.
As 5 bloqueadas tem credits_cost=0 e prompt/idea VAZIOS — assinatura de UPLOAD,
nao de geracao (na base inteira desde 05/09: 153 de 958 linhas de
image_generations sao cost=0 + prompt vazio, e entre elas ha resolucao
3024x4032, que e foto de camera de celular).
Mais: o prompt que ela escreveu na unica que gerou foi "Olhar fixo para a camera,
boca visivel rosto ereto sem estar inclinado" — ou seja, ela leu a mensagem de
recusa do gate e pagou 525 creditos pra escrever os requisitos dele a mao. E
funcionou. O produto fez ela descobrir a regra por tentativa e erro.

O QUE EU NAO VERIFIQUEI, E ISSO E LIMITE DURO
Eu NAO abri as 5 imagens. Eu NAO afirmo que o gate errou nelas — se ela estiver
mesmo olhando pra baixo, o gate acertou, e ai o caso dela e atendimento, nao bug.
Decidir isso depende de OLHO HUMANO e vai pro grupo (ordem 27/08 §4), nunca vira
veredito meu. ESTE CARTAO NAO DEPENDE DISSO: o defeito e a casa nao conseguir
enxergar a recusa, esteja o gate certo ou errado.

TAMANHO DA CLASSE: NAO MENSURAVEL HOJE — e essa e a propria falha
Nao consigo dizer quantos alunos o gate barrou, porque a informacao nao e
gravada. O teto grosseiro que consigo tirar: nos ultimos 7 dias, 184 alunos tem
imagem 'ready' E voz 'ready', e 48 deles NUNCA criaram uma unica linha em
video_clones. NAO afirmo que os 48 foram barrados — a maioria provavelmente so
nao tentou. O ponto e que o banco nao permite separar "foi barrado" de "nao
tentou", e hoje a unica peneira que existe e o aluno se dar ao trabalho de
reclamar.

DINHEIRO: NENHUMA AFIRMACAO
Conferido no codigo: o gate roda ANTES da cobranca (route.ts:150-160, o INSERT e
o debito vem depois). Ninguem foi cobrado pela recusa, e eu NAO cruzei ref_id com
nada nem afirmo estorno devido. Os 525 cr da imagem 4100fc07 sao geracao de
imagem legitima e entregue, nao cobranca do gate.

O QUE ESTE CARTAO NAO E
Nao e o #335 (gate PERMISSIVO demais: rosto pequeno passa e e cobrado). Este aqui
e o outro lado do balcao — e os dois convivem, porque nenhum dos dois lados tem
numero. Sem registro de recusa, a discussao "o gate esta frouxo ou apertado"
nunca pode ser decidida por medicao, so por anedota.
Nao e o #131 (fixed), que foi quem CRIOU o gate.
Nao e pedido pra afrouxar nem pra endurecer o criterio: e pedido pra ele deixar
rastro.

CORRECAO PROPOSTA (barata, e nao muda o comportamento pro aluno)
1. Gravar a recusa. O caminho mais barato que ja existe na casa: uma linha por
   recusa com (user_id, image_path, reason, created_at) — tabela propria ou o
   mecanismo de assinatura de incidente que a casa ja usa pra classe repetida.
2. Reincidencia e o sinal que importa: MESMO aluno + N recusas em M minutos e
   exatamente "aluno travado batendo na parede", e hoje passa despercebido. A
   casa ja tem esse padrao pronto (burst-rule, que abre cartao de rajada de
   falhas de Video Clone). Aqui a rajada nem chega a existir como dado.
3. NAO mexer no criterio do gate nesta correcao. Primeiro medir, depois calibrar
   — inclusive porque calibrar o #335 sem este registro e chutar.
4. Herdar o fail-open (face-gate.ts:70): visao fora do ar nao bloqueia. O
   registro novo nao pode inverter isso nem virar erro que derruba a rota.

AS TRES CHECAGENS DA ORDEM DE 27/08, FEITAS ANTES DE ABRIR
1. JA EXISTE? Varri a fila aberta E fechada. Por titulo (face/gate/rosto/rastro/
   invisivel) e por signature (%gate%/%rosto%/%face%). Os vizinhos: #335
   (investigating) e o gate PERMISSIVO demais, direcao oposta; #131 (fixed) foi
   quem criou o gate; #371 e o cartao de ATENDIMENTO da aluna, nao do defeito.
   Nenhum cartao, aberto ou fechado, trata a recusa nao deixar rastro.
2. JA FOI CORRIGIDO? git log origin/main da janela (22:12:46Z -> 00:11Z) = 2
   commits, ambos log de ronda (_frank/prova), nenhum toca codigo. gh pr list
   --state open --limit 200 (limite DECLARADO: o default de 30 corta em silencio)
   = 36 PRs; os que citam face/rosto/gate/clone/video sao #254 (gate de job velho
   no reenvio, outro gate), #200 (previa de transcricao) e #185 (teste). NENHUM
   toca face-gate.ts nem o ramo da linha 157.
3. ENVOLVE DINHEIRO? Nao afirmo nada sobre dinheiro (ver bloco acima). O gate
   roda antes de cobrar, conferido no arquivo.`;

async function main() {
  const agora = new Date().toISOString();
  const linha = {
    kind: "system",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: "vigia:face-gate-recusa-sem-rastro",
    title: TITULO,
    description: DESCRICAO,
    occurrences: 1,
    affected_emails: AFETADOS,
    reported_by: "vigia",
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
