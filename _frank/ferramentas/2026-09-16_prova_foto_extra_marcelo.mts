/**
 * PROVA, COM O HAIKU DE VERDADE, DE QUE O CONSERTO DO #270 COBRE O CASO DO #285.
 *
 * POR QUE EXISTE. O #270 (Paulo, `pcezardireito@icloud.com`) foi fechado em
 * 15/09 pelo PR #297 (merge `3e8af23`, produção 18:11Z) e o aluno DELE foi
 * avisado. Mas a medição do próprio conserto contou **15 alunos** atingidos, e
 * só um soube. Um dos outros 14 é o **Marcelo Santos Pereira**
 * (`smilefastrio@gmail.com`), dono do **#285** — que reclamou do gerador de
 * imagens em 06/09 e recebeu da casa uma resposta de *modo de usar*, porque na
 * data ninguém sabia que o botão apagava a atribuição.
 *
 * O PONTO QUE ESTA FERRAMENTA FECHA. Dizer ao Marcelo "está consertado" porque
 * o conserto do Paulo subiu é presumir. As ideias dos dois NÃO têm a mesma
 * forma: a do Paulo escreve `da foto extra` solto no meio da frase; a do
 * Marcelo põe **entre parênteses** — `Seu consultório odontológico (da foto
 * extra) de fundo` — que é justamente o tipo de construção que um LLM engole
 * ao reescrever. Enquanto o Haiku não for chamado com o texto DELE, "coberto"
 * é torcida.
 *
 * O QUE MEDE (mesma régua do `2026-09-15_prompt_apaga_foto_extra.cjs`, de
 * propósito — trocar a régua no meio invalidaria a comparação):
 *
 *   A) O caso REAL do Marcelo, `image_generations` `0f0efe39`, 06/09 14:22:32Z,
 *      refs=4: a ideia cita a foto extra e o prompt gravado NÃO cita mais.
 *      Depois do conserto, o prompt TEM de citar.
 *   B) CONTROLE, mesma ideia sem o parêntese: isola se o que cura é o conserto
 *      ou a pontuação.
 *   C) CONTROLE NEGATIVO, a ideia dele de 04/09 (refs=7, não cita extra): o
 *      modelo NÃO pode inventar atribuição. É a armadilha do cabeçalho do
 *      `generate-image-prompt.ts` — consertar 15 alunos inventando cenário
 *      para os outros 792.
 *
 * ⚠️ A ARMADILHA HERDADA, e ela continua valendo aqui: `generateImagePrompt`
 * **devolve a ideia crua** quando a chamada falha (sem key, HTTP != 200,
 * timeout, exceção). A ideia crua CITA a foto extra — então uma chamada
 * QUEBRADA passaria no critério (A) como se fosse sucesso. Toda saída idêntica
 * à ideia é marcada `INCONCLUSIVO`, nunca `ok`.
 *
 * CUSTO: Haiku, ~3N chamadas. NÃO gasta crédito de aluno, NÃO usa GPU, NÃO
 * grava nada no banco. Só leitura do lado da casa.
 *
 * USO: node --experimental-strip-types \
 *        _frank/ferramentas/2026-09-16_prova_foto_extra_marcelo.mts [N]
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

/** Mesma régua da medição do #270. Não trocar. */
const CITA_EXTRA = /foto\s+extra|fotos\s+extras|imagem\s+extra|da\s+extra|nas\s+extras/i;

type Caso = {
  nome: string;
  idea: string;
  refs: number;
  espera: "cita" | "nao_cita";
};

const CASOS: Caso[] = [
  {
    // image_generations 0f0efe39-2c65-4123-a6f3-465195655898, 06/09 14:22:32Z.
    // PROMPT gravado: "...Ao fundo, um consultório odontológico com móveis,
    // equipamentos e iluminação profissional, levemente desfocado..." —
    // "(da foto extra)" sumiu. Custou 525 créditos.
    nome: "A  Marcelo 06/09 14:22 (real, apagou) — parêntese",
    idea: "Pessoa da foto, sorrindo para a câmera, sentado em uma mesa. Seu consultório odontológico (da foto extra) de fundo e levemente desfocado",
    refs: 4,
    espera: "cita",
  },
  {
    nome: "B  controle: mesma ideia SEM parêntese",
    idea: "Pessoa da foto, sorrindo para a câmera, sentado em uma mesa. Seu consultório odontológico da foto extra de fundo e levemente desfocado",
    refs: 4,
    espera: "cita",
  },
  {
    // CONTROLE NEGATIVO DE VERDADE: lote de selfies, sem cenário nenhum.
    // Mesmo espírito do controle B do `2026-09-15_prova_foto_extra_no_haiku.mts`,
    // que segue passando 3/3 em produção (re-rodado hoje, 12/12 no total).
    nome: "C  controle negativo: lote de selfies dele (não pode inventar extra)",
    idea: "Eu sorrindo, em pé, foto profissional para divulgação, fundo neutro",
    refs: 4,
    espera: "nao_cita",
  },
];

