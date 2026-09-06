/**
 * `node --test src/components/voice/progresso-envio.test.ts`
 *
 * O que este teste protege: a tela não pode emudecer enquanto o botão está
 * apagado. Ele percorre a linha do tempo REAL de um envio de 20 arquivos e
 * compara a regra de exibição antiga com a nova — provando que a antiga tinha
 * buraco e onde exatamente ele ficava.
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { painelDeEnvio, AVISO_PARADO_MS, type FaseEnvio } from "./progresso-envio.ts";

type EstadoArquivo = "idle" | "uploading" | "done" | "error";

type Momento = {
  nome: string;
  busy: boolean;
  step: "form" | "upload" | "submitting" | "done";
  arquivos: EstadoArquivo[];
  fase: FaseEnvio;
  overall: number;
  paradoMs: number;
};

const repetir = (n: number, e: EstadoArquivo): EstadoArquivo[] => new Array(n).fill(e);

/**
 * A regra que estava no ar até o #289, reproduzida como estava em
 * voice-creator.tsx. Está aqui só para ser confrontada — não é código vivo.
 */
function regraAntiga(m: Momento): boolean {
  return m.step === "submitting" || (m.step === "upload" && m.arquivos.some((s) => s === "uploading"));
}

/** Envio da Elane: 20 clipes, do clique até a navegação. */
const LINHA_DO_TEMPO: Momento[] = [
  {
    nome: "1. clicou em Treinar (pedindo os slots ao backend)",
    busy: true,
    step: "submitting",
    arquivos: repetir(20, "idle"),
    fase: "preparando",
    overall: 0,
    paradoMs: 0,
  },
  {
    nome: "2. slots recebidos, upload começou",
    busy: true,
    step: "upload",
    arquivos: repetir(20, "uploading"),
    fase: "enviando",
    overall: 0,
    paradoMs: 0,
  },
  {
    nome: "3. metade dos arquivos subiu",
    busy: true,
    step: "upload",
    arquivos: [...repetir(10, "done"), ...repetir(10, "uploading")],
    fase: "enviando",
    overall: 50,
    paradoMs: 0,
  },
  {
    nome: "4. último byte subiu (uploads-complete em voo)",
    busy: true,
    step: "upload",
    arquivos: repetir(20, "done"),
    fase: "finalizando",
    overall: 100,
    paradoMs: 0,
  },
  {
    nome: "5. backend respondeu, navegando pro detalhe da voz",
    busy: true,
    step: "upload",
    arquivos: repetir(20, "done"),
    fase: "finalizando",
    overall: 100,
    paradoMs: 30_000,
  },
];

test("enquanto o botão está apagado, o painel NUNCA some", () => {
  for (const m of LINHA_DO_TEMPO) {
    const painel = painelDeEnvio(m);
    assert.equal(painel.visivel, true, `painel sumiu em: ${m.nome}`);
  }
});

test("a regra ANTIGA emudecia a tela na reta final — é o defeito do #289", () => {
  const mudos = LINHA_DO_TEMPO.filter((m) => !regraAntiga(m));

  // Não é "alguma coisa falhou": são exatamente os dois momentos depois do
  // último byte, que é quando a aluna concluiu que tinha travado.
  assert.deepEqual(
    mudos.map((m) => m.nome),
    [
      "4. último byte subiu (uploads-complete em voo)",
      "5. backend respondeu, navegando pro detalhe da voz",
    ],
  );

  // E nesses mesmos momentos o botão continuava apagado (busy), ou seja: a
  // tela travada por fora e sem nada explicando por dentro.
  for (const m of mudos) {
    assert.equal(m.busy, true);
    assert.equal(painelDeEnvio(m).visivel, true, `a regra nova devia cobrir: ${m.nome}`);
  }
});

test("sem envio em curso não há painel nenhum", () => {
  const painel = painelDeEnvio({ busy: false, fase: "enviando", overall: 40, paradoMs: 0 });
  assert.equal(painel.visivel, false);
});

test("a barra não inventa avanço em nenhuma das pontas", () => {
  // "preparando": nenhum byte subiu, mesmo que sobre lixo de uma tentativa
  // anterior no `overall`.
  assert.equal(painelDeEnvio({ busy: true, fase: "preparando", overall: 73, paradoMs: 0 }).barra, 0);
  // "enviando": medida real do XHR, sem enfeite.
  assert.equal(painelDeEnvio({ busy: true, fase: "enviando", overall: 37, paradoMs: 0 }).barra, 37);
  // "finalizando": todos os bytes subiram de verdade — 100 é fato, não promessa.
  assert.equal(painelDeEnvio({ busy: true, fase: "finalizando", overall: 100, paradoMs: 0 }).barra, 100);
});

test("a porcentagem só aparece na fase em que ela quer dizer alguma coisa", () => {
  assert.equal(painelDeEnvio({ busy: true, fase: "preparando", overall: 0, paradoMs: 0 }).mostraPorcentagem, false);
  assert.equal(painelDeEnvio({ busy: true, fase: "enviando", overall: 12, paradoMs: 0 }).mostraPorcentagem, true);
  assert.equal(painelDeEnvio({ busy: true, fase: "finalizando", overall: 100, paradoMs: 0 }).mostraPorcentagem, false);
});

test("o aviso de 'parece parado' respeita o limite e conta em minutos cheios", () => {
  const em = (paradoMs: number) =>
    painelDeEnvio({ busy: true, fase: "enviando", overall: 40, paradoMs }).avisoParadoMin;

  assert.equal(em(0), null);
  assert.equal(em(AVISO_PARADO_MS - 1), null, "não pode assustar antes da hora");
  assert.equal(em(AVISO_PARADO_MS), 2, "no limite exato já avisa");
  assert.equal(em(179_000), 2, "2min59s ainda é 'há 2 min', não arredonda pra cima");
  assert.equal(em(600_000), 10);
});

test("upload terminado e servidor demorando NÃO é acusado de travado", () => {
  // Depois do último byte o `overall` para de mudar por definição. Se o aviso
  // não fosse preso à fase "enviando", todo envio cujo backend levasse mais de
  // dois minutos passaria a acusar travamento que não existe — trocando o
  // silêncio do #289 por um susto falso.
  const painel = painelDeEnvio({ busy: true, fase: "finalizando", overall: 100, paradoMs: 15 * 60_000 });
  assert.equal(painel.avisoParadoMin, null);
  assert.equal(painel.visivel, true);
});
