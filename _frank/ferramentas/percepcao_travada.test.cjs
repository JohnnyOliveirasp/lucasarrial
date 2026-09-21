/**
 * Testes do detector de percepcao travada. Sem banco, sem rede:
 *
 *   node --test "_frank/ferramentas/percepcao_travada.test.cjs"
 *
 * ⚠️ Leia `# pass` / `# skipped`, nunca so o codigo de saida (armadilha 3 do
 * `_frank/03_ROTINA.md`): teste que nao RODOU tambem sai com exit 0.
 *
 * POR QUE ESTES CASOS. Em 21/09 duas rondas seguidas reportaram "18 cards
 * travados em percepcao" medindo com o SQL cru da ordem de 17/09, que varre a
 * pilha de agent_notes INTEIRA — e os 18 eram falso positivo (15 casavam so
 * em nota JA SUPERADA; 702cc916/#226, ab5644be/#296 e bb97e2f1/#460 entre
 * eles). O criterio certo, que este arquivo trava em teste, e: a marca conta
 * SO na ULTIMA nota. A ultima secao roda a semantica VELHA (pilha inteira)
 * contra os MESMOS casos e prova que ela erra — teste que passa nos dois
 * lados nao prova nada.
 */
const test = require("node:test");
const assert = require("node:assert/strict");

const { marcaDe, travadosDe, MARCAS, BOILERPLATE, STATUS_VARRIDOS, CUMPRIMENTOS } = require("./percepcao_travada.cjs");

// ---------------------------------------------------------------------------
// Casos fabricados com a MESMA forma das linhas de `incidents`.
// ---------------------------------------------------------------------------

/** CONTROLE POSITIVO fabricado: a ULTIMA nota pede percepcao. TEM que casar. */
const PENDENTE_REAL = {
  id: "aa11bb22-0000-4000-8000-000000000001", numero: 9001, status: "open",
  agent_notes: [
    { by: "frank", at: "2026-09-18T10:00:00Z", note: "medi o extrato, nada anormal" },
    { by: "frank", at: "2026-09-20T10:00:00Z", note: "falta um humano olhar a imagem do R2 e decidir se o rosto e o da aluna" },
  ],
};

/** A classe dos 18 falsos: marca em nota ANTERIOR, ultima nota ja superou. */
const SUPERADO = {
  id: "aa11bb22-0000-4000-8000-000000000002", numero: 9002, status: "open",
  agent_notes: [
    { by: "frank", at: "2026-09-10T10:00:00Z", note: "nao enxergo a imagem daqui, precisa assistir o video" },
    { by: "olho", at: "2026-09-12T10:00:00Z", note: "assisti: o video abre normal, causa achada, cartao-filho aberto" },
  ],
};

/** Boilerplate do sensor na ultima nota NAO e pedido de percepcao. */
const SO_BOILERPLATE = {
  id: "aa11bb22-0000-4000-8000-000000000003", numero: 9003, status: "investigating",
  agent_notes: [{ by: "carol", at: "2026-09-19T10:00:00Z", note: "isto precisa de olho humano, não de código" }],
};

/** Fechado nao entra, mesmo com marca viva na ultima nota. */
const FECHADO = {
  id: "aa11bb22-0000-4000-8000-000000000004", numero: 9004, status: "fixed",
  agent_notes: [{ by: "frank", at: "2026-09-15T10:00:00Z", note: "precisa ouvir o audio" }],
};

/** agent_notes degenerado: null, vazio, e fora do formato. Nao explode, nao casa. */
const NOTAS_NULL = { id: "aa11bb22-0000-4000-8000-000000000005", numero: 9005, status: "open", agent_notes: null };
const NOTAS_VAZIAS = { id: "aa11bb22-0000-4000-8000-000000000006", numero: 9006, status: "open", agent_notes: [] };
const NOTAS_STRING = { id: "aa11bb22-0000-4000-8000-000000000007", numero: 9007, status: "open", agent_notes: "nota velha virou string, e ate diz assistir" };
const ULTIMA_SEM_NOTE = { id: "aa11bb22-0000-4000-8000-000000000008", numero: 9008, status: "open", agent_notes: [{ by: "frank", at: "2026-09-19T10:00:00Z" }] };

const BANCO = () => [PENDENTE_REAL, SUPERADO, SO_BOILERPLATE, FECHADO, NOTAS_NULL, NOTAS_VAZIAS, NOTAS_STRING, ULTIMA_SEM_NOTE];

// ---------------------------------------------------------------------------
// marcaDe: a leitura de UMA nota.
// ---------------------------------------------------------------------------

test("marcaDe acha a marca mesmo com acento e caixa (não ouço -> nao ouco)", () => {
  assert.equal(marcaDe("Não OUÇO o áudio desta geração"), "nao ouco");
});

test("marcaDe desconta o boilerplate do sensor", () => {
  assert.equal(marcaDe("precisa de olho humano, não de código"), null);
});

test("marcaDe em null/undefined/vazio devolve null sem explodir", () => {
  assert.equal(marcaDe(null), null);
  assert.equal(marcaDe(undefined), null);
  assert.equal(marcaDe(""), null);
});

// ---------------------------------------------------------------------------
// travadosDe: o criterio inteiro — ULTIMA nota, cards abertos.
// ---------------------------------------------------------------------------

