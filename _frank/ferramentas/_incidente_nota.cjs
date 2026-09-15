/**
 * _incidente_nota.cjs — resolver o incidente CERTO, e anexar nota PROVANDO que gravou.
 *
 * POR QUE EXISTE (medido em 15/09, em producao). O `cancelar_assinatura.cjs`
 * cancelou a assinatura do Luciano na Hotmart (irreversivel) e imprimiu
 * "registrado no incidente 407." sem ter registrado NADA. Duas falhas
 * empilhadas, e as duas sao caladas por natureza:
 *
 *   1. O ALVO ERRADO / ALVO NENHUM. O script fazia `.eq("id", "407")` com o
 *      NUMERO do incidente num campo `uuid`. Numero de incidente (`numero`,
 *      bigint, 1..409) e id (`uuid`) sao coisas diferentes, e a pessoa que
 *      opera fala "#407" — nunca o uuid. Resolver por PREFIXO tambem nao
 *      salva: "407" e prefixo de `4071ee9a-…`, que e o incidente **#399**.
 *      Medido hoje no banco: `numero=407` e `d5e1acb2-3d44-…`. Ou seja, o
 *      caminho "prefixo" acerta o card ERRADO com ar de acerto.
 *   2. A ESCRITA NAO CONFERIDA. `update(...).eq("id", inexistente)` afeta
 *      ZERO linhas e NAO devolve erro. Sem `.select()` e sem contar as linhas,
 *      "gravou" e "nao existe" sao indistinguiveis — e o script imprimia
 *      sucesso incondicional na linha seguinte.
 *
 * Isto e a armadilha 1 do `_frank/03_ROTINA.md` ("consulta que erra volta
 * VAZIA") aplicada a ESCRITA, e a mesma que o cabecalho do
 * `anotar_incidente.cjs` ja documentava ("UPDATE POR ID INEXISTENTE AFETA 0
 * LINHAS EM SILENCIO"). Aquele arquivo resolvia; este aqui existe pra que a
 * solucao deixe de ser dele sozinho e vire peca compartilhada e testavel.
 *
 * REGRAS QUE ESTE MODULO IMPOE:
 *   - So-digitos e NUMERO do incidente, nunca prefixo de uuid. A convencao da
 *     casa e "#407"; deixar o prefixo ganhar foi o que apontou pro #399.
 *   - Nao achou, ou achou mais de um => RECUSA. Nunca escolhe o "mais
 *     provavel": alvo errado aqui vira nota no card de outra pessoa.
 *   - NOTA SE ANEXA, NUNCA SE SOBRESCREVE. Le o array, acrescenta um item.
 *     (A ronda das 03h de 21/08 perdeu 4 historicos fazendo `update` direto.)
 *   - Escrita se CONFERE: `.select()`, exatamente 1 linha, e o array
 *     releito com o tamanho esperado. Sem isso nao ha "gravou", ha "mandei".
 *
 * Nao requer `_comum.cjs` de proposito: `db` entra por parametro, entao da pra
 * testar tudo sem banco, sem rede e sem `.env.local`.
 *
 * Testes: node --test _frank/ferramentas/_incidente_nota.test.cjs
 */

/** So aceita o que pode ser numero ou uuid/prefixo — barra lixo antes da consulta. */
const FORMATO_ALVO = /^[0-9a-f-]+$/i;
const SO_DIGITOS = /^\d+$/;

/**
 * Teto da leitura de incidents. A lista existe pra garantir UNICIDADE; se ela
 * vier truncada, "prefixo unico" vira mentira silenciosa (a armadilha 1 de
 * novo). Entao truncou => recusa, nao adivinha. Hoje sao 396 incidentes.
 */
const TETO_LEITURA = 5000;

const ehNumero = (alvo) => SO_DIGITOS.test(String(alvo ?? "").trim());

