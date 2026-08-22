/**
 * Onboarding — a RÉGUA DE AVISOS de cada linha da planilha (Johnny 21/08).
 *
 * O aluno recebe um rastro do que está acontecendo com os arquivos dele:
 *   começamos → processando imagens → processando áudio → final.
 * E o final tem três caras: tudo pronto / está ok mas assine / algo falhou.
 *
 * DUAS REGRAS QUE O JOHNNY DEIXOU CLARAS, e que este arquivo existe pra
 * guardar:
 *
 *   1. E-MAIL DE ERRO SÓ QUANDO A CAUSA DEPENDE DO ALUNO. Link sem permissão,
 *      pasta vazia, áudio curto demais: ele precisa agir, então ele é avisado
 *      e a mensagem diz o que fazer. Erro NOSSO (rede, servidor, Kie fora) NÃO
 *      vai pro aluno — vai pra planilha e pro grupo, e a gente resolve.
 *      Avisar o aluno de erro nosso só gera chamado e desconfiança.
 *
 *   2. TODO ERRO VAI PRO GRUPO, com a LINHA da planilha e o E-MAIL do aluno —
 *      é assim que o time acha a linha em segundos. A Carol (WhatsApp do
 *      suporte) é quem fala; o e-mail ao suporte@ é o registro.
 *
 * Tudo aqui é best-effort: aviso que falha NUNCA derruba o import. Sai pelo
 * SMTP do suporte@ (pelo Resend sairia como "AI Clone Verse" — lição 10/08).
 */
import { sendSupportMail } from "@/lib/agent/mail-smtp";
import { sendAgentText } from "@/lib/agent/provider";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";

const LOGIN_URL = "https://fastcloner.com/login";
const ASSINAR_URL = "https://fastcloner.com/#planos";
const ASSINATURA = "\n\n— Equipe FastCloner";