test("CONTROLE POSITIVO: ultima nota pedindo percepcao CASA (detector nao ficou cego)", () => {
  const t = travadosDe(BANCO());
  assert.equal(t.length, 1, "exatamente o pendente real, nada alem");
  assert.equal(t[0].i.numero, 9001);
  assert.equal(t[0].marca, "humano olhar");
  assert.equal(t[0].ultima.at, "2026-09-20T10:00:00Z", "a nota apontada e a ULTIMA");
});

test("marca em nota JA SUPERADA nao casa (a classe dos 18 falsos de 21/09)", () => {
  assert.equal(travadosDe([SUPERADO]).length, 0);
});

test("boilerplate do sensor na ultima nota nao casa", () => {
  assert.equal(travadosDe([SO_BOILERPLATE]).length, 0);
});

test("card fechado nao entra, mesmo com marca na ultima nota", () => {
  assert.equal(travadosDe([FECHADO]).length, 0);
});

// ---------------------------------------------------------------------------
// SEGUNDO DEFEITO (21/09 18hZ): 'aguardando_aluno' que MENTE. O rotulo diz que
// a bola e do aluno, mas a ultima nota pede percepcao — quem trava e a CASA.
// A varredura antiga so contava open/investigating e 13 cartoes com aluno
// nomeado ficaram invisiveis (o #207 perdeu a garantia assim: R$97 nao
// devolvidos). Estes testes travam a regressao.
// ---------------------------------------------------------------------------

/** A forma do #216/#406/#455: parado em aguardando_aluno, ultima nota pede VER. */
const AGUARDANDO_MAS_BOLA_DA_CASA = {
  id: "aa11bb22-0000-4000-8000-000000000010", numero: 9010, status: "aguardando_aluno",
  agent_notes: [
    { by: "frank", at: "2026-09-10T10:00:00Z", note: "respondi o aluno pedindo o print" },
    { by: "vigia", at: "2026-09-19T10:00:00Z", note: "o print chegou; falta olho humano conferir a imagem contra a referencia" },
  ],
};

/** A forma do #207 HOJE: marca so em nota velha; a ultima diz que o aluno ja foi respondido. */
const AGUARDANDO_JA_DESPACHADO = {
  id: "aa11bb22-0000-4000-8000-000000000011", numero: 9011, status: "aguardando_aluno",
  agent_notes: [
    { by: "frank", at: "2026-09-01T10:00:00Z", note: "precisa assistir o video e ouvir o audio da geracao" },
    { by: "frank", at: "2026-09-21T17:49:00Z", note: "ALUNO RESPONDIDO - carta enviada, reembolso encaminhado" },
  ],
};

test("REGRESSAO do defeito: aguardando_aluno com percepcao na ULTIMA nota CASA", () => {
  const t = travadosDe([AGUARDANDO_MAS_BOLA_DA_CASA]);
  assert.equal(t.length, 1, "o rotulo aguardando_aluno nao pode esconder cartao travado na casa");
  assert.equal(t[0].i.numero, 9010);
  assert.equal(t[0].i.status, "aguardando_aluno", "o status sai junto: o relatorio mostra ONDE ele estava escondido");
});

test("aguardando_aluno com marca so em nota superada NAO casa (forma do #207 pos-despacho)", () => {
  assert.equal(travadosDe([AGUARDANDO_JA_DESPACHADO]).length, 0);
});

test("aguardando_aluno com agent_notes null nao explode nem casa", () => {
  assert.equal(travadosDe([{ id: "aa11bb22-0000-4000-8000-000000000012", numero: 9012, status: "aguardando_aluno", agent_notes: null }]).length, 0);
});

test("status FINAIS continuam fora, mesmo com marca viva (ignored alem do fixed)", () => {
  assert.equal(travadosDe([{ ...FECHADO, id: "aa11bb22-0000-4000-8000-000000000013", numero: 9013, status: "ignored" }]).length, 0);
});

test("prova de discriminacao do status: o filtro VELHO (open/investigating) perdia o 9010", () => {
  const filtroVelho = (i) => ["open", "investigating"].includes(i.status);
  assert.equal(filtroVelho(AGUARDANDO_MAS_BOLA_DA_CASA), false, "a varredura antiga descartava este cartao");
  assert.equal(travadosDe([AGUARDANDO_MAS_BOLA_DA_CASA]).length, 1, "a nova nao");
});

test("agent_notes null / [] / string / nota sem 'note' nao explode nem casa", () => {
  assert.equal(travadosDe([NOTAS_NULL, NOTAS_VAZIAS, NOTAS_STRING, ULTIMA_SEM_NOTE]).length, 0);
});

test("ordena do mais parado pro mais recente pela data da ultima nota", () => {
  const outro = {
    ...PENDENTE_REAL, id: "aa11bb22-0000-4000-8000-000000000009", numero: 9009,
    agent_notes: [{ by: "frank", at: "2026-09-01T10:00:00Z", note: "precisa assistir o video do aluno" }],
  };
  const t = travadosDe([PENDENTE_REAL, outro]);
  assert.deepEqual(t.map((x) => x.i.numero), [9009, 9001]);
});

