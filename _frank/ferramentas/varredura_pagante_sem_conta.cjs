/**
 * varredura_pagante_sem_conta.cjs — lê `payment_events.error` e ABRE incidente
 * sozinha quando acha uma compra PAGA que nunca virou conta nem entitlement
 * dono, sem depender de ninguém "ir olhar por acaso".
 *
 * ============================================================================
 * POR QUE ESTE SCRIPT EXISTE (incidente b6036323 / #582, 25/09/2026)
 * ============================================================================
 * O PR #315 (16/09, commit cbfffeb4) fez o webhook da Hotmart começar a GRAVAR
 * o motivo em `payment_events.error` quando uma compra órfã (sem dono por
 * e-mail nem por entitlement) paga não gerava aviso novo — mas NINGUÉM leu essa
 * coluna por 9 dias. A ronda das falhas de 25/09 ~21hZ foi ler manualmente e
 * achou 3 pagantes que a casa não sabia que existiam: Joseph (R$1.483,13, 70d),
 * Isaias (R$1.442,96, 69d) e EZ Motors (USD 40, cobrado no próprio dia). Isso
 * abriu o #582 (`b6036323-1c9e-4202-ab17-0a10c7f6b7f8`) à mão.
 *
 * "Conserto que passa a GRAVAR prova cria uma dívida de LEITURA" — a lição do
 * #582. Este script é o pagamento dessa dívida: em vez de depender de uma
 * ronda tropeçar na coluna de novo, ele lê sozinho e abre o chamado sozinho.
 *
 * ⚠️ NÃO reaproveita nem mergeia `feat/orfa-carencia-sweeper` (3 commits de
 * 08–09/09, sem PR). Medido em 25/09: mergear aquele branch APAGARIA a
 * gravação do #315 (o campo `error` que torna esta varredura possível) e a
 * trava de rajada do #314 (campo `tentativas`) — ou seja, cegaria a casa de
 * novo e desta vez sem nem a prova sobrevivendo. Este arquivo nasce do zero a
 * partir da main de hoje (70a0dd4a), só aproveitando a IDEIA do branch velho
 * ("quem decide é quem varre depois, não o webhook na hora do evento").
 *
 * ============================================================================
 * O QUE CONTA COMO "COMPRA PAGA QUE NÃO VIROU CONTA" AQUI
 * ============================================================================
 * O webhook (frontend/src/app/api/v1/webhooks/hotmart/route.ts:357-372) grava
 * exatamente DUAS frases começando com "compra órfã" quando `avisarCompraOrfa`
 * roda (ou seja: nem o e-mail do comprador nem o dono do entitlement da MESMA
 * assinatura resolveram alguém — `credito-assinatura.ts`):
 *
 *   (a) "compra órfã sem canal de aviso: <email> [<externalId>]"
 *       -> `avisarCompraOrfa` tentou avisar e NENHUM canal aceitou. Dispara
 *          para QUALQUER órfã, pago ou trial (R$0) — o código não filtra por
 *          pagamento aqui.
 *   (b) "compra órfã paga sem aviso novo (motivo: <motivo>): <email> [<extId>]"
 *       -> já é condicionado a `eventoEhPagamento` no próprio webhook.
 *
 * Como (a) NÃO garante pagamento, este script NUNCA confia na frase: ele relê
 * o `payload.data.purchase.price.value` + `.status` de CADA linha e aplica a
 * MESMA regra de pagamento do resto da casa (`acesso-regra.ts:eventoEhPagamento`
 * / `pagou_de_verdade.cjs`): valor > 0 E status em {APPROVED, COMPLETE,
 * COMPLETED}. Sem isso, um trial repetido (medido: 2 dos 6 casos de hoje são
 * R$0) entraria como "pagante" — o mesmo engano que já custou 1.356.554
 * créditos devolvidos por engano em 18/08.
 *
 * FORA DE ESCOPO DE PROPÓSITO — outras frases em `payment_events.error` não
 * significam "pagou e não virou conta": revogação sem entitlement casado,
 * estorno sem usuário identificável, falha de e-mail/conta do SGP (SGP é
 * curso, não dá acesso à plataforma — regra do Lucas 31/08). Cada uma dessas é
 * um instrumento PRÓPRIO, ainda não escrito. Este script varre só a família
 * "compra órfã" porque é exatamente essa a que o b6036323 mediu.
 *
 * ============================================================================
 * IDEMPOTÊNCIA (rodar duas vezes não pode abrir o mesmo incidente duas vezes)
 * ============================================================================
 * Cada evento vira, no máximo, UM incidente, via duas travas:
 *   1. signature = `frank:pagante-sem-conta-orfao:<event_id>` — o `event_id`
 *      é a chave de idempotência do PRÓPRIO `payment_events` (route.ts:127,
 *      upsert onConflict "provider,event_id"), então é estável entre corridas.
 *   2. Se o e-mail JÁ aparece em `affected_emails` de um incidente ainda
 *      ABERTO (open/investigating/fixing) — inclusive um aberto à mão, como o
 *      #582 — este script NÃO abre outro. Sem essa trava, rodar esta varredura
 *      hoje duplicaria os 3 casos do #582 num cartão novo, com uma signature
 *      diferente da que o #582 usa (o #582 foi aberto à mão, fora deste script).
 * Incidente já FECHADO (fixed/ignored) não bloqueia: se a mesma pessoa voltar
 * a aparecer órfã depois de resolvida, isso é fato novo, não duplicata.
 *
 * ============================================================================
 * CONTROLE POSITIVO (obrigatório)
 * ============================================================================
 * A varredura tem que reencontrar, na leitura crua (antes de qualquer filtro
 * de "já tem incidente"), os 3 casos do b6036323: josephgois@hotmail.com,
 * isaias.enf@gmail.com, ezwaymotors@gmail.com. Se faltar UM que seja, o script
 * ABORTA com exit 1 e GRITA — zero aqui é instrumento cego (coluna sumiu,
 * `.like()` quebrou, payload mudou de formato), nunca "não há problema".
 *
 * ============================================================================
 * REGRAS DE ESCRITA
 * ============================================================================
 *  - SÓ LEITURA + INSERT em `incidents`. Nunca mexe em profiles, entitlements,
 *    credit_transactions nem chama a Hotmart. Nunca fecha nem atualiza um
 *    incidente existente (mesmo achando ele "vivo de novo") — a regra de
 *    fechamento é humana e mora só em `_comum.cjs:fechamento`, que este script
 *    nem importa.
 *  - Todo `{data,error}` do Supabase é conferido ANTES de usar `data` —
 *    coluna inexistente falha CALADA e devolve `data: null`/`[]`, e isso já
 *    inventou um "abandono" que não existia (lição de 24/09).
 *  - Supabase corta em 1000 linhas por página: pagina com `.range()` e só para
 *    quando a página vier com MENOS que o tamanho pedido.
 *  - Sem `--confirmar`, só ENSAIA (mesma convenção de `abrir_chamado_*.cjs` e
 *    `anotar_incidente.cjs`): imprime tudo que abriria, sem gravar nada.
 *
 * Uso:
 *   node _frank/ferramentas/varredura_pagante_sem_conta.cjs             # ensaio
 *   node _frank/ferramentas/varredura_pagante_sem_conta.cjs --confirmar # grava
 */
