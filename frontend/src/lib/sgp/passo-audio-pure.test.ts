/**
 * Tela 3 do SGP — o que estes testes protegem:
 *
 *  1. o botão "Continuar" nunca fica cinza sem a tela dizer POR QUÊ (caso da
 *     Catarina, 20/09: 37h parada com um arquivo "aprovado", `motivos: []`,
 *     `avisos: []`, ✓ verde e botão morto — faltavam 30 SEGUNDOS de fala);
 *  2. o número que aparece é o REAL: 30 segundos vira "30 segundo(s)", não
 *     "1 min" arredondado, e o texto diz que a conta é de FALA e não de
 *     duração do arquivo;
 *  3. a régua NÃO afrouxou: 20 min de fala aprovada e os 4 itens continuam
 *     obrigatórios, e quatro cópias do mesmo item não valem quatro itens;
 *  4. o que volta do banco reidrata os checkboxes (é isso que faz atualizar a
 *     página deixar de apagar as marcações — `ciencia_audio` estava NULL no
 *     pedido dela).
 *
 * Rodar (o alias @/ não é usado aqui, mas tsx é o runner da casa):
 *   npx tsx --test src/lib/sgp/passo-audio-pure.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  cienciaAudioValida,
  motivosBloqueioAudio,
  podeContinuarAudio,
  podeGuardarRascunhoCienciaAudio,
  type EstadoPassoAudio,
} from "./passo-audio-pure.ts";
import { CIENCIA_AUDIO, SGP_AUDIO_MAX_SEGUNDOS, SGP_AUDIO_MIN_SEGUNDOS } from "./types.ts";

const TODAS = [...CIENCIA_AUDIO];
/** Estado "tudo certo menos o que o teste quer medir". */
const OK: EstadoPassoAudio = {
  falaAprovada: SGP_AUDIO_MIN_SEGUNDOS,
  arquivos: 1,
  ocupado: false,
  ciencia: CIENCIA_AUDIO.length,
};

// ─── o texto que o aluno lê de verdade ──────────────────────────────────────
// Não basta o motivo estruturado estar certo: o defeito da Catarina foi a
// AUSÊNCIA de texto na tela. Aqui resolvemos a chave no pt-BR de produção e
// interpolamos como o next-intl faz, pra um motivo sem tradução quebrar o teste.
const PT = JSON.parse(readFileSync(new URL("../../../messages/pt-BR.json", import.meta.url), "utf8")) as {
  sgp: { audio: { bloqueio: Record<string, string> } };
};

function texto(chave: string, vals: Record<string, string | number>): string {
  const bruto = PT.sgp.audio.bloqueio[chave];
  assert.ok(bruto, `pt-BR não tem sgp.audio.bloqueio.${chave}`);
  return bruto.replace(/\{(\w+)\}/g, (_, k: string) => {
    assert.ok(k in vals, `placeholder {${k}} sem valor em ${chave}`);
    return String(vals[k]);
  });
}

test("(CATARINA) 1.170s de fala bloqueia e o motivo diz que faltam 30 SEGUNDOS", () => {
  // O pedido dela, exatamente: um arquivo aprovado, as 4 caixinhas marcadas.
  const estado: EstadoPassoAudio = { falaAprovada: 1170, arquivos: 1, ocupado: false, ciencia: 4 };
  assert.equal(podeContinuarAudio(estado), false);
  assert.deepEqual(motivosBloqueioAudio(estado), [
    { tipo: "fala", faltamSegundos: 30, falaAprovada: 1170, unidade: "segundos", quanto: 30 },
  ]);
});

