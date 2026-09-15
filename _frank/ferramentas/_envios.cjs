/**
 * LIVRO-CAIXA DOS E-MAILS QUE SAÍRAM PRO ALUNO — e a trava contra mandar o
 * MESMO aviso duas vezes pra mesma pessoa.
 *
 * O QUE ACONTECEU (06/09, medido): duas levas mandaram o aviso "o Vídeo Clone
 * voltou" pros MESMOS alunos com 32 minutos de diferença — enviados uid
 * 1099-1107 às 00:36Z e uid 1115-1118 às 01:08Z. Quatro alunos que já tinham
 * levado 12h de apagão (costa.anaelson, rafaluanravi29, clayton, lux.neuropsi)
 * receberam a carta em dobro. Ninguém errou de propósito: a segunda leva
 * simplesmente não sabia da primeira.
 *
 * POR QUE A PROTEÇÃO DE HOJE NÃO PEGA: a única defesa é HUMANA — "antes de
 * escrever, rode `ler_caixa.cjs --enviados --para <email>`". Regra que depende
 * de alguém lembrar não é trava, é torcida. E o `enviar_email.cjs` não tinha
 * memória nenhuma: cada chamada nascia sem passado.
 *
 * O QUE ISTO FAZ: grava DESTINATÁRIO + CHAVE DO AVISO + INSTANTE a cada envio,
 * e recusa o mesmo par (destinatário, chave) dentro da janela. `--forcar`
 * existe pra quando o reenvio é intencional — mas aí é decisão registrada, não
 * acidente.
 *
 * DUAS TRAVAS, NÃO UMA. A chave sozinha deixa um buraco: bastava o assunto
 * mudar uma vírgula ("Vídeo Clone voltou" → "Vídeo Clone voltou!") pra virar
 * chave nova e a carta sair de novo. Então o corpo também é indexado pelo
 * hash: corpo BYTE-IDÊNTICO pro mesmo aluno dentro da janela é barrado mesmo
 * com assunto diferente. As duas travas são independentes de propósito.
 *
 * O QUE NÃO É BARRADO — e isto é o ponto mais importante deste arquivo: a
 * trava é por (destinatário, chave). Uma leva de 9 alunos com o MESMO assunto
 * passa inteira, porque o destinatário muda a cada um. Uma trava por chave só
 * teria bloqueado o 2º aluno da leva legítima e transformado o conserto num
 * dano maior que o defeito.
 *
 * ONDE MORA O ESTADO — `agent_state`, SEM MIGRATION, como o Vigia, o
 * `orphan_invites`, o `sgp_boas_vindas` e o `fast_mail_replied` já fazem. DDL
 * novo aqui seria trava que não protege: a migration 85 (`support_mail_replies`)
 * está proposta desde 20/08 e nunca foi aplicada em produção — uma trava que lê
 * tabela inexistente nunca bloqueia nada E AINDA PARECE QUE FUNCIONA.
 *
 * ESPELHO LOCAL: todo registro também vai pra `_frank/prova/envios_ledger.jsonl`.
 * Motivo: se o `agent_state` aceitar o envio mas a gravação falhar, o registro
 * não pode evaporar — era exatamente assim que a segunda leva nascia cega. O
 * arquivo é lido junto na consulta, então máquina sem banco no momento ainda
 * dedupe pelo que ela mesma mandou. É ignorado pelo git: o repo é PÚBLICO e a
 * linha tem e-mail de aluno.
 *
 * O QUE ESTA TRAVA **NÃO** SABE — e por isso ela NÃO substitui o
 * `ler_caixa.cjs --enviados --para <email>`:
 *   1. o passado. O livro-caixa começa vazio: tudo que saiu antes desta trava
 *      existir (inclusive as duas levas de 06/09) é invisível pra ela;
 *   2. o que saiu por fora. O `enviar_email.sh` (bash+curl, roda no servidor)
 *      e a própria Fast (`lib/agent/mail-smtp.ts`) mandam sem passar por aqui.
 * A pasta Enviados continua sendo a fonte mais completa. A trava é a rede de
 * segurança pro erro que a conferência humana já deixou passar, não a
 * dispensa dela.
 *
 * SEGURANÇA DE FALHA — AQUI É FECHADO, E ISSO É DE PROPÓSITO. O irmão
 * `frontend/src/lib/agent/mail-dedupe.ts` falha ABERTO (se não consegue ler o
 * estado, responde assim mesmo), e está certo: lá o dano de errar é deixar o
 * aluno no SILÊNCIO, que foi o incidente que gerou aquela trava. Aqui é o
 * contrário: quem chama é uma pessoa (ou a ronda) com o comando na mão e a
 * recusa aparece na cara, com código de saída 2 e a instrução de `--forcar`.
 * Ninguém fica no silêncio — no máximo alguém relê e reenvia de propósito.
 * Entre "não consigo conferir e mando mesmo assim" e "não consigo conferir e
 * peço confirmação", a segunda é a única honesta.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(__dirname, "..", "..");

/** Chave única no `agent_state` (mesmo padrão de `orphan_invites`). */
const CHAVE_ESTADO = "frank_envios_email";

