import type { LegalDoc } from "./types";

/** Política de Uso (pt-BR, rascunho). Uso aceitável + proibições p/ voz IA. */
export const ACCEPTABLE_USE: LegalDoc = {
  slug: "uso",
  title: "Política de Uso",
  updatedAt: "Junho de 2026 (rascunho)",
  intro: [
    "Esta Política de Uso define o que é permitido e proibido na AI Clone Verse. " +
      "Ela existe para proteger as pessoas contra o uso indevido de clonagem de voz " +
      "por inteligência artificial. Violações podem levar à suspensão da conta e à " +
      "comunicação às autoridades.",
  ],
  sections: [
    {
      heading: "1. Princípio geral",
      body: [
        "Você é responsável por todo conteúdo que cria. Use a Plataforma apenas para " +
          "finalidades legais e com respeito aos direitos de terceiros.",
      ],
    },
    {
      heading: "2. Consentimento de voz é obrigatório",
      body: [
        "Só clone vozes que sejam suas ou para as quais você tenha autorização " +
          "expressa e comprovável da pessoa titular.",
        "É terminantemente proibido clonar a voz de outra pessoa sem consentimento.",
      ],
    },
    {
      heading: "3. Usos proibidos",
      body: [
        "Fraude, golpes ou engenharia social (ex.: fingir ser outra pessoa para " +
          "obter dinheiro, dados ou vantagens).",
        "Falsidade de identidade, difamação ou criação de declarações falsas " +
          "atribuídas a alguém.",
        "Desinformação, manipulação eleitoral ou conteúdo enganoso apresentado como " +
          "real.",
        "Conteúdo ilegal, de ódio, assédio, violência ou exploração.",
        "Conteúdo sexual envolvendo a voz de uma pessoa sem o seu consentimento, e " +
          "qualquer conteúdo envolvendo menores.",
        "Spam, robocalls abusivas ou comunicações automatizadas não autorizadas.",
        "Tentar contornar mecanismos de segurança, limites ou filtros da Plataforma.",
      ],
    },
    {
      heading: "4. Conteúdo de alto risco",
      body: [
        "Usos em contextos sensíveis (saúde, jurídico, financeiro, emergências) " +
          "exigem cautela redobrada e supervisão humana. Não use voz sintética para " +
          "simular autoridade ou induzir decisões críticas de terceiros.",
      ],
    },
    {
      heading: "5. Divulgação de conteúdo gerado por IA",
      body: [
        "Recomenda-se (e, em alguns casos, é exigido por lei) deixar claro quando um " +
          "áudio foi gerado por inteligência artificial, evitando enganar o público.",
      ],
    },
    {
      heading: "6. Vozes de terceiros e figuras públicas",
      body: [
        "A notoriedade de uma pessoa não autoriza a clonagem da sua voz. Vozes de " +
          "figuras públicas também exigem consentimento e não podem ser usadas para " +
          "fins enganosos.",
      ],
    },
    {
      heading: "7. Denúncia de abuso",
      body: [
        "Se você identificar uso indevido ou tiver sua voz clonada sem autorização, " +
          "entre em contato: suporte@fastcloner.com. Investigamos e agimos sobre " +
          "denúncias.",
      ],
    },
    {
      heading: "8. Consequências da violação",
      body: [
        "Podemos remover conteúdo, suspender ou encerrar contas e, quando cabível, " +
          "cooperar com autoridades competentes em casos de uso ilícito.",
      ],
    },
  ],
};
