/**
 * Testes do portão da CONFIRMAÇÃO de gravações encontradas (caso João Soares,
 * 16/09).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/audio/gravacoes-achadas.test.ts
 *
 * POR QUE ESTE ARQUIVO EXISTE:
 * A confirmação "N gravações carregadas" era renderizada sob o estado que só
 * o efeito do IndexedDB preenchia. Como o Gravador apaga a cópia local assim
 * que o upload pra conta confirma, o efeito ficou INVERTIDO: upload
 * bem-sucedido → nenhuma confirmação; upload falho → aviso verde. O caso que
 * originou tudo é o primeiro teste abaixo: IndexedDB VAZIO + servidor COM
 * gravações tem que confirmar.
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  NENHUMA_GRAVACAO,
  PREFIXO_FONTE,
  fonteDoId,
  resumirGravacoes,
  somarGravacoes,
} from "./gravacoes-achadas.ts";

test("IndexedDB VAZIO + servidor COM gravações: a confirmação APARECE", () => {
  // O caso do João: as 5 gravações do navegador subiram pra conta e a cópia
  // local foi apagada. Antes, este cenário não confirmava NADA na tela.
  const r = resumirGravacoes({ ...NENHUMA_GRAVACAO, conta: 5 });
  assert.equal(r.achou, true, "achou tem que ser true — as gravações estão na conta");
  assert.equal(r.total, 5, "a contagem mostrada é a da conta, não a do IndexedDB");
});

test("só takes do celular: a confirmação APARECE", () => {
  // Terceira fonte: o efeito dos takes não marcava NADA no sucesso, então
  // quem gravou só pelo celular também caía na tela muda.
  const r = resumirGravacoes({ ...NENHUMA_GRAVACAO, celular: 2 });
  assert.equal(r.achou, true);
  assert.equal(r.total, 2);
});

test("só IndexedDB: continua confirmando (não houve regressão do caminho antigo)", () => {
  const r = resumirGravacoes({ ...NENHUMA_GRAVACAO, navegador: 3 });
  assert.equal(r.achou, true);
  assert.equal(r.total, 3);
});

test("as três fontes somam num número só", () => {
  const r = resumirGravacoes({ navegador: 3, conta: 5, celular: 2 });
  assert.equal(r.total, 10, "o aluno lê a soma, não o desfecho de uma fonte");
  assert.equal(r.achou, true);
  assert.deepEqual(r.fontes, { navegador: 3, conta: 5, celular: 2 });
});

test("nenhuma fonte trouxe nada: NÃO confirma", () => {
  const r = resumirGravacoes(NENHUMA_GRAVACAO);
  assert.equal(r.achou, false, "sem gravação não se afirma que achou");
  assert.equal(r.total, 0);
});

test("contagem inválida não vira total negativo", () => {
  const r = resumirGravacoes({ navegador: -2, conta: 4, celular: Number.NaN });
  assert.equal(r.total, 4);
  assert.equal(r.achou, true);
});

test("fonteDoId separa gravação de arquivo escolhido no disco", () => {
  assert.equal(fonteDoId(`${PREFIXO_FONTE.navegador}abc`), "navegador");
  assert.equal(fonteDoId(`${PREFIXO_FONTE.conta}user/gravador/x.mp3`), "conta");
  assert.equal(fonteDoId(`${PREFIXO_FONTE.celular}user/recorder-test/y.mp3`), "celular");
  assert.equal(fonteDoId("entrevista.mp3-12345-1690000000-ab12cd"), null);
});

test("somarGravacoes soma SÓ gravação, e não inventa duração de quem não foi medido", () => {
  const s = somarGravacoes([
    { id: "srv-a", duracao: 233 },
    { id: "srv-b", duracao: 300 },
    { id: "cel-c", duracao: null },
    { id: "rec-d", duracao: 34 },
    // arquivo do disco: não é gravação, não entra nesta soma
    { id: "podcast.mp3-999-1690000000-zz99zz", duracao: 3600 },
  ]);
  assert.equal(s.segundos, 233 + 300 + 34);
  assert.equal(s.semMedida, 1, "o take ainda sem medida é declarado, não some");
});

test("lista vazia: zero segundos e zero pendências", () => {
  assert.deepEqual(somarGravacoes([]), { segundos: 0, semMedida: 0 });
});

/**
 * Guarda estrutural. Os testes acima provam a RÉGUA; este prova que a tela
 * não voltou a ter um estado de confirmação alimentado por uma fonte só —
 * que era a forma exata do defeito. `setRecorderImport` era esse estado.
 */
test("voice-creator não tem mais estado de confirmação preso ao IndexedDB", () => {
  const aqui = dirname(fileURLToPath(import.meta.url));
  const fonte = readFileSync(
    join(aqui, "..", "..", "components", "voice", "voice-creator.tsx"),
    "utf8",
  );
  assert.ok(
    !fonte.includes("setRecorderImport"),
    "a confirmação voltou a depender só do IndexedDB — é o defeito do caso João Soares",
  );
  assert.ok(
    fonte.includes("resumirGravacoes"),
    "a tela tem que decidir pela régua das três fontes",
  );
});
