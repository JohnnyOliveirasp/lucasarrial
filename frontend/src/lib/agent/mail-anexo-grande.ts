/**
 * Recusa por tamanho de mensagem: a CONTA e o TEXTO (funções puras).
 *
 * Vive fora de `mail-respond.ts` porque não depende de nada de `@/` — dá pra
 * testar com `node --test` direto, sem subir Next nem banco.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * O CASO QUE ORIGINOU (cliente PAGANTE, 09/09):
 *
 *   1. Ele mandou o print do problema (IMG_1177.PNG, 1.653.831 bytes = 1,7 MB).
 *   2. A Fast recusou: "veio com um anexo grande demais (2 MB)".
 *   3. Ele respondeu, com razão: "O arquivo enviado não tem 2mb".
 *   4. A Fast pediu desculpa e disse "pode reenviar que agora eu abro".
 *   5. Ele reenviou (uid 534).
 *   6. A Fast recusou DE NOVO, com a mesma mensagem de 2 MB.
 *   7. Ele: "Preciso de um suporte humano... ainda vem resposta automatizada errada".
 *
 * DOIS DEFEITOS, e os dois estão consertados aqui:
 *
 * (A) A CONTA ESTAVA ERRADA — ou melhor: era de OUTRA COISA. O teto do
 *     `mail-imap.ts` compara com `RFC822.SIZE`, que é a MENSAGEM INTEIRA, mas
 *     o texto dizia "seu ANEXO tem 2 MB". Anexo vira base64 no corpo do
 *     e-mail e incha ~33%: o print de 1,7 MB dele chegou como mensagem de
 *     2,3 MB. As duas afirmações eram verdadeiras ao mesmo tempo, e a nossa
 *     era a que estava com o rótulo errado — ele leu "seu anexo tem 2 MB",
 *     olhou o arquivo, viu 1,7 MB, e concluiu (certo) que a gente estava
 *     enganado.
 *
 *     Pior: o `Math.round(2_300_000 / 1_000_000)` devolvia exatamente `2`.
 *     Ou seja, a gente arredondava a mensagem PRA BAIXO até bater no valor do
 *     próprio limite, e mandava pro cliente um número que era menor que o
 *     tamanho real — dando a ele munição para provar que estávamos errados.
 *     Por isso `formatarTamanho` arredonda PRA CIMA e nunca subestima.
 *
 * (B) A FAST PROMETEU O QUE NÃO PODIA CUMPRIR. Entre a 1ª e a 2ª recusa ela
 *     disse "reenvia que agora eu abro". O limite é da caixa e não muda com o
 *     reenvio, então a promessa nascia morta — e repetir a mesma receita
 *     depois de falhar é o que transformou um problema pequeno em cliente
 *     pedindo humano. Daí `decidirAnexoGrande`: na SEGUNDA recusa ao mesmo
 *     remetente a receita não se repete, o caso vai pra uma pessoa.
 *
 * É a mesma família do #320 (uid 503): pedir REENVIO de algo que ia falhar
 * igual, e o cliente respondendo "caso contrário CANCELO SUBSCRIÇÃO".
 */

/**
 * Tamanho em MB para MOSTRAR AO CLIENTE, arredondado PRA CIMA.
 *
 * Arredondar pra cima não é capricho: com `Math.round`, uma mensagem de
 * 2,3 MB virava "2 MB" — o mesmo número do limite. O cliente lia que tinha
 * batido exatamente no teto, conferia o arquivo dele (menor), e a nossa
 * mensagem virava prova de que a gente não sabia do que estava falando.
 * Número que a gente mostra nunca pode ser MENOR que o real.
 *
 * Uma casa decimal, vírgula (pt-BR), sem `,0` pendurado: "2,3 MB", "33 MB".
 */
export function formatarTamanho(bytes: number): string {
  const mb = Math.max(0, bytes) / 1_000_000;
  // *10 / 10 = uma casa decimal, sempre pra cima. O +1e-9 mata o caso em que
  // a divisão binária devolve 2.0000000000000004 e o ceil sobe pra 2,1.
  const arredondado = Math.ceil(mb * 10 - 1e-9) / 10;
  const texto = Number.isInteger(arredondado)
    ? String(arredondado)
    : arredondado.toFixed(1).replace(".", ",");
  return `${texto} MB`;
}

/** Por remetente: quantas recusas por tamanho e quando foi a última. */
export type EstadoRecusas = Record<string, { n: number; at: string }>;

/** Passado isto, a reincidência não é mais a mesma conversa — zera. */
export const JANELA_RECUSAS_DIAS = 30;

/**
 * Joga fora o que passou da janela. Sem isto o registro cresce pra sempre —
 * é um único JSON no `agent_state`, e um blob que só engorda acaba virando o
 * problema do próximo (o `orphan_invites` chegou a 180 registros assim).
 */