/** Espelho local — ignorado pelo git (e-mail de aluno em repo público). */
const ARQUIVO_LOCAL = path.join(RAIZ, "_frank", "prova", "envios_ledger.jsonl");

/**
 * Janela padrão. 72h porque o aviso típico da ronda ("seu vídeo voltou", "seu
 * áudio ficou pronto", "pode confirmar pra mim?") é uma carta só: mandar de
 * novo em três dias é quase sempre engano, não intenção. A leva duplicada de
 * 06/09 teve 32 minutos de intervalo — qualquer janela pegaria. A janela larga
 * é pra pegar o caso pior: a ronda seguinte, horas depois, refazendo trabalho.
 *
 * Regulável por `--janela <horas>` ou `DEDUPE_EMAIL_HORAS`. Zero desliga a
 * trava (útil em teste), mas nunca some do log.
 */
const JANELA_PADRAO_HORAS = 72;

/** Depois disto o registro é podado — mantém o JSONB pequeno pra sempre. */
const RETENCAO_MS = 30 * 24 * 60 * 60 * 1000;

/** Endereço em forma comparável: `Maria@Gmail.com ` e `maria@gmail.com` são a mesma pessoa. */
function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

/**
 * Assunto → chave estável.
 *
 * Tira acento, caixa e pontuação porque a mesma carta é reescrita à mão a cada
 * leva e volta com "Vídeo Clone voltou!" onde antes era "Video clone voltou".
 * Comparar o assunto cru deixaria as duas passarem como avisos diferentes.
 *
 * Assunto que some inteiro na normalização (só emoji, por exemplo) NÃO vira
 * chave vazia — chave vazia colidiria com toda outra carta sem letras e barraria
 * envio legítimo. Nesse caso a identidade sai do hash do assunto original.
 */
function chaveDoAviso(assunto, explicita) {
  if (explicita !== undefined && explicita !== null && String(explicita).trim()) {
    return String(explicita).trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80);
  }
  const slug = String(assunto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas de acento soltas depois do NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  if (slug) return slug;
  return `assunto-${crypto.createHash("sha256").update(String(assunto || "")).digest("hex").slice(0, 12)}`;
}

/** Identidade do corpo. 16 hex bastam: o universo aqui é de milhares de cartas. */
function shaCorpo(html) {
  return crypto.createHash("sha256").update(String(html ?? ""), "utf8").digest("hex").slice(0, 16);
}

/* ------------------------------------------------------------------ */
/* Estado: mapa plano `<email>|<indice>` → registro. Dois índices por    */
/* envio (chave e corpo), o mesmo registro em ambos.                     */
/* ------------------------------------------------------------------ */

