/**
 * A EQUIPE HUMANA JÁ FALOU COM ESTE ALUNO? — só leitura, nada muda.
 *
 *   node _frank/ferramentas/ja_falaram.cjs <email> [--json]
 *   node _frank/ferramentas/ja_falaram.cjs --autoteste
 *
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUE ISTO EXISTE, e o acidente é meu (14/09)
 *
 * Escrevi pro Rodrigo (`rodrigo.limas.1978@gmail.com`) que "ninguém te deu
 * retorno, foram dois dias e meio". A equipe JÁ tinha respondido: o chamado
 * `#363` estava marcado `aluno_respondido` em 12/09 por
 * `suporte@lucasarrial.com`. Acusei o nosso próprio time de silêncio, na
 * frente do cliente, com base numa cegueira minha.
 *
 * A cegueira: eu leio só a caixa `suporte@fastcloner.com`. A equipe atende
 * pela `suporte@lucasarrial.com`, que eu NÃO leio. O botão "Aluno respondido"
 * existe em `/admin/falhas` desde 04/09 e o time USA — medido em 14/09: **30
 * marcações** (27 de `suporte@lucasarrial.com`, 3 de `vitor@lucasarrial.com`,
 * entre 05/09 e 12/09), mais **1 desfeita**. Nenhuma ferramenta em `_frank/`
 * lia isso. O dado estava no banco o tempo todo, a uma consulta de distância.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * ⚠️ A REGRA QUE MANDA NESTE ARQUIVO, e ela está impressa na saída de
 * propósito: **"SEM REGISTRO" NÃO É PROVA DE SILÊNCIO.** Significa só que não
 * há marcação no NOSSO banco. A caixa `suporte@lucasarrial.com` não é lida por
 * nós, então a equipe pode ter respondido por lá sem nada aparecer aqui. Esta
 * ferramenta sabe dizer "alguém falou"; ela **não** sabe dizer "ninguém
 * falou". Quem inverter isso repete o acidente do Rodrigo de cabeça pra baixo.
 *
 * AS TRÊS FONTES, e elas NÃO valem a mesma coisa — misturar as três num
 * "ATENDIDO" só foi rejeitado de propósito:
 *
 *   (a) FORTE  `incidents.agent_notes` com `tipo='aluno_respondido'`.
 *              É a única que quer dizer literalmente UM HUMANO RESPONDEU O
 *              ALUNO. Respeita o desfazer (ver `baixaVigente`).
 *   (b) FRACO  `incidents.resolved_by` que não é robô.
 *              Quer dizer FECHOU O CHAMADO — não "falou com o aluno". Um dev
 *              fechando um bug técnico não mandou e-mail pra ninguém. Entra
 *              como indício, em bloco separado, e NUNCA vira "ATENDIDO"
 *              sozinho: contar isso como resposta produziria o erro do
 *              Rodrigo ao contrário (eu calado achando que o time atendeu).
 *   (c) FORTE  WhatsApp: `agent_messages.role='human'` / `agent_chats.mode='human'`.
 *              Gente de verdade digitando pro aluno.
 *
 * ⚠️ LIMITE MEDIDO DA FONTE (c): `agent_chats` **não tem coluna de e-mail**.
 * O único vínculo é `profile_id -> profiles.id`, e em 14/09 só **22 dos 158**
 * chats têm `profile_id` — dos 13 chats que têm mensagem `role='human'`,
 * apenas **5** são ligáveis a um e-mail. Então a fonte (c) enxerga pouco, e o
 * que ela não enxerga sai como ausência. Está declarado aqui porque cobertura
 * fina lida como cobertura total é a mesma armadilha do "zero de instrumento
 * cego".
 *
 * ⚠️ ERRO DE CONSULTA NUNCA VIRA "NÃO TEM" (regra da casa, ver
 * `protesto_invisivel.cjs`): toda falha de select levanta exceção. Um 500 lido
 * como lista vazia faria esta ferramenta dizer "SEM REGISTRO" — ou seja, a
 * mentira exata que ela existe pra impedir.
 *
 * ⚠️ TEM CONTROLE POSITIVO E ABORTA (exit 1) SE ELE ZERAR: `--autoteste`
 * obriga a reencontrar as 4 marcações conhecidas. Ferramenta cega aqui não dá
 * erro — ela dá "SEM REGISTRO" pra todo mundo, com cara de resposta boa.
 *
 * SEM MIGRATION e SEM COLUNA NOVA, de propósito: `agent_notes` já existe e há
 * 5 migrations pendentes (104, 106, 107, 108, 109) entupindo o caminho.
 */
