/**
 * Testes do manual da Fast. Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/agent/manual.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE (#215, reincidência do #e05561c5):
 * o manual inteiro vai no system prompt da Fast. Enquanto ele descreveu
 * "grava a própria voz no gravador guiado do navegador (recomendado) ou envia
 * áudios" como UMA coisa só, a Fast fundiu duas telas diferentes e mandou
 * DUAS alunas, em 3 dias, apertar um botão de gravar que não existe em
 * /app/voice-cloning/new. A segunda (Lucila, 01/09) perguntou quatro vezes
 * seguidas onde apertava, ouviu quatro vezes a mesma instrução impossível, e
 * desistiu com 100.000 créditos parados e 0 vozes.
 *
 * A separação das duas telas não é preferência de redação: é o conserto. Se
 * alguém reescrever essa seção e reencostar as duas de novo, este teste cai
 * ANTES de chegar em aluno.
 *
 * A REALIDADE MEDIDA no código em 01/09, que é o que as asserções protegem:
 *   - /app/voice-cloning/script → ScriptReader + RecorderWithPhone, a ÚNICA
 *     tela que grava. Chega nela pelo item "Gravador" do menu Vozes
 *     (sidebar.tsx:150 → nav.recorder → "Gravador" em pt-BR.json).
 *   - /app/voice-cloning/new → VoiceCreator: só dropzone de arquivos e o
 *     botão "Treinar voz". O único <Mic> ali é ícone decorativo.
 *   - o menu Vozes NÃO tem item "Treinar Voz" — os itens são Gerar Voz,
 *     Gerar Áudio, Gravador e Histórico. "Treinar Voz" é o h1 de Gerar Voz.
 *
 * NOTA DE EXECUÇÃO: manual.ts importa por alias ("@/lib/video-clone/config"),
 * que o runner nativo do Node não resolve sem loader. Por isso o teste lê o
 * FONTE em vez de importar o módulo — o trecho protegido é texto literal,
 * sem interpolação, então ler o fonte mede exatamente o que vai pro prompt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const FONTE = readFileSync(
  fileURLToPath(new URL("./manual.ts", import.meta.url)),
  "utf8",
);

/** A seção de treino de voz, isolada do resto do manual. */
function secaoDeTreino(): string {
  const inicio = FONTE.indexOf("### Vozes → clonar a própria voz");
  assert.notEqual(
    inicio,
    -1,
    "a seção de clonagem de voz sumiu ou foi renomeada — se renomear de propósito, ajuste este teste junto",
  );
  const fim = FONTE.indexOf("### Vozes → Gerar Áudio", inicio);
  assert.notEqual(fim, -1, "a seção seguinte (Gerar Áudio) sumiu");
  return FONTE.slice(inicio, fim);
}

test("o manual dá o caminho da tela que realmente grava", () => {
  const secao = secaoDeTreino();
  assert.match(
    secao,
    /\/app\/voice-cloning\/script/,
    "sem o endereço do gravador a Fast não tem pra onde mandar o aluno",
  );
  assert.match(
    secao,
    /menu Vozes → \*\*Gravador\*\*|Vozes → "Gravador"/,
    "o aluno navega por NOME DE MENU, não por URL — o nome do item tem que estar lá",
  );
});

test("o manual diz, com todas as letras, que /new não grava", () => {
  const secao = secaoDeTreino();
  assert.match(secao, /\/app\/voice-cloning\/new/);
  assert.match(
    secao,
    /NÃO EXISTE BOTÃO DE GRAVAR NESTA TELA/,
    "é esta frase que impede a Fast de inventar um botão de gravar em /new",
  );
});

test("o manual proíbe nominalmente as duas respostas que queimaram as alunas", () => {
  const secao = secaoDeTreino();
  // A Fast afirmou "você já está na tela certa" mesmo lendo o pathname /new.
  assert.match(secao, /já está na tela certa/);
  // E mandou clicar em "Iniciar gravação" / no ícone de microfone.
  assert.match(secao, /Iniciar\s+gravação/);
  assert.match(secao, /ícone de microfone/);
});

test("o manual não manda clicar num item de menu que não existe", () => {
  const secao = secaoDeTreino();
  assert.doesNotMatch(
    secao,
    /menu Vozes → Treinar Voz/,
    'não existe item "Treinar Voz" no menu Vozes — é o título da página Gerar Voz',
  );
});

test("gravar e enviar arquivo não voltam pra mesma frase", () => {
  // A frase original do bug colava as duas telas com um "ou":
  // "grava a própria voz no gravador guiado do navegador ... ou envia áudios".
  for (const linha of secaoDeTreino().split("\n")) {
    // As linhas que PROÍBEM a fusão citam as duas coisas de propósito.
    if (linha.includes("🚫")) continue;
    const grava = /\bgrava(r|\b)/i.test(linha);
    const envia = /\benvia(r)?\s+(áudios|arquivos)/i.test(linha);
    assert.ok(
      !(grava && envia),
      `esta linha funde gravar e enviar arquivo de novo, que foi a causa do #215: ${linha.trim()}`,
    );
  }
});

