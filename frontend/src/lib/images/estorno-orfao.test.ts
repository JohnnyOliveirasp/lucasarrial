/**
 * Testes do estorno órfão (incidente 1970fcaa — segundo bug, dinheiro).
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/images/estorno-orfao.test.ts
 *
 * O defeito coberto: failImageGeneration, com o claim vazio, retornava sem
 * estornar SEMPRE — inclusive quando a row tinha sido APAGADA pelo aluno com
 * a geração em voo (DELETE do histórico hard-deleta). Aluno cobrado, sem
 * imagem, sem estorno, em silêncio.
 *
 * O que se testa aqui é a DECISÃO (pura). A execução do estorno em si passa
 * pelo handleTechFailure/refundOriginalDebit de sempre, cuja idempotência por
 * contagem (só devolve enquanto débitos > estornos no ref_id) já é o
 * mecanismo de produção de todos os estornos automáticos.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirFalhaSemClaim } from "./estorno-orfao.ts";

test("apagar geração em voo estorna: row sumiu + débito no extrato → estornar_orfao", () => {
  assert.equal(
    decidirFalhaSemClaim({ rowAindaExiste: false, houveDebito: true }),
    "estornar_orfao",
  );
});

test("row ainda existe (ready/failed por outra via) → não mexe, quem claimou já tratou", () => {
  assert.equal(
    decidirFalhaSemClaim({ rowAindaExiste: true, houveDebito: true }),
    "ja_finalizada_por_outra_via",
  );
  // mesmo sem débito: existência da row decide primeiro
  assert.equal(
    decidirFalhaSemClaim({ rowAindaExiste: true, houveDebito: false }),
    "ja_finalizada_por_outra_via",
  );
});

test("row sumiu mas nunca houve débito (equipe/admin/bypass) → nada a devolver", () => {
  assert.equal(
    decidirFalhaSemClaim({ rowAindaExiste: false, houveDebito: false }),
    "sem_cobranca",
  );
});