const { supa } = require("./_comum.cjs");

const CONFIRMAR = process.argv.includes("--confirmar");
const PAGINA = 1000; // teto real do PostgREST/Supabase por request
const TETO_INCIDENTS = 5000; // mesmo teto de segurança do _incidente_nota.cjs

// Regra de pagamento da casa (acesso-regra.ts:eventoEhPagamento). Duplicada
// aqui de propósito — estas ferramentas rodam com `node` puro, sem loader de
// TS/alias (mesma limitação documentada em credito-assinatura.ts e vinculo.ts).
const STATUS_PAGO = new Set(["APPROVED", "COMPLETE", "COMPLETED"]);
function eventoEhPagamento(valor, status) {
  const v = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(v) || v <= 0) return false;
  return STATUS_PAGO.has(String(status ?? "").toUpperCase());
}

// Os 3 casos que o b6036323/#582 já mediu à mão — controle positivo.
const CONHECIDOS_B6036323 = [
  "josephgois@hotmail.com",
  "isaias.enf@gmail.com",
  "ezwaymotors@gmail.com",
];

// Incidente com o e-mail em affected_emails e status ainda "vivo" bloqueia
// abertura duplicada. Fechado (fixed/ignored) NÃO bloqueia — reaparecer depois
// de resolvido é fato novo.
const STATUS_VIVOS = new Set(["open", "investigating", "fixing"]);