/** A seção de créditos, isolada do resto do manual. */
function secaoDeCreditos(): string {
  const inicio = FONTE.indexOf("## Créditos (moeda da plataforma)");
  assert.notEqual(
    inicio,
    -1,
    "a seção de créditos sumiu ou foi renomeada — se renomear de propósito, ajuste este teste junto",
  );
  const fim = FONTE.indexOf("## Ferramentas e preços", inicio);
  assert.notEqual(fim, -1, "a seção seguinte (Ferramentas e preços) sumiu");
  return FONTE.slice(inicio, fim);
}

test("o manual não promete estorno automático em toda falha", () => {
  // 04/09, chamado 47: a Fast escreveu a uma aluna PAGANTE "seus créditos já
  // foram estornados automaticamente (tanto da primeira quanto dessa segunda
  // tentativa)". O extrato dela não tinha NENHUMA transação no período — a
  // geração fora por conta da casa, então não houve débito e não havia o que
  // estornar. A frase saiu do manual, que dizia "Falha TÉCNICA em qualquer
  // ferramenta → os créditos são estornados AUTOMATICAMENTE": uma regra
  // categórica que o código não cumpre (support/failure-alert.ts:88 devolve
  // "nada cobrado", :107 devolve "ESTORNO FALHOU" e :321 devolve "sem estorno
  // automático configurado pra esta operação").
  const secao = secaoDeCreditos();
  assert.doesNotMatch(
    secao,
    /qualquer ferramenta[^.]*estornad/i,
    "o manual voltou a prometer estorno em QUALQUER ferramenta — o código tem três saídas em que ele não sai",
  );
  assert.match(
    secao,
    /NUNCA afirme[\s\S]{0,120}estorno[\s\S]{0,200}extrato/i,
    "sumiu a proibição de afirmar estorno sem ver a linha no extrato da pessoa",
  );
});

test("a seção vai inteira pro system prompt da Fast", () => {
  // buildAgentSystem() é o que a brain.ts manda pro modelo. Se ele parar de
  // interpolar o manual, o conserto acima não chega na Fast.
  const corpo = FONTE.slice(FONTE.indexOf("export function buildAgentSystem"));
  assert.match(
    corpo,
    /\$\{PLATFORM_MANUAL\}/,
    "buildAgentSystem parou de embutir o PLATFORM_MANUAL",
  );
});