/** Onde a Carol avisa a equipe (mesma env da escalação do WhatsApp). */
function grupoJids(): string[] {
  return (process.env.AGENT_TEAM_WHATSAPP ?? "")
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function mandar(to: string, subject: string, text: string): Promise<void> {
  try {
    await sendSupportMail({ to, subject, text: text + ASSINATURA });
  } catch (e) {
    console.error(`[onboarding/avisos] e-mail "${subject}" → ${to}:`, e instanceof Error ? e.message : e);
  }
}

// ── A régua ────────────────────────────────────────────────────────────────

export async function avisoComecamos(email: string, nome: string | null): Promise<void> {
  await mandar(
    email,
    "Começamos a preparar a sua plataforma",
    `Oi${nome ? `, ${nome}` : ""}!\n\n` +
      `Recebemos o seu material e já começamos: estamos fazendo o upload dos seus ` +
      `arquivos e analisando as imagens e os áudios que você enviou.\n\n` +
      `Você vai receber um e-mail a cada etapa. Não precisa fazer nada por enquanto.`,
  );
}

export async function avisoProcessandoImagens(email: string): Promise<void> {
  await mandar(
    email,
    "Processando as suas imagens",
    `As suas imagens chegaram e estão sendo processadas agora. ` +
      `Elas vão virar a sua referência visual na plataforma.\n\n` +
      `Em seguida passamos para o áudio.`,
  );
}

export async function avisoProcessandoAudio(email: string): Promise<void> {
  await mandar(
    email,
    "Processando o seu áudio",
    `Agora é a vez do áudio: estamos baixando e medindo o material de voz que ` +
      `você enviou. Precisamos de pelo menos 20 minutos de fala para treinar ` +
      `a sua voz com qualidade.\n\n` +
      `Quando terminar, você recebe o resultado aqui.`,
  );
}

/**
 * Erro que DEPENDE do aluno (regra 1). `oQueFazer` é a instrução concreta —
 * "libere o acesso da pasta", "envie mais 8 minutos de áudio" — nunca um
 * código de erro.
 */
export async function avisoPrecisamosDeVoce(
  email: string,
  assunto: string,
  oQueAconteceu: string,
  oQueFazer: string,
): Promise<void> {
  await mandar(
    email,
    assunto,
    `${oQueAconteceu}\n\n` +
      `O que precisamos de você:\n${oQueFazer}\n\n` +
      `Assim que ajustar, responda este e-mail ou avise no suporte que a gente ` +
      `retoma de onde parou — o que já deu certo está guardado.`,
  );
}

/** Final feliz, aluno com assinatura vigente. Texto do Johnny 13/08. */
export async function avisoTudoPronto(email: string): Promise<void> {
  await mandar(
    email,
    "Sua plataforma está pronta! 🎉",
    `Sua plataforma está pronta! 🎉\n\n` +
      `Já configuramos sua imagem e sua voz na FastCloner e testamos: está funcionando. ` +
      `Agora você pode entrar na plataforma e gerar quantos vídeos e cenários quiser, ` +
      `a partir da sua imagem e da sua voz treinada.\n\n` +
      `Se preferir, volte às aulas da Fábrica de Conteúdo Invisível — a Aula 7 mostra ` +
      `o passo a passo de como gerar seus próprios vídeos, e a Aula 8 te dá o mapa do ` +
      `que postar toda semana.\n\n` +
      `Acesse: ${LOGIN_URL}`,
  );
}

/**
 * Final para quem NÃO tem assinatura vigente (ou nunca entrou). Os arquivos
 * estão ok e já processados; falta só o acesso. ⚠️ Por decisão do Johnny
 * (21/08) NÃO fala de saldo nem de cobrança — só que está tudo ok.
 */
export async function avisoOkMasAssine(email: string): Promise<void> {
  await mandar(
    email,
    "Seus arquivos estão prontos — falta só o acesso",
    `Boa notícia: suas imagens e o seu áudio estão ok e já foram processados. ` +
      `Sua imagem e a sua voz estão configuradas na FastCloner.\n\n` +
      `Para usar tudo isso — gerar vídeos, cenários e áudios com a sua voz — ` +
      `você precisa ativar a sua assinatura da plataforma.\n\n` +
      `Assine aqui: ${ASSINAR_URL}\n\n` +
      `Assim que ativar, é só entrar em ${LOGIN_URL} e está tudo lá te esperando.`,
  );
}

// ── O grupo (regra 2) ──────────────────────────────────────────────────────

export type ErroOnboarding = {
  /** Linha da planilha — é assim que o time acha. */
  linha: number | null;
  email: string;
  /** "imagens" | "áudio" | "conta"… */
  etapa: string;
  /** O motivo, legível. */
  motivo: string;
  /** true = o aluno precisa agir (e já foi avisado); false = erro nosso. */
  dependeDoAluno: boolean;
};

/** A Carol avisa o grupo e o suporte@ recebe o registro. Nunca lança. */
export async function escalarNoGrupo(erro: ErroOnboarding): Promise<void> {
  const linha = erro.linha == null ? "?" : String(erro.linha);
  const quem = erro.dependeDoAluno ? "aluno já avisado por e-mail" : "erro NOSSO — aluno NÃO foi avisado";
  const texto = [
    `📋 *Onboarding — linha ${linha} com erro (${erro.etapa})*`,
    ``,
    `*Aluno:* ${erro.email}`,
    `*Motivo:* ${erro.motivo}`,
    `*Quem resolve:* ${quem}`,
    ``,
    erro.dependeDoAluno
      ? `Quando o aluno liberar, é só voltar o Status da linha ${linha} pra "Recebido".`
      : `Precisa de alguém olhar a linha ${linha} na planilha.`,
  ].join("\n");

  for (const jid of grupoJids()) {
    try {
      await sendAgentText(jid, texto);
    } catch {
      /* tenta o próximo */
    }
  }

  try {
    await sendEmail({
      to: [SUPPORT_EMAIL],
      subject: `📋 Onboarding linha ${linha}: erro em ${erro.etapa} (${erro.email})`,
      html:
        `<ul>` +
        `<li><strong>Linha:</strong> ${escapeHtml(linha)}</li>` +
        `<li><strong>Aluno:</strong> ${escapeHtml(erro.email)}</li>` +
        `<li><strong>Etapa:</strong> ${escapeHtml(erro.etapa)}</li>` +
        `<li><strong>Motivo:</strong> ${escapeHtml(erro.motivo)}</li>` +
        `<li><strong>Quem resolve:</strong> ${escapeHtml(quem)}</li>` +
        `</ul>`,
    });
  } catch {
    /* registro é best-effort */
  }
}

/**
 * Classifica se o motivo DEPENDE DO ALUNO (regra 1). Olha o texto do erro que
 * o import já produz — são os mesmos motivos que hoje vão pra nota da
 * planilha. Conservador: na dúvida, é erro nosso (o aluno NÃO é incomodado).
 */
export function dependeDoAluno(motivo: string): boolean {
  const m = motivo.toLowerCase();
  return (
    /permiss|acesso negado|access denied|403|401|n[aã]o p[uú]blico|privad/.test(m) ||
    /n[aã]o encontrado|not found|404|link inv[aá]lido|n[aã]o [eé] um link|pasta vazia|sem arquivo|nenhum arquivo|no item with the given id/.test(m) ||
    /curto demais|insuficiente|m[ií]nimo|menos de \d+ ?min|pelo menos \d+ ?min/.test(m) ||
    /corrompid|n[aã]o [eé] (imagem|[aá]udio)|formato/.test(m) ||
    // 22/08 (Johnny): arquivo gigante É erro real e É do aluno. As linhas 529
    // (8.944MB) e 531 (3.932MB) morreram no teto e o aluno nunca soube: o
    // grupo era avisado, ele não. Quem mandou 8,9GB precisa ser avisado, senão
    // manda de novo igual.
    /teto|passa do teto|passou de \d+|tem \d+ ?mb|grande demais/.test(m) ||
    // 22/08 (OneDrive): o link devolveu página de login no lugar do arquivo.
    // A falha é do NOSSO download, mas só o aluno resolve — mandando o link
    // por um serviço que a gente abre (Drive/WeTransfer/Dropbox). Sem avisar,
    // ele nunca fica sabendo e a linha morre calada.
    /p[aá]gina da internet|n[aã]o conseguimos baixar/.test(m)
  );
}
