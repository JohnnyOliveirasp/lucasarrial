/**
 * A RÉGUA "é a mesma foto?" do SGP tela 2 — as DUAS pontas travadas.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo), de dentro de frontend/:
 *   node --test src/lib/sgp/impressao-foto-pure.test.ts
 *
 * Este arquivo existe por causa do #349, e ele tem que segurar dois lados que
 * puxam em direções opostas. Mexer só num deles já quebrou o produto uma vez:
 *
 *  (1) A MESMA imagem re-salva TEM que continuar sendo barrada. É a exigência
 *      do Johnny de 29/08 — *"subi a mesma foto e ele deixou subir"*. Afrouxar
 *      o hash para consertar o #349 e regredir isso não é conserto, é troca de
 *      bug.
 *  (2) Fotos DIFERENTES NÃO podem ser barradas. É o #349: o dHash de 8x8 dava
 *      distância 0..4 entre fotos distintas da mesma pessoa, o limite era 5, e
 *      o aluno ficou ~6h sem conseguir anexar UMA foto sequer (o mínimo é 4).
 *
 * ⚠️ OS TESTES (2) E (3) RODAM ffmpeg DE VERDADE, com imagem de verdade. Sem
 * imagem real eles não provariam nada: a coisa que se quer medir é justamente
 * o que a redução para 17x16 cinza faz com o conteúdo. As imagens são geradas
 * pelo próprio ffmpeg (`lavfi`), então o teste é determinístico e não depende
 * de asset nenhum do repositório.
 *
 * Sem ffmpeg no PATH, esses dois se PULAM com aviso — nunca passam em silêncio
 * fingindo que provaram algo (mesmo contrato do anexar.test.ts sem credencial).
 *
 * O teste (3) carrega o CONTROLE de não-tautologia: ele mede o mesmo par de
 * imagens com o algoritmo ANTIGO (8x8, copiado aqui de propósito) e exige que
 * o antigo TENHA barrado. Ou seja: se alguém reverter o hash para 8x8, o (3)
 * falha de verdade, não por acaso.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DHASH_LIMITE, dhashDeBytes, distancia, ehRepetida } from "./impressao-foto-pure.ts";

const exec = promisify(execFile);

const LARGURA = 900;
const ALTURA = 1200;

/** O limite antigo, que valia com o hash de 8x8. Só o controle do (3) usa. */
const LIMITE_ANTIGO = 5;