/*
 * ⚠️ CONTROLE QUE EU TENTEI E **DESCARTEI** — fica registrado para ninguém
 * repetir o erro, que foi MEU, hoje.
 *
 * Primeira versão desta ferramenta usou como controle negativo a ideia real
 * dele de 04/09 (`227db8b3`, refs=7):
 *
 *   "(...) Ao fundo, **meu consultório**. Iluminação natural suave (...)"
 *
 * Ela deu **0/3**, e por 20 minutos pareceu uma REGRESSÃO do conserto do #270:
 * "o modelo passou a inventar atribuição a foto extra". Eu quase publiquei isso.
 *
 * É FALSO, e a prova é visual. Baixei as 7 referências daquela geração do R2
 * (`voices-clone-ai-verse`, prefixo `dad39108-.../refs/`) e olhei:
 *   - `2e931787_20260810_190227.jpg` → o próprio Marcelo, jaleco preto escrito
 *     "Dr. Marcelo Pereira — Cirurgião Dentista", fundo azul de estúdio.
 *   - `13c2201e_1000235859.jpg`      → **o consultório odontológico dele**:
 *     cadeira azul, refletor, bancada, ar-condicionado, janela.
 *
 * Ou seja: quando ele escreve "meu consultório" e sobe 7 fotos, **uma delas É o
 * consultório**. O Haiku dizer "o consultório da foto extra" não é invenção —
 * é a leitura CERTA. O controle é que estava contaminado: ele não testa
 * invenção, testa uma atribuição legítima.
 *
 * O controle negativo honesto é o que ficou no lugar (C): ideia SEM cenário
 * nenhum, onde não existe extra a que atribuir. Esse é o que vale, e o gêmeo
 * dele no arquivo do #270 (6 selfies, fundo neutro) passa 3/3 hoje.
 */

const N = Math.max(1, Math.min(Number(process.argv[2] ?? 3) || 3, 10));

console.log(`PROVA #285 (caso Marcelo) — Haiku de verdade, ${N} rodada(s) por caso\n`);

let falhas = 0;
let inconclusivos = 0;

for (const c of CASOS) {
  const linhas: string[] = [];
  let ok = 0;
  for (let i = 0; i < N; i++) {
    const out: string = await generateImagePrompt(c.idea, c.refs);
    const fallback = out.trim() === c.idea.trim();
    const cita = CITA_EXTRA.test(out);

    let veredito: string;
    if (fallback) {
      veredito = "INCONCLUSIVO (saída == ideia: a chamada caiu no fallback)";
      inconclusivos++;
    } else if (c.espera === "cita") {
      veredito = cita ? "ok" : "FALHOU (apagou a atribuição da foto extra)";
      if (cita) ok++; else falhas++;
    } else {
      veredito = cita ? "FALHOU (inventou atribuição a foto extra)" : "ok";
      if (cita) falhas++; else ok++;
    }
    linhas.push(`   #${i + 1} ${veredito}\n      ${out.replace(/\s+/g, " ").slice(0, 220)}`);
  }
  console.log(`${c.nome}  [refs=${c.refs}, espera=${c.espera}]  → ${ok}/${N} ok`);
  console.log(linhas.join("\n") + "\n");
}

console.log("=== RESUMO ===");
console.log(`  falhas:        ${falhas}`);
console.log(`  inconclusivos: ${inconclusivos}`);
if (inconclusivos) console.log("  ⚠️  inconclusivo NÃO é aprovação — a chamada caiu no fallback.");
process.exit(falhas || inconclusivos ? 1 : 0);
