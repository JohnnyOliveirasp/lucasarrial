/**
 * GUARDA DE REGRESSÃO do /api/openapi — doc × código, contra o DISCO real.
 *
 * O defeito que ela impede: documentar rota que não existe (ou método que a
 * rota não exporta). Doc que descola do código é pior que doc nenhum: mente
 * com autoridade — o integrador monta o request certinho contra um 404.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo), de dentro de frontend/:
 *   node --test src/app/api/openapi/openapi-doc.test.ts
 *
 * Como funciona: importa buildSpec (spec.ts, sem next/server), percorre TODO
 * path documentado e exige (a) o route.ts correspondente em src/app, mapeando
 * segmento `{param}` pra diretório dinâmico `[…]` do Next (o NOME do param não
 * precisa bater — /voices/{voiceId}/generate mora em voices/[id]/generate); e
 * (b) cada método documentado exportado como function no arquivo.
 *
 * MUTAÇÃO (testes 4 e 5): o validador roda contra um spec com path inventado
 * e com método inventado — os dois têm que ser acusados. Guarda que passa com
 * e sem o defeito não prova nada.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSpec } from "./spec.ts";

/** src/app — raiz do App Router (este teste mora em src/app/api/openapi/). */
const APP_DIR = fileURLToPath(new URL("../../", import.meta.url));

const METODOS_HTTP = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

/** "/api/v1/voices/{voiceId}/generate" → caminho do route.ts no disco, ou problema. */
function resolverRouteFile(docPath: string): { file: string } | { problema: string } {
  let dir = APP_DIR.replace(/\/$/, "");
  for (const seg of docPath.replace(/^\//, "").split("/")) {
    if (/^\{.+\}$/.test(seg)) {
      const dinamico = readdirSync(dir).find(
        (n) => /^\[.+\]$/.test(n) && statSync(join(dir, n)).isDirectory(),
      );
      if (!dinamico) {
        return { problema: `${docPath}: segmento ${seg} sem diretório dinâmico [*] em ${dir}` };
      }
      dir = join(dir, dinamico);
    } else {
      dir = join(dir, seg);
      if (!existsSync(dir)) return { problema: `${docPath}: diretório "${seg}" não existe no app` };
    }
  }
  const file = join(dir, "route.ts");
  if (!existsSync(file)) return { problema: `${docPath}: sem route.ts em ${dir}` };
  return { file };
}

/**
 * Todos os problemas doc×disco de um spec: path sem route.ts e método
 * documentado sem `export [async] function MÉTODO` no fonte da rota.
 */
function validarSpecContraDisco(spec: { paths: Record<string, unknown> }): string[] {
  const problemas: string[] = [];
  for (const [docPath, item] of Object.entries(spec.paths)) {
    const r = resolverRouteFile(docPath);
    if ("problema" in r) {
      problemas.push(r.problema);
      continue;
    }
    const src = readFileSync(r.file, "utf8");
    for (const metodo of METODOS_HTTP) {
      if (!(item as Record<string, unknown>)[metodo]) continue;
      const re = new RegExp(`export\\s+(async\\s+)?function\\s+${metodo.toUpperCase()}\\b`);
      if (!re.test(src)) {
        problemas.push(`${docPath}: método ${metodo.toUpperCase()} documentado mas não exportado em ${r.file}`);
      }
    }
  }
  return problemas;
}

const spec = buildSpec("http://localhost");

test("1. todo path documentado tem route.ts no disco com os métodos exportados", () => {
  assert.deepEqual(validarSpecContraDisco(spec), []);
});

test("2. as 4 rotas do publicador social estão documentadas, com os métodos reais", () => {
  const p = spec.paths as Record<string, Record<string, unknown>>;
  // Remover uma rota/método do doc é regressão tão real quanto documentar fantasma.
  assert.deepEqual(Object.keys(p["/api/v1/social/accounts"] ?? {}).sort(), ["delete", "get"]);
  assert.deepEqual(Object.keys(p["/api/v1/social/publish"] ?? {}).sort(), ["delete", "get", "post"]);
  assert.deepEqual(Object.keys(p["/api/v1/social/upload-url"] ?? {}).sort(), ["post"]);
  assert.deepEqual(Object.keys(p["/api/v1/social/caption"] ?? {}).sort(), ["post"]);
});

test("3. rotas internas NÃO entram no doc público (sweep é cron; connect/callback são OAuth de navegador)", () => {
  for (const proibida of Object.keys(spec.paths).filter((p) => /sweep|connect|callback/.test(p))) {
    assert.fail(`rota interna documentada no doc público: ${proibida}`);
  }
});

test("4. MUTAÇÃO: path inventado no doc é acusado", () => {
  const mutado = {
    paths: { ...spec.paths, "/api/v1/social/nao-existe": { get: { summary: "fantasma" } } },
  };
  const problemas = validarSpecContraDisco(mutado);
  assert.equal(problemas.length, 1, `esperava 1 problema, veio: ${JSON.stringify(problemas)}`);
  assert.match(problemas[0], /nao-existe/);
});

test("5. MUTAÇÃO: método inventado num path real é acusado", () => {
  const mutado = {
    paths: {
      ...spec.paths,
      "/api/v1/social/caption": { ...(spec.paths as Record<string, object>)["/api/v1/social/caption"], delete: {} },
    },
  };
  const problemas = validarSpecContraDisco(mutado);
  assert.equal(problemas.length, 1, `esperava 1 problema, veio: ${JSON.stringify(problemas)}`);
  assert.match(problemas[0], /caption.*DELETE/);
});
