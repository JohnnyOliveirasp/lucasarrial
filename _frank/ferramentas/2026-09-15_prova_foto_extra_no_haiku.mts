/**
 * PROVA DE COMPORTAMENTO do conserto do #270 — chama o HAIKU DE VERDADE.
 *
 * POR QUE EXISTE. O conserto do #270 (`b67bc8c` + `2ca2097`, PR #297, merge
 * `3e8af23`) subiu com 14 testes de unidade. Todos eles testam a STRING que
 * vai pro modelo (`SYSTEM`, `mensagemDoUsuario`) — nenhum chama o modelo. Mas
 * o defeito do #270 NÃO era a string: era **o Haiku obedecendo o SYSTEM** e
 * apagando a atribuição do aluno. Teste sem modelo não consegue, por
 * construção, provar que o modelo parou de apagar. É a lição da ronda das
 * 17hZ ("prova do andar de baixo assinando pelo de cima"), e aqui ela se
 * aplica um andar acima: a string está certa, falta provar a OBEDIÊNCIA.
 *
 * O QUE MEDE. Roda as ideias REAIS do Paulo (#270, 12/09) — as duas em que a
 * atribuição foi medida como apagada — e mais dois CONTROLES, N vezes cada:
 *
 *   A) PRESERVA: ideia cita a foto extra → o prompt gerado TEM de citar.
 *   B) NÃO INVENTA: ideia com 6 fotos que NÃO cita extra → o prompt NÃO pode
 *      atribuir nada a foto extra. (É a armadilha 117× maior descrita no
 *      cabeçalho do `generate-image-prompt.ts`: consertar 15 alunos mandando
 *      o modelo inventar móvel/logo pra 792.)
 *   C) UMA FOTO SÓ: caminho antigo, tem de continuar saindo sem menção a extra.
 *
 * ⚠️ A ARMADILHA DESTA PRÓPRIA FERRAMENTA, e ela é séria:
 * `generateImagePrompt` **devolve a ideia crua** quando a chamada falha (sem
 * key, HTTP != 200, timeout, exceção). A ideia crua CITA a foto extra — então
 * uma chamada QUEBRADA passaria no critério (A) como se fosse sucesso. Por
 * isso toda saída idêntica à ideia é marcada `INCONCLUSIVO`, nunca `ok`. Sem
 * essa guarda, esta ferramenta mede a si mesma e mente.
 *
 * CUSTO: Haiku, ~12 chamadas. Não gasta crédito de aluno, não usa GPU, não
 * grava nada no banco. SÓ LEITURA do lado da casa.
 *
 * USO: node --experimental-strip-types _frank/ferramentas/2026-09-15_prova_foto_extra_no_haiku.mts [N]
 */
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const RAIZ = path.join(import.meta.dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const { generateImagePrompt } = await import(
  path.join(RAIZ, "frontend", "src", "lib", "llm", "generate-image-prompt.ts")
);

/** Mesma régua do `2026-09-15_prompt_apaga_foto_extra.cjs` — de propósito. */
const CITA_EXTRA = /foto\s+extra|fotos\s+extras|imagem\s+extra|da\s+extra|nas\s+extras/i;
const CITA_ORIGINAL = /original(idade)?|mesma\s+sala|mesmo\s+escrit[óo]rio|sem\s+perder/i;

type Caso = {
  nome: string;
  idea: string;
  refs: number;
  espera: "cita" | "nao_cita";
  tambemOriginal?: boolean;
};

const CASOS: Caso[] = [
  {
    // image_generations 2026-09-12 23:04:19Z — prompt saiu "uma cadeira de
    // escritório (...) Cenário de escritório MINIMALISTA". Atribuição apagada.
    nome: "A1 Paulo 23:04 (real, apagou)",
    idea: "Eu que estou na foto de referência sentado na cadeira desse escritório da foto extra, com a mesa com alguns documentos. A imagem mais próxima",
    refs: 2,
    espera: "cita",
  },
  {
    // image_generations 2026-09-12 23:15:25Z — "Cenário de escritório original"
    // virou "cenário de escritório realista e autêntico".
    nome: "A2 Paulo 23:15 (real, apagou + perdeu 'original')",
    idea: "A pessoa da foto de referência sentada na cadeira de escritório da foto extra, trabalhando à mesa repleta de documentos e papéis. Foto próxima, focada no rosto e tronco, com lighting natural suave vindo da janela ao fundo. Expressão concentrada e profissional. Cenário de escritório original, fotografia realista.",
    refs: 2,
    espera: "cita",
    tambemOriginal: true,
  },
  {
    // A população de 98%: lote de selfies. NÃO pode virar cenário inventado.
    nome: "B  controle 6 selfies (não pode inventar extra)",
    idea: "Eu sorrindo, em pé, foto profissional para o LinkedIn, fundo neutro",
    refs: 6,
    espera: "nao_cita",
  },
  {
    nome: "C  controle 1 foto (caminho antigo)",
    idea: "Eu numa praia ao pôr do sol, olhando para a câmera",
    refs: 1,
    espera: "nao_cita",
  },
];

const N = Math.max(1, Math.min(Number(process.argv[2] ?? 3) || 3, 10));

console.log(`PROVA #270 — Haiku de verdade, ${N} rodada(s) por caso\n`);

let falhas = 0;
let inconclusivos = 0;

for (const c of CASOS) {
  const linhas: string[] = [];
  let ok = 0;
  for (let i = 0; i < N; i++) {
    const out: string = await generateImagePrompt(c.idea, c.refs);
    const fallback = out.trim() === c.idea.trim();
    const cita = CITA_EXTRA.test(out);
    const manteveOriginal = CITA_ORIGINAL.test(out);

    let veredito: string;
    if (fallback) {
      veredito = "INCONCLUSIVO (saída == ideia: a chamada caiu no fallback)";
      inconclusivos++;
    } else if (c.espera === "cita") {
      const bom = cita && (!c.tambemOriginal || manteveOriginal);
      veredito = bom ? "ok" : `FALHOU (cita_extra=${cita}${c.tambemOriginal ? `, manteve_original=${manteveOriginal}` : ""})`;
      if (bom) ok++; else falhas++;
    } else {
      veredito = cita ? "FALHOU (inventou atribuição a foto extra)" : "ok";
      if (cita) falhas++; else ok++;
    }
    linhas.push(`   #${i + 1} ${veredito}\n      ${out.replace(/\s+/g, " ").slice(0, 200)}`);
  }
  console.log(`${c.nome}  [refs=${c.refs}, espera=${c.espera}]  → ${ok}/${N} ok`);
  console.log(linhas.join("\n") + "\n");
}

console.log("=== RESUMO ===");
console.log(`  falhas:        ${falhas}`);
console.log(`  inconclusivos: ${inconclusivos}`);
if (inconclusivos) console.log("  ⚠️  inconclusivo NÃO é aprovação — a chamada caiu no fallback.");
process.exit(falhas || inconclusivos ? 1 : 0);
