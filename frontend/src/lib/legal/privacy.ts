import type { LegalDoc } from "./types";

/** Política de Privacidade (pt-BR, rascunho). Foco LGPD + processamento de voz. */
export const PRIVACY: LegalDoc = {
  slug: "privacidade",
  title: "Política de Privacidade",
  updatedAt: "Junho de 2026 (rascunho)",
  intro: [
    "Esta Política de Privacidade descreve como a AI Clone Verse coleta, usa e " +
      "protege seus dados pessoais, incluindo sua voz, em conformidade com a Lei " +
      "Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD).",
  ],
  sections: [
    {
      heading: "1. Quem somos (Controlador)",
      body: [
        "A AI Clone Verse atua como controladora dos dados tratados na Plataforma. " +
          "Contato do encarregado: contact@jcsolutionsus.com.",
      ],
    },
    {
      heading: "2. Dados que coletamos",
      body: [
        "Dados de cadastro: nome, e-mail e foto de perfil (ex.: via login Google).",
        "Dados de voz: amostras de áudio que você envia ou grava para treinar seu " +
          "clone de voz, e os áudios gerados.",
        "Dados de uso: registros de acesso, ações na plataforma e informações " +
          "técnicas (navegador, dispositivo, endereço IP).",
      ],
    },
    {
      heading: "3. Como usamos seus dados",
      body: [
        "Para fornecer o Serviço: treinar o modelo da sua voz, gerar áudios e " +
          "manter seu histórico.",
        "Para segurança, prevenção a fraudes e cumprimento de obrigações legais.",
        "Para melhorar a Plataforma e oferecer suporte.",
      ],
    },
    {
      heading: "4. Base legal (LGPD)",
      body: [
        "Tratamos dados com base na execução do contrato (prestação do Serviço), no " +
          "consentimento (especialmente para dados de voz, que podem ser dados " +
          "sensíveis), no cumprimento de obrigações legais e no legítimo interesse, " +
          "quando aplicável.",
      ],
    },
    {
      heading: "5. Processamento de voz por IA",
      body: [
        "Sua voz é usada para criar um modelo (LoRA/adaptação) que permite gerar " +
          "novos áudios. Esse processamento é necessário para a finalidade do " +
          "Serviço e ocorre mediante seu consentimento.",
        "Você pode solicitar a exclusão do seu clone de voz e dos áudios a qualquer " +
          "momento.",
      ],
    },
    {
      heading: "6. Compartilhamento e provedores",
      body: [
        "Não vendemos seus dados. Compartilhamos apenas com provedores que viabilizam " +
          "o Serviço, como infraestrutura de autenticação e banco de dados, " +
          "armazenamento de arquivos e processamento em GPU, sob obrigações de " +
          "confidencialidade.",
      ],
    },
    {
      heading: "7. Retenção",
      body: [
        "Mantemos seus dados enquanto sua conta estiver ativa ou pelo tempo " +
          "necessário para cumprir finalidades legais. Após a exclusão, removemos ou " +
          "anonimizamos os dados, salvo obrigação legal de retenção.",
      ],
    },
    {
      heading: "8. Seus direitos",
      body: [
        "Conforme a LGPD, você pode solicitar confirmação de tratamento, acesso, " +
          "correção, anonimização, portabilidade, eliminação e informações sobre " +
          "compartilhamento, além de revogar o consentimento.",
        "Para exercer seus direitos: contact@jcsolutionsus.com.",
      ],
    },
    {
      heading: "9. Segurança",
      body: [
        "Adotamos medidas técnicas e organizacionais para proteger seus dados, como " +
          "controle de acesso e uso de URLs assinadas para arquivos. Nenhum sistema, " +
          "porém, é totalmente imune a incidentes.",
      ],
    },
    {
      heading: "10. Cookies",
      body: [
        "Usamos cookies essenciais para autenticação e funcionamento da Plataforma, " +
          "e podemos usar cookies de medição para melhorar a experiência.",
      ],
    },
    {
      heading: "11. Transferência internacional",
      body: [
        "Alguns provedores podem processar dados fora do Brasil. Nesses casos, " +
          "buscamos garantias adequadas de proteção, conforme a LGPD.",
      ],
    },
    {
      heading: "12. Menores",
      body: [
        "A Plataforma não se destina a menores de 18 anos e não coletamos " +
          "intencionalmente seus dados.",
      ],
    },
    {
      heading: "13. Alterações",
      body: [
        "Podemos atualizar esta Política. Mudanças relevantes serão comunicadas e " +
          "poderão exigir novo aceite.",
      ],
    },
    {
      heading: "14. Contato",
      body: ["Dúvidas sobre privacidade: contact@jcsolutionsus.com."],
    },
  ],
};
