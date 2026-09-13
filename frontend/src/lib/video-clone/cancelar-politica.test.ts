/**
 * Réguas do cancelamento do Vídeo Clone (incidente 13/09).
 * node --test — sem alias `@/`, sem banco.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  STATUS_EM_VOO,
  podeCancelar,
  motivoNaoCancelavel,
  lerEspera,
  minutosDesde,
} from "./cancelar-politica.ts";

test("só cancela o que está em voo", () => {
  assert.equal(podeCancelar("pending"), true);
  assert.equal(podeCancelar("generating"), true);
  // Terminais: nada a cancelar.
  assert.equal(podeCancelar("ready"), false);
  assert.equal(podeCancelar("failed"), false);
  assert.equal(podeCancelar("canceled"), false);
  assert.equal(podeCancelar("qualquer_coisa"), false);
});

test("STATUS_EM_VOO é exatamente o gate de reivindicação do finalizeVideoClone", () => {
  // Se estes dois conjuntos divergirem, abre a janela de entrega tardia que o
  // cartão manda fechar: uma row cancelada passaria a casar no UPDATE do
  // webhook e viraria `ready` com o crédito já devolvido.
  assert.deepEqual([...STATUS_EM_VOO], ["pending", "generating"]);
});

test("job que JÁ ficou pronto não vira mensagem de erro genérica", () => {
  // "já ficou pronto" é notícia boa — tratar como erro faria o aluno achar
  // que perdeu o vídeo.
  assert.match(motivoNaoCancelavel("ready"), /já ficou pronto/i);
  assert.match(motivoNaoCancelavel("ready"), /histórico/i);
});

test("cancelado e falhado têm mensagens distintas, e a de falha cita o estorno", () => {
  assert.match(motivoNaoCancelavel("canceled"), /já foi cancelada/i);
  assert.match(motivoNaoCancelavel("failed"), /créditos já voltaram/i);
  assert.notEqual(motivoNaoCancelavel("canceled"), motivoNaoCancelavel("failed"));
});

test("leitura da espera bate com a distribuição medida (p90 34,2min / máx 97min)", () => {
  assert.equal(lerEspera(0), "normal");
  assert.equal(lerEspera(13), "normal"); // mediana medida: 13,8 min
  assert.equal(lerEspera(34), "normal"); // ainda dentro do p90
  assert.equal(lerEspera(35), "fila_cheia"); // passou do p90 → é fila, não travamento
  assert.equal(lerEspera(61), "fila_cheia"); // o momento da reclamação do incidente
  assert.equal(lerEspera(97), "fila_cheia"); // o máximo medido AINDA entregou
  assert.equal(lerEspera(100), "acima_do_medido"); // fora de tudo que já se viu
});

test("o caso do incidente não é classificado como travamento", () => {
  // rafapaga reclamou aos ~61min; o vídeo saiu aos ~95min. Em nenhum dos dois
  // instantes a tela pode dizer que travou — porque não travou.
  assert.notEqual(lerEspera(61), "acima_do_medido");
  assert.notEqual(lerEspera(95), "acima_do_medido");
});

test("minutosDesde conta certo e não devolve negativo", () => {
  const agora = Date.parse("2026-09-13T01:00:00Z");
  assert.equal(minutosDesde("2026-09-13T00:00:00Z", agora), 60);
  assert.equal(minutosDesde("2026-09-13T00:59:30Z", agora), 0);
  // Relógio torto (row criada "no futuro") não vira número negativo na tela.
  assert.equal(minutosDesde("2026-09-13T02:00:00Z", agora), 0);
  // Data inválida não propaga NaN pra interface.
  assert.equal(minutosDesde("nao-e-data", agora), 0);
});
