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
import { gruposDoTime } from "@/lib/support/grupo";
import { sendAgentText } from "@/lib/agent/provider";
import { sendEmail, escapeHtml } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support/failure-alert";
import { classificarErro } from "./erro-dono";

const LOGIN_URL = "https://fastcloner.com/login";
const ASSINAR_URL = "https://fastcloner.com/#planos";
const ASSINATURA = "\n\n— Equipe FastCloner";

/**
 * Onde a Carol avisa a equipe: o GRUPO do suporte (jid em lib/support/grupo.ts,
 * um lugar só — já foi cópia em dois arquivos).
 *
 * 22/08 (Johnny): *"tem um grupo de whatsapp, é pra falar no grupo"*. Até aqui
 * isto lia AGENT_TEAM_WHATSAPP — 4 TELEFONES individuais, não o grupo — e
 * ainda mandava o número cru, sem o sufixo do jid. O WAHA recusa `chatId` sem
 * domínio, o `catch` abaixo era vazio e não logava: TODO aviso de erro do
 * onboarding falhou em silêncio desde que a régua entrou. Ninguém no grupo
 * soube de nenhuma das 46 linhas que deram erro.
 */
const grupoJids = gruposDoTime;

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
/**
 * SGP — etapa concluída. 29/08 (Johnny): "não recebi nenhum e-mail depois
 * dizendo que a foto foi gerada, que a voz está em treinamento, que a voz
 * estava pronta". Um e-mail por etapa, disparado por lib/sgp/etapas.ts.
 */
export async function avisoFotoPronta(email: string): Promise<void> {
  await mandar(
    email,
    "Seu clone de foto ficou pronto ✅",
    `Boa! A sua foto de clone já foi gerada.

` +
      `Agora estamos treinando a sua VOZ — leva cerca de 30 minutos. ` +
      `Você recebe outro e-mail quando ela ficar pronta; não precisa fazer nada.`,
  );
}

export async function avisoVozPronta(email: string): Promise<void> {
  await mandar(
    email,
    "Sua voz clonada ficou pronta 🎙️",
    `A sua voz terminou o treino e já está configurada na FastCloner.

` +
      `Se a sua foto também já ficou pronta, é só entrar na plataforma pra usar as duas.`,
  );
}

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
  // A família sai do próprio motivo — assim o grupo nunca lê "erro NOSSO" pra
  // uma linha que na verdade é e-mail errado na planilha (dois donos bem
  // diferentes, e a ação de cada um também).
  const dono = classificarErro(erro.motivo);
  const quem = {
    aluno: "o ALUNO — já avisado por e-mail com o que fazer",
    planilha: "o TIME — dado errado na planilha (o aluno NÃO dá pra avisar)",
    nosso: "a GENTE — erro nosso, o aluno NÃO foi incomodado",
  }[dono];
  const proximo = {
    aluno: `Quando ele mandar o material novo, volte o Status da linha ${linha} pra "Recebido".`,
    planilha: `Corrija o dado na linha ${linha} e volte o Status pra "Recebido".`,
    nosso: `Ninguém precisa falar com o aluno. É pra gente reprocessar a linha ${linha}.`,
  }[dono];
  const texto = [
    `📋 *Onboarding — linha ${linha} com erro (${erro.etapa})*`,
    ``,
    `*Aluno:* ${erro.email}`,
    `*Motivo:* ${erro.motivo}`,
    `*Quem resolve:* ${quem}`,
    ``,
    proximo,
  ].join("\n");

  for (const jid of grupoJids()) {
    try {
      await sendAgentText(jid, texto);
    } catch (e) {
      // NUNCA engolir calado: foi assim que o aviso morreu sem ninguém notar.
      console.error(`[onboarding/avisos] grupo ${jid}:`, e instanceof Error ? e.message : e);
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
 * A régua de culpa (classificarErro / dependeDoAluno / DonoDoErro) mora agora
 * em `erro-dono.ts`: é decisão PURA e precisa de teste próprio, e este arquivo
 * importa SMTP/WhatsApp/Resend (não sobe num `node --test`). Re-exportado aqui
 * pra não mexer em quem já importava daqui — o route.ts do import, por exemplo.
 */
export { classificarErro, dependeDoAluno } from "./erro-dono";
export type { DonoDoErro } from "./erro-dono";