async function temFfmpeg(): Promise<boolean> {
  try {
    await exec("ffmpeg", ["-version"], { timeout: 20_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * O dHash ANTIGO (8x8 = 64 bits), copiado de propósito. É o CONTROLE: serve só
 * para o teste (3) mostrar que o código velho barrava o par de fotos que o novo
 * deixa passar. Não é o algoritmo em uso — esse vem de `dhashDeBytes`.
 */
async function dhash8x8(arquivo: string): Promise<string> {
  const { stdout } = await exec(
    "ffmpeg",
    ["-v", "error", "-i", arquivo, "-vf", "scale=9:8,format=gray", "-frames:v", "1", "-f", "rawvideo", "-"],
    { encoding: "buffer", timeout: 60_000, maxBuffer: 1024 * 1024 },
  );
  const px = stdout as unknown as Buffer;
  assert.ok(px.length >= 72, "ffmpeg não devolveu os 9x8 pixels do controle");
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) bits += px[y * 9 + x] > px[y * 9 + x + 1] ? "1" : "0";
  }
  let hex = "";
  for (let i = 0; i < bits.length; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

/** Bancada: gera as imagens do caso e devolve o dHash de produção de cada uma. */
async function bancada() {
  const dir = await mkdtemp(join(tmpdir(), "sgp-dhash-test-"));
  const p = (n: string) => join(dir, n);

  // A "foto" base. `testsrc2` borrado tem gradiente suave e formas variadas —
  // se comporta como conteúdo fotográfico na redução, e não como ruído.
  await exec("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", `testsrc2=s=${LARGURA}x${ALTURA}:d=1`,
    "-vf", "gblur=sigma=14", "-frames:v", "1", p("base.png"),
  ]);

  // A MESMA imagem, re-salva: é assim que o aluno "muda" a foto sem mudar a
  // foto (manda de novo em JPEG, o app dele recomprime, troca png por jpg).
  await exec("ffmpeg", ["-y", "-v", "error", "-i", p("base.png"), "-q:v", "5", p("resalva-q75.jpg")]);
  await exec("ffmpeg", ["-y", "-v", "error", "-i", p("base.png"), "-q:v", "18", p("resalva-q30.jpg")]);

  // OUTRA foto: mesmo assunto, ENQUADRAMENTO diferente. É o análogo sintético
  // do #349 — "outra foto da mesma pessoa", que é o caso normal de quem tira 6
  // selfies seguidas, e exatamente o que o hash de 8x8 confundia.
  await exec("ffmpeg", [
    "-y", "-v", "error", "-i", p("base.png"),
    "-vf", `crop=${Math.round(LARGURA * 0.97)}:${Math.round(ALTURA * 0.97)}:${Math.round(LARGURA * 0.03)}:${Math.round(ALTURA * 0.03)},scale=${LARGURA}:${ALTURA}`,
    "-frames:v", "1", p("outra-enquadramento.png"),
  ]);

  // E uma foto sem nada a ver, o caso fácil.
  await exec("ffmpeg", [
    "-y", "-v", "error",
    "-f", "lavfi", "-i", `mandelbrot=s=${LARGURA}x${ALTURA}:maxiter=100`,
    "-vf", "gblur=sigma=6", "-frames:v", "1", p("outra-totalmente.png"),
  ]);

  const nomes = ["base.png", "resalva-q75.jpg", "resalva-q30.jpg", "outra-enquadramento.png", "outra-totalmente.png"] as const;
  const h: Record<string, string> = {};
  for (const nome of nomes) {
    const dh = await dhashDeBytes(await readFile(p(nome)), dir);
    assert.ok(dh, `dhashDeBytes devolveu null para ${nome} — a bancada não mediu nada`);
    h[nome] = dh;
  }
  return { dir, p, h, limpar: () => rm(dir, { recursive: true, force: true }).catch(() => {}) };
}

// ─────────────────────────────────────────────────────── configuração travada

test("(1) o hash é de 256 bits (16x16) e o limite fica na janela medida", async (t) => {
  if (!(await temFfmpeg())) return t.skip("ffmpeg não está no PATH — este teste NÃO rodou");

  const dir = await mkdtemp(join(tmpdir(), "sgp-dhash-test-"));
  try {
    const alvo = join(dir, "x.png");
    await exec("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc2=s=400x400:d=1", "-frames:v", "1", alvo]);
    const dh = await dhashDeBytes(await readFile(alvo), dir);
    // 256 bits = 64 chars de hex. Com 8x8 seriam 16 — a resolução ERA a causa
    // do #349, então ela é o que este teste trava.
    assert.equal(dh?.length, 64, "o dHash saiu do tamanho de 256 bits — voltou pro 8x8?");
    assert.match(dh!, /^[0-9a-f]{64}$/);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }

  // Janela medida em produção no #349 (32 objetos reais da sessão 42454b04):
  // mesma imagem re-salva 0..1, fotos diferentes >= 5. O limite tem que cair
  // DENTRO desse vão, senão uma das duas pontas quebra.
  assert.ok(DHASH_LIMITE >= 2 && DHASH_LIMITE <= 4, `DHASH_LIMITE=${DHASH_LIMITE} caiu fora da janela medida (2..4)`);
});

// ────────────────────────────────────────── (1) a mesma foto continua barrada

test("(2) a MESMA imagem re-salva continua sendo barrada como repetida", async (t) => {
  if (!(await temFfmpeg())) return t.skip("ffmpeg não está no PATH — este teste NÃO rodou");

  const { h, limpar } = await bancada();
  try {
    for (const copia of ["resalva-q75.jpg", "resalva-q30.jpg"]) {
      const d = distancia(h["base.png"], h[copia]);
      assert.ok(
        d <= DHASH_LIMITE,
        `regressão do 29/08: a mesma imagem re-salva (${copia}) deu distância ${d} > ${DHASH_LIMITE} e passaria como foto nova`,
      );
      assert.equal(
        ehRepetida({ sha256: "sha-da-copia", dhash: h[copia] }, [{ sha256: "sha-do-original", dhash: h["base.png"] }]),
        true,
        `${copia} tinha que ser barrada — é a mesma imagem, só re-salva`,
      );
    }
  } finally {
    await limpar();
  }
});

// ───────────────────────────────── (2) foto diferente NÃO pode ser barrada

test("(3) fotos DIFERENTES não são barradas — e o hash antigo barrava (#349)", async (t) => {
  if (!(await temFfmpeg())) return t.skip("ffmpeg não está no PATH — este teste NÃO rodou");

  const { p, h, limpar } = await bancada();
  try {
    for (const outra of ["outra-enquadramento.png", "outra-totalmente.png"]) {
      const d = distancia(h["base.png"], h[outra]);
      assert.ok(d > DHASH_LIMITE, `#349 de volta: ${outra} é outra foto e deu distância ${d} <= ${DHASH_LIMITE}`);
      assert.equal(
        ehRepetida({ sha256: "sha-da-outra", dhash: h[outra] }, [{ sha256: "sha-do-original", dhash: h["base.png"] }]),
        false,
        `${outra} é outra foto e não podia ser recusada — é assim que o aluno trava na tela 2`,
      );
    }

    // CONTROLE DE NÃO-TAUTOLOGIA. O mesmo par, medido com o algoritmo ANTIGO
    // (8x8, limite 5): ele TEM que ter barrado. Se este assert falhar, o par de
    // imagens deixou de reproduzir o defeito e o teste acima virou decoração.
    const antigoBase = await dhash8x8(p("base.png"));
    const antigoOutra = await dhash8x8(p("outra-enquadramento.png"));
    const dAntigo = distancia(antigoBase, antigoOutra);
    assert.ok(
      dAntigo <= LIMITE_ANTIGO,
      `a bancada parou de reproduzir o #349: com o hash de 8x8 o par deu ${dAntigo} > ${LIMITE_ANTIGO}, então o teste acima não prova mais nada`,
    );
  } finally {
    await limpar();
  }
});

// ──────────────────────────────── régua pura: compatibilidade e falha-aberto

test("(4) hash antigo (16 chars) x hash novo (64 chars) FALHA ABERTO", () => {
  const antigo = "f0e1d2c3b4a59687";
  const novo = "f0e1d2c3b4a59687".repeat(4);
  assert.equal(antigo.length, 16);
  assert.equal(novo.length, 64);
  // 64 é o sentinela de "nada a ver", e tem que continuar batendo com o SQL
  // (public.sgp_dhash_distancia devolve 64 quando os comprimentos diferem).
  assert.equal(distancia(antigo, novo), 64);
  assert.ok(distancia(antigo, novo) > DHASH_LIMITE, "o hash da era 8x8 não pode ser lido como repetido");
  assert.equal(
    ehRepetida({ sha256: "novo", dhash: novo }, [{ sha256: "velho", dhash: antigo }]),
    false,
    "pedido antigo perde o dedup até o aluno reenviar — deixa passar, nunca trava",
  );
});

test("(5) sem dhash (ffmpeg falhou), o sha256 ainda barra o arquivo idêntico", () => {
  const mesmo = "a".repeat(64);
  assert.equal(ehRepetida({ sha256: mesmo, dhash: null }, [{ sha256: mesmo, dhash: null }]), true);
  assert.equal(ehRepetida({ sha256: mesmo, dhash: null }, [{ sha256: "b".repeat(64), dhash: null }]), false);
  // dhash null nunca pode virar "repetida" por si só — a impressão não derruba upload.
  assert.equal(ehRepetida({ sha256: "x", dhash: null }, [{ sha256: "y", dhash: "0".repeat(64) }]), false);
});

test("(6) distância conta bit a bit e hash igual dá zero", () => {
  const z = "0".repeat(64);
  assert.equal(distancia(z, z), 0);
  assert.equal(distancia(z, "1" + "0".repeat(63)), 1); // 0x1 = um bit
  assert.equal(distancia(z, "f" + "0".repeat(63)), 4); // 0xf = quatro bits
  assert.equal(distancia("f".repeat(64), z), 256); // 256 bits, todos diferentes
});
