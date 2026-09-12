/**
 * MANIFESTO DE ANEXO — o que chegou, nunca o que tem dentro (#370).
 *
 * 🔴 O caso: Simone (chamado #301) respondeu ao suporte@ com dois JPEGs e
 * NENHUM texto. 4min19s depois a Fast re-pediu os MESMOS três itens, com as
 * mesmas palavras. Motivo: abaixo do teto de tamanho o anexo simplesmente não
 * existia pro fluxo — o único ramo ciente de anexo era o `mail.oversized`, que
 * só vale ACIMA do teto. Pior: a guarda `text.length < 5` marcava como lido e
 * DESCARTAVA em silêncio o e-mail que só tinha anexo. Classe medida: 4 e-mails
 * / 3 alunos em 3 dias, TODOS de reembolso — o anexo era justamente a prova que
 * a casa tinha pedido pra liberar dinheiro.
 *
 * ⚠️ DECISÃO DE PROJETO (Johnny + GLM, 12/09): MANIFESTO, NÃO VISÃO.
 * A Fast não tem alçada pra decidir reembolso, então ela não precisa LER o
 * comprovante — precisa parar de re-pedir, guardar a prova e escalar pro
 * humano. Visão custaria mais, mudaria o contrato do modelo e obrigaria a
 * confiar que ela lê valor em imagem, que é exatamente o erro que vira dinheiro
 * errado.
 *
 * Por isso tudo aqui é DECLARADO, nunca lido: nome e Content-Type vêm de quem
 * enviou e podem mentir. O manifesto prova RECEBIMENTO, jamais CONTEÚDO — e o
 * texto que vai pro cérebro diz isso com todas as letras, senão o modelo lê
 * `comprovante-672.jpg` e escreve "recebi seu comprovante de R$ 672".
 *
 * Este módulo é só DECISÃO (texto e política), sem IO: `mail-respond.ts` importa
 * Supabase/SMTP/`@/` e não roda em `node --test`, então o que precisa de teste
 * mora aqui. A LEITURA do MIME (`listarAnexos`) mora em `mail-charset.ts`, junto
 * das fronteiras declaradas que ela reutiliza — ter uma segunda cópia da regra
 * de fronteira é como nasceu a medida errada de anexo do #351.
 *
 * O `import type` abaixo é apagado pelo type-stripping do Node, então este
 * arquivo continua sem nenhum import em tempo de execução (import de módulo
 * local SEM extensão não resolve em `node --test`).
 */
import type { AnexoInfo } from "./mail-charset";