const indicePorChave = (para, chave) => `${normalizarEmail(para)}|k:${chave}`;
const indicePorCorpo = (para, sha) => `${normalizarEmail(para)}|b:${sha}`;

/** Descarta o que passou da retenção. Roda a cada escrita. */
function podar(estado, agora = Date.now(), retencaoMs = RETENCAO_MS) {
  const vivo = {};
  for (const [k, reg] of Object.entries(estado || {})) {
    const t = Date.parse(reg?.at ?? "");
    // Data ilegível SOBREVIVE à poda: apagar o que não sei datar seria apagar
    // prova. Quem decide o que fazer com ela é o `decidir` (e ele fecha).
    if (!Number.isFinite(t) || agora - t < retencaoMs) vivo[k] = reg;
  }
  return vivo;
}

/** Junta dois estados preferindo o registro mais NOVO de cada índice. */
function fundir(a, b) {
  const out = { ...(a || {}) };
  for (const [k, reg] of Object.entries(b || {})) {
    const atual = Date.parse(out[k]?.at ?? "");
    const novo = Date.parse(reg?.at ?? "");
    if (!(k in out) || !Number.isFinite(atual) || (Number.isFinite(novo) && novo > atual)) out[k] = reg;
  }
  return out;
}

/** O que o estado sabe sobre este par (destinatário, aviso). */
function consultar(estado, { para, chave, sha }) {
  return {
    porChave: (estado || {})[indicePorChave(para, chave)] || null,
    porCorpo: sha ? (estado || {})[indicePorCorpo(para, sha)] || null : null,
  };
}

/**
 * A DECISÃO — função pura, sem banco e sem rede, pra poder ser testada em cada
 * fronteira (é ela que decide se um aluno recebe ou não recebe uma carta).
 *
 * Devolve sempre o achado, mesmo quando libera: com `--forcar` quem manda
 * precisa VER o que já saiu antes de decidir mandar de novo.
 */
function decidir(achados, { agora = Date.now(), janelaHoras = JANELA_PADRAO_HORAS, forcar = false } = {}) {
  const janelaMs = Math.max(0, Number(janelaHoras) || 0) * 3600000;
  const motivos = [];

  for (const [tipo, reg] of [
    ["mesma chave de aviso", achados.porChave],
    ["corpo byte-idêntico", achados.porCorpo],
  ]) {
    if (!reg) continue;
    const t = Date.parse(reg.at ?? "");
    if (!Number.isFinite(t)) {
      // Registro sem data legível. Não dá pra afirmar que está fora da janela,
      // e afirmar "está fora" é o erro que manda a carta de novo. Fecha.
      motivos.push({ tipo, reg, horas: null, detalhe: "registro anterior sem data legível" });
      continue;
    }
    const horas = (agora - t) / 3600000;
    if (janelaMs > 0 && agora - t < janelaMs) motivos.push({ tipo, reg, horas, detalhe: null });
  }

  if (!motivos.length) {
    return { bloqueia: false, forcado: false, motivos: [], anteriores: anterioresDe(achados, agora) };
  }
  if (forcar) {
    return { bloqueia: false, forcado: true, motivos, anteriores: anterioresDe(achados, agora) };
  }
  return { bloqueia: true, forcado: false, motivos, anteriores: anterioresDe(achados, agora) };
}

