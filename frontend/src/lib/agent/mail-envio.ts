/**
 * O ENVIO, do lado de cá: quem a casa escreveu, quando, e com qual Message-ID.
 * Módulo PURO (zero IO, zero import) — quem grava vive em `mail-envio-registro.ts`.
 *
 * POR QUE EXISTE. O `mail-bounce.ts` já sabe dizer que uma mensagem NÃO chegou,
 * e extrai o `Message-ID` do envio original do relatório de entrega (medido em
 * 13/09: **45 de 45** relatórios de falha dos últimos 30 dias trazem esse
 * cabeçalho, nenhum sem). Só que o outro lado do casamento NÃO EXISTIA: o
 * `sendSupportMail` gerava o Message-ID numa string inline, mandava, e jogava
 * fora — a função devolve `void` e nenhuma tabela guardava linha nenhuma.
 *
 * Consequência medida, e é a que dói: dá pra saber que UM e-mail quicou, mas
 * não dá pra responder **"quais alunos a gente acha que avisou e na verdade
 * não avisou"**, porque não existe registro do "a gente acha que avisou". O
 * 250 do SMTP era o único carimbo, e ele só quer dizer "aceitei pra entrega".
 *
 * ⚠️ NÃO EXISTE COLUNA `entregue`, DE PROPÓSITO. A casa nunca recebe
 * confirmação de leitura nem de entrega — o máximo que o processo sabe é
 * "o relay aceitou" (que já mentiu) e "voltou bounce" (que é prova). Uma
 * coluna tri-estado NULL/false/true convidaria alguém a ler NULL como
 * "entregue", que é exatamente a suposição que criou este problema. Então o
 * único fato gravado é o NEGATIVO, que é o que a gente realmente sabe:
 * `bounce_em is not null` significa "provado que não chegou". Ausência de
 * bounce é ausência de notícia, não prova de entrega — e o nome da coluna
 * não deixa ninguém confundir os dois.
 */

/** De onde saiu a mensagem — qual fluxo da casa escreveu pro aluno. */
export type OrigemEnvio =
  /** resposta da Fast a um e-mail do aluno (mail-respond) */
  | "fast-resposta"
  /** aviso automático de anexo grande demais (mail-respond) */
  | "fast-anexo-grande"
  /** encaminhamento interno pro time revisar (mail-respond) */
  | "fast-revisao-interna"
  /** código de confirmação do SGP (sgp/codigo) */
  | "sgp-codigo"
  /** boas-vindas da compra do SGP na Hotmart */
  | "sgp-boas-vindas"
  /** avisos do onboarding (onboarding/avisos, onboarding/pronto) */
  | "onboarding-aviso"
  /** lembrete de treino de voz parado */
  | "lembrete-treino"
  /** convite/lembrete pro pagante que não criou conta */
  | "orfao-convite"
  /** campanha de recuperação */
  | "winback"
  /**
   * "Esqueci a senha" (`api/v1/auth/recuperar-senha`).
   *
   * ⚠️ ESTA ORIGEM NÃO EXISTIA, e a ausência dela é a história: até 18/09 o link
   * de senha saía pelo provedor do **Supabase** (chamada de cliente, no
   * `forgot-password-form.tsx`), então não passava pelo `sendSupportMail` e não
   * deixava linha nenhuma nesta tabela. Medido na aluna
   * walsicleia_kaka@hotmail.com: `recovery_sent_at` carimbado em `auth.users` e
   * ZERO linha aqui — a casa não tinha prova de entrega NEM de bounce
   * justamente no e-mail mais crítico que existe, o que devolve a conta pra
   * quem não consegue entrar.
   */
  | "recuperacao-senha"
  /**
   * E-mail escrito À MÃO pela ronda, pelo `_frank/ferramentas/enviar_email.cjs`.
   *
   * Não passa pelo `sendSupportMail` — sai de um script, direto no SMTP — e por
   * isso ficava FORA desta tabela. Medido em 16/09 no `#101`: o Luciano tem duas
   * linhas aqui, as duas de `fast-resposta` (15/09), e a carta que a ronda
   * mandou pra ele em 16/09 01:55Z (Enviados uid 2494) não tem linha nenhuma.
   * Mesmo aluno, mesma caixa, um caminho registrado e o outro invisível.
   *
   * O buraco não é de escrituração: `contato-ficha.ts` calcula TENTATIVAS e
   * PRÓXIMO PASSO lendo esta tabela. E-mail da ronda que não aparece aqui faz a
   * ficha dizer "ninguém tentou" depois de alguém ter tentado — que é como
   * nascem as quatro ordens de reenvio descritas no cabeçalho do
   * `ficha_bounce.cjs`. E se essa carta quicar, o `marcarNaoEntregue` não acha
   * linha pra carimbar e o aluno segue contado como avisado.
   */
  | "ronda-manual"
  /** chamador não informou */
  | "desconhecida";