function tamanhoLegivel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} bytes`;
}

/**
 * O bloco que entra NA MENSAGEM DO ALUNO (o turn `user`), não no system.
 *
 * Precisa ser no conteúdo por um motivo mecânico, não estético: `toTurns` do
 * `brain.ts` descarta turn de texto vazio e `buildAgentReply` LANÇA "histórico
 * sem mensagem do aluno no fim". E-mail só-com-anexo tem texto vazio — se o
 * manifesto fosse apenas systemExtra, o caso da Simone continuaria morrendo,
 * agora com exceção em vez de silêncio.
 */
export function manifestoParaOCerebro(anexos: AnexoInfo[]): string {
  if (anexos.length === 0) return "";
  const itens = anexos.map((a, i) => `  ${i + 1}. "${a.nome}" (${a.tipo}, ${tamanhoLegivel(a.bytes)})`);
  return [
    ``,
    `[ANEXOS RECEBIDOS NESTE E-MAIL — ${anexos.length} arquivo(s):`,
    ...itens,
    `Estes arquivos CHEGARAM até nós. O conteúdo deles NÃO foi lido: o nome e o tipo acima são apenas o que o e-mail declarou e podem não corresponder ao que há dentro.]`,
  ].join("\n");
}

/**
 * A regra de comportamento (vai no systemExtra).
 *
 * Risco que o GLM levantou e que esta regra existe pra tapar: sem ela o modelo
 * trata nome de arquivo como evidência e afirma valor de comprovante que nunca
 * leu. Nome de arquivo é o que o remetente digitou, nada mais.
 */
export function regraDeAnexoParaOSistema(anexos: AnexoInfo[]): string {
  if (anexos.length === 0) return "";
  return [
    `ANEXOS: este e-mail veio com ${anexos.length} arquivo(s) anexado(s) — a lista está no fim da mensagem do aluno.`,
    `Você NÃO consegue abrir nem ler esses arquivos. Você sabe que eles CHEGARAM; o que há dentro, não sabe. Então:`,
    `1) NUNCA peça de novo um print, documento ou comprovante que já esteja naquela lista. Esse é o erro mais grave aqui: a pessoa acabou de mandar, e re-pedir faz a casa parecer que ignorou ela.`,
    `2) NUNCA descreva o conteúdo de um anexo, nem cite valor, data ou banco a partir dele, nem use o NOME do arquivo como prova do que ele é — nome e tipo são declarados por quem enviou e podem mentir. Não existe "recebi seu comprovante de R$ X"; existe "recebi seus arquivos".`,
    `3) O que você pode e deve dizer: que recebeu os ${anexos.length} arquivo(s) e já encaminhou pro time conferir.`,
    `4) Se o e-mail veio SÓ com o anexo e sem texto nenhum, não trate como mensagem vazia nem peça pra pessoa explicar tudo de novo do zero: confirme o recebimento e diga o próximo passo.`,
    `5) Se o assunto for dinheiro (reembolso, cobrança, cancelamento), continue escalando normalmente com [ESCALAR: resumo] — receber o arquivo não te dá alçada pra decidir nada.`,
  ].join("\n");
}

/**
 * O trecho que reabre o chamado (`reabrirPorRespostaDoAluno`).
 *
 * A marca do anexo vem NA FRENTE de propósito: a nota do chamado corta em 300
 * caracteres, e num e-mail longo o sufixo seria exatamente o pedaço perdido —
 * justo o que explica ao time por que o aluno voltou a falar.
 */
export function trechoComAnexos(text: string, anexos: AnexoInfo[]): string {
  if (anexos.length === 0) return text;
  const marca = `[respondeu com ${anexos.length} anexo(s)]`;
  return text.trim() ? `${marca} ${text}` : `${marca} (sem texto no corpo)`;
}

/**
 * Só-anexo NÃO é mensagem vazia.
 *
 * Era exatamente aqui que a Simone sumia: `text.length < 5` → `markSeen` →
 * `skipped`. Sem resposta, sem chamado, sem rastro.
 */
export function deveDescartarPorVazio(text: string, anexos: AnexoInfo[]): boolean {
  return text.length < 5 && anexos.length === 0;
}

/** O que a guarda de anexos devolve, pra decisão abaixo poder ser testada. */
export type ResultadoDeGuarda = {
  /** Partes ELEGÍVEIS pra guarda (tipo suportado, dentro do teto). */
  encontrados: number;
  /** Elegíveis que não viraram chave no R2. */
  falhas: number;
  /** Erro que derrubou a varredura inteira, se houve. */
  erro: string | null;
};

/**
 * Prova recebida que NÃO foi guardada é pior que não ter recebido: a Fast já
 * disse ao aluno "recebi e encaminhei pro time", e não há o que encaminhar.
 * Isso não pode virar `console.error` e acabar — vira escalação registrada.
 *
 * O que NÃO é falha: anexo de tipo que a gente não copia (.zip, .docx). Ele não
 * se perdeu, só não foi copiado — o original continua na caixa do suporte@ e o
 * chamado foi reaberto pela resposta do aluno. Escalar nesse caso seria ruído
 * em cima de ruído.
 */
export function falhaAoGuardarAnexo(anexos: AnexoInfo[], res: ResultadoDeGuarda): string | null {
  if (anexos.length === 0) return null;
  if (res.erro) return `falha ao guardar anexo do aluno: ${res.erro}`;
  if (res.falhas > 0) {
    return `${res.falhas} de ${res.encontrados} anexo(s) do aluno não foram guardados (upload falhou)`;
  }
  return null;
}

/**
 * O motivo que abre o incidente — nulo quando não há o que registrar.
 *
 * Duas origens independentes: a Fast pediu escalação (`reason`), ou a prova do
 * aluno se perdeu (`falhaDeAnexo`). Qualquer uma das duas basta; as duas juntas
 * viram um motivo só, porque o time precisa ver o pedido E o anexo perdido no
 * MESMO chamado — dois incidentes sobre o mesmo e-mail é como o quadro vira
 * ruído e ninguém lê.
 *
 * Mora aqui, e não no `mail-respond.ts`, porque é ISTO que decide se o e-mail
 * acaba em "escalated" ou em silêncio, e silêncio foi o defeito.
 */
export function motivoDoIncidente(reason: string | null, falhaDeAnexo: string | null): string | null {
  if (reason && falhaDeAnexo) return `${reason} | ATENÇÃO: ${falhaDeAnexo}`;
  return reason || falhaDeAnexo || null;
}