test("a data de hoje vai junto no system prompt (#323)", () => {
  // A Fast repetiu a uma aluna "no dia 07 eu te mando o update" NO DIA 09,
  // porque o system prompt inteiro não dizia em lugar nenhum que dia era hoje.
  // As asserções do CONTEÚDO do bloco estão em hoje.test.ts (que chama a função
  // com relógio fixo); aqui se guarda só o que aquele teste não alcança — que o
  // bloco continua sendo INTERPOLADO no prompt que a brain.ts manda pro modelo.
  const corpo = FONTE.slice(FONTE.indexOf("export function buildAgentSystem"));
  assert.match(
    corpo,
    /\$\{blocoHoje\(agora\)\}/,
    "buildAgentSystem parou de embutir a data de hoje — a Fast volta a ficar cega pro calendário",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * #392 / #270 (15/09) — o Gerador de Imagem.
 *
 * O buraco: o manual dizia só "envia uma foto de referência" e parava. A Fast
 * preencheu o resto sozinha e preencheu AO CONTRÁRIO, duas vezes em 3 dias,
 * com pagante na frente: "não edita fotos que você já tem" (12/09, #270) e "a
 * foto é só pra inspirar" (14/09, #392).
 *
 * ⚠️ POR QUE ESTES TESTES LEEM O pt-BR.json E A ROTA, e não só o manual.
 * A 1ª versão deles casava `/até 15 fotos/` e `/Escolher em Imagens de
 * Referência/` só contra o próprio `manual.ts`. A revisão adversarial provou
 * por mutação que isso é tautologia: renomeando o botão no `pt-BR.json` e
 * baixando `MAX_REFERENCE_IMAGES` de 15 pra 8, os 13 testes seguiam VERDES. O
 * manual repetia a si mesmo e nada o prendia à realidade. Agora o número vem
 * da ROTA e os nomes de botão vêm da UI — se a tela mudar e o manual não, cai
 * aqui, que é o único lugar onde ainda dá pra consertar de graça.
 * ──────────────────────────────────────────────────────────────────────────── */

const PT_BR = readFileSync(
  fileURLToPath(new URL("../../../messages/pt-BR.json", import.meta.url)),
  "utf8",
);
const ROTA_IMAGENS = readFileSync(
  fileURLToPath(new URL("../../app/api/v1/images/generate/route.ts", import.meta.url)),
  "utf8",
);

/** Lê um rótulo da UI pelo nome da chave, pra comparar com o que o manual diz. */
function rotuloDaUI(chave: string): string {
  const m = PT_BR.match(new RegExp(`"${chave}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  assert.ok(m, `a chave "${chave}" sumiu do pt-BR.json — a UI mudou e o manual não sabe`);
  return JSON.parse(`"${m![1]}"`);
}

/** A seção do Gerador de Imagem, isolada do resto do manual. */
function secaoDoGerador(): string {
  const inicio = FONTE.indexOf("### Imagens → Gerador de Imagem");
  assert.notEqual(
    inicio,
    -1,
    "a seção do Gerador de Imagem sumiu ou foi renomeada — se renomear de propósito, ajuste este teste junto",
  );
  const fim = FONTE.indexOf("### Imagens → Animar imagem", inicio);
  assert.notEqual(fim, -1, "a seção seguinte (Animar imagem) sumiu");
  return FONTE.slice(inicio, fim);
}

test("o manual diz que o Gerador é imagem→imagem e que a foto enviada é a BASE (#392)", () => {
  const secao = secaoDoGerador();
  assert.match(
    secao,
    /IMAGEM → IMAGEM/,
    "sem dizer que é imagem→imagem, a Fast volta a tratar o Gerador como texto→imagem",
  );
  assert.match(
    secao,
    /é a BASE/,
    "a frase que separa 'base' de 'inspiração' é o conserto — é ela que responde a pergunta do aluno",
  );
  // E o fato tem que continuar VERDADE na rota, senão o manual vira mentira nova.
  assert.match(
    ROTA_IMAGENS,
    /image-to-image/,
    "a rota deixou de ser image-to-image: o manual agora está errado e precisa mudar junto",
  );
});

test("o manual PROÍBE nominalmente as três frases que queimaram os dois alunos (#270, #392)", () => {
  const secao = secaoDoGerador();
  assert.match(secao, /NUNCA diga/, "o guard sumiu");
  for (const frase of [/cria do zero/, /não edita fotos que você já/, /só pra inspirar/]) {
    assert.match(
      secao,
      frase,
      `a proibição de ${frase} saiu do manual — foi uma destas frases que a Fast disse a um pagante`,
    );
  }
});

test("o teto de fotos do manual é o MESMO da rota que recusa a geração (#392)", () => {
  const m = ROTA_IMAGENS.match(/MAX_REFERENCE_IMAGES\s*=\s*(\d+)/);
  assert.ok(m, "MAX_REFERENCE_IMAGES sumiu da rota");
  assert.match(
    secaoDoGerador(),
    new RegExp(`até ${m![1]} fotos`),
    `a rota recusa acima de ${m![1]} fotos e o manual promete outro número — a Fast autoriza o que o servidor rejeita`,
  );
  // O peso é o teto que a CONTAGEM sozinha não pega: foi o #199 (aluno cobrado
  // e estornado 3x com 14 fotos / 340 MB).
  assert.ok(
    /MAX_REFERENCE_BYTES\s*=\s*150\s*\*/.test(ROTA_IMAGENS),
    "o teto de peso mudou na rota — ajuste os 150 MB do manual junto",
  );
  assert.match(secaoDoGerador(), /150 MB/, "sem o teto de peso a Fast autoriza o payload do #199");
});

test("o manual nomeia os DOIS botões do caminho das extras, com o nome que está na tela (#392)", () => {
  const secao = secaoDoGerador();
  // "Escolher em Imagens de Referência" só ROLA até a aba; quem adiciona de
  // verdade é "Adicionar como extra", em cada foto. Parar no primeiro botão é o
  // #e6c53db1: o aluno clica no botão óbvio e nada visível acontece.
  // O manual é texto quebrado em ~76 colunas, então o rótulo da UI pode estar
  // partido no meio por uma quebra de linha + recuo. Comparar cru dá falso
  // NEGATIVO (foi o que aconteceu na 1ª rodada deste teste): normaliza os dois.
  const semQuebra = secao.replace(/\s+/g, " ");
  for (const chave of ["extrasPick", "addExtra", "extrasLabel"]) {
    const rotulo = rotuloDaUI(chave).replace(/\s+/g, " ");
    assert.ok(
      semQuebra.includes(rotulo),
      `o manual não usa o texto exato de "${chave}" ("${rotulo}") — o aluno procura na tela pelo nome, não pela ideia`,
    );
  }
  assert.match(
    secao,
    /só\s+LEVA até a aba/,
    "sem dizer que o primeiro botão só navega, o manual manda o aluno parar no meio do caminho",
  );
});

test("o manual não repete o falso negativo do #392 sobre a foto do quadro principal", () => {
  const secao = secaoDoGerador();
  // image-studio.tsx: `if (!fixedRef && primeira) persistFixedRef(primeira)` —
  // com o quadro VAZIO a primeira foto subida VIRA a principal e ENTRA na
  // geração. Dizer, sem essa ressalva, que "subir foto no quadro só salva" é o
  // mesmo defeito que este PR conserta, virado do avesso.
  assert.match(
    secao,
    /se ele está VAZIO, a primeira foto que o aluno subir\s*\n?\s*vira a principal/,
    "voltou a afirmar que a foto do quadro não entra na geração — falso quando o quadro está vazio",
  );
  assert.match(
    secao,
    /Não diga a ninguém que a foto do quadro não é usada/,
    "o guard explícito contra o falso negativo sumiu",
  );
});

test("o manual manda dizer no prompt o que vem de cada foto, e reler o prompt automático (#270)", () => {
  const secao = secaoDoGerador();
  assert.match(
    secao,
    /DIZER NO PROMPT o\s*\n?\s*que vem de cada foto/,
    "é a única orientação que faz a atribuição por foto funcionar — sem ela a IA monta cenário genérico",
  );
  assert.match(
    secao,
    /EDITÁVEL e é o texto final/,
    "o aluno acha que a IA obedece a ideia que ele digitou; ela obedece o prompt gerado",
  );
});

test("o manual NÃO afirma o que existe dentro das fotos extras (#270, a armadilha 117× maior)", () => {
  // O PR #297 mediu: 2.583 de 2.626 gerações com 2+ fotos (98%, 792 alunos) NÃO
  // atribuem nada às extras — a moda é lote de selfie. Afirmar que as extras
  // trazem cenário/objeto/logo faria a Fast mandar 792 alunos inventarem móvel.
  //
  // A 1ª versão deste teste só checava a PRESENÇA da ressalva, e a revisão
  // adversarial provou que dava pra inserir "as extras SEMPRE carregam um
  // cenário" mantendo a ressalva e os 13 testes seguiam verdes. Agora o teste
  // proíbe a forma afirmativa, que é o que o nome dele sempre prometeu.
  const secao = secaoDoGerador();
  assert.match(
    secao,
    /Não afirme qual dos dois é/,
    "sem esta ressalva o manual repete, do lado da Fast, o defeito ao contrário que o PR #297 evitou",
  );
  for (const afirmativa of [
    /extras?\s+(sempre|carregam|trazem|têm|contêm)/i,
    /as extras são o cenário/i,
  ]) {
    assert.doesNotMatch(
      secao,
      afirmativa,
      `o manual passou a AFIRMAR o conteúdo das extras (${afirmativa}) — é o defeito do #270 ao contrário, e 117× maior`,
    );
  }
  // E não empurre atribuição pra quem não pediu: é o caso de 98%.
  assert.match(
    secao,
    /Não empurre atribuição pra quem não pediu/,
    "o guard que protege os 98% que só mandam selfie sumiu",
  );
});

test("o manual manda PERGUNTAR em vez de deduzir se a foto entrou, e cita o aviso que a tela dá (#392)", () => {
  const secao = secaoDoGerador();
  // O defeito do #392 é a Fast AFIRMAR sobre uma tela que ela não vê. O item
  // anterior descreve dois caminhos com resultados opostos; sem este guard, a
  // Fast escolhe um dos dois por dedução e acerta metade das vezes.
  assert.match(
    secao,
    /VOCÊ NÃO VÊ A TELA DELE/,
    "o guard que proíbe deduzir o estado da tela sumiu — é o defeito do #392 pela raiz",
  );
  assert.match(
    secao,
    /não DEDUZA se a foto que ele subiu entrou ou não: PERGUNTE/,
    "sem mandar PERGUNTAR, dizer 'você não vê a tela' não vira ação nenhuma",
  );
  // ⚠️ ANCORAGEM: a frase que o manual manda o aluno procurar tem que ser a
  // frase que a UI realmente escreve. Se `usingNow` for reescrita no pt-BR.json
  // e o manual não, a Fast manda o aluno procurar um texto que não existe —
  // que é inventar tela, exatamente o que este PR conserta.
  const usingNow = rotuloDaUI("usingNow");
  const trecho = "Nesta geração entram a foto principal do quadro e";
  assert.ok(
    usingNow.includes(trecho),
    `a UI mudou o texto de "usingNow" — o manual cita "${trecho}", que não está mais lá; ajuste os dois juntos`,
  );
  assert.ok(
    secao.replace(/\s+/g, " ").includes(trecho),
    "o manual parou de citar o aviso real da tela — sem ele o aluno não sabe onde olhar",
  );
});