/**
 * Gera o Message-ID do envio. Era uma expressão solta dentro do array de
 * cabeçalhos do `mail-smtp.ts`; virou função pra poder ser TESTADA e pra o
 * formato ficar num lugar só — é a CHAVE DO CASAMENTO com o bounce, então
 * mudar o formato sem querer quebraria o laço inteiro em silêncio.
 *
 * Formato preservado byte a byte do que já ia pro ar (`fast-<ms>-<aleatorio>@
 * fastcloner.com`), porque os bounces que já estão na caixa carregam ele e
 * qualquer varredura pra trás precisa continuar casando.
 *
 * Recebe `agora`/`aleatorio` por parâmetro pra ser determinístico no teste —
 * `Date.now()` dentro da função tornaria a asserção de formato impossível.
 */
export function gerarMessageId(
  agora: number = Date.now(),
  aleatorio: string = Math.random().toString(36).slice(2),
): string {
  return `<fast-${agora}-${aleatorio}@fastcloner.com>`;
}

/**
 * Normaliza um Message-ID pra servir de chave.
 *
 * ⚠️ OS DOIS LADOS ESCREVEM DIFERENTE. A gente gera COM os sinais de maior/
 * menor (`<...>`), que é o que manda a RFC 5322 e o que vai no cabeçalho. O
 * `mail-bounce.ts` extrai com `match(/<[^>]+>/)`, então também traz os sinais —
 * mas o `In-Reply-To` de alguns relatórios vem sem, e servidor nenhum garante
 * espaçamento. Comparar string crua faria o casamento falhar EM SILÊNCIO, que
 * é o pior desfecho possível aqui: o laço pareceria fechado e não estaria.
 *
 * Devolve `null` pra entrada vazia/sem formato de endereço, pra nunca gravar
 * chave lixo que casaria com outra chave lixo.
 */
export function normalizarMessageId(bruto: string | null | undefined): string | null {
  if (!bruto) return null;
  const semSinais = String(bruto).trim().replace(/^<+/, "").replace(/>+$/, "").trim();
  // Message-ID é `id-left@id-right`. Sem arroba não é Message-ID, é ruído.
  if (!semSinais || !semSinais.includes("@")) return null;
  return `<${semSinais.toLowerCase()}>`;
}

export type EnvioRegistro = {
  messageId: string;
  toEmail: string;
  assunto: string;
  origem?: OrigemEnvio | null;
  userId?: string | null;
};

/** A linha exatamente como vai pro banco. Separada pra ser testável sem cliente. */
export function linhaDoEnvio(r: EnvioRegistro): Record<string, unknown> | null {
  const messageId = normalizarMessageId(r.messageId);
  // Sem chave de casamento a linha não serve pro que a tabela existe: melhor
  // não gravar do que gravar registro que nenhum bounce vai achar.
  if (!messageId) return null;
  const to = (r.toEmail || "").trim().toLowerCase();
  if (!to) return null;
  return {
    message_id: messageId,
    to_email: to,
    // O assunto é o que identifica o caso pro humano que abrir a consulta.
    assunto: (r.assunto || "").slice(0, 300) || null,
    origem: r.origem ?? "desconhecida",
    user_id: r.userId ?? null,
  };
}

/**
 * A marcação de "não chegou", aplicada sobre a linha do envio.
 *
 * `bounce_em` é o carimbo do FATO (voltou), não da tentativa — quem chama já
 * tem o bounce na mão. `classe`/`diagnostico` vêm do `mail-bounce.ts` sem
 * reinterpretação: duas cópias da mesma regra é como elas divergem em silêncio.
 */
export function marcacaoDeNaoEntregue(args: {
  classe: string;
  diagnostico?: string | null;
  quando?: string;
}): Record<string, unknown> {
  return {
    bounce_em: args.quando ?? new Date().toISOString(),
    bounce_classe: args.classe,
    // Diagnóstico cru do servidor é a PROVA; truncar demais tira o que decide
    // o próximo passo, guardar inteiro enche a tabela. 1000 cobre os reais.
    bounce_diagnostico: (args.diagnostico || "").replace(/\s+/g, " ").trim().slice(0, 1000) || null,
  };
}
