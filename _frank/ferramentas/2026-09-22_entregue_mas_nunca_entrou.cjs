#!/usr/bin/env node
/**
 * entregue_mas_nunca_entrou.cjs — "a casa entregou o clone; o aluno chegou a ENTRAR?"
 *
 * POR QUE EXISTE (medido 22/09, ronda ~00hZ). O #505 ("ENTREGAMOS O CLONE E
 * TRANCAMOS A PORTA") foi investigado a fundo e fechado CERTO: a falta de
 * acesso do comprador de SGP e regra comercial do Lucas de 31/08, e os 39 do
 * cartao FORAM avisados de que o material estava pronto. Mas aquele cartao
 * mediu **"foi avisado?"**. Ninguem nunca mediu **"entrou?"**.
 *
 * Sao perguntas diferentes e a segunda e a que o aluno sente. Medido na
 * primeira passada: 128 pedidos em 'pronto' com user_id, 110 ja entraram
 * alguma vez, **18 NUNCA entraram** (14%), o mais velho pronto ha 15,9 dias.
 * A Walsicleia (#525, 7 e-mails dela) e UM desses 18 — ela nao e um caso
 * isolado, e o caso barulhento de uma classe silenciosa.
 *
 * ⚠️ O QUE ESTE SCRIPT **NAO** PROVA, e esta escrito aqui pra ninguem
 * transformar o numero em acusacao:
 *
 *   (a) "NUNCA ENTROU" != "ESTA TRANCADO". Quem comprou o SGP foi avisado por
 *       escrito de que precisa assinar a parte pra USAR o clone; parte dos 18
 *       pode ter lido e escolhido nao voltar. O numero mede ausencia, nao
 *       impedimento.
 *   (b) COORTE NOVA CONTAMINA A COMPARACAO. Quem ficou pronto ontem ainda nao
 *       teve tempo de entrar. Por isso o corte por idade existe e por isso o
 *       relatorio imprime a idade de cada linha — comparar pre/pos conserto
 *       sem casar a janela de idade e o erro obvio aqui.
 *   (c) "SEM recovery_sent_at" NAO E "A CASA NAO TENTOU". Depois do fix do
 *       #435 (commit 7871f590, 16/09 21:50:18Z) a carta de fim de onboarding
 *       leva PARAGRAFO_SENHA com link de AUTO-ATENDIMENTO (CRIAR_SENHA_URL)
 *       em vez de a casa disparar resetPasswordForEmail. Conta pos-fix sem
 *       recovery e o comportamento ESPERADO do conserto. Esta armadilha me
 *       mordeu ao vivo na ronda de 22/09 e eu derrubei a propria hipotese na
 *       mesma ronda — nao a reintroduza.
 *
 * CONTROLE POSITIVO EMBUTIDO: se a Walsicleia (conhecida, pre-fix, 4 links e
 * zero consumo) NAO for reencontrada entre os que nunca entraram, o script
 * MORRE em vez de imprimir numero. Zero que nao bate com nada ja enganou esta
 * casa mais de uma vez.
 *
 * Só LEITURA: nao escreve linha, nao manda carta, nao gasta GPU.
 *
 * uso: node _frank/ferramentas/2026-09-22_entregue_mas_nunca_entrou.cjs [--json]
 */
const { supa } = require("./_comum.cjs");

/** commit 7871f590 — os 3 fins de onboarding passam a levar o link da senha (#435) */
const CORTE_435 = new Date("2026-09-16T21:50:18Z");
/** controle positivo: caso conhecido que TEM que aparecer na lista */
const CONTROLE = "walsicleia_kaka@hotmail.com";

const JSONMODE = process.argv.includes("--json");

/** Le a tabela inteira PAGINADA — a consulta do Supabase corta em 1000. */
async function tudo(db, tabela, colunas) {
  const out = [];
  for (let de = 0; ; de += 500) {
    const r = await db.from(tabela).select(colunas).range(de, de + 499);
    // imprime o erro CRU antes de acreditar em qualquer zero
    if (r.error) {
      console.error(`ERRO ao ler ${tabela}[${de}]:`, JSON.stringify(r.error));
      process.exit(1);
    }
    out.push(...(r.data ?? []));
    if ((r.data ?? []).length < 500) break;
  }
  return out;
}

const dias = (d) => (Date.now() - new Date(d).getTime()) / 86400000;
const f1 = (n) => n.toFixed(1);

