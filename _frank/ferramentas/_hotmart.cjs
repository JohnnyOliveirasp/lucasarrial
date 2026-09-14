/**
 * _hotmart.cjs — o cliente da Hotmart, em UM lugar só. Não roda sozinho.
 *
 * POR QUE EXISTE (perna 1 do #384). A consulta de assinatura vivia INLINE
 * dentro do `cancelar_assinatura.cjs` (token/get/GET /subscriptions). Enquanto
 * ela morou lá, qualquer varredura que precisasse perguntar "essa assinatura
 * ainda está viva?" tinha duas saídas ruins: copiar a regra, ou não perguntar.
 * A casa escolheu a segunda por 5 dias — e o #384 nasceu exatamente disso: o
 * aluno pediu pra sair, a assinatura seguiu ACTIVE, e NADA cruzava as duas
 * pontas porque a pergunta não era fazível fora daquele arquivo.
 *
 * ⚠️ CÓPIA DE REGRA É O DEFEITO, NÃO A SOLUÇÃO. O #351 nasceu de uma cópia da
 * regra de MIME que derivou da original. Por isso `ehAtiva()` mora AQUI e tem
 * um só dono: quem quiser saber o que é "assinatura viva" importa, não recopia.
 *
 * ⚠️ A REGRA MAIS IMPORTANTE DESTE ARQUIVO: **erro de consulta NUNCA vira
 * "a pessoa não tem assinatura".** Um 500 da Hotmart lido como lista vazia faz
 * a varredura inteira imprimir "ninguém está sendo cobrado indevidamente" e ser
 * acreditada. Por isso `assinaturasDe()` devolve `{ ok: false, erro }` e quem
 * chama é OBRIGADO a olhar o `ok` — não existe caminho em que falha silencie.
 * É a mesma trava que o `cancelar_assinatura.cjs` já tinha ("erro de consulta
 * nunca vira 'a pessoa não tem assinatura'"), agora compartilhada.
 *
 * Só LEITURA. Cancelamento continua morando no `cancelar_assinatura.cjs`, que
 * é onde está a salvaguarda de titularidade e o `--confirmar`.
 */

const BASE = "https://developers.hotmart.com/payments/api/v1";
const AUTH = "https://api-sec-vlc.hotmart.com/security/oauth/token";

const VARS = ["HOTMART_CLIENT_ID", "HOTMART_CLIENT_SECRET", "HOTMART_BASIC"];

/**
 * Status que NÃO é assinatura viva. Idêntico ao que o `cancelar_assinatura.cjs`
 * usa pra decidir o que é "cancelável" — é a MESMA pergunta ("isto ainda está
 * de pé?") e agora tem uma definição só.
 *
 * Por negação de propósito: o vocabulário de status da Hotmart cresce (hoje já
 * aparecem ACTIVE, CANCELLED_BY_SELLER, CANCELLED_BY_CUSTOMER, INACTIVE,
 * EXPIRED, DELAYED, OVERDUE...). Enumerar os VIVOS criaria vão novo a cada
 * status novo, e o vão erraria pro lado caro: status desconhecido sumiria da
 * varredura em silêncio. Assim, status que eu não conheço é tratado como VIVO
 * e aparece pra alguém olhar — falso positivo custa uma linha lida, falso
 * negativo custa a cobrança de um aluno.
 */
const MORTA = /cancel|inactive|expired/i;
const ehAtiva = (status) => !MORTA.test(String(status ?? ""));

/** O code da assinatura muda de lugar conforme o endpoint. Um lugar só pra ler. */
const codeDe = (a) => a?.subscriber_code || a?.subscriber?.code || a?.code || null;

function faltando() {
  return VARS.filter((v) => !process.env[v]);
}

let _token = null;
/** Token é caro e vale pra varredura inteira: pega uma vez, reusa. */
async function token() {
  if (_token) return _token;
  const falta = faltando();
  if (falta.length) {
    throw new Error(
      `credenciais da Hotmart ausentes em frontend/.env.local: ${falta.join(", ")}`,
    );
  }
  const u =
    `${AUTH}?grant_type=client_credentials` +
    `&client_id=${encodeURIComponent(process.env.HOTMART_CLIENT_ID)}` +
    `&client_secret=${encodeURIComponent(process.env.HOTMART_CLIENT_SECRET)}`;
  const r = await fetch(u, {
    method: "POST",
    headers: { Authorization: `Basic ${process.env.HOTMART_BASIC}` },
  });
  const raw = await r.text();
  let t = null;
  try {
    t = JSON.parse(raw).access_token;
  } catch {
    /* cai no throw abaixo com o cru */
  }
  if (!t) throw new Error(`Hotmart sem access_token (HTTP ${r.status}): ${raw.slice(0, 200)}`);
  _token = t;
  return t;
}

/**
 * As assinaturas de um e-mail.
 *
 * NUNCA lança por falha de rede/API: devolve `{ ok: false, erro, status }`.
 * Lançar faria uma varredura de 20 pessoas morrer na 3ª e perder as 17; devolver
 * lista vazia seria a mentira cara. O meio-termo honesto é dizer "não sei desta".
 *
 * @returns {Promise<{ok: true, assinaturas: object[], raw: string}
 *                  | {ok: false, erro: string, status: number|null}>}
 */
async function assinaturasDe(email) {
  let H;
  try {
    H = { Authorization: `Bearer ${await token()}` };
  } catch (e) {
    return { ok: false, erro: `token: ${e.message}`, status: null };
  }

  const url = `${BASE}/subscriptions?subscriber_email=${encodeURIComponent(email)}`;
  let r, raw;
  try {
    r = await fetch(url, { headers: H });
    raw = await r.text();
  } catch (e) {
    return { ok: false, erro: `rede: ${e.message}`, status: null };
  }

  if (!r.ok) return { ok: false, erro: `HTTP ${r.status}: ${raw.slice(0, 200)}`, status: r.status };

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, erro: `resposta não é JSON: ${raw.slice(0, 200)}`, status: r.status };
  }

  const assinaturas = json.items || (Array.isArray(json) ? json : []);
  return { ok: true, assinaturas, raw };
}

module.exports = { assinaturasDe, ehAtiva, codeDe, token, faltando, BASE, VARS };