export function podar(estado: EstadoRecusas, agora: number): EstadoRecusas {
  const limite = agora - JANELA_RECUSAS_DIAS * 24 * 60 * 60 * 1000;
  const out: EstadoRecusas = {};
  for (const [email, reg] of Object.entries(estado)) {
    const quando = Date.parse(reg?.at ?? "");
    // Data ilegível não é motivo pra descartar: na dúvida a gente PRESERVA,
    // porque perder o registro significa repetir a recusa com quem já levou uma.
    if (!Number.isFinite(quando) || quando >= limite) out[email] = reg;
  }
  return out;
}

export type DecisaoAnexoGrande = {
  /** Manda o caso pra uma PESSOA em vez de repetir a receita automática. */
  escalar: boolean;
  /** Corpo do e-mail pro cliente. */
  texto: string;
  /** Frase curta pro incidente / encaminhamento ao time. */
  motivo: string;
};

/**
 * O que fazer com uma mensagem acima do teto.
 *
 * @param sizeBytes         RFC822.SIZE — a MENSAGEM inteira, não o anexo.
 * @param limitBytes        o teto (MAIL_MAX_BYTES).
 * @param recusasAnteriores quantas vezes ESTE remetente já levou esta recusa.
 */
export function decidirAnexoGrande(args: {
  sizeBytes: number;
  limitBytes: number;
  recusasAnteriores: number;
}): DecisaoAnexoGrande {
  const { sizeBytes, limitBytes, recusasAnteriores } = args;
  const tamanho = formatarTamanho(sizeBytes);
  const teto = formatarTamanho(limitBytes);

  // SEGUNDA recusa ao mesmo remetente: a receita já falhou uma vez com esta
  // pessoa. Repetir palavra por palavra é exatamente o que fez o cliente de
  // 09/09 pedir "suporte humano". Aqui a gente para de tentar e entrega.
  if (recusasAnteriores >= 1) {
    return {
      escalar: true,
      motivo: `2ª recusa por tamanho (${tamanho}) ao mesmo remetente — escalado pra humano`,
      texto: [
        "Oi! Tudo bem?",
        "",
        `É a segunda vez que seu e-mail não abre aqui do meu lado, e eu não vou te fazer tentar de novo — o limite é da nossa caixa (${teto} por e-mail) e ele não muda no reenvio. A culpa não é do que você mandou.`,
        "",
        // NÃO dizer "mandei seu e-mail em anexo pra ela": o encaminhamento
        // leva só o aviso, e o original fica na caixa do suporte@ pra pessoa
        // abrir. Prometer o que o código não faz é o defeito (B) de novo.
        "Já passei o seu caso pra uma pessoa da equipe, e ela consegue abrir o seu e-mail original direto na nossa caixa. Ela te responde por aqui mesmo.",
        "",
        "Se quiser adiantar enquanto isso, me escreve em texto o que está acontecendo (só o texto, sem anexo) que eu já vou olhando junto.",
        "",
        "Desculpa a volta toda e obrigada pela paciência.",
        "",
        "Fast — FastCloner",
      ].join("\n"),
    };
  }

  return {
    escalar: false,
    motivo: `mensagem de ${tamanho} (teto ${teto})`,
    texto: [
      "Oi! Tudo bem?",
      "",
      // "SEU E-MAIL INTEIRO", nunca "seu anexo": o número é do RFC822.SIZE.
      // Ver o defeito (A) no cabeçalho deste arquivo.
      `Recebi seu e-mail, mas ele chegou aqui com ${tamanho} no total e a nossa caixa de suporte só consegue abrir mensagens de até ${teto} — por isso eu não consegui ler o que você mandou.`,
      "",
      // Esta frase existe pra pessoa não achar que a gente está inventando o
      // número. É a diferença entre o tamanho do ARQUIVO e o da MENSAGEM.
      "Só pra explicar o número, porque ele costuma não bater: quando um arquivo viaja anexado num e-mail, ele engorda cerca de 30% no caminho. Um anexo de 1,5 MB no seu computador chega aqui como uma mensagem de quase 2 MB. Então pode ser que o seu arquivo esteja menor que isso e mesmo assim o e-mail inteiro passe do limite.",
      "",
      // NUNCA "reenvia que agora eu abro" — ver defeito (B). Só caminhos que
      // de fato funcionam.
      "O que funciona daqui pra frente:",
      "",
      "- Me contar em texto mesmo o que aconteceu, sem anexo — na maioria dos casos eu resolvo só com isso.",
      "- Se for print de erro: mandar um só por e-mail, ou reduzir/tirar print da tela em vez de mandar a foto original do celular (a foto original é bem mais pesada).",
      "- Se for áudio, gravação ou vídeo: subir direto na plataforma, ou me mandar um link (Google Drive, WeTransfer, YouTube não listado).",
      "",
      "Se tentar de novo e ainda assim não passar, me avisa que eu chamo alguém da equipe pra pegar seu e-mail direto na caixa — você não vai ficar sem resposta.",
      "",
      "Desculpe o transtorno e obrigada!",
      "",
      "Fast — FastCloner",
    ].join("\n"),
  };
}