// ---------------------------------------------------------------------------
// A semantica VELHA (pilha inteira, como o SQL cru da ordem de 17/09) contra
// os MESMOS casos: ela marca o SUPERADO como pendencia. E por isso que ela
// devolvia 18 e este detector devolvia 2 no mesmo instante de 21/09.
// ---------------------------------------------------------------------------

test("prova de discriminacao: a pilha inteira ERRA nestes mesmos casos", () => {
  const pilhaInteira = (i) => {
    const t = JSON.stringify(i.agent_notes ?? "").toLowerCase();
    return ["humano olhar", "precisa olhar", "nao enxergo", "nao ouco", "assistir", "ouvir"].some((p) => t.includes(p));
  };
  assert.equal(pilhaInteira(SUPERADO), true, "a semantica velha marca historico como pendencia");
  assert.equal(travadosDe([SUPERADO]).length, 0, "a nova nao");
});

test("sanidade das constantes exportadas", () => {
  assert.ok(MARCAS.includes("humano olhar"));
  assert.ok(!MARCAS.includes("alguem olhar"), "saiu em 17/09 (#315): verbo sem artefato");
  assert.equal(BOILERPLATE, "precisa de olho humano, nao de codigo");
  assert.deepEqual(STATUS_VARRIDOS, ["open", "investigating", "aguardando_aluno"], "aguardando_aluno entrou em 21/09; finais ficam fora");
});

// ---------------------------------------------------------------------------
// TERCEIRO DEFEITO (ronda 21/09 ~19hZ): NARRATIVA de percepcao cumprida
// casava como se fosse pedido. Depois dos consertos #390/#392, os 5 cards que
// sobraram eram TODOS falso positivo — a classe real era ZERO e o relatorio
// mentia pra cima. Cada caso abaixo usa o TEXTO REAL da ultima nota do card,
// copiado do banco em 21/09 (sql.cjs, agent_notes -> -1). Se alguem afrouxar
// o anulador de relato ou o descarte de citacao, um destes cinco volta a
// casar e o teste quebra com o nome do card na cara.
// ---------------------------------------------------------------------------

