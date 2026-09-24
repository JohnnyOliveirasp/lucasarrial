/**
 * MONTAGEM DA MENSAGEM do enviar_email.cjs — extraída pra ser testável.
 *
 * Por que existe como arquivo separado (incidente #559, 24/09): o script
 * principal só monta a mensagem dentro do fluxo que fala SMTP e grava no
 * banco de verdade — impossível de testar sem mandar e-mail real. Aqui a
 * montagem é PURA (entrada → string) e o teste em _montar_mensagem.test.cjs
 * prova byte a byte que o caminho sem thread continua idêntico ao de sempre.
 *
 * ⚠️ Fonte ÚNICA da montagem: o enviar_email.cjs chama ESTA função. Não copie
 * esta lógica de volta pra lá — duas cópias da mesma regra divergem em silêncio.
 */

const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
/** Assunto com acento precisa virar encoded-word (RFC 2047). */
const cabecalho = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);

/**
 * Monta a mensagem RFC 5322 completa (cabeçalhos + corpo base64).
 *
 * `emRespostaA` é o Message-ID da carta do ALUNO a que estamos respondendo
 * (com os <>). Quando presente, sai In-Reply-To E References com esse valor —
 * mesmo padrão do mail-smtp.ts:151 que a Fast usa em produção. Como o APPEND
 * em Enviados grava a mensagem exatamente como montada aqui, a cópia nossa
 * fica na mesma thread que a do aluno, sem passo extra.
 *
 * ⚠️ Isso melhora a chance de o aluno RECONHECER a resposta na caixa dele
 * (o cliente de e-mail agrupa na conversa). NÃO é conserto de entrega: carta
 * fora de thread sempre CHEGOU — ela só aparecia solta.
 *
 * `agora` existe só pro teste fixar a data; sem ele, é new Date() como sempre.
 */
function montarMensagem({ user, dest, bcc, assunto, html, messageId, emRespostaA, agora }) {
  return [
    `From: Fast - FastCloner <${user}>`,
    `To: ${dest}`,
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${cabecalho(assunto)}`,
    // Date/Message-ID: sem eles a cópia gravada em enviados fica sem data e
    // sem identidade — o servidor SMTP até completa em trânsito, mas o APPEND
    // grava a mensagem exatamente como está aqui.
    `Date: ${(agora ?? new Date()).toUTCString()}`,
    `Message-ID: ${messageId}`,
    ...(emRespostaA ? [`In-Reply-To: ${emRespostaA}`, `References: ${emRespostaA}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/html; charset="UTF-8"',
    // ⚠️ SEM ESTA LINHA O ALUNO LÊ "vocÃª". Medido em 25/08 no e-mail do
    // Luciano (enviados uid 103): o cabeçalho dizia charset UTF-8, mas o corpo
    // saía em bytes 8-bit CRUS, sem declarar codificação de transferência. O
    // padrão quando este campo falta é 7bit, que proíbe byte acima de 127 —
    // então cada acento vira dois caracteres sujos e sobra pro cliente
    // adivinhar. O mailer da Fast (frontend/src/lib/agent/mail-smtp.ts:141)
    // sempre mandou base64, e por isso na MESMA pasta de enviados os e-mails
    // DELA apareciam limpos e os NOSSOS não. Vale pra todo e-mail que este
    // script mandou pra aluno antes desta data.
    "Content-Transfer-Encoding: base64",
    "",
    // Base64 quebrado em 76 colunas (limite do MIME).
    b64(html).replace(/(.{76})/g, "$1\r\n"),
  ].join("\r\n");
}

module.exports = { montarMensagem, b64, cabecalho };
