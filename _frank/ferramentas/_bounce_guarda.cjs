/**
 * A GUARDA DE BOUNCE **ANTES** DO ENVIO — decidir se ainda vale a pena
 * escrever pra um endereço que a própria casa já viu quicar.
 *
 * O QUE FALTAVA (medido em 20/09). O `enviar_email.cjs` tem memória de UM
 * tipo só: "eu já mandei este aviso pra esta pessoa?" (`_envios.cjs`). Contra
 * endereço que a casa JÁ PROVOU que não existe, zero — as três ocorrências de
 * "bounce" no script são comentário e a gravação que acontece DEPOIS do envio.
 * O dado estava na mesma tabela (`emails_enviados`) que o script escreve, a
 * uma consulta de distância, e ninguém lia antes de falar no SMTP.
 *
 * ⚠️ POR QUE A GUARDA ÓBVIA ESTÁ ERRADA — E ESTE É O CORAÇÃO DO ARQUIVO.
 * O desenho intuitivo ("nunca mais escreva pra endereço que bounceou") teria
 * BARRADO UMA CAIXA VIVA. Timeline medida de `lucianadox1@gmail.com`:
 *
 *   16/09 13:04:43  1º código do SGP enviado
 *   16/09 13:15:29  2º código enviado
 *   16/09 13:15:47  `email_verificado_at` CARIMBADO — 18s depois do 2º código
 *   16/09 13:50:04  bounce "inexistente" chega... referente à carta das 13:04
 *   20/09 11:28:29  carta da ronda pro MESMO endereço, sem bounce nenhum
 *
 * E o carimbo não é fraco: `api/v1/sgp/codigo/route.ts` exige
 * `hashCodigo(codigo) === pedido.codigo_hash` (linha 29) antes de gravar
 * (linha 36). Ela RECEBEU o código naquele endereço e digitou o certo. A caixa
 * FUNCIONA — o bounce "inexistente" das 13:50 é que estava errado, ou venceu.
 *
 * Então a regra aqui NÃO é "existe bounce?", é **"qual é a notícia MAIS
 * RECENTE sobre esta caixa?"**. Bounce permanente só bloqueia enquanto for a
 * última palavra. Qualquer sinal de vida POSTERIOR reabre a porta. Uma trava
 * que ignora isso deixa o aluno sem resposta por causa de histórico velho — e
 * aluno em silêncio é o dano que a casa já pagou caro pra aprender a evitar.
 *
 * SEGURANÇA DE FALHA: aqui é ABERTO, ao contrário do `_envios.cjs`. Os dois
 * erram pra lados opostos de propósito, porque o dano é oposto. Lá, errar é
 * mandar a carta DUAS VEZES (chato, recuperável). Aqui, errar é NÃO MANDAR —
 * o aluno fica sem notícia achando que foi ignorado. Na dúvida, esta guarda
 * libera e fala alto; ela só fecha quando tem prova de que não adianta.
 *
 * Módulo PURO: zero `require`, zero IO, zero rede. Quem lê o banco é o
 * `enviar_email.cjs`; aqui só entra dado já lido. É isto que permite testar
 * cada fronteira da decisão que faz (ou não faz) um aluno receber uma carta.
 *
 * Testes: npx tsx --test _frank/ferramentas/_bounce_guarda.test.cjs
 */

/**
 * As classes que o `mail-bounce.ts` produz e que significam "reenviar por este
 * caminho NÃO vai funcionar". Copiadas do `ORIENTACAO` de lá, onde cada uma
 * tem, escrito, o passo humano que justifica estar nesta lista:
 *
 *   inexistente      "Reenviar para este endereço NUNCA vai funcionar."
 *   spam-saida       "NÃO adianta reenviar pelo mesmo caminho — sai o mesmo 550."
 *   bloqueio-destino "Reenviar não resolve enquanto o bloqueio durar."
 *
 * ⚠️ `desconhecida` FICA DE FORA, de propósito. Ela quer dizer "a entrega
 * falhou e o motivo não foi reconhecido" — e o passo de lá é "ler o
 * diagnóstico cru e classificar na mão". Não-reconhecido não é prova de
 * endereço morto; bloquear nela seria transformar ignorância em veredito. São
 * 3 dos 11 bounces reais da base hoje (guitaschetti ×2, alinedutra_) e nenhum
 * deles tem qualquer indício de endereço inválido.
 */
const CLASSES_PERMANENTES = ["inexistente", "spam-saida", "bloqueio-destino"];

