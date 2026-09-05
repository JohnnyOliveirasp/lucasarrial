/**
 * `node --test src/i18n/chaves.test.ts`
 *
 * O que este teste protege: toda chave pedida por `useTranslations` no código
 * tem que EXISTIR nos três idiomas. Se não existir, o next-intl não avisa em
 * build nem em lint — ele explode em RUNTIME, na cara do aluno, com
 * `MISSING_MESSAGE`, e o componente inteiro deixa de renderizar.
 *
 * Caso que originou o teste: o commit eb55f4f criou o hambúrguer do menu
 * mobile em `topbar.tsx` chamando `useTranslations("shell.topbar")` +
 * `t("openMenu")`, mas gravou a chave em `shell.sidebar.openMenu`. A chave
 * existia no JSON (um grep por "openMenu" achava), só que no CAMINHO errado —
 * então o grep dava falso positivo e o defeito passou. Resultado: ~214 erros
 * em produção num único dia, justamente no botão que dá navegação ao aluno de
 * celular (o bug que aquele commit tentava consertar).
 *
 * Por que varrer o código em vez de comparar os JSONs entre si: os três
 * idiomas estavam CONSISTENTES entre si (todos tinham a chave no lugar
 * errado). Só a confrontação código × JSON pega esse caso.
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_SRC = join(AQUI, "..");
const DIR_MENSAGENS = join(AQUI, "..", "..", "messages");

type Dicionario = Record<string, unknown>;

/** Lê `pt-BR.json`, `en.json`, ... e devolve { locale: conteúdo }. */
function carregarIdiomas(): Record<string, Dicionario> {
  const idiomas: Record<string, Dicionario> = {};
  for (const arquivo of readdirSync(DIR_MENSAGENS)) {
    if (!arquivo.endsWith(".json")) continue;
    const locale = arquivo.slice(0, -".json".length);
    idiomas[locale] = JSON.parse(readFileSync(join(DIR_MENSAGENS, arquivo), "utf8"));
  }
  return idiomas;
}

/** Resolve "shell.topbar.openMenu" dentro do dicionário. `undefined` = não existe. */
function resolver(dic: Dicionario, caminho: string): unknown {
  let atual: unknown = dic;
  for (const parte of caminho.split(".")) {
    if (typeof atual !== "object" || atual === null || !(parte in atual)) return undefined;
    atual = (atual as Dicionario)[parte];
  }
  return atual;
}

/** Todos os .ts/.tsx sob src/, menos os próprios testes. */
function listarFontes(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === "node_modules" || nome.startsWith(".")) continue;
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      listarFontes(caminho, saida);
    } else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) {
      saida.push(caminho);
    }
  }
  return saida;
}

/** `const t = useTranslations("ns")` — só namespace literal. */
const RE_DECL = /const\s+(\w+)\s*=\s*useTranslations\(\s*["']([^"']+)["']\s*\)/g;

type Uso = { arquivo: string; linha: number; caminho: string };

/**
 * Casa `t("chave")`, `t.rich("chave")` e `t.raw("chave")` para uma variável
 * declarada. Resolve o namespace pela declaração MAIS PRÓXIMA ACIMA da
 * chamada: um mesmo arquivo pode ter vários componentes, cada um com seu `t`
 * apontando para namespace diferente (é o caso de `passo-editar.tsx`, com três
 * `const t` distintos). Ignorar isso gera falso positivo em massa.
 */
function coletarUsos(arquivo: string, fonte: string): Uso[] {
  const decls = [...fonte.matchAll(RE_DECL)].map((m) => ({
    pos: m.index ?? 0,
    nome: m[1],
    namespace: m[2],
  }));
  if (decls.length === 0) return [];

  const usos: Uso[] = [];
  for (const nome of new Set(decls.map((d) => d.nome))) {
    const reUso = new RegExp(`\\b${nome}(?:\\.rich|\\.raw)?\\(\\s*["']([^"']+)["']\\s*[,)]`, "g");
    for (const m of fonte.matchAll(reUso)) {
      const pos = m.index ?? 0;
      const anteriores = decls.filter((d) => d.nome === nome && d.pos < pos);
      if (anteriores.length === 0) continue; // usado antes de declarar: não é o nosso t
      const namespace = anteriores[anteriores.length - 1].namespace;
      usos.push({
        arquivo,
        linha: fonte.slice(0, pos).split("\n").length,
        caminho: `${namespace}.${m[1]}`,
      });
    }
  }
  return usos;
}

test("toda chave de useTranslations existe nos três idiomas", () => {
  const idiomas = carregarIdiomas();
  const locales = Object.keys(idiomas);
  assert.ok(locales.length >= 3, `esperava >= 3 idiomas, achei: ${locales.join(", ")}`);

  const faltando: string[] = [];
  let totalVerificado = 0;

  for (const arquivo of listarFontes(RAIZ_SRC)) {
    const fonte = readFileSync(arquivo, "utf8");
    if (!fonte.includes("useTranslations")) continue;
    for (const uso of coletarUsos(arquivo, fonte)) {
      totalVerificado++;
      const ausentes = locales.filter((l) => resolver(idiomas[l], uso.caminho) === undefined);
      if (ausentes.length > 0) {
        faltando.push(
          `${relative(RAIZ_SRC, uso.arquivo)}:${uso.linha}  ${uso.caminho}  ` +
            `(ausente em: ${ausentes.join(", ")})`,
        );
      }
    }
  }

  // Se este número desabar, o regex parou de casar e o teste virou decorativo.
  assert.ok(
    totalVerificado > 200,
    `só ${totalVerificado} chaves verificadas — o coletor provavelmente quebrou`,
  );

  assert.deepEqual(
    faltando,
    [],
    `chave(s) usada(s) no código e ausente(s) no JSON — isso vira MISSING_MESSAGE ` +
      `em runtime para o aluno:\n  ${faltando.join("\n  ")}`,
  );
});

test("o par de controles do drawer mobile existe nos três idiomas", () => {
  const idiomas = carregarIdiomas();
  for (const [locale, dic] of Object.entries(idiomas)) {
    for (const chave of ["shell.sidebar.openMenu", "shell.sidebar.closeMenu"]) {
      assert.equal(
        typeof resolver(dic, chave),
        "string",
        `${chave} faltando ou não-string em ${locale}`,
      );
    }
  }
});
