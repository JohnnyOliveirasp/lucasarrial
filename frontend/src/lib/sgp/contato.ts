/**
 * SGP — os RASCUNHOS que o TIME manda pro aluno, e o canal do clique.
 *
 * ⚠️ A REGRA QUE MANDA AQUI (Johnny, 15/09, corrigindo o escopo do recado 6):
 * *"você não vai entrar em contato com o aluno, minha equipe vai, só na tela
 * que pedimos para whatsapp e email, para que minha equipe tenha a
 * visualização"*.
 *
 * Então NADA neste arquivo envia coisa alguma, e não existe nada em lugar
 * nenhum que envie a partir dele: sem cron, sem job, sem fila de disparo, sem
 * 48h/D+5/D+9, sem WAHA. Ele monta um `href` — `wa.me` ou `mailto:` — com o
 * texto já escrito. O WhatsApp que abre é o de QUEM CLICOU, nunca o número da
 * empresa, e quem aperta "enviar" é a pessoa, depois de ler e editar. Continua
 * valendo, intacta, a regra permanente de que a empresa nunca inicia WhatsApp
 * por robô — este módulo é justamente o contrário disso: é o robô preparando o
 * texto pra uma pessoa mandar.
 *
 * Módulo PURO de propósito: sem fetch, sem banco, sem `Date.now()`. Dá pra
 * testar o texto de cada etapa sem subir nada.
 */
import { normalizarWhatsapp } from "./types.ts";
import type { SgpStatus } from "./types.ts";

/* ---------------------------------------------------------------------------
 * O CANAL
 * ------------------------------------------------------------------------- */

/**
 * Por onde o time falou. Registrado no clique (migration 115) — antes disso o
 * "já cobrei" só sabia QUANDO e QUEM, e o time não conseguia saber se o caso
 * foi pro WhatsApp ou pro e-mail sem perguntar pra pessoa que clicou.
 */
export const CANAIS = ["whatsapp", "email"] as const;
export type CanalCobranca = (typeof CANAIS)[number];

/** Como o canal aparece na tela. Minúsculo porque entra no meio de frase. */
export const CANAL_ROTULO: Record<CanalCobranca, string> = {
  whatsapp: "WhatsApp",
  email: "e-mail",
};

/** Valida o que veio do corpo do POST. Nada de `as CanalCobranca` na rota. */
export function ehCanal(v: unknown): v is CanalCobranca {
  return typeof v === "string" && (CANAIS as readonly string[]).includes(v);
}

/* ---------------------------------------------------------------------------
 * O RASCUNHO, POR ETAPA
 * ------------------------------------------------------------------------- */

/**
 * O primeiro nome, pro texto não abrir com "Oi Stella Maris Gomes Pereira
 * Pontes Pinheiro". Devolve `""` quando não há nome utilizável — inclusive no
 * `"(sem nome)"` que `montarLinha` usa como placeholder, que NÃO pode vazar pro
 * texto que o aluno lê.
 */
export function primeiroNome(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo || limpo === "(sem nome)") return "";
  return limpo.split(/\s+/)[0];
}

export type Rascunho = {
  /** Assunto do e-mail. O WhatsApp não usa — mensagem de zap não tem assunto. */
  assunto: string;
  /** O texto em si, igual nos dois canais. É o que vai preenchido no link. */
  corpo: string;
};

/**
 * O miolo da mensagem, por etapa do pedido.
 *
 * ⚠️ POR QUE ISTO NÃO REUSA `FALTA_NO_WIZARD` (painel.ts), que diz a mesma
 * coisa: aquele texto é TERCEIRA PESSOA, escrito pro ATENDENTE ler na coluna "O
 * que fazer" ("peça pra ele apertar o botão — o material *dele* já está lá").
 * Este é SEGUNDA PESSOA, escrito pro ALUNO ler. Colar um no outro produziria
 * "peça pra ele apertar o botão" dentro de uma mensagem endereçada ao próprio
 * aluno. São audiências diferentes, não duplicação de regra — a regra (em que
 * etapa o pedido está) continua morando num lugar só, que é o `status`.
 *
 * `Record<SgpStatus, …>` de propósito: status novo não compila até alguém
 * escrever o texto dele. Sem isso a etapa nova cairia num texto genérico e
 * ninguém notaria.
 */