(async () => {
  const db = supa();

  const pedidos = (await tudo(db, "sgp_pedidos", "email,nome,status,user_id,voz_pronta_em,criado_em"))
    .filter((p) => p.status === "pronto" && p.user_id);
  const perfis = await tudo(db, "profiles", "id,email,onboarding_ready_email_at");
  const porId = new Map(perfis.map((p) => [p.id, p]));

  const nunca = [];
  let entraram = 0;
  for (const p of pedidos) {
    const r = await db.auth.admin.getUserById(p.user_id);
    if (r.error) {
      console.error(`ERRO auth ${p.email}:`, JSON.stringify(r.error));
      process.exit(1);
    }
    const u = r.data.user;
    if (u.last_sign_in_at) { entraram++; continue; }
    nunca.push({
      email: p.email,
      nome: p.nome ?? "",
      pronto_em: p.voz_pronta_em || p.criado_em,
      avisado_em: porId.get(p.user_id)?.onboarding_ready_email_at ?? null,
      link_em: u.recovery_sent_at || u.invited_at || null,
    });
  }
  nunca.sort((a, b) => new Date(a.pronto_em) - new Date(b.pronto_em));

  // ---- controle positivo: sem ele, nao imprime numero ----
  if (!nunca.some((n) => n.email === CONTROLE)) {
    console.error(
      `CONTROLE POSITIVO FALHOU: ${CONTROLE} deveria estar entre os que nunca entraram ` +
      `(pre-fix, 4 links, zero consumo) e NAO foi reencontrado. ` +
      `Ou ela finalmente entrou — o que e NOTICIA BOA e exige atualizar este controle — ` +
      `ou a consulta quebrou. Nao imprimo numero em cima de controle furado.`,
    );
    process.exit(1);
  }

  const antes = nunca.filter((n) => n.avisado_em && new Date(n.avisado_em) < CORTE_435);
  const depois = nunca.filter((n) => n.avisado_em && new Date(n.avisado_em) >= CORTE_435);
  const semCarimbo = nunca.filter((n) => !n.avisado_em);

  if (JSONMODE) {
    console.log(JSON.stringify({ entregues: pedidos.length, entraram, nunca }, null, 2));
    return;
  }

  console.log(`controle positivo OK (${CONTROLE} reencontrado) · ${pedidos.length} entregues varridos\n`);
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`🚪 ENTREGUE E NUNCA ENTROU: ${nunca.length} de ${pedidos.length} (${f1((nunca.length / pedidos.length) * 100)}%)`);
  console.log("══════════════════════════════════════════════════════════════════════");
  console.log(`   ja entraram alguma vez ......... ${entraram}`);
  console.log(`   mais velho pronto ha ........... ${f1(dias(nunca[0].pronto_em))}d (${nunca[0].email})`);
  console.log(`   sem carimbo de aviso ........... ${semCarimbo.length}`);

  const bloco = (rot, arr, nota) => {
    console.log(`\n── ${rot}: ${arr.length}`);
    if (nota) console.log(`   ${nota}`);
    for (const n of arr) {
      console.log(
        `   ${f1(dias(n.pronto_em)).padStart(5)}d · aviso ${n.avisado_em ? n.avisado_em.slice(0, 16) : "NENHUM"}` +
        ` · link ${n.link_em ? n.link_em.slice(0, 16) : "NENHUM"} · ${n.email}`,
      );
    }
  };
  bloco("AVISADOS ANTES do fix do #435 (carta mandava pra porta sem chave)", antes);
  bloco(
    "AVISADOS DEPOIS do fix (carta ja levava o link da senha)",
    depois,
    "'link NENHUM' aqui e ESPERADO: pos-fix a carta leva auto-atendimento, a casa nao dispara recovery.",
  );
  if (semCarimbo.length) bloco("SEM CARIMBO DE AVISO", semCarimbo);

  console.log(`\n>>> NUMERO PRO RELATORIO: ${nunca.length} entregue(s) que nunca entrou · mais velho ${f1(dias(nunca[0].pronto_em))}d`);
  console.log(`    ⚠️  NAO leia como "trancados": comprar SGP nao da a plataforma (regra do Lucas, 31/08) e`);
  console.log(`        parte deles pode ter lido isso e escolhido nao voltar. E NAO compare ${antes.length} x ${depois.length}`);
  console.log(`        sem casar a janela de IDADE — a coorte pos-fix e mais nova e ainda teve menos tempo.`);
})();
