#!/usr/bin/env node
/**
 * AS DECISÕES QUE ESTÃO TRAVADAS NO DONO — uma lista só, em vez de espalhadas
 * por dez cartões.
 *
 * ── POR QUE EXISTE ────────────────────────────────────────────────────────
 * A ronda das 13h de 26/09 mediu, conferindo os mais antigos um a um, o padrão
 * que explica por que a fila não baixa: *"o topo da fila não está parado por
 * falta de investigação. Está parado em decisões do dono."* Ela nomeou os
 * cartões e deixou a lista consolidada como pendência explícita pra ronda
 * seguinte. Esta é a ronda seguinte.
 *
 * O valor é o recorte: o Johnny lê no celular e não vai abrir dez cartões pra
 * descobrir que em todos o passo que falta é uma frase dele. Aqui sai o número
 * do cartão, quem está esperando, há quanto tempo, e O QUE exatamente precisa
 * ser decidido — com o custo em dinheiro quando existe.
 *
 * NÃO escreve no banco. NÃO decide nada. NÃO fecha cartão.
 *
 * ARMADILHAS RESPEITADAS:
 *   - a idade sai de `first_seen_at` (régua canônica da casa), não de
 *     `created_at`, que em cartão reaberto mente;
 *   - resolve cada cartão por NÚMERO e recusa se não achar — lista que some um
 *     item em silêncio é pior que lista nenhuma;
 *   - imprime o status REAL de cada um, porque `aguardando_aluno` num caso que
 *     espera o DONO é rótulo errado e a ordem de 21/09 mede isso;
 *   - a coluna "o que falta" é TEXTO MEU, declarado como meu: vem da leitura
 *     das notas, não é campo do banco. Quem quiser a fonte abre o cartão.
 *
 * USO: node _frank/ferramentas/2026-09-26_decisoes_travadas_no_dono.cjs
 */
const { supa } = require("./_comum.cjs");

/** O que falta em cada um — leitura das notas feita na ronda de 26/09 15hZ. */
const PAUTA = [
  { n: 249, falta: "o \"pode\" pra chamar no WhatsApp — e-mail está morto como canal", dono: "Johnny", dinheiro: "parte dos R$ 1.427,60" },
  { n: 250, falta: "o \"pode\" pra chamar no WhatsApp — e-mail está morto como canal", dono: "Johnny", dinheiro: "parte dos R$ 1.427,60" },
  { n: 589, falta: "o \"pode\" pra chamar no WhatsApp (3º pedido preso na mesma pergunta)", dono: "Johnny", dinheiro: null },
  { n: 263, falta: "devolver ou não os R$ 97 de 08/08", dono: "Johnny", dinheiro: "R$ 97,00" },
  { n: 551, falta: "o esticão de acesso VENCE 03/10 12:00Z e a assinatura segue canceled: reativar na Hotmart ou decidir o que acontece", dono: "Johnny", dinheiro: "+ reembolso da Comunidade R$ 1.803,60" },
  { n: 594, falta: "ligar ou não TTS_TAIL_QA_INTERNO_MODO=reprovando (chave de ambiente, sem deploy, custa GPU)", dono: "Johnny", dinheiro: null },
  { n: 590, falta: "teto do PM2: subir ou não", dono: "Johnny", dinheiro: null },
  { n: 52, falta: "decisão do Johnny (ver nota do cartão)", dono: "Johnny", dinheiro: null },
  { n: 216, falta: "decisão do Johnny (ver nota do cartão)", dono: "Johnny", dinheiro: null },
  { n: 226, falta: "decisão do Johnny (ver nota do cartão)", dono: "Johnny", dinheiro: null },
  { n: 234, falta: "decisão do Johnny (ver nota do cartão)", dono: "Johnny", dinheiro: null },
];

const DIAS = (iso) => (iso ? ((Date.now() - new Date(iso).getTime()) / 86400000).toFixed(1) : "?");

(async () => {
  const db = supa();
  const numeros = PAUTA.map((p) => p.n);
  const { data: cards, error } = await db
    .from("incidents")
    .select("id,numero,status,signature,affected_emails,first_seen_at,created_at,occurrences,agent_notes")
    .in("numero", numeros);
  if (error) { console.error("ERRO incidents:", error.message); process.exit(1); }

  const porN = new Map((cards ?? []).map((c) => [c.numero, c]));
  const faltando = numeros.filter((n) => !porN.has(n));
  if (faltando.length) {
    console.error(`cartões não encontrados: ${faltando.join(", ")} — PARE (lista que perde item em silêncio não serve).`);
    process.exit(1);
  }

  const linhas = PAUTA.map((p) => ({ ...p, c: porN.get(p.n) }))
    .sort((a, b) => new Date(a.c.first_seen_at ?? a.c.created_at) - new Date(b.c.first_seen_at ?? b.c.created_at));

  console.log("DECISÕES TRAVADAS NO DONO — fila de incidentes do FastCloner");
  console.log(`medido em ${new Date().toISOString()} · ${linhas.length} cartões\n`);
  console.log("As duas colunas que importam: há quanto tempo está parado, e qual é a frase que falta.\n");

  for (const l of linhas) {
    const c = l.c;
    const quem = (c.affected_emails ?? []).join(", ") || "(sem aluno nomeado)";
    console.log(`#${String(c.numero).padEnd(4)} ${String(DIAS(c.first_seen_at ?? c.created_at)).padStart(5)}d  [${c.status}]`);
    console.log(`      aluno: ${quem}`);
    console.log(`      FALTA: ${l.falta}`);
    if (l.dinheiro) console.log(`      dinheiro em jogo: ${l.dinheiro}`);
    console.log("");
  }

  const comDinheiro = linhas.filter((l) => l.dinheiro);
  console.log("─".repeat(70));
  console.log(`${linhas.length} cartões parados numa decisão que não é da ronda.`);
  console.log(`${comDinheiro.length} deles têm dinheiro de aluno em jogo: ${comDinheiro.map((l) => "#" + l.n).join(", ")}`);
  const maisVelho = linhas[0];
  console.log(`o mais velho: #${maisVelho.n}, parado há ${DIAS(maisVelho.c.first_seen_at ?? maisVelho.c.created_at)} dias.`);
  console.log("\n⚠️  A coluna FALTA é leitura MINHA das notas, não campo do banco.");
  console.log("    Os quatro cartões com \"ver nota do cartão\" são os que a ronda das 13h");
  console.log("    classificou como \"decisão do Johnny\" sem transcrever qual: quem for");
  console.log("    decidir abre o cartão. Não inventei a pergunta pra encher a linha.");
})();
