/**
 * `node --test src/lib/onboarding/resgate-audio.test.ts`
 *
 * Import com extensão `.ts` explícita e sem alias `@/`: o runner do
 * `node --test` não resolve o alias (lição do PR #159).
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { decidirResgate, mbDeclaradoNoErro } from "./resgate-audio.ts";

/** Os mesmos tetos de `import.ts`. Copiados de propósito: se lá mudarem, o
 *  teste continua descrevendo o contrato que o conserto do #194 depende. */
const TETO_RESGATE = 4 * 1024 * 1024 * 1024; // MAX_AUDIO_SOURCE_BYTES
const AGORA = 1_000_000;
const DEADLINE = AGORA + 300_000;

const base = {
  streamsRestantes: 3,
  agoraMs: AGORA,
  deadlineMs: DEADLINE,
  tetoResgateBytes: TETO_RESGATE,
};

/** A mensagem que `drive.ts` levanta ao recusar pelo content-length. */
const recusaPorTamanho = (mb: number) => `Arquivo abc123 tem ${mb}MB (teto 400MB)`;

describe("mbDeclaradoNoErro", () => {
  test("lê o MB da recusa por content-length", () => {
    assert.equal(mbDeclaradoNoErro(recusaPorTamanho(10905)), 10905);
  });

  test("lê o MB da recusa do arquivo local já em disco", () => {
    assert.equal(mbDeclaradoNoErro("arquivo fonte.bin de 878 MB passa do teto"), 878);
  });

  test("devolve null quando a mensagem não traz número", () => {
    assert.equal(mbDeclaradoNoErro("passa do teto"), null);
    assert.equal(mbDeclaradoNoErro("Arquivo abc não está público no Drive"), null);
  });
});

describe("decidirResgate", () => {
  test("recusa que NÃO é de tamanho nunca vira resgate", () => {
    const d = decidirResgate({
      ...base,
      msgErro: "Arquivo abc123 não está público no Drive (veio página HTML, não o arquivo)",
    });
    assert.deepEqual(d, { resgatar: false, motivo: "nao_e_tamanho" });
  });

  test("arquivo acima do teto do resgate NÃO gasta vaga, mesmo com as 3 livres", () => {
    // O coração do #194: 10,9GB não cabe nos 4GB, então tentar é jogar vaga fora.
    const d = decidirResgate({ ...base, msgErro: recusaPorTamanho(10905) });
    assert.deepEqual(d, { resgatar: false, motivo: "nao_cabe_no_resgate" });
  });

  test("arquivo que cabe no teto do resgate é resgatado", () => {
    const d = decidirResgate({ ...base, msgErro: recusaPorTamanho(490) });
    assert.deepEqual(d, { resgatar: true });
  });

  test("sem vaga não resgata", () => {
    const d = decidirResgate({ ...base, streamsRestantes: 0, msgErro: recusaPorTamanho(490) });
    assert.deepEqual(d, { resgatar: false, motivo: "sem_vaga" });
  });

  test("fora do relógio não resgata", () => {
    const d = decidirResgate({ ...base, agoraMs: DEADLINE + 1, msgErro: recusaPorTamanho(490) });
    assert.deepEqual(d, { resgatar: false, motivo: "sem_tempo" });
  });

  test("sem número legível mantém o comportamento antigo: tenta", () => {
    const d = decidirResgate({ ...base, msgErro: "passa do teto" });
    assert.deepEqual(d, { resgatar: true });
  });

  /**
   * A REGRESSÃO, com a pasta real do johnathan.ppires@gmail.com (#180/#194).
   * Ordem alfabética, que é a que o Drive entrega. Antes do conserto o de
   * 490MB — o único com 28min22s de fala — ficava sem vaga.
   */
  test("pasta real do Johnathan: o arquivo de 490MB é resgatado", () => {
    const pastaEmMB = [10905, 9422, 106, 2065, 490, 6408, 48, 164, 161, 185, 190, 228, 10046, 8594, 2218];
    const MAX_VAGAS = 3;

    const rodar = (comConserto: boolean) => {
      let vagas = MAX_VAGAS;
      const resgatados: number[] = [];
      for (const mb of pastaEmMB) {
        if (mb <= 400) continue; // baixa normal, não passa pelo resgate
        const msgErro = recusaPorTamanho(mb);
        if (comConserto) {
          const d = decidirResgate({ ...base, streamsRestantes: vagas, msgErro });
          if (!d.resgatar) continue;
          vagas--;
        } else {
          // O comportamento anterior: debita a vaga antes de saber se cabe.
          if (vagas <= 0) continue;
          vagas--;
        }
        if (mb * 1e6 <= TETO_RESGATE) resgatados.push(mb);
      }
      return resgatados;
    };

    // Antes: as duas primeiras vagas morrem em 10905 e 9422; sobra uma, que vai
    // pro 2065 — e o 490 (o que abre a porta) fica de fora.
    assert.deepEqual(rodar(false), [2065]);

    // Depois: as vagas vão para os três arquivos que realmente cabem.
    assert.deepEqual(rodar(true), [2065, 490, 2218]);
    assert.ok(rodar(true).includes(490));
  });
});