/**
 * `caixa-cheia` e `temporaria` NUNCA bloqueiam: o próprio `ORIENTACAO` manda
 * tentar de novo mais tarde ("tentar de novo mais tarde costuma funcionar",
 * "o servidor ainda tenta sozinho"). Reenvio ali é o comportamento CERTO, não
 * o acidente. Lista explícita só pra deixar a intenção escrita — o código
 * decide por `CLASSES_PERMANENTES`, e o que não está lá já não bloqueia.
 */
const CLASSES_TEMPORARIAS = ["caixa-cheia", "temporaria"];

/**
 * Quanto tempo um envio sem bounce precisa ter pra valer como sinal de vida.
 *
 * NÃO É NÚMERO CHUTADO. "Enviei e não voltou bounce" é ausência de notícia, e
 * a tabela inteira foi desenhada em cima disso (`108_emails_enviados.sql`: "não
 * tem coluna entregue de propósito"). Logo depois do envio, "sem bounce" quase
 * sempre quer dizer "o bounce ainda não chegou" — e ler isso como vida faria a
 * guarda se auto-destruir: bastava alguém insistir uma vez pra liberar todas as
 * próximas.
 *
 * Latência medida nos 11 bounces reais da base (20/09): os permanentes
 * voltaram em 0,9 min (filosofiadeogro) e 45,4 min (lucianadox1); os lentos
 * (~48-51 h) são todos `temporaria`/`caixa-cheia`, que é o servidor remoto
 * reteentando dois dias antes de desistir — e esses não bloqueiam mesmo.
 *
 * 24 h fica com folga acima do pior permanente medido e abaixo da cauda lenta.
 * ⚠️ A amostra de permanentes é de DOIS casos: isto é uma escolha defensável,
 * não uma distribuição. Regulável por `maturacaoHoras` justamente porque o
 * número deve mudar quando houver base pra mudar.
 */
const MATURACAO_PADRAO_HORAS = 24;

/** Mesmo critério de igualdade de endereço do `_envios.cjs`. */
function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/** Data → ms, ou `null` quando ilegível. Nunca lança. */
function instante(valor) {
  const t = Date.parse(valor ?? "");
  return Number.isFinite(t) ? t : null;
}

function ehPermanente(classe) {
  return CLASSES_PERMANENTES.includes(String(classe || "").trim().toLowerCase());
}

/**
 * O ÚLTIMO bounce permanente do histórico — é ele, e só ele, que pode fechar
 * a porta.
 *
 * ⚠️ A ÂNCORA É O `enviado_em`, NÃO O `bounce_em` — e este teste custou caro.
 * `bounce_em` é quando a CASA DESCOBRIU que não chegou (a varredura roda de
 * tempos em tempos); o fato que o bounce prova é "a carta que saiu às
 * `enviado_em` não chegou". Os dois relógios andam longe: medido na base em
 * 20/09, a descoberta veio de 0,9 min a 51 h depois do envio.
 *
 * Ancorar na descoberta reprova a Luciana. O carimbo do código dela é de
 * 16/09 13:15:47 — DEPOIS da carta que falhou (13:04:43), mas ANTES de a casa
 * ler o bounce (13:50:04). Medindo contra a descoberta, a prova de que a caixa
 * funciona seria descartada por ser "velha demais", e a guarda calaria
 * justamente a aluna que o cartão mandou proteger. Medindo contra a tentativa
 * que falhou, a ordem dos fatos volta a fazer sentido: ela recebeu e confirmou
 * um código DEPOIS da carta que quicou.
 *
 * Sem `enviado_em` legível, cai pro `bounce_em`; sem nenhum dos dois, `null` —
 * e `null` VENCE a comparação de propósito: não dá pra provar que algo veio
 * depois de um instante ilegível, e inventar data aqui seria inventar
 * permissão de envio.
 */
function ancoraDoBounce(linha) {
  return instante(linha.enviado_em) ?? instante(linha.bounce_em);
}

function ultimoBouncePermanente(historico) {
  let pior = null;
  for (const linha of historico || []) {
    if (!linha || !linha.bounce_em || !ehPermanente(linha.bounce_classe)) continue;
    const t = ancoraDoBounce(linha);
    if (pior === null) {
      pior = { linha, t };
      continue;
    }
    // Ilegível vence: é o caso em que nada consegue se provar posterior.
    if (pior.t === null) continue;
    if (t === null || t > pior.t) pior = { linha, t };
  }
  return pior;
}