const MIOLO: Record<SgpStatus, string> = {
  dados:
    "vi aqui que o seu cadastro do clone ficou pela metade — falta só terminar de preencher os seus dados. " +
    "Quando puder, é rapidinho. Qualquer dúvida é só me chamar por aqui.",
  foto:
    "vi aqui que o seu cadastro do clone parou na hora de enviar as fotos. " +
    "Assim que você mandar, a gente segue com o resto. Precisa de ajuda nessa parte?",
  audio:
    "vi aqui que o seu cadastro do clone parou na hora de mandar o áudio da sua voz. " +
    "Assim que você mandar, a gente segue. Precisa de ajuda nessa parte?",
  revisao:
    "vi aqui que o seu material do clone já está todo enviado — falta só você confirmar o envio na tela pra gente começar. " +
    "Quer que eu te acompanhe nesse último passo?",
  enviado:
    "passando pra avisar que o seu pedido do clone já está aqui com a gente, na fila. " +
    "Não precisa fazer mais nada do seu lado. Qualquer coisa, é só me chamar.",
  processando:
    "passando pra avisar que o seu clone está sendo gerado. " +
    "Não precisa fazer nada do seu lado. Qualquer coisa, é só me chamar.",
  pronto:
    "o seu clone já ficou pronto e está disponível na plataforma. " +
    "Passando só pra confirmar se deu tudo certo do seu lado.",
  // Sem prazo, de propósito (regra do Johnny/Lucas). E sem empurrar pro aluno
  // o contorno de um defeito nosso: o que ele precisa saber é que já estamos
  // olhando, não o que ele tem que fazer pra driblar a nossa falha.
  falhou:
    "estou olhando aqui o seu pedido do clone e vi que deu um problema do nosso lado. " +
    "Já estamos cuidando disso. Posso te ajudar em mais alguma coisa enquanto isso?",
};

/** Quem comprou e nunca abriu o portal: não tem pedido, então não tem status. */
const MIOLO_NAO_COMECOU =
  "vi que a sua compra do clone já está confirmada, mas o cadastro ainda não foi começado por aqui. " +
  "Quer que eu te ajude a dar o primeiro passo?";

const ASSUNTO: Record<SgpStatus, string> = {
  dados: "Seu cadastro do clone ficou pela metade",
  foto: "Faltam as fotos do seu clone",
  audio: "Falta o áudio da sua voz",
  revisao: "Falta só confirmar o envio do seu clone",
  enviado: "Seu pedido do clone está na fila",
  processando: "Seu clone está sendo gerado",
  pronto: "Seu clone está pronto",
  falhou: "Sobre o seu pedido do clone",
};

const ASSUNTO_NAO_COMECOU = "Vamos começar o seu clone?";

/**
 * O rascunho pronto pra ir no `href`. `status === null` = a pessoa comprou e
 * nunca abriu o portal (é a maior parte da aba "Todos os compradores").
 *
 * ⚠️ Isto é RASCUNHO, não mensagem final: ele abre no app da pessoa que clicou,
 * que lê, edita se quiser e manda. Por isso o texto é curto e sem promessa de
 * prazo — quem assina é um humano, e ele que decida o resto.
 */
export function rascunhoDeCobranca(status: SgpStatus | null, nome: string | null | undefined): Rascunho {
  const nm = primeiroNome(nome);
  const saudacao = nm ? `Oi ${nm}, tudo bem?` : "Oi, tudo bem?";
  const miolo = status ? MIOLO[status] : MIOLO_NAO_COMECOU;
  return {
    assunto: status ? ASSUNTO[status] : ASSUNTO_NAO_COMECOU,
    corpo: `${saudacao} Aqui é do time da FastCloner, ${miolo}`,
  };
}

/* ---------------------------------------------------------------------------
 * OS LINKS
 * ------------------------------------------------------------------------- */

/**
 * `https://wa.me/<digitos>?text=<rascunho>` — ou `null` quando não há telefone
 * utilizável, que é o que impede o link quebrado do card ("aluno SEM celular →
 * não renderiza link").
 *
 * ⚠️ O NORMALIZADOR É O DA CASA (`normalizarWhatsapp`, types.ts), o mesmo que a
 * aba "Todos os compradores" já usava pra montar `celularDigitos`. Não existe
 * um segundo aqui de propósito: dois normalizadores de telefone divergem, e o
 * dia em que divergirem uma das duas abas manda o time pro número errado.
 * Passar um `celularDigitos` (que já saiu dele) de volta por aqui é inofensivo
 * — a função é idempotente sobre dígitos com DDI, e é isso que deixa as DUAS
 * abas usarem este mesmo caminho.
 */
export function linkWhatsapp(bruto: string | null | undefined, corpo: string): string | null {
  const digitos = bruto ? normalizarWhatsapp(bruto) : null;
  if (!digitos) return null;
  return `https://wa.me/${digitos}?text=${encodeURIComponent(corpo)}`;
}

/**
 * `mailto:` com assunto e corpo preenchidos, ou `null` sem e-mail utilizável.
 *
 * O `"—"` é o placeholder que `montarLinha` grava quando a coluna vem vazia; se
 * ele virasse `mailto:—` o time abriria o cliente de e-mail num endereço
 * inválido e acharia que mandou.
 */
export function linkEmail(email: string | null | undefined, r: Rascunho): string | null {
  const limpo = (email ?? "").trim();
  if (!limpo || limpo === "—" || !limpo.includes("@")) return null;
  // O endereço vai CRU (só a query é escapada): `@` é caractere legal no alvo de
  // um `mailto:` (RFC 6068) e cliente de e-mail que recebe `%40` no lugar dele
  // abre com o destinatário torto em parte do parque instalado.
  const q = `subject=${encodeURIComponent(r.assunto)}&body=${encodeURIComponent(r.corpo)}`;
  return `mailto:${limpo}?${q}`;
}
