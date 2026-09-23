/**
 * #222 — DETECTOR da classe "pagou com um e-mail, criou a conta com outro".
 *
 * SO LEITURA. Nao vincula, nao credita, nao escreve.
 *
 * Por que existe: em 7 ocorrencias (#20, #27, #36, #195, #218, #222, e o
 * Fernando de 08/09) TODOS os casos foram achados por acidente, um a um, por
 * uma ronda que estava olhando outra coisa. Nunca houve detector. A causa em
 * entitlements.ts:133-137 casa orfao SO por ilike(buyer_email) — quem comprou
 * com outro e-mail nunca casa e nada avisa ninguem.
 *
 * O que ele faz: pega o pagante orfao com janela viva e procura um perfil que
 * seja PLAUSIVELMENTE a mesma pessoa por duas chaves independentes:
 *   - CPF  (raw_event.buyer.document) x profiles.cpf, quando existir
 *   - NOME (raw_event.buyer.name) x profiles.display_name, normalizado
 * Nome normalizado = minusculo, sem acento, sem pontuacao, espacos colapsados.
 *
 * ⚠️ AMBIGUIDADE E' RESULTADO, NAO ERRO: se a chave casa com MAIS DE UM perfil,
 * o script marca AMBIGUO e NAO sugere vinculo. A nota de 04/09 mediu que CPF
 * casava 2 de 42 com 9 ambiguos — vincular no escuro poe dinheiro na conta
 * errada. Quem decide vinculo e gente, olhando o caso.
 */
const { supa } = require("./_comum.cjs");

const agora = new Date();
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const soDigitos = (s) => String(s ?? "").replace(/\D/g, "");

// Particulas que nao identificam ninguem — nao contam como sobrenome em comum.
const PARTICULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "del", "la"]);
const toks = (s) => norm(s).split(" ").filter((t) => t.length > 1 && !PARTICULAS.has(t));

/**
 * MESMA PESSOA? primeiro nome igual E pelo menos um outro token em comum.
 *
 * Nao e exato de proposito: medido em 06 casos REAIS de e-mail divergente que
 * ja estao vinculados (controle positivo), a igualdade exata da string pegava
 * so 3 — porque a pessoa encurta o nome ao criar a conta ("Nassara Borges
 * Mesquita Oliveira" vira "Nássara Mesquita"). Esta regra pega 5 dos 6 e
 * continua recusando o 6o, que e legitimamente outra pessoa (conta de empresa
 * "Equipe Qooqi" comprada por "Moyses Filipe B. Martins").
 * Exigir o PRIMEIRO nome igual e o que impede casar irmaos/homonimos parciais.
 */
function mesmaPessoa(a, b) {
  const ta = toks(a);
  const tb = toks(b);
  if (ta.length < 2 || tb.length < 2) return false;
  if (ta[0] !== tb[0]) return false;
  const resto = new Set(ta.slice(1));
  return tb.slice(1).some((t) => resto.has(t));
}

async function paginar(db, tabela, sel, aplica) {
  let tudo = [];
  let de = 0;
  for (;;) {
    let q = db.from(tabela).select(sel).range(de, de + 499);
    if (aplica) q = aplica(q);
    const { data, error } = await q;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    tudo = tudo.concat(data);
    if (data.length < 500) break;
    de += 500;
  }
  return tudo;
}