/**
 * `agent_notes` ja corrompido (string, do acidente de 21/08 do Vigia) vira UMA
 * nota legada em vez de derrubar a escrita — perder o texto seria pior.
 * Mesma logica do `anotar_incidente.cjs`.
 */
function normalizarNotas(atual) {
  if (Array.isArray(atual)) return atual;
  if (atual === null || atual === undefined) return [];
  if (typeof atual === "string") {
    return [
      {
        at: null,
        by: "desconhecido",
        note:
          "[HISTORICO RECUPERADO DE STRING CORROMPIDA — o array jsonb foi " +
          "sobrescrito por concatenacao de string; os objetos originais ja " +
          "estavam perdidos neste ponto] " + atual,
        legado: true,
      },
    ];
  }
  return [atual];
}

/**
 * Resolve `--incidente` (numero OU uuid OU prefixo de uuid) no uuid de verdade.
 *
 * Devolve `{ incidente: {id, numero, title, status}, via, avisos[] }`.
 * LANCA quando nao acha ou quando o prefixo e ambiguo — recusar e o ponto do
 * modulo: seguir em frente aqui escreve no card de outra pessoa.
 */
async function resolverIncidente(db, alvoCru) {
  const alvo = String(alvoCru ?? "").trim();

  if (!alvo) {
    throw new Error("--incidente veio vazio — passe o numero (ex.: 407) ou o uuid.");
  }
  if (alvo.startsWith("--")) {
    throw new Error(
      `--incidente recebeu "${alvo}", que e outra flag: faltou o valor. Use --incidente 407.`,
    );
  }
  if (!FORMATO_ALVO.test(alvo)) {
    throw new Error(
      `"${alvo}" nao e numero de incidente nem uuid/prefixo (so digitos, hex e hifen).`,
    );
  }

  const { data, error } = await db
    .from("incidents")
    .select("id,numero,title,status")
    .limit(TETO_LEITURA);
  if (error) throw new Error(`falha lendo incidents: ${JSON.stringify(error)}`);
  if (!Array.isArray(data)) {
    throw new Error("a leitura de incidents nao devolveu lista — nao vou adivinhar o alvo.");
  }
  if (data.length >= TETO_LEITURA) {
    throw new Error(
      `leitura de incidents truncada em ${TETO_LEITURA} linhas — nao da pra garantir que o alvo e unico.`,
    );
  }

  const avisos = [];
  const porPrefixo = data.filter((i) =>
    String(i.id).toLowerCase().startsWith(alvo.toLowerCase()),
  );

  // --- caminho do NUMERO -------------------------------------------------
  // O que quebrou hoje. "407" e o numero visivel do incidente; tratar como
  // prefixo de uuid casa com 4071ee9a (#399) e anota no card errado.
  if (ehNumero(alvo)) {
    const n = Number(alvo);
    const porNumero = data.filter((i) => i.numero !== null && Number(i.numero) === n);

    if (porNumero.length > 1) {
      throw new Error(
        `numero ${n} aparece em ${porNumero.length} incidentes (${porNumero
          .map((h) => String(h.id).slice(0, 8))
          .join(", ")}) — nao vou escolher por voce.`,
      );
    }
    if (porNumero.length === 1) {
      const escolhido = porNumero[0];
      const colisao = porPrefixo.filter((p) => p.id !== escolhido.id);
      if (colisao.length) {
        // Nao e erro: e exatamente o caso 407 -> 4071ee9a. Fica gritado no log
        // pra que a proxima pessoa veja a armadilha em vez de redescobrir.
        avisos.push(
          `"${alvo}" tambem e prefixo de ${colisao
            .map((c) => `${String(c.id).slice(0, 8)} (#${c.numero})`)
            .join(", ")} — tratei como NUMERO do incidente (#${escolhido.numero}), que e a convencao da casa.`,
        );
      }
      return { incidente: escolhido, via: "numero", avisos };
    }
    // numero nao existe: cai pro prefixo, mas avisa que a leitura obvia falhou.
    avisos.push(`nenhum incidente com numero ${n}; tentando como prefixo de uuid.`);
  }

  // --- caminho do UUID / PREFIXO -----------------------------------------
  if (porPrefixo.length === 0) {
    throw new Error(
      `nenhum incidente com numero ou id comecando por "${alvo}" — nao vou dar UPDATE em alvo que nao existe (afetaria 0 linhas em silencio).`,
    );
  }
  if (porPrefixo.length > 1) {
    throw new Error(
      `"${alvo}" e ambiguo (${porPrefixo.length}): ${porPrefixo
        .map((h) => `${String(h.id).slice(0, 12)} (#${h.numero})`)
        .join(", ")}`,
    );
  }
  return { incidente: porPrefixo[0], via: "prefixo", avisos };
}

/**
 * Anexa UMA nota ao `agent_notes` do incidente ja resolvido e CONFERE a escrita.
 *
 * `incidente` e o objeto devolvido por `resolverIncidente` (ou o uuid cru).
 * LANCA se o UPDATE nao afetar exatamente 1 linha ou se o array releito nao
 * tiver o tamanho esperado. Quem chama decide o que fazer com a falha — no
 * cancelamento ela e GRAVE, porque a Hotmart ja cancelou e nao tem desfazer.
 */
async function anexarNota(db, incidente, texto, opts = {}) {
  const id = incidente && typeof incidente === "object" ? incidente.id : incidente;
  const por = opts.por || "frank";
  const agora = opts.agora || new Date().toISOString();

  if (!id) throw new Error("anexarNota: sem id resolvido — passe o retorno de resolverIncidente.");
  if (!texto || !String(texto).trim()) throw new Error("anexarNota: nota vazia.");

  const leitura = await db
    .from("incidents")
    .select("id,agent_notes")
    .eq("id", id)
    .maybeSingle();
  if (leitura.error) {
    throw new Error(`falha lendo agent_notes de ${id}: ${JSON.stringify(leitura.error)}`);
  }
  if (!leitura.data) {
    throw new Error(`incidente ${id} nao existe mais na hora da escrita — nada foi gravado.`);
  }

  const antes = normalizarNotas(leitura.data.agent_notes);
  const eraLegado = leitura.data.agent_notes != null && !Array.isArray(leitura.data.agent_notes);
  // ANEXA. Nunca `update({agent_notes: [nota]})`: isso apaga o historico.
  const esperado = [...antes, { at: agora, by: por, note: String(texto) }];

  const escrita = await db
    .from("incidents")
    .update({ agent_notes: esperado })
    .eq("id", id)
    .select("id,agent_notes");
  if (escrita.error) {
    throw new Error(`falha gravando agent_notes em ${id}: ${JSON.stringify(escrita.error)}`);
  }

  // O ponto do `.select()`: UPDATE por id inexistente devolve [] SEM erro.
  const linhas = Array.isArray(escrita.data) ? escrita.data : escrita.data ? [escrita.data] : [];
  if (linhas.length !== 1) {
    throw new Error(
      `o UPDATE afetou ${linhas.length} linhas, esperava 1 — a nota NAO foi gravada em ${id}.`,
    );
  }

  const gravado = linhas[0];
  if (!Array.isArray(gravado.agent_notes)) {
    throw new Error(
      `agent_notes de ${id} voltou ${typeof gravado.agent_notes}, nao array — escrita suspeita, trate como NAO gravada.`,
    );
  }
  if (gravado.agent_notes.length !== esperado.length) {
    throw new Error(
      `agent_notes de ${id} voltou com ${gravado.agent_notes.length} notas, esperava ${esperado.length} — escrita NAO conferida.`,
    );
  }

  return { id, antes: antes.length, depois: gravado.agent_notes.length, eraLegado };
}

module.exports = {
  resolverIncidente,
  anexarNota,
  normalizarNotas,
  ehNumero,
  TETO_LEITURA,
};
