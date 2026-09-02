/**
 * Régua do painel do SGP (/admin/sgp).
 *
 * O que estes testes protegem, na ordem de importância pro time de suporte:
 *  1. quem está parado há +48h aparece marcado e NO TOPO;
 *  2. a frase de "o que fazer" não vaza jargão (o time não lê código);
 *  3. quem está entregue não sobe na frente de quem precisa de ação.
 *
 * Rodar (Node ≥ 22.18, type-stripping nativo):
 *   node --test src/lib/sgp/painel.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ETAPA_HUMANA,
  montarLinha,
  ordenar,
  resumir,
  tempoHumano,
  SGP_PARADO_HORAS,
} from "./painel.ts";
import type { SgpPedidoRow, SgpStatus } from "./types.ts";

const H = 60 * 60 * 1000;
const AGORA = new Date("2026-09-02T12:00:00Z").getTime();

function pedido(over: Partial<SgpPedidoRow> = {}): SgpPedidoRow {
  return {
    id: "id-1",
    sessao: "sess",
    nome: "Fulano",
    email: "f@x.com",
    whatsapp: "5561999998888",
    email_verificado_at: null,
    codigo_hash: null,
    codigo_expira_em: null,
    codigo_tentativas: 0,
    conta_existente: false,
    user_id: null,
    criado_em: new Date(AGORA - 10 * H).toISOString(),
    atualizado_em: new Date(AGORA - 1 * H).toISOString(),
    status: "foto",
    ciencia_foto: null,
    ciencia_foto_at: null,
    ciencia_audio: null,
    ciencia_audio_at: null,
    aceite_lgpd_at: null,
    fotos: [],
    audios: [],
    enviado_em: null,
    foto_pronta_em: null,
    voz_pronta_em: null,
    voice_id: null,
    erro: null,
    ...over,
  };
}

test("tempoHumano fala como gente, não em ISO", () => {
  assert.equal(tempoHumano(40 * 60_000), "40min");
  assert.equal(tempoHumano(5 * H), "5h");
  assert.equal(tempoHumano(24 * H), "1 dia");
  assert.equal(tempoHumano(55 * H), "2 dias e 7h");
  assert.equal(tempoHumano(-5), "0min"); // relógio torto não vira número negativo na tela
});

test("parado no wizard há +48h é marcado e manda cobrar o aluno", () => {
  const l = montarLinha(
    pedido({ status: "foto", atualizado_em: new Date(AGORA - 55 * H).toISOString() }),
    AGORA,
  );
  assert.equal(l.parado, true);
  assert.equal(l.precisaAcao, true);
  assert.equal(l.etapa, "Enviando as fotos");
  assert.equal(l.paradoTexto, "2 dias e 7h");
  assert.match(l.oQueFazer, /Cobrar o aluno/);
  assert.match(l.oQueFazer, /fotos/);
});

test("dentro das 48h no wizard não vira ação — não se cobra quem acabou de entrar", () => {
  const l = montarLinha(
    pedido({ status: "audio", atualizado_em: new Date(AGORA - 3 * H).toISOString() }),
    AGORA,
  );
  assert.equal(l.parado, false);
  assert.equal(l.precisaAcao, false);
  assert.match(l.oQueFazer, /Aguardar/);
  assert.match(l.oQueFazer, new RegExp(`${SGP_PARADO_HORAS}h`));
});

test("entregue há muito tempo NÃO é 'parado' — a régua só vale pro wizard", () => {
  const l = montarLinha(
    pedido({
      status: "pronto",
      atualizado_em: new Date(AGORA - 30 * 24 * H).toISOString(),
      enviado_em: new Date(AGORA - 30 * 24 * H).toISOString(),
      foto_pronta_em: new Date(AGORA - 30 * 24 * H).toISOString(),
      voz_pronta_em: new Date(AGORA - 30 * 24 * H).toISOString(),
    }),
    AGORA,
  );
  assert.equal(l.parado, false);
  assert.equal(l.precisaAcao, false);
  assert.equal(l.oQueFazer, "Nada a fazer. Já foi entregue.");
  assert.equal(l.foto, "ok");
  assert.equal(l.voz, "ok");
});

test("falhou vira ação sem prometer prazo (regra do Johnny/Lucas)", () => {
  const l = montarLinha(pedido({ status: "falhou", erro: "timeout no treino" }), AGORA);
  assert.equal(l.precisaAcao, true);
  assert.match(l.oQueFazer, /NÃO prometa prazo/);
  assert.equal(l.erro, "timeout no treino");
});

test("processando/enviado travado há dias deixa de ser 'nada a fazer'", () => {
  const ok = montarLinha(
    pedido({
      status: "processando",
      enviado_em: new Date(AGORA - 2 * H).toISOString(),
      atualizado_em: new Date(AGORA - 2 * H).toISOString(),
    }),
    AGORA,
  );
  assert.match(ok.oQueFazer, /Nada a fazer/);
  assert.equal(ok.foto, "gerando");

  const travado = montarLinha(
    pedido({
      status: "processando",
      enviado_em: new Date(AGORA - 60 * H).toISOString(),
      atualizado_em: new Date(AGORA - 60 * H).toISOString(),
    }),
    AGORA,
  );
  assert.match(travado.oQueFazer, /Avise o time técnico/);
});

test("antes do envio, Foto/Voz mostram o que falta, não um '-' mudo", () => {
  const l = montarLinha(
    pedido({ fotos: [{ key: "a", status: "aprovada" }], audios: [] }),
    AGORA,
  );
  assert.equal(l.foto, "1 de 4");
  assert.equal(l.voz, "nenhum");
});

test("nenhuma frase de ação vaza jargão técnico pro atendente", () => {
  const jargao = /\.tsx|\.ts\b|\.cjs|PR ?#|sgp_pedidos|status ?=|user_id|null|undefined|API|endpoint/i;
  const todos: SgpStatus[] = [
    "dados",
    "foto",
    "audio",
    "revisao",
    "enviado",
    "processando",
    "pronto",
    "falhou",
  ];
  for (const status of todos) {
    for (const idadeH of [1, 100]) {
      const l = montarLinha(
        pedido({ status, atualizado_em: new Date(AGORA - idadeH * H).toISOString() }),
        AGORA,
      );
      assert.equal(jargao.test(l.oQueFazer), false, `jargão em ${status}/${idadeH}h: ${l.oQueFazer}`);
      assert.equal(jargao.test(l.etapa), false, `jargão na etapa ${status}`);
      assert.notEqual(l.etapa, status, `etapa de ${status} não foi traduzida`);
    }
  }
});

test("todo status possível tem tradução — status novo não pode vazar cru na tela", () => {
  const todos: SgpStatus[] = [
    "dados",
    "foto",
    "audio",
    "revisao",
    "enviado",
    "processando",
    "pronto",
    "falhou",
  ];
  for (const s of todos) assert.equal(typeof ETAPA_HUMANA[s], "string");
});

test("ordem: quem precisa de ação vem antes de quem só está velho", () => {
  const entregueVelho = montarLinha(
    pedido({
      id: "entregue",
      status: "pronto",
      atualizado_em: new Date(AGORA - 30 * 24 * H).toISOString(),
    }),
    AGORA,
  );
  const paradoRecente = montarLinha(
    pedido({ id: "parado-49h", status: "foto", atualizado_em: new Date(AGORA - 49 * H).toISOString() }),
    AGORA,
  );
  const paradoAntigo = montarLinha(
    pedido({ id: "parado-5d", status: "dados", atualizado_em: new Date(AGORA - 5 * 24 * H).toISOString() }),
    AGORA,
  );
  const ordem = ordenar([entregueVelho, paradoRecente, paradoAntigo]).map((l) => l.id);
  assert.deepEqual(ordem, ["parado-5d", "parado-49h", "entregue"]);
});

test("contadores batem por etapa e contam só os parados de verdade", () => {
  const linhas = [
    montarLinha(pedido({ id: "1", status: "foto", atualizado_em: new Date(AGORA - 55 * H).toISOString() }), AGORA),
    montarLinha(pedido({ id: "2", status: "foto", atualizado_em: new Date(AGORA - 2 * H).toISOString() }), AGORA),
    montarLinha(pedido({ id: "3", status: "pronto", atualizado_em: new Date(AGORA - 99 * H).toISOString() }), AGORA),
  ];
  const r = resumir(linhas);
  assert.equal(r.total, 3);
  assert.equal(r.parados, 1); // o "pronto" velho NÃO conta
  assert.deepEqual(
    r.porEtapa.map((e) => [e.status, e.n]),
    [
      ["foto", 2],
      ["pronto", 1],
    ],
  );
});

test("linha sem nome/whatsapp não quebra a tela", () => {
  const l = montarLinha(pedido({ nome: null, email: null, whatsapp: null }), AGORA);
  assert.equal(l.nome, "(sem nome)");
  assert.equal(l.email, "—");
  assert.equal(l.whatsapp, "—");
});

/** Caso REAL medido no banco em 02/09 — a aluna do chamado #206. */
test("reproduz o caso real da Wallana (travada em 'foto' desde 31/08)", () => {
  const l = montarLinha(
    pedido({
      id: "0fd2845a-addf-450e-9ff4-340a698c62a0",
      nome: "Wallana Daphiny Pereira Rodrigues",
      email: "wallanadaphiny@icloud.com",
      whatsapp: "5561993107338",
      status: "foto",
      criado_em: "2026-08-31T14:02:39.283Z",
      atualizado_em: "2026-08-31T14:07:05.103Z",
      fotos: [{ key: "a", status: "aprovada" }],
      audios: [],
    }),
    new Date("2026-09-02T18:00:00Z").getTime(),
  );
  assert.equal(l.etapa, "Enviando as fotos");
  assert.equal(l.parado, true);
  assert.equal(l.paradoTexto, "2 dias e 3h");
  assert.equal(l.foto, "1 de 4");
  assert.match(l.oQueFazer, /Cobrar o aluno.*WhatsApp.*fotos/);
});
