/**
 * GUARDA do seletor de "Reels de teste" no publicador.
 *
 * Não renderiza React — lê o FONTE e os arquivos de tradução de verdade.
 * Protege as duas coisas que quebram calado neste recurso:
 *
 *  1. CHAVE DE TRADUÇÃO FALTANDO EM UM IDIOMA. A tela só quebra pra quem usa
 *     aquele idioma, então passa despercebido em teste manual feito em pt-BR.
 *     Aqui os três idiomas são exigidos com as MESMAS chaves.
 *
 *  2. A TRAVA `podeTrial` SUMIR. Sem ela, o checkbox marcado sobrevive à troca
 *     da mídia e manda `is_trial` numa IMAGEM; a API recusa com erro de
 *     validação e o aluno leva a culpa por uma escolha que a tela não mostrava
 *     mais. É o tipo de defeito que só aparece na mão do usuário.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(import.meta.dirname, "..", "..", "..");
const FONTE = readFileSync(join(RAIZ, "src/components/lab/social-publisher.tsx"), "utf8");

const IDIOMAS = ["pt-BR", "en", "es"];
const CHAVES = ["label", "help", "strategy", "onlyReel"];
const ESTRATEGIAS = ["MANUAL", "SS_PERFORMANCE"];

function bloco(locale: string): Record<string, unknown> {
  const j = JSON.parse(readFileSync(join(RAIZ, `messages/${locale}.json`), "utf8"));
  return j?.social?.trial ?? {};
}

test("os 3 idiomas têm o bloco social.trial com as mesmas chaves", () => {
  for (const loc of IDIOMAS) {
    const b = bloco(loc);
    for (const k of CHAVES) {
      assert.equal(typeof b[k], "string", `${loc}: falta social.trial.${k}`);
      assert.ok((b[k] as string).trim().length > 0, `${loc}: social.trial.${k} está vazio`);
    }
  }
});

test("as duas estratégias têm rótulo nos 3 idiomas", () => {
  for (const loc of IDIOMAS) {
    const s = (bloco(loc).strategies ?? {}) as Record<string, string>;
    for (const e of ESTRATEGIAS) {
      assert.equal(typeof s[e], "string", `${loc}: falta social.trial.strategies.${e}`);
    }
  }
});

test("o texto de ajuda explica que o Reels vai para quem NÃO segue", () => {
  // Sem isto o aluno marca uma caixa que não entende. O recurso só faz sentido
  // se a tela disser o que ele faz com o alcance do vídeo.
  const ajudas: Record<string, RegExp> = {
    "pt-BR": /n[ãa]o te segue/i,
    en: /do not follow you/i,
    es: /no te siguen/i,
  };
  for (const [loc, re] of Object.entries(ajudas)) {
    assert.match(String(bloco(loc).help), re, `${loc}: a ajuda não explica o alcance`);
  }
});

test("podeTrial exige reel E não-tiktok", () => {
  const m = FONTE.match(/const\s+podeTrial\s*=\s*([^;]+);/);
  assert.ok(m, "a trava podeTrial sumiu do componente");
  const expr = m![1];
  assert.match(expr, /!isTiktok/, "podeTrial não exclui o TikTok");
  assert.match(expr, /mediaType\s*===\s*"reel"/, "podeTrial não exige que a mídia seja reel");
});

test("o payload só manda is_trial atrás de podeTrial, nunca do checkbox sozinho", () => {
  const i = FONTE.indexOf("is_trial: true");
  assert.ok(i > 0, "o componente não manda mais is_trial");
  // a condição que guarda esse ramo tem que citar podeTrial, não só igTrial
  const antes = FONTE.slice(Math.max(0, i - 260), i);
  assert.match(antes, /podeTrial\s*&&\s*igTrial/, "is_trial não está atrás de podeTrial && igTrial");
});

test("publicar limpa a escolha de teste (não gruda na próxima publicação)", () => {
  const i = FONTE.indexOf('setCaptionIdea("")');
  assert.ok(i > 0, "o bloco de reset sumiu");
  const depois = FONTE.slice(i, i + 400);
  assert.match(depois, /setIgTrial\(false\)/, "publicar não desmarca Reels de teste");
});