const NOTA_216 = "FRANK, ronda 21/09 ~19hZ — ALUNA RESPONDIDA DEPOIS DE 13 DIAS, E O CARTAO SAI DE aguardando_aluno PORQUE A BOLA E NOSSA.\n\n1. O QUE ESTE CARTAO NAO E MAIS. Ele casou o percepcao_travada.cjs por [olho humano], mas e FALSO POSITIVO: a percepcao JA foi cumprida. A nota [4] (02/09) olhou foto e video (rosto ~10-11% da altura do quadro 480x832) e a nota [7] (vigia, 19/09) baixou o render do R2 (56508a06, 4.001.902 bytes, ffprobe 480x832/45,8s) e despachou pro olho: render INTEGRO, sem defeito de maquina. Ninguem precisa olhar nada de novo. Quem reencontrar este cartao pelo detector: a marca esta na nota de DESPACHO CUMPRIDO, nao num pedido pendente.\n\n2. O QUE ESTAVA REALMENTE ABERTO, e ninguem tinha pego. As objecoes do vigia (notas [5] e [6], 16/09) mediram o que importa e ficaram sem dono: a aluna VOLTOU em 08/09 20:22:12Z no chat do app pedindo 'como cancelo assinatura? nao tem suporte nao me atendem' e NAO teve uma linha de resposta. Reconferido hoje na fonte forte (pasta Enviados, que sobrevive a checkout): UMA carta na historia inteira ate hoje, uid 446 de 02/09, sobre realismo. O pedido de cancelamento dela nunca teve cartao proprio: este aqui, que nasceu sobre realismo do Video Clone, e o unico que ela tem. 13 dias de silencio sobre um pedido de cancelamento de aluna que pagou.\n\n3. DINHEIRO, remedido hoje com pagou_de_verdade.cjs (nao herdado da nota). Avulsa PAGA de R$297 (HP2922120201, Fabrica de Conteudo Invisivel, 26/08) — ela PAGOU, so nao pela assinatura. Assinatura FastCloner rec#1 0 BRL COMPLETE; rec#2 97 BRL OVERDUE, ou seja, cobranca EXISTE mas NAO foi paga (OVERDUE nao e pagamento, armadilha ja registrada na casa). Logo nao ha estorno a fazer hoje; o risco real e retentativa futura, e por isso o cancelamento importa. access_until 30/09.\n\n4. O QUE EU FIZ. Escrevi para ela agora (regra 8: carta individual sobre caso que estou tratando e decisao minha). Enviados uid 3121, chave cancelamento-216-fabiana, registrada em emails_enviados. A carta: assume os 13 dias sem desculpa; explica que o chat do app e robo e que resposta humana so sai por e-mail (ninguem nunca disse isso a ela); diz que a cobranca de R$97 consta NAO PAGA e pede que ela confira o extrato e avise se houver debito; separa a compra de R$297, que continua dela; e resume o achado do realismo (foto de corpo inteiro, rosto ~10%; do peito pra cima o rosto fica 3-4x maior).\n\n5. O QUE EU NAO PROMETI. Nao prometi data de cancelamento e nao afirmei que esta cancelado. Prometi UMA coisa: escrever de novo confirmando quando estiver feito. Essa promessa e divida da casa — quem pegar o cartao honra.\n\n6. POR QUE MUDEI O STATUS. Sai de aguardando_aluno para investigating. O que falta nao depende dela: depende da casa executar o cancelamento no painel. Em aguardando_aluno o cartao fica FORA da contagem de abertos (admin/falhas/page.tsx:81) e some do placar — foi exatamente assim que ele ficou 20 dias parado. O passo que falta e o mesmo dos outros 18 medidos nesta ronda: mao humana no painel da Hotmart. Escalado ao grupo.";
const STATUS_216 = "investigating";
const AT_216 = "2026-09-21T18:47:22.466Z";
const NOTA_406 = "OLHEI AS IMAGENS, UMA POR UMA. NAO HA DEFEITO — E NAO DEI ESTORNO.\n\nO recado dizia 'EU NAO ENXERGO IMAGEM, precisa de olho humano'. Eu enxergo, entao baixei as 4 geracoes do R2 e comparei cada uma com o pedido dela. Resultado, e ele CONTRARIA a queixa:\n 03:36 (960 cr)  pediu EM PE no consultorio com a cadeira ao fundo -> saiu EM PE, consultorio, cadeira ao fundo\n 03:55 (960 cr)  pediu EM PE, calca e camisa social preta          -> saiu EM PE, preto\n 11:34 (525 cr)  pediu SENTADO a mesa com computador               -> saiu SENTADO a mesa com computador\n 11:38 (525 cr)  pediu remover o quadro de dente do fundo          -> o quadro saiu\nAs quatro fizeram o que foi pedido. A queixa 'pediu em pe, saiu sentado' NAO se sustenta nas geracoes que estao na conta dele. Pedi a ele o horario de alguma geracao especifica, caso exista alguma que eu nao vi.\n\nCONFERI TAMBEM A TRADUCAO, porque seria a suspeita obvia: o prompt_en das duas do consultorio diz 'standing'. A intencao sobreviveu a traducao. Nao e bug de pipeline.\n\nACHEI E DESCARTEI UM FALSO POSITIVO MEU: os dois rostos sao visivelmente diferentes entre si, e quase reportei isso como falha de semelhanca. Antes de afirmar, fui ver as REFERENCIAS: sao fotos DIFERENTES, e a da segunda geracao e um arquivo 'Facetune_15-09-2026'. Baixei essa referencia e comparei com a saida — e o MESMO homem, olhos azuis, barba, camisa preta, semelhanca excelente. O sistema copiou fielmente a referencia que recebeu. Rosto diferente entre as duas = ele trocou de foto base, nao defeito nosso. Escrevi isso a ele como orientacao.\n\nO VIDEO CLONE E ONDE ESTA A DOR REAL, e tem causa medida: os 2 videos (bronze 1.320 cr e gold 9.000 cr, ambos 'ready', sem erro) foram gerados a partir daquelas imagens de CORPO INTEIRO, ele em pe e de longe. E exatamente a regua que ja medimos: quadro vertical pequeno + pessoa de corpo inteiro = rosto ocupa fracao minima, a boca fica com poucos pixels e a fala sai artificial. Nao e o rosto dele, e o enquadramento de origem. Orientei: gerar o video a partir de imagem do PEITO PARA CIMA, rosto perto de metade da altura do quadro.\n\nESTORNO: NAO, e aplico a regra #960 sozinho. As geracoes entregaram o que foi pedido e os videos sairam sem falha — nao houve bug, arquivo perdido nem cobranca errada. E 'resultado aquem do esperado' + limite tecnico, que a regra diz expressamente para NAO reembolsar. Escrevi isso a ele com todas as letras, sem inventar justificativa e sem prometer ajuste na plataforma (ordem de nao fazer engenharia pra dor de um cliente so).\nDeixei UMA porta aberta, e ela e barata e justa: se ele refizer com o enquadramento certo e ainda vier ruim, me manda o horario que eu abro; se for defeito nosso, trato como defeito nosso e devolvo.\n\nGASTO DELE ate agora: 13.290 creditos (2.970 em imagem + 10.320 em video), saldo 73.885, acesso ate 22/09. Nao toquei em credito.\n\nARMADILHA QUE EVITEI: a varredura de bounces de hoje tem 'drrodrigoribero7@gmail.com' (SEM o 'i') como inexistente. O e-mail real dele e 'drrodrigoribeiro7@gmail.com', unico em profiles. Conferi antes de enviar; se tivesse copiado do bounce, a resposta nao chegaria.\n\nNAO passei nada pro Vigia: o recado dizia 'se voce ver que o gerador esta ignorando o prompt, isso vira bug'. Eu vi, e ele NAO esta ignorando. Abrir chamado tecnico aqui seria fabricar trabalho em cima de uma hipotese que a medicao derrubou.\n\nE-mail uid 2425, entrega conferida. Status aguardando_aluno: a proxima acao e dele (refazer com o enquadramento, ou me mandar o horario da geracao que ele diz ter saido errada).";
const STATUS_406 = "aguardando_aluno";
const AT_406 = "2026-09-15T12:38:41.700Z";
const NOTA_438 = "FRANK, ronda 21/09 ~13h40-14hZ — A PERNA DO FORMATO SAIU DO PAPEL E ESTA EM PRODUCAO. A PERNA DO DESENHO CONTINUA ABERTA, E E POR ISSO QUE ESTE CARTAO NAO FECHA.\n\n=== 0. O BLOQUEIO DESTE CARTAO ERA FALSO, E ISSO E O ACHADO PRINCIPAL ===\nA nota de 19/09 00:48Z encerrou com \"nao mergeei o #346 (janela de merge segue sendo pergunta aberta ao Johnny)\". Fui ler a regra antes de repetir a frase: a 9-B diz, na tabela, \"Corrigir bug de codigo -> VOCE revisa e mergeia (ver 14-B)\", e a 14-B diz \"o Johnny NAO vai revisar merge (estrada, a partir de 24/08)\". So MIGRATION precisa do aval dele (regra 21), e nenhum dos dois PRs tem DDL.\nOu seja: o conserto passou 3 DIAS esperando uma autorizacao que as regras da casa dizem que nao existe. E exatamente a doenca que a ordem de 17/09 matou pra percepcao (\"precisa de um humano olhar\" nao e estado de parada), aparecendo na forma de merge. Registro como licao, nao como desculpa.\n\n=== 1. ANTES DE MERGEAR, A PROVA QUE FALTAVA: CONTRA O DOMINIO DE PRODUCAO ===\nOs dois PRs declaravam honestamente a propria ressalva: as pernas [2]/[3] tinham batido num next-server LOCAL. Fechei a lacuna. Conta da CASA (suporte@fastcloner.com), nenhum aluno tocado, token FRESCO em cada caminho (a armadilha escrita no cabecalho do modulo: reusar token faz o conserto certo parecer quebrado).\n\n  type=recovery, em https://fastcloner.com\n    [A] action_link ..... 303 -> /auth/callback?next=%2Freset-password#<FRAGMENTO>\n        token na QUERY? NAO\n        callback ........ 307 -> /login?error=missing_code_or_token · Set-Cookie: NAO\n    [B] token_hash ...... 307 -> /reset-password · Set-Cookie de sessao: SIM\n\n  type=magiclink (o do botao do suporte), mesmo dominio\n    [A] action_link ..... 303 -> fragmento -> missing_code_or_token · cookie NAO\n    [B] token_hash ...... 307 -> /app · cookie SIM\n\nO defeito estava VIVO em producao HOJE, no dominio real, nos DOIS tipos. Nao era artefato de ambiente local.\n\n=== 2. O QUE SUBIU ===\nPR #346 (merge 9a999f4f) — o link que vai PRO ALUNO. Modulo novo lib/auth/link-de-acesso.ts + o caminho que carimba o recovery na criacao da conta (sgp-boas-vindas-canal.ts) + o endpoint de admin + as 2 ferramentas CommonJS.\nPR #371 (merge 6a478bc5) — o botao \"Entrar na conta do aluno\". URGENTE por um motivo que ninguem tinha escrito: o #370 pos esse botao em producao, e ate hoje CADA CLIQUE DO SUPORTE QUEIMAVA A CHAVE DE USO UNICO DO ALUNO e jogava o atendente em missing_code_or_token. A casa estava trancando aluno com a propria mao de atendimento.\n\nConferencias antes do merge, nos dois: merge da main dentro do branch LIMPO; testes 9/9, 49/49 e 10/10; tsc --noEmit exit 0 sobre o resultado INTEGRADO (nao sobre o branch solto).\nCONFUNDIDOR QUE EU FUI CHECAR DE PROPOSITO, porque e a cicatriz que mais voltou nesta casa (onedrive-401, fix-image-upload-retry, as 2 da cura de referencia, trava-foto-nova): NENHUM DOS DOIS ESTAVA STALE. A main andou 116 commits desde a base do #346 e 46 desde a do #371, e ZERO desses commits toca QUALQUER um dos 6 arquivos. Nao havia conserto concorrente pra derrubar.\n\n=== 3. PROVA DE QUE ESTA EM PRODUCAO (nao \"deploy verde\", md5 do fonte no servidor) ===\nDeploy Frontend (production): 9a999f4f SUCCESS, 6a478bc5 SUCCESS. Mas verde nao e prova — conferi o FONTE no Hetzner (/mnt/volume/aiverse/frontend) contra origin/main, 4 de 4 md5 IDENTICOS:\n  8e3796d2b44cbd09c9c1f5dda9dc61c0  src/lib/auth/link-de-acesso.ts\n  65db66a61d8e29fd95401bc7831509a9  src/lib/sgp/link-entrada-pure.ts\n  04b94d05ef8bd4148691ac823001d1a9  src/lib/payments/sgp-boas-vindas-canal.ts\n  9576a2ff71d67c85c5a466814613392f  src/app/api/v1/admin/sgp/entrar/route.ts\n\n=== 4. POR QUE ESTE CARTAO NAO VAI PRA FIXED (regra 14 inteira) ===\nO titulo deste cartao e \"A CASA GASTA A UNICA CHAVE DO ALUNO NO INSTANTE EM QUE CRIA A CONTA\". Isso sao DUAS pernas, e so uma caiu:\n  (A) FORMATO — o link nascia morto. CORRIGIDO E NO AR hoje.\n  (B) DESENHO — o recovery segue sendo CARIMBADO na criacao da conta, com 1 hora de validade, pra quem nao pediu. Isso NAO foi tocado por nenhum dos dois PRs.\nDepois do (A), a perna (B) fica NUA: antes, \"aluno nao entrou\" tinha duas explicacoes possiveis e nenhuma medicao separava as duas. Agora o link do PUSH nasce valido, entao o instrumento do item 2 da nota de 19/09 finalmente VALE:\n  token CONSUMIDO e sem login -> ele abriu e quebrou depois (defeito que sobrou)\n  token INTACTO e sem login   -> ele nao abriu a tempo (a JANELA de 1h e a causa)\nMECA ISSO NA COORTE CARIMBADA DEPOIS DE 21/09 14hZ, e so nela — misturar com a coorte velha contamina, porque la o token nao consumia mesmo quando o aluno clicava. E FILTRE recovery_token not like 'pkce_%' (o pkce_ nao e limpo no uso e colhe zero falso — foi o 5o zero falso da casa na semana).\nSe vier majoritariamente INTACTO, o conserto certo e link sob demanda / validade maior, e mais formato nao resolve nada.\n\n=== 5. O QUE EU NAO AFIRMO ===\nNAO afirmo que os 16 que estao fora vao entrar agora. O conserto do formato so vale pra link GERADO DE AGORA EM DIANTE — os links velhos deles continuam mortos, e os de Iran e Walsicleia ja tinham sido mandados no formato certo, na mao, em 18/09, e mesmo assim nao foram consumidos. Ou seja: pros que ja estao trancados, o (A) nao e a cura; a cura deles e carta nova, e e por isso que eu escrevi uma hoje (item 6).\nNAO afirmo que o dominio de producao carrega o codigo novo em RUNTIME — o md5 prova o FONTE entregue e o pm2 recarregou no deploy; nao grepei bundle (falso negativo conhecido, ver a prova de 02/09) nem forcei uma compra de SGP real pra ver a carta nascer certa. A primeira compra de SGP depois das 14hZ e a prova de runtime, e quem pegar a proxima ronda pode conferir a carta dela.\n\n=== 6. UM ALUNO LEVADO ATE O FIM (regra 8, carta individual e minha alcada) ===\niran@ogr.com.br, Iran Ferreira de Moura — o MAIS VELHO dos 16 fora, 14,5 dias, pedido do SGP 'pronto' desde 07/09 e last_sign_in_at NULL.\n⚠️ ACHADO QUE MUDA O CASO: pagou_de_verdade neste endereco da SEM PAGAMENTO, e parar ai teria sido o erro classico. Procurei por NOME, como a propria ferramenta manda: IRAN FERREIRA DE MOURA comprou o Sistema de Geracao Pronto em 16/08 por R$597 (HP2111499193) no endereco iranfmoura@gmail.com, mais 2x R$297 de Fabrica de Conteudo Invisivel. E PAGANTE, R$1.191 no total, trancado do lado de fora do que comprou. E a classe #214/#218 (compra num e-mail, conta em outro).\nNAO vinculei as duas contas — vincular compra a conta e ato humano e esta escrito assim na propria ferramenta. Perguntei a ele qual endereco quer manter.\nConferi recovery_sent_at ANTES de gerar (18/09 23:43Z, morto ha 2 dias): nao apaguei link vivo de ninguem. Link novo montado no formato token_hash, conferido por regex antes de entrar na carta (sem fragmento).\nCarta enviada 13:55Z, tres pernas conferidas: uid 3082 na pasta de enviados + linha em emails_enviados (origem ronda-manual) + chave de dedupe porta-sgp-conserto-438.\nDESENHO DA CARTA, de proposito: o link NAO e o heroi. O caminho principal e PULL — \"responda com a palavra LINK e eu mando outro, a qualquer hora\" — porque e a unica mitigacao que nao depende de o aluno acertar a janela de 1h, e a janela e justamente a perna (B) que continua aberta. A carta diz que o saldo -10.525 (classe #341) nao e divida dele e nao sai do bolso dele, SEM data, porque eu nao tenho data.\n\n=== 7. O QUE EU NAO FIZ ===\nNao mexi em credito, carteira, acesso, entitlement nem plano de ninguem. Nao vinculei conta. Nao gastei GPU. Nao apliquei migration. Nao mandei carta em massa pros outros 15 (e massa, precisa do \"pode\" do Johnny). Nao liguei nem mandei WhatsApp (acao externa). Nao toquei em nada da planilha (ordem de 29/08).\n\n=== 8. OBJECAO QUE EU REGISTRO CONTRA O MEU PROPRIO MERGE ===\nO #346 e o #371 criaram DOIS modulos que fazem a MESMA montagem com contratos diferentes (lib/auth/link-de-acesso.ts estoura; lib/sgp/link-entrada-pure.ts devolve {ok,erro}). Dois lugares pra consertar quando o formato mudar de novo e exatamente como esta cicatriz se espalhou pra 4 arquivos. Mergeei assim mesmo porque unificar antes atrasaria um conserto que estava sangrando chave de aluno hoje, e duplicata correta e melhor que unica errada — mas fica NOMEADO pra consolidacao, e eu prefiro que isso esteja escrito aqui do que descoberto por quem tropecar nele.";
const STATUS_438 = "investigating";
const AT_438 = "2026-09-21T13:55:08.460Z";
const NOTA_450 = "FRANK, ronda 18/09 ~13hZ — DESPACHO DE PERCEPCAO (ordem de 17/09): NAO e caso de percepcao. O percepcao_travada.cjs casou este cartao pelo padrao '%ouvir%', mas o trecho que casou e prosa da minha propria nota anterior ('e exatamente o que ele precisa ouvir'), nao um artefato. Nao ha imagem, audio nem video a examinar: o cartao e analise de dados (telefone x e-mail em payment_events) e ja esta medido. Conferi eu mesmo o trecho casado, nao herdei da ronda anterior. Nao despachei pro olho nem pro qa porque NAO EXISTE ARTEFATO — e este e o bloqueio REAL declarado, na forma que a ordem de 17/09 exige. A classe de percepcao segue em ZERO real. Segunda ronda seguida com falso positivo ocupando a linha do relatorio (na de 12hZ foi o #438, pelo padrao '%precisa olhar%' em cima de uma consulta SQL). NAO apertei o padrao do varredor, de proposito: falso positivo custa 2 minutos de conferencia, falso negativo custou os 16 dias de silencio que originaram a ordem. O varredor ja imprime o trecho casado, e e isso que torna a conferencia barata. O cartao segue investigating pelo seu proprio merito (a proposta de mudar o TEXTO do convite espera decisao), nao por percepcao.";
const STATUS_450 = "investigating";
const AT_450 = "2026-09-18T12:48:44.464Z";
const NOTA_455 = "=== O QUE FOI FEITO ===\nAudio LIBERADO. sgp_pedidos 7269cb2a, audios[0].status: reprovado -> aprovado, 1333s, atualizado_em 2026-09-17 20:28:56Z. Conferido na RELEITURA depois de gravar, 1 linha afetada. Deixei marca de auditoria no campo avisos do proprio audio dizendo que foi liberacao manual e por que — nao quis aprovacao fantasma sem rastro.\nAluno avisado por e-mail, copia confirmada nos enviados uid 2691. Ele NAO tem login (formulario sem conta), entao e-mail era o canal. WhatsApp +5533998109053 fica com a equipe se precisar.\nNAO mexi em credito, nao disparei treino, nao mexi no pedido de mais ninguem.\n\n=== POR QUE EU LIBEREI (nao foi no chute) ===\nEu NAO ouco audio. Entao provei por dois caminhos independentes, os dois em cima do arquivo real baixado do R2 (22 MB, 1333s):\n1. F0 ao longo dos 22 min, autocorrelacao, 901 quadros amostrados, 244 vozeados: distribuicao UNIMODAL e continua. Mediana 148 Hz, p10 99, p25 133, p75 170, p90 190. Histograma decresce suave depois do pico (11%/35%/24%/16%/13%/2%) — NAO ha segundo modo nem vale. Duas pessoas de generos diferentes apareceriam como dois picos separados.\n2. Transcricao (Whisper) de 2 amostras de 75s, distantes 700s uma da outra. Nas DUAS o mesmo locutor se identifica: \"Doutor Diego falando\".\nRessalva honesta: F0 nao distingue duas pessoas do MESMO genero e autocorrelacao tem erro de oitava. E evidencia forte somada a transcricao, nao prova matematica.\n\n=== A CAUSA DO FALSO POSITIVO, com o texto na mao ===\nEle e cirurgiao e grava mensagens INDIVIDUAIS pra cada paciente, em sequencia: \"Oi, Terezinha, tudo bem? Doutor Diego falando...\" ... \"Tchau, tchau.\" ... \"Oi, Onisse, tudo bem? Doutor Diego falando...\". Mais perguntas retoricas o tempo todo (\"nao e isso?\", \"percebe?\", \"ta bom?\").\nmedir-audio.ts:89-91 transcreve 2 amostras e pergunta a um LLM se aquilo e CONVERSA. Lido so como TEXTO, isso e um dialogo. E um homem so falando com a camera.\nO relato dele de que o mesmo arquivo ja tinha sido aceito antes esta CORRETO e e consequencia direta: juiz LLM nao-deterministico sobre 2 amostras.\n\n=== O GATE NAO DEVE SER REMOVIDO ===\nRegistro pra ninguem \"consertar\" isso apagando a trava: ela existe por incidente medido (5c3f1f8b / #65, cabecalho de retirar_amostra.cjs). La um arquivo com duas pessoas passou, o treino completou e a referencia pegou a ENTREVISTADORA — o aluno recebeu clone com voz de outra pessoa (F0 197,5 Hz, 91,6% em faixa feminina). O errado e o METODO (juiz de texto, chute unico, sem registro), nao a intencao.\nCartao aberto pro coder: gravar veredito+trecho, exigir mais de uma concordancia antes de BARRAR, e avaliar F0 como arbitro deterministico.\n\n=== CLASSE ===\nMedido na base inteira: 1 pedido / 1 pessoa barrados por este motivo. n=1. Mas o funil nao mostra quem desistiu calado antes de escalar.\n\n=== ALERTA DE DADO SENSIVEL (levado ao grupo) ===\nO arquivo de treino dele contem consultas medicas com NOMES DE PACIENTES e detalhes clinicos, e esta guardado no nosso R2. Nao e bloqueio e a escolha e dele, mas ofereci por e-mail trocar por material sem dado de paciente.";
const STATUS_455 = "aguardando_aluno";
const AT_455 = "2026-09-17T20:30:17.931Z";
const NOTA_310_EXECUTOR = "EXECUTOR 09/09 14:30Z (ocorrencia 2, 14:08Z): o assunto MUDOU — agora a aluna pede fala + gesto (aceno) simultaneos no MESMO video do Video Clone. Nao ouco nem enxergo e nao medi o pipeline: trato como pedido de ORIENTACAO, nao como defeito, e nao afirmo o que o produto suporta. O assunto ANTERIOR (imagem 'preta' de 08/09, 525cr) esta resolvido NO CARD mas NAO PARA ELA: Frank provou em 09/09 01:09Z que o arquivo esta integro (result.png 941x1672, 1.902.552 bytes, status ready, error NULL) — falhou a TELA, nao a geracao — e definiu como proximo passo escrever pra ela antes de qualquer estorno; nao ha registro de e-mail enviado desde entao. Ela e pagante de 08/09 (100.000 cr) e seguiu usando, nao esta travada. PLANO: UM unico e-mail para thallitamachado@hotmail.com cobrindo as duas coisas — (a) anexar a imagem de 08/09 e perguntar o que ela viu na tela, so depois decidir credito (NAO estornar cego), (b) responder a duvida de gesto+fala no Video Clone. Ela esta no chat do app, que nao tem resposta humana.";