(async () => {
  const db = supa();

  const orfaos = await paginar(db, "entitlements", "*", (q) => q.is("user_id", null));
  const perfis = await paginar(
    db,
    "profiles",
    "id,email,display_name,plan,access_until,credits_subscription,credits_extra",
  );
  // 2a chave: entitlement do MESMO CPF que JA tem dono -> aponta o perfil certo.
  // profiles nao tem coluna cpf, entao o CPF so existe no raw_event da compra.
  const comDono = await paginar(db, "entitlements", "*", (q) => q.not("user_id", "is", null));

  console.log(
    `base: ${orfaos.length} entitlements orfaos, ${comDono.length} com dono, ${perfis.length} perfis`,
  );

  // funil, decomposto de proposito (zero so vale se cada degrau explicar o anterior)
  const ativos = orfaos.filter((e) => e.status === "active");
  const vigentes = ativos.filter((e) => !e.access_until || new Date(e.access_until) > agora);
  const val = (e) => Number(e.raw_event?.purchase?.price?.value ?? 0);
  const pagantes = vigentes.filter((e) => val(e) > 0);

  console.log("\nFUNIL");
  console.log(`  orfaos ................. ${orfaos.length}`);
  console.log(`  status active .......... ${ativos.length}`);
  console.log(`  janela viva ............ ${vigentes.length}`);
  console.log(`  pagou (price>0) ........ ${pagantes.length}`);

  // indices dos perfis
  const porId = new Map(perfis.map((p) => [p.id, p]));
  const porNome = new Map();
  const porCpf = new Map();
  const porEmail = new Set();
  for (const p of perfis) {
    porEmail.add(norm(p.email));
    const n = norm(p.display_name);
    if (n && n.split(" ").length >= 2) {
      if (!porNome.has(n)) porNome.set(n, []);
      porNome.get(n).push(p);
    }
  }
  // CPF -> perfis, atravessando o entitlement que ja tem dono
  for (const e of comDono) {
    const c = soDigitos(e.raw_event?.buyer?.document);
    if (c.length !== 11) continue;
    const p = porId.get(e.user_id);
    if (!p) continue;
    if (!porCpf.has(c)) porCpf.set(c, []);
    if (!porCpf.get(c).some((x) => x.id === p.id)) porCpf.get(c).push(p);
  }

  // ── CONTROLE POSITIVO ──────────────────────────────────────────────────────
  // Um zero so vale se o instrumento sabe dizer SIM. Aqui o detector e obrigado
  // a reencontrar casos de e-mail divergente que JA estao vinculados: se ele
  // nao acha nem os conhecidos, o "nenhum preso" e cegueira, nao boa noticia.
  //
  // O ESPERADO E' ESCRITO A MAO, NAO DERIVADO DA CONSULTA. Se o gabarito saisse
  // dos mesmos dados que ele julga, a consulta encolher encolheria o gabarito
  // junto e ate um "6/6" poderia ser falso. Por isso: lista fixa + piso fixo.
  //
  // ⚠️ O PISO SO DESCE POR ESCRITO. Quem BAIXAR de proposito (tirar alguem de
  // CONTROLE_ESPERADO, reduzir CONTROLE_TOTAL_ESPERADO ou CONTROLE_PISO_ACHADOS)
  // tem que reescrever a lista AQUI e deixar o motivo AQUI, nesta mesma linha do
  // caso (reembolsado? perfil teve o display_name corrigido? regra de nome
  // mudou?). Piso que cai sem justificativa escrita e detector desligado em
  // silencio — e ninguem depois consegue saber se a queda foi decisao ou defeito.
  const CONTROLE_ESPERADO = [
    {
      nome: "Nassara Borges Mesquita Oliveira",
      deve: "ACHA",
      porque:
        'encurtou o nome na conta ("Nássara Mesquita") — e o caso que obriga a regra a NAO ser igualdade exata',
    },
    {
      nome: "Moyses Filipe B. Martins",
      deve: "PERDE",
      porque:
        'conta de empresa "Equipe Qooqi" — recusa LEGITIMA: e o 6o caso, o que a regra tem que continuar nao pegando',
    },
    // NOMINAR OS OUTROS 4: o universo medido em 04/09 tem 6 casos, so 2 estao
    // nomeados aqui. Na proxima rodada, copie do dump ACHA/PERDE abaixo o nome e
    // o id dos 4 restantes e acrescente nesta lista — enquanto eles nao tiverem
    // nome, o unico guarda deles e o piso numerico logo abaixo, que detecta
    // sumico mas nao diz QUEM sumiu.
  ];
  // Universo conhecido (medido em 04/09): 6 casos de e-mail divergente ja
  // vinculados, dos quais a chave de nome reencontra 5 — o 6o e a conta de
  // empresa acima. Estes dois numeros sao o gabarito, nao saem dos dados.
  const CONTROLE_TOTAL_ESPERADO = 6;
  const CONTROLE_PISO_ACHADOS = 5;

  const controle = comDono
    .filter((e) => e.status === "active" && e.raw_event?.buyer?.name)
    .map((e) => ({ e, p: porId.get(e.user_id) }))
    .filter(({ e, p }) => p && norm(e.buyer_email) !== norm(p.email))
    .map(({ e, p }) => ({ e, p, ok: mesmaPessoa(e.raw_event.buyer.name, p.display_name) }));
  const controleOk = controle.filter((c) => c.ok);
  const idDe = ({ e }) => e.external_id ?? e.id;
  const descreve = (c) => `"${c.e.raw_event.buyer.name}" (${idDe(c)}) x perfil "${c.p.display_name}"`;

  console.log(
    `\nCONTROLE POSITIVO: ${controleOk.length}/${controle.length} casos de e-mail divergente reencontrados pela chave de nome (gabarito escrito a mao: ${CONTROLE_PISO_ACHADOS}/${CONTROLE_TOTAL_ESPERADO})`,
  );
  for (const c of controle) {
    console.log(`  ${c.ok ? "ACHA " : "PERDE"} | ${idDe(c)} | "${c.e.raw_event.buyer.name}" x "${c.p.display_name}"`);
  }

  // Confere item a item contra a LISTA esperada, nao contra um total qualquer.
  const faltaram = [];
  for (const esp of CONTROLE_ESPERADO) {
    const achado = controle.find((c) => norm(c.e.raw_event.buyer.name) === norm(esp.nome));
    if (!achado) {
      faltaram.push(`SUMIU DA CONSULTA: "${esp.nome}" — esperado ${esp.deve}. ${esp.porque}`);
    } else if ((esp.deve === "ACHA") !== achado.ok) {
      faltaram.push(
        `VEREDITO MUDOU: ${descreve(achado)} — esperado ${esp.deve}, obtido ${achado.ok ? "ACHA" : "PERDE"}. ${esp.porque}`,
      );
    }
  }
  // O universo tambem nao pode encolher: menos casos conhecidos = menos gabarito.
  if (controle.length < CONTROLE_TOTAL_ESPERADO) {
    faltaram.push(
      `UNIVERSO ENCOLHEU: a consulta trouxe ${controle.length} casos de e-mail divergente, o gabarito tem ${CONTROLE_TOTAL_ESPERADO}. ` +
        `Presentes agora: ${controle.map(descreve).join(" ; ") || "(nenhum — o controle rodou VAZIO, entao nao houve controle nenhum)"}. ` +
        `Faltam ${CONTROLE_TOTAL_ESPERADO - controle.length}: compare esta lista com os 6 de 04/09 para ver quem caiu.`,
    );
  }
  if (controleOk.length < CONTROLE_PISO_ACHADOS) {
    const perdidos = controle.filter((c) => !c.ok);
    faltaram.push(
      `PISO FURADO: a chave de nome reencontrou ${controleOk.length}, o piso e ${CONTROLE_PISO_ACHADOS}. ` +
        `Recusados nesta rodada: ${perdidos.map(descreve).join(" ; ") || "(nenhum recusado — entao a perda foi na consulta, nao na chave)"}`,
    );
  }
  if (faltaram.length) {
    console.error("\nCONTROLE POSITIVO FURADO — quem sumiu:");
    for (const f of faltaram) console.error(`  ✗ ${f}`);
    throw new Error(
      "controle positivo furado: o detector perdeu caso(s) conhecido(s) listado(s) acima. " +
        "A varredura NAO pode rodar assim — a chave que nao reencontra quem JA sabemos que existe tambem nao reencontra " +
        "quem ainda nao sabemos, entao qualquer numero impresso abaixo seria OTIMISTA: o vies e sempre pra baixo " +
        "(preso que a chave nao casa vira 'nenhum preso', e o silencio passa por boa noticia). " +
        "Conserte a chave, ou — se a queda for decisao consciente — reescreva CONTROLE_ESPERADO/o piso com o motivo escrito ali.",
    );
  }

  const presos = [];
  const semConta = [];

  for (const e of pagantes) {
    const emailCompra = norm(e.buyer_email);
    // se ja existe perfil com o e-mail da compra, o claim normal resolve no login
    if (porEmail.has(emailCompra)) continue;

    const nome = norm(e.raw_event?.buyer?.name);
    const cpf = soDigitos(e.raw_event?.buyer?.document);

    const porCpfHit = cpf.length === 11 ? porCpf.get(cpf) ?? [] : [];
    const porNomeHit = nome ? perfis.filter((p) => mesmaPessoa(nome, p.display_name)) : [];

    // uniao por id
    const cands = new Map();
    for (const p of porCpfHit) cands.set(p.id, { p, via: "CPF" });
    for (const p of porNomeHit) {
      if (cands.has(p.id)) cands.get(p.id).via = "CPF+NOME";
      else cands.set(p.id, { p, via: "NOME" });
    }
    const lista = [...cands.values()];

    if (lista.length === 0) semConta.push({ e, nome });
    else presos.push({ e, nome, cands: lista });
  }

  console.log(`\n  destes, sem perfil no e-mail da compra e COM perfil provavel em outro e-mail: ${presos.length}`);
  console.log(`  destes, sem perfil nenhum (o convite de compra orfa e o caminho, nao este card): ${semConta.length}`);

  console.log("\n=== CANDIDATOS A 'PRESO FORA DA PROPRIA CONTA' ===");
  if (!presos.length) console.log("  (nenhum)");
  for (const { e, nome, cands } of presos) {
    const amb = cands.length > 1;
    console.log(
      `\n  ${amb ? "⚠️ AMBIGUO" : "ALVO"} | ${e.external_id ?? e.id} | R$${val(e)} | compra ${e.buyer_email} | "${nome}"`,
    );
    console.log(`    acesso ate ${e.access_until} | product ${e.product_code ?? "?"}`);
    for (const { p, via } of cands) {
      console.log(
        `    -> perfil ${p.email} | via ${via} | plan=${p.plan} | cr=${(p.credits_subscription ?? 0) + (p.credits_extra ?? 0)} | acesso=${p.access_until}`,
      );
    }
  }
})().catch((e) => {
  console.error("FALHOU:", e.message);
  process.exit(1);
});
