/**
 * Chave de dedupe dos incidentes abertos pela Fast via E-MAIL.
 *
 * O DEFEITO que este módulo corrige (20/08, caso Katia): a assinatura era só
 * `fast-email:{tec|atend}:{email}` — o REMETENTE como chave. Quando o mesmo
 * aluno escrevia uma queixa NOVA e DIFERENTE, ela entrava como "ocorrência 2"
 * de um incidente já fechado sobre OUTRO defeito, sobrescrevia a description
 * e sumia do radar (a queixa de PACING da Katia, 20/08 17:05 UTC, entrou no
 * card ce6e157d de eco/corte, já corrigido pelo PR #8 e fechado).
 *
 * A chave agora distingue a QUEIXA, não só o remetente:
 *   `fast-email:{tec|atend}:{classe}:{email}`  quando a queixa é classificável
 *   `fast-email:{tec|atend}:{email}`           (formato legado) quando não é
 *
 * As duas travas que o conserto NÃO pode quebrar:
 *  (a) queixa nova (classe diferente) do mesmo aluno → incidente NOVO;
 *  (b) o mesmo aluno reclamando DA MESMA COISA n vezes → UM incidente com n
 *      ocorrências (dedupe legítimo continua), nunca n incidentes.
 * E a regra do card fechado: incidente fechado que recebe ocorrência nova
 * REABRE (com nota de reincidência) ou vira incidente novo — nunca vira
 * contador incrementado em silêncio.
 *
 * Observação: o vigia já criava na mão signatures com classe no meio
 * (`fast-email:qualidade-voz:...`, `fast-email:pendente:...`) — este módulo
 * formaliza a convenção que o time já usava organicamente.
 */

/** Minúsculas + sem acento, pra casar regex sem depender de grafia. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Classes de queixa, do mais específico pro mais genérico. A PRIMEIRA que
 * casar vence — a ordem importa: "está robótico, frases sem pontuação" tem
 * que cair em `pacing` (o sintoma concreto), não em `semelhanca` por causa
 * do "robótico" solto.
 */
const CLASSES: Array<{ classe: string; re: RegExp }> = [
  // Frases grudadas / sem pausa / sem pontuação (prosódia nas emendas)
  {
    classe: "pacing",
    re: /sem pontuacao|pontuacao|grudad|emendad|sem espaco|sem pausa|muito proxim|sem intervalo|colad[ao]s? (uma|na)|frases corrid/,
  },
  // Áudio incompleto / cortado / começando no lugar errado (completude)
  {
    classe: "corte",
    re: /letras? solt|cortad|incomplet|faltando|pela metade|nao (sai|aparece|toca) (todo|inteiro)|comecando (em lugar|no meio)|comeca(ndo)? no meio|para no meio|termina (cedo|antes)|audio nao termina|silabas? sem sentido|comendo trecho|perdeu? o (comeco|final|fim)|sem o final/,
  },
  // Áudio que não sai / mudo / não toca
  { classe: "sem-audio", re: /audio (vazio|mudo)|sem som|nao (gera|gerou|saiu) (o )?audio|nao toca/ },
  // Voz não parece com a pessoa (semelhança do clone)
  {
    classe: "semelhanca",
    re: /nao parec|diferente da minha voz|nao e (a )?minha voz|nao ficou parecid|voz de robo|parece (um )?robo|robotic|robotiz|voz estranha|nao soa como/,
  },
  // Créditos (não caiu, sumiu, cobrado a mais)
  { classe: "credito", re: /credito/ },
  // Cobrança / reembolso / cancelamento / assinatura
  { classe: "cobranca", re: /cobranc|cobrad[ao]|reembols|cancelament|cancelar|estorn|pagament|assinatura|mensalidade|fatura/ },
  // Acesso / login
  { classe: "acesso", re: /acesso|login|senha|nao consigo entrar|conta bloquead/ },
  // Treinamento / clonagem da voz
  { classe: "treinamento", re: /trein|clonar|clonagem|criar (a |uma )?voz/ },
  // Vídeo (clone de vídeo, animação)
  { classe: "video", re: /video/ },
  // Imagem / foto
  { classe: "imagem", re: /imagem|foto/ },
];

/**
 * Classifica a queixa numa classe grossa. Olha o RESUMO da Fast (reason)
 * primeiro — é texto dela, estável e sem citação —, e só cai pro excerpt
 * (e-mail cru do aluno) se o resumo não classificar. NUNCA classifica pelo
 * excerpt quando o reason já casou: o e-mail cru costuma vir com o thread
 * inteiro citado (a queixa ANTIGA junto), o que contaminaria a classe.
 */
export function classifyComplaint(reason: string, excerpt = ""): string | null {
  for (const texto of [reason, excerpt]) {
    const t = norm(texto ?? "");
    if (!t) continue;
    for (const { classe, re } of CLASSES) {
      if (re.test(t)) return classe;
    }
  }
  return null;
}

/** Monta a assinatura de dedupe. Classe null → formato legado (só remetente). */
export function incidentSignature(
  technical: boolean,
  fromEmail: string,
  classe: string | null,
): string {
  const canal = technical ? "tec" : "atend";
  return classe
    ? `fast-email:${canal}:${classe}:${fromEmail}`
    : `fast-email:${canal}:${fromEmail}`;
}

export type DedupeAction = "increment" | "reopen" | "new";

/**
 * O que fazer quando a busca pela assinatura encontra (ou não) um incidente.
 *
 * - sem incidente → NOVO (é a separação do caso Katia: classe diferente gera
 *   assinatura diferente, a busca não acha nada, nasce card próprio).
 * - aberto/investigando → INCREMENTA (trava b: mesma queixa repetida soma
 *   ocorrência num card que alguém já está olhando — nada se esconde).
 * - fechado (fixed/ignored):
 *     · queixa CLASSIFICADA → REABRE com nota de reincidência (mesma classe
 *       voltando depois de "corrigido" é regressão, e reabrir é sinal, não
 *       ruído);
 *     · queixa SEM classe → NOVO. No formato legado a assinatura não prova
 *       que é a mesma queixa — absorver num card fechado é exatamente o bug
 *       que escondeu a Katia. Card novo, com referência ao antigo na nota.
 */
export function decideDedupe(
  existingStatus: string | null | undefined,
  classe: string | null,
): DedupeAction {
  if (!existingStatus) return "new";
  const closed = existingStatus === "fixed" || existingStatus === "ignored";
  if (!closed) return "increment";
  return classe ? "reopen" : "new";
}