function asRecord(v) {
  return v && typeof v === "object" ? v : {};
}

/** Extrai valor/moeda/status/transação de `payment_events.payload`, igual a hotmart-payload.ts. */
function lerCompraDoPayload(payload) {
  const purchase = asRecord(asRecord(asRecord(payload).data).purchase);
  const price = asRecord(purchase.price);
  const bruto = price.value;
  let valor = null;
  if (typeof bruto === "number") valor = Number.isFinite(bruto) ? bruto : null;
  else if (typeof bruto === "string" && bruto.trim()) {
    const n = Number(bruto);
    valor = Number.isFinite(n) ? n : null;
  }
  return {
    valor,
    moeda: price.currency_value || price.currency_code || "?",
    status: typeof purchase.status === "string" ? purchase.status.toUpperCase() : "",
    transacao: typeof purchase.transaction === "string" && purchase.transaction ? purchase.transaction : null,
  };
}

/** "compra órfã ...: email [EXTID]" -> "EXTID". Sem o colchete final, devolve null (nunca adivinha). */
function externalIdDoErro(erro) {
  const m = /\[([^[\]]+)\]\s*$/.exec(String(erro ?? ""));
  return m ? m[1] : null;
}

/** Pagina de verdade sobre payment_events.error começando em "compra órfã". */
async function lerEventosOrfaosComErro(db) {
  const linhas = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await db
      .from("payment_events")
      .select("id,event_id,event_type,provider,buyer_email,error,payload,received_at,processed_at")
      .like("error", "compra órfã%")
      .order("received_at", { ascending: true })
      .range(offset, offset + PAGINA - 1);
    if (error) {
      throw new Error(`payment_events (offset ${offset}): ${JSON.stringify(error)}`);
    }
    if (!Array.isArray(data)) {
      throw new Error(`payment_events (offset ${offset}) não devolveu lista — não confio em vazio aqui.`);
    }
    linhas.push(...data);
    if (data.length < PAGINA) break;
    offset += PAGINA;
  }
  return linhas;
}

async function contaTemDono(db, buyerEmail, externalId) {
  const { data: perfil, error: e1 } = await db
    .from("profiles")
    .select("id")
    .ilike("email", buyerEmail.trim())
    .maybeSingle();
  if (e1) throw new Error(`profiles (${buyerEmail}): ${JSON.stringify(e1)}`);

  const { data: ent, error: e2 } = await db
    .from("entitlements")
    .select("user_id,status,access_until")
    .eq("provider", "hotmart")
    .eq("external_id", externalId)
    .maybeSingle();
  if (e2) throw new Error(`entitlements (${externalId}): ${JSON.stringify(e2)}`);

  return {
    temConta: !!perfil?.id,
    temDonoEntitlement: !!ent?.user_id,
    entStatus: ent?.status ?? null,
    entAcessoAte: ent?.access_until ?? null,
  };
}

async function lerIncidentesParaDedupeENumero(db) {
  const { data, error } = await db
    .from("incidents")
    .select("id,numero,status,signature,affected_emails")
    .limit(TETO_INCIDENTS);
  if (error) throw new Error(`incidents (leitura p/ dedupe): ${JSON.stringify(error)}`);
  if (!Array.isArray(data)) throw new Error("incidents não devolveu lista — não vou abrir sem saber o que já existe.");
  if (data.length >= TETO_INCIDENTS) {
    throw new Error(`leitura de incidents truncada em ${TETO_INCIDENTS} linhas — não dá pra garantir que não é duplicata.`);
  }
  return data;
}

