/**
 * A data de hoje, para o system prompt da Fast.
 *
 * POR QUE ESTE MÓDULO EXISTE (incidente #323, 09/09/2026): `buildAgentSystem()`
 * montava o system prompt INTEIRO sem dizer em nenhum lugar que dia é hoje.
 * A única data que chegava até a Fast era a da garantia (account.ts:181/184), e
 * só quando existia janela de garantia da Hotmart. Fora dali a Fast não tinha
 * noção de tempo: ela lia datas no HISTÓRICO da conversa e as devolvia como se
 * fossem futuro.
 *
 * O CASO MEDIDO (aluna alana_pinho@hotmail.com, chamado #223):
 *   02/09 21:00Z  a casa escreveu a ela "Dia 07 eu te mando um update".
 *   09/09 12:33Z  ela cobrou o retorno.
 *   09/09 12:35Z  a Fast respondeu "no dia 07 eu te mando o update prometido"
 *                 — DOIS DIAS DEPOIS do dia 07. Ela leu a frase do próprio
 *                 histórico e a repetiu como promessa futura.
 *   09/09 12:47Z  a aluna percebeu: "Oi..mas hoje é dia 09. Achei que seria
 *                 esse mês o seu contato. Me enganei?"
 *
 * O aluno PERCEBE. Esta mesma aluna já tinha nos acusado de ser robô por um
 * erro da mesma família em 02/09 ("Vc e uma IA, pois hj e o segundo e nao o
 * terceiro dia"). Repetir prazo vencido queima a confiança exatamente de quem
 * já está irritado.
 *
 * MESMA FAMÍLIA DO #319 (account.ts:271 anunciava Pix pendente 9 dias depois de
 * vencido). Aquele consertou UM ponto de cálculo; este cobre a causa geral —
 * agora a data viaja em TODOS os canais (e-mail, chat do app, WhatsApp, grupo,
 * winback), porque todos passam por `buildAgentSystem()`.
 *
 * `agora` entra por PARÂMETRO de propósito — a mesma lição já escrita em
 * garantia.ts:64: prazo testado com relógio real vira teste que passa hoje e
 * quebra amanhã sem ninguém ter mexido no código.
 */

/** Fuso da casa. Todo aluno é brasileiro; a data que vale é a de Brasília. */
const TZ = "America/Sao_Paulo";

/**
 * "terça-feira, 09/09/2026" no fuso de Brasília.
 *
 * O fuso NÃO é detalhe: o servidor roda em UTC, e das 21h às 24h de Brasília o
 * UTC já virou o dia seguinte. Formatar com o relógio do processo faria a Fast
 * anunciar amanhã como se fosse hoje, todas as noites.
 */
export function dataPorExtensoBR(agora: Date): string {
  const dia = agora.toLocaleDateString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const semana = agora.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long" });
  return `${semana}, ${dia}`;
}

/**
 * O bloco que entra no system prompt.
 *
 * Não basta informar a data: o modo de falha medido não foi "ela não sabia o
 * dia", foi "ela repetiu uma data do histórico sem conferir se já tinha
 * passado". Por isso o bloco traz a REGRA junto com o dado — e manda escalar em
 * vez de inventar prazo novo, porque quem tem a resposta é a equipe, não ela.
 */
export function blocoHoje(agora: Date): string {
  return `HOJE É ${dataPorExtensoBR(agora)} (horário de Brasília).

REGRA DO TEMPO — obedeça ANTES de repetir qualquer data:
- Você só sabe que dia é hoje por esta linha. NUNCA deduza a data pelo histórico da conversa nem pela sua memória.
- Datas que aparecem no histórico são do PASSADO da conversa e podem JÁ TER VENCIDO. Antes de repetir qualquer data, COMPARE com a data de hoje acima.
- Se um prazo prometido ao aluno já passou, JAMAIS o repita como se fosse futuro ("no dia X eu te retorno"). Reconheça o atraso em uma frase, sem se justificar, e escale (regra 3) — quem tem o retorno é a equipe, não você.
- NUNCA prometa data nova por conta própria: você não controla o calendário da equipe. Prometer prazo que ninguém vai cumprir é pior do que dizer que vai verificar.

ESTA DATA É SÓ PRA CONFERIR PROMESSA DE RETORNO. NÃO a use para calcular garantia, prazo de reembolso, vencimento de Pix/boleto ou tempo de acesso: essas contas chegam PRONTAS no bloco CONTA DO ALUNO e você continua proibida de contar dias. Se a linha pronta não estiver lá, escale (regra 3) — não deduza a partir de hoje.`;
}
