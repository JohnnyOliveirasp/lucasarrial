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