const REAL = (numero, status, at, note) => ({
  id: "bb22cc33-0000-4000-8000-" + String(numero).padStart(12, "0"),
  numero, status,
  agent_notes: [{ by: "frank", at, note }],
});

test("#450 real: 'NAO e caso de percepcao' + marca so em citacao NAO casa", () => {
  assert.equal(travadosDe([REAL(450, STATUS_450, AT_450, NOTA_450)]).length, 0);
});

test("#406 real: 'OLHEI AS IMAGENS, UMA POR UMA' e relato cumprido, NAO casa", () => {
  assert.equal(travadosDe([REAL(406, STATUS_406, AT_406, NOTA_406)]).length, 0);
});

test("#455 real: 'O QUE FOI FEITO / Audio LIBERADO' e relato cumprido, NAO casa", () => {
  assert.equal(travadosDe([REAL(455, STATUS_455, AT_455, NOTA_455)]).length, 0);
});

test("#216 real: 'percepcao JA foi cumprida / FALSO POSITIVO' NAO casa", () => {
  assert.equal(travadosDe([REAL(216, STATUS_216, AT_216, NOTA_216)]).length, 0);
});

test("#438 real: frase da ordem CITADA entre aspas NAO casa (citacao nao e pedido)", () => {
  assert.equal(travadosDe([REAL(438, STATUS_438, AT_438, NOTA_438)]).length, 0);
});