/** Tudo que já saiu pra este par, dentro ou fora da janela (pra imprimir). */
function anterioresDe(achados, agora) {
  const vistos = new Set();
  const out = [];
  for (const reg of [achados.porChave, achados.porCorpo]) {
    if (!reg) continue;
    const id = `${reg.message_id || ""}|${reg.at || ""}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    const t = Date.parse(reg.at ?? "");
    out.push({ ...reg, horas: Number.isFinite(t) ? (agora - t) / 3600000 : null });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* E/S — banco e espelho local. Tudo daqui pra baixo é efeito colateral. */
/* ------------------------------------------------------------------ */

/** Lê o espelho local. Arquivo ausente é estado vazio, não erro. */
function lerLocal(arquivo = ARQUIVO_LOCAL) {
  if (!fs.existsSync(arquivo)) return {};
  let estado = {};
  for (const linha of fs.readFileSync(arquivo, "utf8").split("\n")) {
    if (!linha.trim()) continue;
    let reg;
    try {
      reg = JSON.parse(linha);
    } catch {
      continue; // linha truncada por queda no meio do append: ignora a linha, não o arquivo
    }
    if (!reg?.para || !reg?.chave) continue;
    estado = fundir(estado, {
      [indicePorChave(reg.para, reg.chave)]: reg,
      ...(reg.sha ? { [indicePorCorpo(reg.para, reg.sha)]: reg } : {}),
    });
  }
  return estado;
}

function gravarLocal(reg, arquivo = ARQUIVO_LOCAL) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.appendFileSync(arquivo, `${JSON.stringify(reg)}\n`, "utf8");
  return arquivo;
}

/** Cliente do Supabase só quando precisa (teste unitário não carrega banco). */
function banco() {
  return require(path.join(__dirname, "_comum.cjs")).supa();
}

async function lerBanco() {
  const { data, error } = await banco()
    .from("agent_state")
    .select("value")
    .eq("key", CHAVE_ESTADO)
    .maybeSingle();
  if (error) throw new Error(`agent_state (${CHAVE_ESTADO}): ${error.message}`);
  return data?.value || {};
}

/**
 * Estado completo = banco ∪ espelho local.
 *
 * Erro de leitura do banco NÃO vira estado vazio: estado vazio significaria
 * "nunca escrevi pra esta pessoa", que é a mentira exata que duplica a carta.
 * Propaga, e quem chama fecha a porta.
 */
async function lerEstado({ arquivoLocal = ARQUIVO_LOCAL } = {}) {
  const doBanco = await lerBanco();
  return fundir(doBanco, lerLocal(arquivoLocal));
}

/**
 * Registra um envio que JÁ SAIU. Ordem de propósito: espelho local primeiro
 * (síncrono, não depende de rede), banco depois. Se o banco falhar, o registro
 * local já existe e a próxima chamada NESTA máquina ainda dedupe — o buraco
 * fica só entre máquinas, e é reportado alto em vez de silencioso.
 *
 * NUNCA chame antes do envio: registro de carta que não saiu barra a carta de
 * verdade depois.
 */
async function registrar({ para, chave, assunto, messageId, sha, at }, { arquivoLocal = ARQUIVO_LOCAL } = {}) {
  const reg = {
    at: at || new Date().toISOString(),
    para: normalizarEmail(para),
    chave,
    assunto: assunto ?? null,
    message_id: messageId ?? null,
    sha: sha ?? null,
  };

  const local = { ok: false, erro: null, arquivo: null };
  try {
    local.arquivo = gravarLocal(reg, arquivoLocal);
    local.ok = true;
  } catch (e) {
    local.erro = e.message;
  }

  const bd = { ok: false, erro: null };
  try {
    const estado = podar(await lerBanco());
    estado[indicePorChave(reg.para, reg.chave)] = reg;
    if (reg.sha) estado[indicePorCorpo(reg.para, reg.sha)] = reg;
    const { error } = await banco()
      .from("agent_state")
      .upsert({ key: CHAVE_ESTADO, value: estado, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    bd.ok = true;
  } catch (e) {
    bd.erro = e.message;
  }

  return { reg, local, banco: bd };
}

module.exports = {
  CHAVE_ESTADO,
  ARQUIVO_LOCAL,
  JANELA_PADRAO_HORAS,
  RETENCAO_MS,
  normalizarEmail,
  chaveDoAviso,
  shaCorpo,
  indicePorChave,
  indicePorCorpo,
  podar,
  fundir,
  consultar,
  decidir,
  lerLocal,
  gravarLocal,
  lerEstado,
  lerBanco,
  registrar,
};