test("(CATARINA) o TEXTO na tela dela diz 30 segundos, e diz que a conta é de fala", () => {
  const [m] = motivosBloqueioAudio({ falaAprovada: 1170, arquivos: 1, ocupado: false, ciencia: 4 });
  assert.equal(m.tipo, "fala");
  if (m.tipo !== "fala") return;
  const frase = texto("falaSegundos", { n: m.quanto, tem: "19:30", min: SGP_AUDIO_MIN_SEGUNDOS / 60 });
  assert.match(frase, /30 segundo/);
  assert.match(frase, /FALA/); // a aluna não tem como adivinhar que silêncio não conta
  assert.doesNotMatch(frase, /\{/); // nenhum placeholder sobrou sem valor
});

test("(CATARINA) 30s não viram '1 min' arredondado — o número dito é o número real", () => {
  const [m] = motivosBloqueioAudio({ falaAprovada: 1170, arquivos: 1, ocupado: false, ciencia: 4 });
  if (m.tipo !== "fala") return assert.fail("motivo deveria ser 'fala'");
  assert.equal(m.unidade, "segundos");
  assert.equal(m.quanto, 30);
});

test("1.200s exatos (o mínimo) liberam o botão", () => {
  const estado: EstadoPassoAudio = { falaAprovada: SGP_AUDIO_MIN_SEGUNDOS, arquivos: 1, ocupado: false, ciencia: 4 };
  assert.equal(SGP_AUDIO_MIN_SEGUNDOS, 1200);
  assert.deepEqual(motivosBloqueioAudio(estado), []);
  assert.equal(podeContinuarAudio(estado), true);
});

test("áudio 'aprovado' abaixo do mínimo BLOQUEIA COM MOTIVO — nunca trava mudo", () => {
  // O arquivo passou na medição (aprovado, motivos: [], avisos: []) e ainda
  // assim não dá pros 20 min. Antes a tela só dizia "✓ aprovado".
  for (const fala of [1, 60, 600, 1170, 1199]) {
    const estado: EstadoPassoAudio = { falaAprovada: fala, arquivos: 1, ocupado: false, ciencia: 4 };
    const motivos = motivosBloqueioAudio(estado);
    assert.equal(podeContinuarAudio(estado), false, `${fala}s deveria bloquear`);
    assert.ok(motivos.length > 0, `${fala}s bloqueou SEM motivo — é o bug da Catarina`);
    assert.equal(motivos[0].tipo, "fala");
  }
});

test("INVARIANTE: botão cinza sempre tem motivo, botão aceso nunca tem", () => {
  // É a promessa inteira deste módulo. Se alguma combinação bloquear sem
  // motivo, a tela volta a ter um botão morto sem explicação.
  for (const falaAprovada of [0, 1, 1170, 1199, 1200, 1800, 3600, 3601, 5000]) {
    for (const arquivos of [0, 1, 3]) {
      for (const ocupado of [false, true]) {
        for (const ciencia of [0, 1, 3, 4]) {
          const estado = { falaAprovada, arquivos, ocupado, ciencia };
          const motivos = motivosBloqueioAudio(estado);
          assert.equal(
            podeContinuarAudio(estado),
            motivos.length === 0,
            `texto e disabled divergiram em ${JSON.stringify(estado)}`,
          );
        }
      }
    }
  }
});

test("(4 caixinhas + recarga) o que volta do banco remarca os 4 e o botão acende", () => {
  // Isto é o teste da rota /api/v1/sgp/audio/ciencia: ela grava esta lista, a
  // página devolve em `cienciaInicial` e a tela a higieniza por aqui.
  assert.deepEqual(cienciaAudioValida(TODAS), TODAS);
  assert.equal(podeContinuarAudio({ ...OK, ciencia: cienciaAudioValida(TODAS).length }), true);
});

test("(recarga) rascunho parcial volta parcial, na ordem da lista da tela", () => {
  assert.deepEqual(cienciaAudioValida(["fala_natural", "30min"]), ["30min", "fala_natural"]);
  assert.equal(podeContinuarAudio({ ...OK, ciencia: 2 }), false);
});

test("zero áudio bloqueia com motivo PRÓPRIO (não é 'faltam 20 min')", () => {
  const estado: EstadoPassoAudio = { falaAprovada: 0, arquivos: 0, ocupado: false, ciencia: 4 };
  assert.deepEqual(motivosBloqueioAudio(estado), [{ tipo: "vazio" }]);
  const frase = texto("vazio", { min: SGP_AUDIO_MIN_SEGUNDOS / 60 });
  assert.match(frase, /20 min/);
  assert.doesNotMatch(frase, /\{/);
});

test("zero áudio E zero confirmação: a tela mostra os dois, não um de cada vez", () => {
  assert.deepEqual(motivosBloqueioAudio({ falaAprovada: 0, arquivos: 0, ocupado: false, ciencia: 0 }), [
    { tipo: "vazio" },
    { tipo: "ciencia", faltam: CIENCIA_AUDIO.length },
  ]);
});

test("com arquivo em voo, o único motivo é 'aguardando' — número no meio da análise é mentira curta", () => {
  assert.deepEqual(motivosBloqueioAudio({ falaAprovada: 0, arquivos: 2, ocupado: true, ciencia: 0 }), [
    { tipo: "ocupado" },
  ]);
});

test("acima do máximo bloqueia dizendo que sobrou, não que faltou", () => {
  const estado: EstadoPassoAudio = { falaAprovada: SGP_AUDIO_MAX_SEGUNDOS + 120, arquivos: 4, ocupado: false, ciencia: 4 };
  assert.deepEqual(motivosBloqueioAudio(estado), [{ tipo: "excedeu", sobramSegundos: 120 }]);
  const frase = texto("excedeu", { max: SGP_AUDIO_MAX_SEGUNDOS / 60 });
  assert.match(frase, /60 min/);
  assert.doesNotMatch(frase, /\{/);
});

test("a unidade vira minutos a partir de 1 min faltando, e arredonda PRA CIMA", () => {
  const falta = (segundos: number) => {
    const [m] = motivosBloqueioAudio({ falaAprovada: SGP_AUDIO_MIN_SEGUNDOS - segundos, arquivos: 1, ocupado: false, ciencia: 4 });
    if (m.tipo !== "fala") return assert.fail("motivo deveria ser 'fala'");
    return { unidade: m.unidade, quanto: m.quanto };
  };
  assert.deepEqual(falta(1), { unidade: "segundos", quanto: 1 });
  assert.deepEqual(falta(59), { unidade: "segundos", quanto: 59 });
  assert.deepEqual(falta(60), { unidade: "minutos", quanto: 1 });
  // 61s faltando NÃO pode virar "1 min": o aluno grava 1 min e o botão
  // continua cinza — que é exatamente o defeito de origem, em escala menor.
  assert.deepEqual(falta(61), { unidade: "minutos", quanto: 2 });
  assert.deepEqual(falta(600), { unidade: "minutos", quanto: 10 });
});

test("a régua não afrouxou: 1 segundo a menos que o mínimo ainda bloqueia", () => {
  assert.equal(podeContinuarAudio({ ...OK, falaAprovada: SGP_AUDIO_MIN_SEGUNDOS - 1 }), false);
  assert.equal(podeContinuarAudio({ ...OK, ciencia: CIENCIA_AUDIO.length - 1 }), false);
  assert.equal(podeContinuarAudio({ ...OK, ocupado: true }), false);
});

test("quatro cópias do mesmo item valem 1, não 4", () => {
  const repetido = Array.from({ length: 4 }, () => "silencio");
  assert.deepEqual(cienciaAudioValida(repetido), ["silencio"]);
  assert.equal(podeContinuarAudio({ ...OK, ciencia: cienciaAudioValida(repetido).length }), false);
});

test("o rascunho só é gravado enquanto o aluno está NA tela 3 e não confirmou", () => {
  assert.equal(podeGuardarRascunhoCienciaAudio({ status: "audio", ciencia_audio_at: null }), true);
});

test("depois do Continuar, o rascunho não reescreve o registro de ciência", () => {
  assert.equal(podeGuardarRascunhoCienciaAudio({ status: "audio", ciencia_audio_at: "2026-09-20T15:31:00Z" }), false);
  assert.equal(podeGuardarRascunhoCienciaAudio({ status: "revisao", ciencia_audio_at: "2026-09-20T15:31:00Z" }), false);
  assert.equal(podeGuardarRascunhoCienciaAudio({ status: "foto", ciencia_audio_at: null }), false);
  assert.equal(podeGuardarRascunhoCienciaAudio({ status: "enviado", ciencia_audio_at: null }), false);
});

test("lixo no banco/corpo do request não vira confirmação", () => {
  assert.deepEqual(cienciaAudioValida(["silencio", "inventado", 7, null, { a: 1 }]), ["silencio"]);
  assert.deepEqual(cienciaAudioValida(null), []);
  assert.deepEqual(cienciaAudioValida(undefined), []);
  assert.deepEqual(cienciaAudioValida("silencio"), []);
});