test("CONTROLE #310 real: a nota do EXECUTOR de 09/09 ('Nao ouco nem enxergo') CONTINUA casando", () => {
  const t = travadosDe([REAL(310, "investigating", "2026-09-09T14:26:13.041Z", NOTA_310_EXECUTOR)]);
  assert.equal(t.length, 1, "o anulador de relato NAO pode cegar o detector pra pedido de verdade");
  assert.equal(t[0].marca, "nao ouco");
});

// O anulador em si, nas beiradas que quase o fariam morder o proprio rabo:

test("anulador: 'assisti' com word boundary NAO anula 'precisa assistir' (pedido de verdade)", () => {
  assert.equal(marcaDe("precisa assistir o video da aluna antes de decidir"), "precisa assistir");
});

test("anulador: 'ouvi' NAO casa dentro de 'precisa ouvir o audio'", () => {
  assert.equal(marcaDe("precisa ouvir o audio da geracao"), "precisa ouvir");
});

test("anulador: relato em primeira pessoa anula a marca da mesma nota", () => {
  assert.equal(marcaDe("olhei a imagem do R2: sem defeito. A marca nao vejo era da ronda anterior"), null);
  assert.equal(marcaDe("assisti o video inteiro, mas a queixa cita ver a imagem tambem"), null);
  assert.equal(marcaDe("ouvi as duas amostras e conferi: nao ouco defeito nenhum"), null);
});

test("citacao: marca entre aspas ou colchetes nao e pedido", () => {
  assert.equal(marcaDe('o recado dizia "precisa de um humano olhar a imagem" e ja foi atendido em outro card'), null);
  assert.equal(marcaDe("o detector casou este card por [olho humano] indevidamente"), null);
});

test("citacao: 'olhei' CITADO de terceiro nao anula pedido verdadeiro da mesma nota", () => {
  assert.equal(marcaDe('a aluna respondeu "olhei e nao gostei"; agora falta um humano olhar a imagem contra a referencia'), "humano olhar");
});

test("citacao: apostrofe solta nao engole pedido (span limitado, sem quebra de linha)", () => {
  assert.equal(marcaDe("copia d'agua no nome do arquivo\nfalta um humano olhar a imagem do R2"), "humano olhar");
});

test("sanidade: CUMPRIMENTOS exportado cobre relato e falso positivo declarado", () => {
  assert.ok(Array.isArray(CUMPRIMENTOS) && CUMPRIMENTOS.length >= 5);
  assert.ok(CUMPRIMENTOS.some((c) => c.test("falso positivo")));
  assert.ok(CUMPRIMENTOS.some((c) => c.test("nao e caso de percepcao")));
});
