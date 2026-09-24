/**
 * Regras PURAS da caixa de recados `para_frank_*` (agent_state).
 *
 * A chave do ciclo de vida é CONSUMO, não status de incidente: o recado acaba
 * quando foi LIDO e agido (`lido_em` dentro do value), não quando o cartão
 * fecha. Medido em 24/09: recado aponta pra incidente que fica aberto semanas
 * depois do consumo, e 15 de 116 recados nem derivam de incidente (formatos
 * `para_frank_<timestamp>` e `para_frank_orfa_<rand>`) — apagar por status de
 * incidente nunca alcançaria esses.
 *
 * Zero banco, zero rede, zero env aqui: tudo que decide é (value, agora) →
 * boolean, pra ser testável a seco. Quem fala com o Supabase é o recado.cjs.
 */

const RETENCAO_DIAS_PADRAO = 30;
const DIA_MS = 86400000;

/**
 * O value da agent_state é jsonb NOT NULL, mas já chegou das três formas:
 * objeto (o normal), string com JSON dentro (dupla codificação de algum
 * escritor antigo) e, em tese, qualquer outra coisa. Normaliza pra objeto
 * SEM perder nada: o que não é objeto vira `{ valor_original: ... }`.
 */
function interpretarValue(bruto) {
  let v = bruto;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      /* segue string; cai no embrulho abaixo */
    }
  }
  if (v === null || typeof v !== "object" || Array.isArray(v)) {
    return { valor_original: v };
  }
  return v;
}

/**
 * Timestamp (ms) do consumo, ou null se o recado NÃO está consumido.
 * `lido_em` ilegível (não-string, vazio, data que não parseia) conta como
 * NÃO consumido: consumo que não se prova não protege ninguém — o recado
 * volta pro --listar e NUNCA entra no --limpar.
 */
function lidoEm(value) {
  const l = value?.lido_em;
  if (typeof l !== "string" || !l.trim()) return null;
  const t = Date.parse(l);
  return Number.isNaN(t) ? null : t;
}

/**
 * Aparece no --listar? SÓ o não consumido. Idade não entra na conta de
 * propósito: existe recado de 03/09 apontando pra cartão ainda aberto —
 * velho e pendente ao mesmo tempo. (`agora` fica na assinatura porque a
 * pergunta é temporal por natureza; hoje a resposta não depende dele.)
 */
function apareceNoListar(value, _agora) {
  return lidoEm(value) === null;
}

/**
 * Pode apagar? SÓ consumido há MAIS de `dias` (padrão 30). Não-lido nunca
 * apaga, seja qual for a idade da chave — idade não diz consumo. Os 30 dias
 * existem porque o texto ORIGINAL de recado já consumido serviu de evidência
 * em 23-24/09 (4 conferências de premissa; 3 premissas não se sustentaram):
 * apagar no consumo destruiria a régua de quanto confiar nos recados.
 */
function podeApagar(value, agora, dias = RETENCAO_DIAS_PADRAO) {
  const l = lidoEm(value);
  if (l === null) return false;
  return agora - l > dias * DIA_MS;
}

/**
 * Carimba o consumo DENTRO do value existente (merge, nunca substitui —
 * agent_state.value é jsonb NOT NULL e o texto original é evidência).
 * Já consumido → devolve intocado com jaLido=true: re-marcar não reseta o
 * relógio dos 30 dias nem apaga quem leu primeiro.
 */
function marcarLido(value, agoraIso, por) {
  if (lidoEm(value) !== null) return { value, jaLido: true };
  const novo = { ...value, lido_em: agoraIso };
  if (por) novo.lido_por = por;
  return { value: novo, jaLido: false };
}

/**
 * Incidente do recado: SÓ o campo `incident_id` do value. O sufixo da chave
 * NÃO entra — medido em 24/09, ele é prefixo de 8 hex do uuid (ou timestamp,
 * ou `orfa_<rand>`), e casar prefixo de uuid já mordeu antes (caso #399/#407:
 * "407" lido como prefixo casou com o cartão errado com ar de acerto).
 */
function incidenteDe(value) {
  const id = value?.incident_id;
  if (typeof id === "string" && id.trim()) return id.trim();
  return null;
}

/** Dia do recado (pro sort e pra exibição): o `at` de quem escreveu; sem ele, o updated_at da linha. */
function diaDe(value, updatedAt) {
  return value?.at || updatedAt || null;
}

module.exports = {
  RETENCAO_DIAS_PADRAO,
  DIA_MS,
  interpretarValue,
  lidoEm,
  apareceNoListar,
  podeApagar,
  marcarLido,
  incidenteDe,
  diaDe,
};
