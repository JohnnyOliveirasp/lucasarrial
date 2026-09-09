/**
 * VARREDURA DE `payment_events.error` (#324, 09/09/2026).
 *
 * POR QUE ESTA FERRAMENTA EXISTE. O webhook da Hotmart já denunciava as falhas
 * — gravava a mensagem em `payment_events.error` e seguia com HTTP 200. Só que
 * NINGUÉM LIA ESSE CAMPO. Em 09/09 a mensagem "boas-vindas do SGP não saíram"
 * ficou 7 HORAS gravada e muda enquanto dois compradores pagavam e não
 * conseguiam entrar. O erro estar registrado não serve de nada se ninguém olha.
 *
 * O QUE ELA NÃO FAZ, DE PROPÓSITO: despejar os 84 erros da janela. Medido em
 * 09/09, 79 dos 84 (30 dias) são de UMA família benigna — cancelamento de um
 * código de assinatura antigo que nunca teve entitlement, enquanto a assinatura
 * atual do mesmo comprador segue viva e paga (18 de 19 casos tinham o
 * entitlement ativo criado NO MESMO DIA do cancelamento: é troca de plano /
 * reassinatura, não caloteiro). Uma varredura que grita 79 linhas de ruído é
 * ignorada na segunda semana — que é exatamente como o campo `error` morreu.
 * Então aqui o ruído é CONTADO e resumido, e só o acionável aparece por extenso.
 *
 * Uso:
 *   node varrer_erros_webhook.cjs [--dias 7] [--tudo] [--json]
 *     --dias N   janela (padrão 7)
 *     --tudo     lista também o que foi classificado como ruído, caso a caso
 *     --json     saída crua, pra encadear com outra ferramenta
 *
 * Só LÊ. Não escreve em lugar nenhum, não manda e-mail, não estorna.
 */
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");
require(path.join(RAIZ, "frontend", "node_modules", "dotenv")).config({
  path: path.join(RAIZ, "frontend", ".env.local"),
});

const PROJECT = "yizerthyrgrajivlotcw";

/**
 * SQL pela Management API, e não PostgREST, de propósito: a classificação
 * precisa cruzar `payment_events` com `entitlements`, e a regra da casa é não
 * concluir "zero ocorrências" em cima de consulta com `.limit()` — aqui não há
 * paginação pra errar, o banco devolve o agregado pronto.
 */
async function consultar(sql) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN ausente em frontend/.env.local");
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJECT}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`Management API HTTP ${r.status}: ${txt.slice(0, 300)}`);
  return JSON.parse(txt);
}

/**
 * As classes, em ordem de gravidade. `acao` é o que a pessoa faz AO VER —
 * escrito pra quem atende, não pra quem lê código.
 */
const CLASSES = {
  sgp_nao_recebeu: {
    ordem: 1,
    titulo: "COMPRADOR DO SGP PAGOU E NÃO RECEBEU O E-MAIL",
    acao:
      "É o e-mail que leva o link de definir senha — sem ele a pessoa não entra. " +
      "Gere um link novo e reenvie as boas-vindas. Confira o Enviados antes, " +
      "pra não mandar em dobro.",
  },
  sgp_sem_conta: {
    ordem: 2,
    titulo: "CONTA DO COMPRADOR DO SGP NÃO FOI CRIADA",
    acao:
      "A pessoa pagou e não tem conta. Crie a conta pelo painel e mande o link " +
      "de definir senha.",
  },
  compra_orfa: {
    ordem: 3,
    titulo: "COMPRA ÓRFÃ SEM AVISO",
    acao:
      "Pagamento entrou sem conta ligada e o aviso não saiu por canal nenhum. " +
      "Siga o playbook de compra órfã (achar o entitlement pelo e-mail da compra).",
  },
  revoke_sem_dono: {
    ordem: 4,
    titulo: "CANCELAMENTO SEM DONO — e o comprador NÃO tem assinatura viva",
    acao:
      "Cancelamento que não achou a assinatura, e a pessoa não tem outra ativa. " +
      "Normalmente é compra que nunca chegou a ser aprovada (nada a fazer), mas " +
      "confira se ela não está usando o produto sem pagar.",
  },
  revoke_sem_id: {
    ordem: 5,
    titulo: "CANCELAMENTO COM externalId NÃO EXTRAÍDO DO PAYLOAD",
    acao: "Defeito de leitura do payload. Vai pro time técnico, não tem ação de atendimento.",
  },
  desconhecido: {
    ordem: 6,
    titulo: "ERRO QUE ESTA VARREDURA NÃO SABE CLASSIFICAR",
    acao:
      "Família de erro nova (ou redação mudou). Leia a mensagem e, se virar " +
      "rotina, acrescente a classe nesta ferramenta.",
  },
};