const { supa } = require("./_comum.cjs");

/** O tipo das notas de baixa. Espelha `@/lib/incidents/baixa`. */
const TIPO_RESPONDIDO = "aluno_respondido";
const TIPO_DESFEITO = "aluno_respondido_desfeito";

/**
 * Quem fecha chamado e NÃO é gente. Medido em `incidents.resolved_by` (14/09):
 * frank(145), claude(57), agent(16), carol(7), backfill(2), frank/rotina-falhas,
 * frank/coder, claude-code, "claude (sessão 11/08)".
 * Compara por PREFIXO porque a casa assina com sufixo entre parênteses ou com
 * barra ("carol (entregue ao time)", "frank/coder").
 */
const ROBOS = ["frank", "carol", "vigia", "claude", "agent", "backfill", "sistema", "bot"];

/**
 * Robô, humano ou não-sei? O terceiro balde existe porque ele é REAL: o
 * `james` fechou 18 chamados e é uma pessoa (achou e corrigiu o VAD no
 * `9c376c8`), mas "fechou um bug" não é "falou com o aluno" — e
 * "johnny (sessão interativa)" é o dono operando, não o suporte atendendo.
 * Chutar qualquer um dos dois lados aqui inventa fato sobre atendimento.
 */
function classificarQuemFechou(by) {
  const quem = String(by ?? "").trim().toLowerCase();
  if (!quem) return "ambiguo";
  // O @ vem PRIMEIRO de propósito: nenhum robô medido assina com endereço, e
  // testar o prefixo antes faria "frank-silva@aluno.com" (ou o "frankenstein")
  // virar robô — rotular gente de máquina é justamente apagar o atendimento
  // que esta ferramenta existe pra enxergar.
  if (quem.includes("@")) return "humano";
  // Separadores medidos na base: espaço ("carol (entregue ao time)"), barra
  // ("frank/coder") e hífen ("claude-code" — que a 1ª versão deixou passar
  // como ambíguo, achado pelo teste, não por leitura).
  if (ROBOS.some((r) => quem === r || /^[ /(-]/.test(quem.slice(r.length)) && quem.startsWith(r))) {
    return "robo";
  }
  return "ambiguo";
}

/**
 * A baixa VIGENTE de um chamado — "quem venceu por último".
 *
 * O desfazer não apaga a nota anterior, acrescenta uma de "desfeito" (apagar
 * linha de `agent_notes` seria destruir rastro). Então varre de trás pra
 * frente e para na primeira das duas. É o MESMO algoritmo de
 * `alunoRespondido` em `frontend/src/lib/incidents/baixa.ts` — se ele mudar
 * lá, muda aqui. Medido em 14/09: existe 1 nota de desfeito na base, então
 * este caminho não é hipotético.
 */
function baixaVigente(agentNotes) {
  // `agent_notes` já apareceu corrompido em string nesta base (ver
  // varredura_travados.cjs) — não confie no tipo.
  const notas = Array.isArray(agentNotes) ? agentNotes : [];
  for (let i = notas.length - 1; i >= 0; i--) {
    const n = notas[i];
    if (n?.tipo === TIPO_RESPONDIDO) return { at: n.at, by: n.by, desfeita: false };
    if (n?.tipo === TIPO_DESFEITO) return { at: n.at, by: n.by, desfeita: true };
  }
  return null;
}

/** Data em pt-BR no fuso em que o time trabalha. */
function quando(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d
    .toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(", ", " às ");
}

/**
 * Lê as três fontes pro e-mail dado. Não escreve nada, nunca.
 *
 * O filtro é `.contains(affected_emails, [email])` — server-side, porque puxar
 * a tabela inteira e filtrar na memória esbarraria no teto de 1000 linhas do
 * PostgREST sem avisar. Conferido em 14/09 contra a varredura em memória das
 * 378 linhas: mesmo resultado, e as 753 entradas de `affected_emails` estão
 * TODAS em minúscula (0 com maiúscula), então normalizar a entrada basta.
 */
async function jaFalaram(db, emailCru) {
  const email = String(emailCru ?? "").trim().toLowerCase();
  if (!email) throw new Error("e-mail vazio");

  const { data: incs, error: errInc } = await db
    .from("incidents")
    .select("numero, title, status, agent_notes, resolved_by, resolved_at")
    .contains("affected_emails", [email]);
  // Erro NUNCA vira "não tem" — seria a mentira que esta ferramenta existe pra impedir.
  if (errInc) throw new Error(`consulta de incidents falhou: ${errInc.message}`);

  const baixas = [];
  const fechamentos = [];
  for (const i of incs ?? []) {
    const b = baixaVigente(i.agent_notes);
    if (b) baixas.push({ numero: i.numero, title: i.title, ...b });
    if (i.resolved_by) {
      const classe = classificarQuemFechou(i.resolved_by);
      if (classe !== "robo") {
        fechamentos.push({ numero: i.numero, title: i.title, by: i.resolved_by, at: i.resolved_at, classe });
      }
    }
  }

  // (c) WhatsApp. Só alcança quem tem perfil E chat vinculado — ver o limite
  // declarado no topo. Ausência aqui não é ausência de conversa.
  const whatsapp = [];
  let alcancavelPorWhatsapp = false;
  const { data: perfil, error: errPerf } = await db
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  if (errPerf) throw new Error(`consulta de profiles falhou: ${errPerf.message}`);

  if (perfil?.id) {
    const { data: chats, error: errChat } = await db
      .from("agent_chats")
      .select("id, mode, name, last_message_at")
      .eq("profile_id", perfil.id);
    if (errChat) throw new Error(`consulta de agent_chats falhou: ${errChat.message}`);
    alcancavelPorWhatsapp = Boolean(chats?.length);

    for (const c of chats ?? []) {
      const { data: msgs, error: errMsg } = await db
        .from("agent_messages")
        .select("created_at, sender_name, content")
        .eq("chat_id", c.id)
        .eq("role", "human")
        .order("created_at", { ascending: false })
        .limit(3);
      if (errMsg) throw new Error(`consulta de agent_messages falhou: ${errMsg.message}`);
      if (msgs?.length || c.mode === "human") {
        whatsapp.push({ chat: c.name, mode: c.mode, mensagens: msgs ?? [] });
      }
    }
  }

  const vigentes = baixas.filter((b) => !b.desfeita);
  const comHumano = whatsapp.filter((w) => w.mensagens.length > 0);
  const atendido = vigentes.length > 0 || comHumano.length > 0;

  return {
    email,
    atendido,
    temPerfil: Boolean(perfil?.id),
    alcancavelPorWhatsapp,
    incidentes: (incs ?? []).map((i) => i.numero),
    baixas,
    fechamentos,
    whatsapp,
  };
}

/** O aviso que NÃO pode sumir da saída. É o motivo do arquivo existir. */
const AVISO =
  '⚠️  "SEM REGISTRO" NÃO SIGNIFICA QUE NINGUÉM RESPONDEU — significa que não há\n' +
  "    REGISTRO. A caixa suporte@lucasarrial.com não é lida por nós, então a\n" +
  "    equipe pode ter respondido por lá sem aparecer aqui. Ausência de marcação\n" +
  "    NÃO é prova de silêncio: nunca escreva a um aluno que ele ficou sem\n" +
  "    resposta com base nesta saída. Antes de falar, PERGUNTE ao time o que já\n" +
  "    foi dito.";

/** Imprime o laudo. Devolve as linhas pra `aluno.cjs` poder embutir. */
function renderTexto(r) {
  const L = [];
  if (r.atendido) {
    const maisRecente = [
      ...r.baixas.filter((b) => !b.desfeita).map((b) => ({ at: b.at, by: b.by, onde: `#${b.numero}` })),
      ...r.whatsapp.flatMap((w) => w.mensagens.map((m) => ({ at: m.created_at, by: m.sender_name ?? "equipe", onde: "WhatsApp" }))),
    ].sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
    L.push(`✅ ATENDIDO em ${quando(maisRecente.at)} por ${maisRecente.by} (${maisRecente.onde})`);
  } else {
    L.push("⬜ SEM REGISTRO de resposta humana a este aluno.");
  }

  const vigentes = r.baixas.filter((b) => !b.desfeita);
  if (vigentes.length) {
    L.push(`\n   📌 BAIXA "aluno respondido" (fonte FORTE — humano respondeu o aluno):`);
    for (const b of vigentes) {
      L.push(`      #${b.numero} · ${quando(b.at)} · ${b.by}`);
      L.push(`         ${String(b.title ?? "").slice(0, 90)}`);
    }
  }
  for (const b of r.baixas.filter((x) => x.desfeita)) {
    L.push(`\n   ↩️  baixa DESFEITA em #${b.numero} (${quando(b.at)} por ${b.by}) — vale como NÃO respondido.`);
  }

  if (r.whatsapp.length) {
    L.push(`\n   💬 WhatsApp (fonte FORTE):`);
    for (const w of r.whatsapp) {
      if (!w.mensagens.length) {
        L.push(`      chat "${w.chat ?? "?"}" em modo ${w.mode} — sem mensagem de humano registrada`);
        continue;
      }
      for (const m of w.mensagens) {
        L.push(`      ${quando(m.created_at)} · ${m.sender_name ?? "equipe"}: ${String(m.content ?? "").slice(0, 70)}`);
      }
    }
  }

  if (r.fechamentos.length) {
    L.push(`\n   🔸 INDÍCIO FRACO — fechou o chamado, o que NÃO é o mesmo que falar com o aluno:`);
    for (const f of r.fechamentos) {
      const duvida = f.classe === "ambiguo" ? " ❓(não sei se é pessoa ou robô)" : "";
      L.push(`      #${f.numero} fechado ${f.at ? quando(f.at) : "?"} por ${f.by}${duvida}`);
    }
    L.push("      ⚠️  Isto NÃO conta como resposta ao aluno e não vira ATENDIDO sozinho.");
  }

  if (!r.temPerfil) {
    L.push("\n   ℹ️  Sem conta em profiles — a fonte WhatsApp não alcança este e-mail.");
  } else if (!r.alcancavelPorWhatsapp) {
    L.push("\n   ℹ️  Conta existe, mas nenhum chat de WhatsApp vinculado (só 22 dos 158 chats têm vínculo).");
  }

  if (!r.atendido) L.push(`\n${AVISO}`);
  return L;
}

/**
 * CONTROLE POSITIVO. As 4 marcações conhecidas em 14/09 têm que reaparecer.
 * Se zerar, a leitura cegou e o script ABORTA — porque cego aqui não dá erro,
 * dá "SEM REGISTRO" pra todo mundo, que é exatamente o acidente do Rodrigo.
 */
const CONTROLE = [
  ["rodrigo.limas.1978@gmail.com", 363],
  ["contatoecocannabis@gmail.com", 299],
  ["victor.inscriptio@gmail.com", 309],
  ["contato@mastroiannioliveira.com.br", 331],
];

async function autoteste(db) {
  let falhou = false;
  for (const [email, numero] of CONTROLE) {
    const r = await jaFalaram(db, email);
    const achou = r.baixas.some((b) => b.numero === numero && !b.desfeita);
    console.log(`${achou ? "✅" : "❌"} ${email} → esperava baixa em #${numero}`);
    if (!achou) falhou = true;
  }
  if (falhou) {
    console.error("\n❌ CONTROLE POSITIVO ZEROU: a leitura está cega. NÃO confie em 'SEM REGISTRO'.");
    process.exit(1);
  }
  console.log("\n✅ controle positivo passou — a ferramenta enxerga as marcações conhecidas.");
}

module.exports = { jaFalaram, baixaVigente, classificarQuemFechou, renderTexto, AVISO, ROBOS };

if (require.main === module) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const email = args.find((a) => !a.startsWith("--"));

  (async () => {
    const db = supa();
    if (args.includes("--autoteste")) return autoteste(db);
    if (!email) {
      console.error("uso: node ja_falaram.cjs <email> [--json]");
      console.error("     node ja_falaram.cjs --autoteste");
      process.exit(1);
    }
    const r = await jaFalaram(db, email);
    if (json) {
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    console.log(`\n🗣️  A EQUIPE JÁ FALOU COM ${r.email}?`);
    console.log(`   (chamados com este e-mail: ${r.incidentes.length ? r.incidentes.map((n) => `#${n}`).join(" ") : "nenhum"})\n`);
    console.log(renderTexto(r).join("\n"));
    console.log("");
  })().catch((e) => {
    console.error("FALHOU:", e.message);
    process.exit(1);
  });
}