function montarIncidente({ numero, caso }) {
  const agora = new Date().toISOString();
  const evidencia = [
    `payment_events.id=${caso.id} event_id=${caso.event_id} provider=${caso.provider} tipo=${caso.event_type}`,
    `recebido em ${caso.received_at}, processado em ${caso.processed_at ?? "?"}`,
    `error gravado: "${caso.error}"`,
    `compra: ${caso.valor} ${caso.moeda} status=${caso.status} transacao=${caso.transacao ?? "?"} (regra: valor>0 e status em APPROVED/COMPLETE/COMPLETED — ver acesso-regra.ts:eventoEhPagamento)`,
    `checado agora (não só no momento do evento): profiles por e-mail exato = ${caso.temConta ? "TEM CONTA" : "0 (sem conta)"}; entitlements.user_id para ${caso.externalId} = ${caso.temDonoEntitlement ? "TEM DONO" : "NULL (órfão)"}`,
    caso.entStatus ? `entitlement ${caso.externalId}: status=${caso.entStatus} access_until=${caso.entAcessoAte ?? "?"}` : null,
  ].filter(Boolean).join("\n  ");

  const titulo =
    `PAGANTE SEM CONTA/ENTITLEMENT (achado pela varredura de payment_events.error): ` +
    `${caso.buyer_email} pagou ${caso.valor} ${caso.moeda} (${caso.status}, transação ${caso.transacao ?? "?"}) ` +
    `em ${caso.received_at}, e continua sem conta e sem dono no entitlement ${caso.externalId}.`;

  const descricao =
    `ABERTO AUTOMATICAMENTE por varredura_pagante_sem_conta.cjs (mesma família do #582/b6036323).\n\n` +
    `EVIDÊNCIA MEDIDA:\n  ${evidencia}\n\n` +
    `POR QUE ISTO É "PAGO E NÃO VIROU CONTA", NÃO RUÍDO:\n` +
    `  O webhook só grava esta família de erro ("compra órfã ...") quando NEM o ` +
    `e-mail do comprador NEM o dono do entitlement da mesma assinatura resolveram ` +
    `alguém (credito-assinatura.ts, avisarOrfa=true). Este script reconferiu o ` +
    `pagamento a partir do payload bruto (não confiou na frase) e reconferiu ` +
    `AGORA, na hora de abrir o cartão, se profiles/entitlements já resolveram — ` +
    `e não resolveram.\n\n` +
    `E-MAIL DO APP ESTÁ MORTO (medido 25/09: Resend recusa com 403, domínio não ` +
    `verificado). Este script NÃO tenta avisar ninguém — só abre o chamado. Quem ` +
    `avisa a pessoa é um humano, por um canal que funcione.\n\n` +
    `NADA FOI TOCADO: nenhuma conta criada, nenhum crédito mexido, nenhuma ` +
    `cobrança nem acesso alterado. Isto é só leitura + abertura de incidente.`;

  return {
    kind: "frank:pagante_sem_conta_orfao_lido",
    cause: "bug",
    categoria: "tecnico",
    status: "open",
    signature: `frank:pagante-sem-conta-orfao:${caso.event_id}`,
    title: titulo.slice(0, 2000),
    occurrences: 1,
    affected_emails: [caso.buyer_email],
    sample_error: caso.error,
    reported_by: "frank/varredura-payment-events-error",
    description: descricao,
    first_seen_at: caso.received_at,
    last_seen_at: agora,
    numero,
  };
}

/**
 * Roda a varredura inteira contra `db` (um cliente supabase-js OU um dublê de
 * teste com a mesma forma). Separado do CLI de propósito — é o que permite
 * testar a lógica (dedupe, controle positivo, insert) sem bater no Supabase de
 * verdade. Lança (nunca `process.exit`) quando algo falha ou quando o
 * controle positivo não fecha — quem decide o exit code é o CLI.
 *
 * @returns {Promise<{resumo: Array<{email:string, acao:string}>, abertos: number}>}
 */