/**
 * Cancelamento sem dono cujo comprador TEM assinatura ativa e viva = troca de
 * plano/reassinatura. É ruído conhecido: some do relatório e vira contagem.
 */
const CLASSE_RUIDO = "revoke_reassinatura";

function sqlDaVarredura(dias) {
  return `
with e as (
  select
    pe.received_at,
    pe.buyer_email,
    pe.event_type,
    pe.error,
    (regexp_match(pe.error, 'entitlement: ([A-Z0-9]+)'))[1] as ext_cancelado
  from payment_events pe
  where pe.error is not null
    and pe.received_at > now() - interval '${dias} days'
),
c as (
  select
    e.*,
    exists (
      select 1 from entitlements en
      where en.buyer_email = e.buyer_email
        and en.status = 'active'
        and (en.access_until is null or en.access_until > now())
    ) as tem_assinatura_viva
  from e
)
select
  received_at,
  buyer_email,
  event_type,
  error,
  tem_assinatura_viva,
  case
    when error like 'boas-vindas do SGP não saíram%'
      or error like 'boas-vindas do SGP desistiram%'
      or error like 'boas-vindas do SGP falharam%'      then 'sgp_nao_recebeu'
    when error like 'conta do SGP não criada%'          then 'sgp_sem_conta'
    when error like 'compra órfã sem canal de aviso%'   then 'compra_orfa'
    when error like 'externalId não extraído%'          then 'revoke_sem_id'
    when error like 'externalId não casa%'
      and tem_assinatura_viva                           then '${CLASSE_RUIDO}'
    when error like 'externalId não casa%'              then 'revoke_sem_dono'
    else 'desconhecido'
  end as classe
from c
order by received_at desc`;
}

function idadeHoras(iso) {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

function humanoIdade(h) {
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 48) return `${Math.round(h)}h`;
  return `${Math.floor(h / 24)}d`;
}

(async () => {
  const argv = process.argv.slice(2);
  const dias = Number(argv[argv.indexOf("--dias") + 1]) || 7;
  const tudo = argv.includes("--tudo");
  const json = argv.includes("--json");

  const linhas = await consultar(sqlDaVarredura(dias));

  if (json) {
    console.log(JSON.stringify(linhas, null, 2));
    return;
  }

  const acionaveis = linhas.filter((l) => l.classe !== CLASSE_RUIDO);
  const ruido = linhas.filter((l) => l.classe === CLASSE_RUIDO);

  console.log(`\nERROS DO WEBHOOK — últimos ${dias} dias`);
  console.log(`${linhas.length} no total · ${acionaveis.length} pedem ação · ${ruido.length} ruído conhecido\n`);

  if (!acionaveis.length) {
    // Silêncio não distingue "tudo bem" de "a varredura morreu": ela FALA.
    console.log("Nada pedindo ação nesta janela.\n");
  }

  const porClasse = new Map();
  for (const l of acionaveis) {
    if (!porClasse.has(l.classe)) porClasse.set(l.classe, []);
    porClasse.get(l.classe).push(l);
  }
  const ordenadas = [...porClasse.entries()].sort(
    (a, b) => (CLASSES[a[0]]?.ordem ?? 99) - (CLASSES[b[0]]?.ordem ?? 99),
  );

  for (const [classe, itens] of ordenadas) {
    const meta = CLASSES[classe] ?? CLASSES.desconhecido;
    console.log(`\n■ ${meta.titulo}  (${itens.length})`);
    console.log(`  O QUE FAZER: ${meta.acao}`);
    console.log("");
    // mais velho primeiro: quem espera há mais tempo é quem dói mais
    for (const l of itens.sort((a, b) => new Date(a.received_at) - new Date(b.received_at))) {
      const idade = humanoIdade(idadeHoras(l.received_at));
      console.log(`  · [há ${idade}] ${l.buyer_email ?? "(sem e-mail)"} — ${l.event_type}`);
      console.log(`      ${l.error}`);
    }
  }

  if (ruido.length) {
    console.log(`\n─────────────────────────────────────────────`);
    console.log(`RUÍDO CONHECIDO (${ruido.length}) — não precisa de ação`);
    console.log(
      `  Cancelamento de código de assinatura antigo cujo comprador TEM\n` +
        `  assinatura ativa e viva: troca de plano/reassinatura. Rode com --tudo\n` +
        `  pra ver caso a caso.`,
    );
    if (tudo) {
      for (const l of ruido) {
        console.log(`  · [há ${humanoIdade(idadeHoras(l.received_at))}] ${l.buyer_email} — ${l.error}`);
      }
    }
  }
  console.log("");
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
