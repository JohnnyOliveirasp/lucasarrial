/**
 * O texto do consentimento do Vídeos Virais 1.0 — um lugar só, porque a MESMA
 * frase precisa aparecer na tela e ser gravada na linha do vídeo.
 *
 * Decisão do Johnny (21/09): não há moderação; o aluno se responsabiliza.
 * Por isso a frase faz três coisas, e nenhuma é decorativa:
 *   1. ele AFIRMA ter o direito de compartilhar (não é só "eu concordo");
 *   2. ele AUTORIZA a exibição para os outros alunos;
 *   3. ele reconhece que a casa pode REMOVER a qualquer momento — que é o que
 *      permite tirar do ar sem discussão quando alguém reclama.
 *
 * Mudou a frase? Mude a versão junto. O que já foi aceito continua gravado com
 * o texto ANTIGO na linha do vídeo — é isso que responde uma reclamação de
 * direito autoral seis meses depois.
 */
export const CONSENTIMENTO_VERSAO = "2026-09-21";

export const CONSENTIMENTO_TEXTO =
  "Declaro que tenho o direito de compartilhar este vídeo e autorizo que ele fique " +
  "disponível para todos os usuários da plataforma. Assumo a responsabilidade pelo " +
  "conteúdo enviado e entendo que ele pode ser removido a qualquer momento.";

/** O que vai gravado na linha: a frase + a versão, pra não virar adivinhação. */
export const consentimentoRegistrado = () =>
  `[${CONSENTIMENTO_VERSAO}] ${CONSENTIMENTO_TEXTO}`;