/**
 * OS SINAIS DE VIDA, do mais forte pro mais fraco.
 *
 * 1. `email_verificado_at` posterior ao bounce — PROVA. Só existe se a pessoa
 *    digitou o código certo que foi mandado PRA AQUELE ENDEREÇO. E o carimbo
 *    não fica pra trás quando o aluno troca de e-mail: `api/v1/sgp/inicio/
 *    route.ts:58` zera (`pedido.email === email ? ... : null`), então ele
 *    sempre se refere ao endereço que está na linha. Conferido no código, não
 *    suposto.
 *
 * 2. Envio posterior ao bounce SEM bounce carimbado, e já MADURO — indício.
 *    Vale menos porque é ausência de notícia (ver `MATURACAO_PADRAO_HORAS`).
 *
 * O envio posterior ainda VERDE (mais novo que a maturação) não libera, mas é
 * devolvido à parte: quem lê o bloqueio merece saber que existe uma carta no
 * ar cujo destino ainda não se sabe.
 */
function sinaisDeVida({ historico, verificacoes }, depoisDe, agora, maturacaoMs) {
  const sinais = [];
  const verdes = [];

  for (const iso of verificacoes || []) {
    const t = instante(iso);
    if (t === null || depoisDe === null || t <= depoisDe) continue;
    sinais.push({
      tipo: "codigo-confirmado",
      forca: "prova",
      at: iso,
      detalhe: "o aluno digitou o código certo mandado PRA ESTE endereço (email_verificado_at)",
    });
  }

  for (const linha of historico || []) {
    if (!linha || linha.bounce_em) continue; // quicou: não é sinal de vida
    const t = instante(linha.enviado_em);
    if (t === null || depoisDe === null || t <= depoisDe) continue;
    const idadeMs = agora - t;
    const alvo = idadeMs >= maturacaoMs ? sinais : verdes;
    alvo.push({
      tipo: "envio-sem-bounce",
      forca: idadeMs >= maturacaoMs ? "indicio" : "verde",
      at: linha.enviado_em,
      horas: idadeMs / 3600000,
      detalhe: `carta de ${linha.origem || "origem desconhecida"} saiu depois do bounce e não voltou`,
    });
  }

  sinais.sort((a, b) => (a.forca === "prova" ? -1 : b.forca === "prova" ? 1 : 0));
  return { sinais, verdes };
}

/**
 * A DECISÃO — pura, determinística, sem banco.
 *
 * `historico`: linhas de `emails_enviados` DAQUELE destinatário
 *              ({ enviado_em, bounce_em, bounce_classe, origem }).
 * `verificacoes`: `sgp_pedidos.email_verificado_at` daquele e-mail (ISO).
 *
 * Devolve SEMPRE o que achou, inclusive quando libera: com `--forcar` quem
 * manda precisa ver o histórico antes de decidir mandar mesmo assim.
 */
function decidirPorBounce(
  { historico = [], verificacoes = [] } = {},
  { agora = Date.now(), forcar = false, maturacaoHoras = MATURACAO_PADRAO_HORAS } = {},
) {
  const maturacaoMs = Math.max(0, Number(maturacaoHoras) || 0) * 3600000;
  const bounce = ultimoBouncePermanente(historico);

  if (!bounce) {
    // Sem bounce permanente não há o que decidir. Inclui o caso mais comum de
    // todos (endereço sem histórico nenhum) e os temporários, que nunca fecham.
    return { bloqueia: false, forcado: false, bounce: null, sinais: [], verdes: [], motivo: null };
  }

  const { sinais, verdes } = sinaisDeVida({ historico, verificacoes }, bounce.t, agora, maturacaoMs);
  const achado = {
    bloqueia: false,
    forcado: false,
    bounce: {
      at: bounce.linha.bounce_em,
      /** A tentativa que falhou — é contra ela que os sinais são medidos. */
      envioEm: bounce.linha.enviado_em ?? null,
      classe: String(bounce.linha.bounce_classe || "").trim().toLowerCase(),
      dataIlegivel: bounce.t === null,
    },
    sinais,
    verdes,
    motivo: null,
  };

  if (sinais.length) {
    // A última notícia é de vida. A porta reabre — e o histórico vai junto.
    return achado;
  }
  if (forcar) {
    return { ...achado, forcado: true, motivo: "bounce permanente é a última notícia desta caixa" };
  }
  return { ...achado, bloqueia: true, motivo: "bounce permanente é a última notícia desta caixa" };
}

module.exports = {
  CLASSES_PERMANENTES,
  CLASSES_TEMPORARIAS,
  MATURACAO_PADRAO_HORAS,
  normalizarEmail,
  instante,
  ehPermanente,
  ancoraDoBounce,
  ultimoBouncePermanente,
  sinaisDeVida,
  decidirPorBounce,
};
