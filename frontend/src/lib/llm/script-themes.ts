/**
 * Temas de roteiro pra gravação de voz. Cada tema vira uma INSTRUÇÃO DE ESTILO
 * pro Haiku (não só assunto) — assim o texto muda de gênero (infantil,
 * jornalístico, piadas…) e a pessoa lê com entonações variadas, o que enriquece
 * o treino da voz.
 *
 * Arquivo SÓ DE DADOS (sem segredo / sem código server) → importável tanto no
 * client (popup de seleção) quanto no server (montar o prompt).
 */
export type ScriptTheme = {
  id: string;
  label: string;
  emoji: string;
  hint: string; // descrição curta pro card do popup
  instruction: string; // injetado no prompt do Haiku (estilo + tipo de conteúdo)
};

export const SCRIPT_THEMES: ScriptTheme[] = [
  {
    id: "cotidiano",
    label: "Conversa do dia a dia",
    emoji: "💬",
    hint: "Casual e espontâneo, como um papo com um amigo",
    instruction:
      "uma história casual e cotidiana, contada como quem conversa com um amigo (gírias leves, ritmo de fala espontâneo). Ex.: um perrengue no mercado, um vizinho excêntrico, um dia caótico no trabalho",
  },
  {
    id: "infantil",
    label: "História infantil",
    emoji: "📖",
    hint: "Lúdica e doce, com fantasia",
    instruction:
      "uma história infantil lúdica e doce, com personagens cativantes (animais, criaturas mágicas), tom encantado e carinhoso, como quem lê pra uma criança dormir",
  },
  {
    id: "jornalistico",
    label: "Jornalístico",
    emoji: "📰",
    hint: "Boletim de notícias, sério e informativo",
    instruction:
      "um boletim jornalístico fictício no tom de âncora de telejornal: sério, claro e informativo, narrando uma notícia inventada mas plausível, com manchete, desenvolvimento e encerramento",
  },
  {
    id: "comedia",
    label: "Piadas e comédia",
    emoji: "😂",
    hint: "Humor leve, com timing cômico",
    instruction:
      "um texto de humor leve, como um stand-up curto ou uma sequência de situações engraçadas do cotidiano, com timing cômico e exageros divertidos",
  },
  {
    id: "dramatico",
    label: "Narração dramática",
    emoji: "🎭",
    hint: "Suspense, tensão e emoção forte",
    instruction:
      "uma narração dramática com suspense e tensão crescente e emoção forte, como um trecho de novela ou conto de mistério, sem violência gráfica",
  },
  {
    id: "comercial",
    label: "Comercial / propaganda",
    emoji: "📣",
    hint: "Entusiasmado e persuasivo",
    instruction:
      "um roteiro de propaganda entusiasmado e persuasivo, anunciando um produto ou serviço fictício, com energia de locutor de comercial e uma chamada pra ação no fim",
  },
  {
    id: "aventura",
    label: "Aventura / fantasia",
    emoji: "🧙",
    hint: "Épico e descritivo",
    instruction:
      "uma aventura de fantasia épica e descritiva, com heróis, cenários grandiosos e momentos de coragem, no tom de quem narra uma saga",
  },
  {
    id: "podcast",
    label: "Podcast / bate-papo",
    emoji: "🎙️",
    hint: "Reflexivo e opinativo",
    instruction:
      "um monólogo de podcast reflexivo e opinativo, como um apresentador comentando um tema curioso do dia a dia, com opiniões pessoais e perguntas retóricas",
  },
];

export function findScriptTheme(id: string | null | undefined): ScriptTheme | null {
  if (!id) return null;
  return SCRIPT_THEMES.find((t) => t.id === id) ?? null;
}