async function rodar(db, { confirmar = false, log = console.log } = {}) {
  log(`Modo: ${confirmar ? "CONFIRMAR (vai gravar)" : "ENSAIO (nada será gravado — use --confirmar pra valer)"}\n`);

  // ------------------------------------------------------------------
  // 1) Ler TODOS os payment_events.error que começam com "compra órfã"
  // ------------------------------------------------------------------
  log("Lendo payment_events.error (prefixo 'compra órfã%'), paginado...");
  const brutos = await lerEventosOrfaosComErro(db);
  log(`  ${brutos.length} linha(s) lida(s).`);

  // ------------------------------------------------------------------
  // 2) Reconfere PAGAMENTO a partir do payload bruto (não confia na frase)
  // ------------------------------------------------------------------
  const candidatos = [];
  for (const row of brutos) {
    const externalId = externalIdDoErro(row.error);
    if (!externalId) {
      console.log(`  ⚠️  ${row.id} — não consegui extrair external_id de "${row.error}"; PULANDO (não adivinho).`);
      continue;
    }
    if (!row.buyer_email) {
      console.log(`  ⚠️  ${row.id} [${externalId}] — sem buyer_email; PULANDO.`);
      continue;
    }
    const compra = lerCompraDoPayload(row.payload);
    candidatos.push({ ...row, externalId, ...compra });
  }

  const pagantes = candidatos.filter((c) => eventoEhPagamento(c.valor, c.status));
  log(
    `\n${candidatos.length} candidato(s) com external_id extraído; ` +
    `${pagantes.length} com PAGAMENTO CONFIRMADO no payload (valor>0 e status em APPROVED/COMPLETE/COMPLETED).`,
  );
  for (const c of candidatos) {
    const marca = eventoEhPagamento(c.valor, c.status) ? "PAGO" : "trial/sem pagamento — fora de escopo";
    log(`  ${c.received_at}  ${c.buyer_email.padEnd(38)} [${c.externalId}]  ${String(c.valor)} ${c.moeda}  ${c.status.padEnd(10)} -> ${marca}`);
  }

  // ------------------------------------------------------------------
  // 3) CONTROLE POSITIVO — lança e recusa a rodada se não reencontrar os 3
  // ------------------------------------------------------------------
  const achados = CONHECIDOS_B6036323.filter((e) => pagantes.some((p) => p.buyer_email === e));
  log(
    `\nCONTROLE POSITIVO (b6036323/#582): ${achados.length}/${CONHECIDOS_B6036323.length} reencontrados` +
    (achados.length ? ` -> ${achados.join(", ")}` : ""),
  );
  const faltando = CONHECIDOS_B6036323.filter((e) => !achados.includes(e));
  if (faltando.length) {
    throw new Error(
      `CONTROLE POSITIVO FALHOU — instrumento CEGO: não reencontrei ${faltando.join(", ")}. ` +
      `Zero (ou parcial) aqui não é "sem problema" — é a coluna sumida, o .like() ` +
      `quebrado ou o payload mudando de formato. Não abro nem deixo de abrir nada ` +
      `em cima de uma leitura que não passa no próprio controle.`,
    );
  }

  // ------------------------------------------------------------------
  // 4) Reconfere ACESSO AGORA (estado, não o evento) pra cada pagante achado
  // ------------------------------------------------------------------
  log("\nReconferindo conta/entitlement AGORA (estado vivo, não o que valia no momento do evento):");
  const semAcessoAgora = [];
  for (const c of pagantes) {
    const dono = await contaTemDono(db, c.buyer_email, c.externalId);
    const linha = { ...c, ...dono };
    log(
      `  ${c.buyer_email.padEnd(38)} [${c.externalId}]  profiles:${dono.temConta ? "TEM CONTA" : "sem conta"}` +
      `  entitlement.user_id:${dono.temDonoEntitlement ? "TEM DONO" : "NULL"}` +
      (dono.entStatus ? `  (status=${dono.entStatus} access_until=${dono.entAcessoAte ?? "?"})` : ""),
    );
    if (!dono.temConta && !dono.temDonoEntitlement) semAcessoAgora.push(linha);
  }
  log(`\n${semAcessoAgora.length} pagante(s) CONFIRMADO(S) sem conta e sem dono AGORA.`);
  if (!semAcessoAgora.length) {
    log("Nada a abrir nesta rodada.");
    return { resumo: [], abertos: 0 };
  }

  // ------------------------------------------------------------------
  // 5) Dedupe contra incidentes já existentes (não duplica o #582 nem outro)
  // ------------------------------------------------------------------
  const existentes = await lerIncidentesParaDedupeENumero(db);
  let proximoNumero = Math.max(0, ...existentes.map((i) => Number(i.numero) || 0)) + 1;

  log(`\n${existentes.length} incidente(s) existente(s) lido(s) pra dedupe.\n`);

  const resumo = [];
  let abertos = 0;
  for (const caso of semAcessoAgora) {
    const emailLower = caso.buyer_email.toLowerCase();
    const cobertoPor = existentes.find(
      (i) => STATUS_VIVOS.has(i.status) && Array.isArray(i.affected_emails)
        && i.affected_emails.some((e) => String(e).toLowerCase() === emailLower),
    );
    if (cobertoPor) {
      log(`${caso.buyer_email} [${caso.externalId}] — já coberto por #${cobertoPor.numero} (${cobertoPor.status}); NÃO duplico.`);
      resumo.push({ email: caso.buyer_email, acao: `pulado (já em #${cobertoPor.numero})` });
      continue;
    }

    const signature = `frank:pagante-sem-conta-orfao:${caso.event_id}`;
    const mesmaAssinatura = existentes.find((i) => i.signature === signature);
    if (mesmaAssinatura) {
      log(`${caso.buyer_email} [${caso.externalId}] — assinatura ${signature} já existe (#${mesmaAssinatura.numero}); NÃO duplico.`);
      resumo.push({ email: caso.buyer_email, acao: `pulado (assinatura já existe, #${mesmaAssinatura.numero})` });
      continue;
    }

    const linha = montarIncidente({ numero: proximoNumero, caso });

    if (!confirmar) {
      log(`${caso.buyer_email} [${caso.externalId}] — ABRIRIA #${proximoNumero} (ensaio, nada gravado):`);
      log(`  título: ${linha.title}`);
      resumo.push({ email: caso.buyer_email, acao: `ensaio: abriria #${proximoNumero}` });
      proximoNumero += 1;
      continue;
    }

    const { data: novo, error: eIns } = await db.from("incidents").insert(linha).select("id,numero,title,status");
    if (eIns) throw new Error(`insert incidents (${caso.buyer_email}): ${JSON.stringify(eIns)}`);
    if (!Array.isArray(novo) || novo.length !== 1) {
      throw new Error(`ESCRITA SUSPEITA abrindo incidente de ${caso.buyer_email}: ${novo?.length} linha(s) devolvida(s)`);
    }
    log(`${caso.buyer_email} [${caso.externalId}] — ABERTO: #${novo[0].numero} (${novo[0].id}) status=${novo[0].status}`);
    resumo.push({ email: caso.buyer_email, acao: `ABERTO #${novo[0].numero} (${novo[0].id})` });
    abertos += 1;
    proximoNumero = Math.max(proximoNumero, Number(novo[0].numero) || 0) + 1;
  }

  log("\n" + "=".repeat(70));
  log("RESUMO:");
  for (const r of resumo) log(`  ${r.email.padEnd(38)} ${r.acao}`);

  return { resumo, abertos };
}

module.exports = {
  rodar,
  eventoEhPagamento,
  externalIdDoErro,
  lerCompraDoPayload,
  montarIncidente,
  lerEventosOrfaosComErro,
  contaTemDono,
  lerIncidentesParaDedupeENumero,
  CONHECIDOS_B6036323,
  STATUS_PAGO,
  STATUS_VIVOS,
  PAGINA,
};

if (require.main === module) {
  (async () => {
    const db = supa();
    await rodar(db, { confirmar: CONFIRMAR });
  })().catch((e) => {
    console.error("FALHOU:", e.message);
    process.exit(1);
  });
}
