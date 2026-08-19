/**
 * Detector de áudio MUDO (silêncio digital) no browser, ANTES do upload.
 *
 * Por quê: caso Fernanda (fcdnanda, 18/08) — um MP3 válido de 44s cujo sinal
 * inteiro era silêncio digital (pico -inf dBFS) virou 3 jobs de Vídeo Clone
 * seguidos, cada um cobrando 4.620 créditos e queimando GPU: o InfiniteTalk
 * divide pela energia do áudio pra sincronizar os lábios e energia zero vira
 * NaN ("Array must not contain infs or NaNs"), sem erro estruturado. Ela
 * tentou 3x às cegas porque a tela só mostrava o erro genérico. O servidor já
 * barra isso (fix 4181a14, via transcrição vazia do Whisper), mas o aluno só
 * descobria DEPOIS de subir o arquivo e clicar em Gerar — aqui a gente avisa
 * no momento em que ele escolhe o arquivo.
 *
 * Limiar -60 dBFS, medido em cima de dado real (18/08): nos 60 jobs que deram
 * certo o pico mais baixo foi -19,09 dB; nas 54 falhas de 45 dias, só os 3
 * arquivos dela ficaram abaixo (em -inf) — a falha mais baixa com áudio real
 * era -17,2 dB. Ou seja, -60 tem ~40 dB de folga dos dois lados.
 *
 * REGRA CRÍTICA — falso positivo é PIOR que o bug: barrar um áudio legítimo
 * deixa um aluno pagante sem gerar, o que é pior que o comportamento atual
 * (que ao menos estorna). Então: bloqueia SÓ silêncio inequívoco (pico do
 * arquivo INTEIRO abaixo do limiar); qualquer erro de decode, browser sem
 * Web Audio, ou dúvida → DEIXA PASSAR e o guard do servidor decide.
 */

/** -60 dBFS em amplitude linear: 10^(-60/20) = 0.001. */
const LIMIAR_PICO_LINEAR = 0.001;

/**
 * true SOMENTE se o arquivo decodificou e o pico de TODOS os canais ficou
 * abaixo de -60 dBFS (silêncio inequívoco). false em qualquer outro caso,
 * inclusive falha de decode — nunca bloqueie por medição ausente.
 */
export async function audioSemSinal(file: File): Promise<boolean> {
  try {
    if (typeof OfflineAudioContext === "undefined") return false;
    const bytes = await file.arrayBuffer();
    // OfflineAudioContext decodifica sem precisar de gesto do usuário e sem
    // abrir dispositivo de som; os parâmetros do construtor são irrelevantes
    // pro decodeAudioData (o buffer sai na taxa nativa do arquivo).
    const ctx = new OfflineAudioContext(1, 1, 44100);
    const audio = await ctx.decodeAudioData(bytes);
    if (audio.length === 0) return false;
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const data = audio.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        // Primeira amostra audível já prova que o arquivo tem sinal.
        if (Math.abs(data[i]) >= LIMIAR_PICO_LINEAR) return false;
      }
    }
    return true;
  } catch {
    return false; // na dúvida, passa — o servidor (Whisper) é a segunda rede
  }
}
