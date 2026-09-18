/**
 * SGP — Sistema de Geração Pronto dentro do FastCloner.
 * Plano e decisões: _Bugs/SGP/PLANO_SGP.md (29/08).
 */

export const SGP_STATUS = [
  "dados",
  "foto",
  "audio",
  "revisao",
  "enviado",
  "processando",
  "pronto",
  "falhou",
] as const;
export type SgpStatus = (typeof SGP_STATUS)[number];

/** Ordem das telas do wizard (barra de passos). */
export const SGP_PASSOS = ["dados", "foto", "audio", "revisao"] as const;
export type SgpPasso = (typeof SGP_PASSOS)[number];

/** Régua de fotos = o guia PDF ("4 a 5 fotos"): mínimo 4 aprovadas, máximo 6. */
export const SGP_FOTOS_MIN = 4;
export const SGP_FOTOS_MAX = 6;

/** Checkboxes da tela 2 (ciência do aluno, gravada com hora). */
export const CIENCIA_FOTO = ["luz", "fundo", "enquadramento", "nitida", "sem_acessorios"] as const;
/** Régua de áudio do SGP = a do app (Johnny 29/08): 20–60 min de FALA aprovada. */
export const SGP_AUDIO_MIN_SEGUNDOS = 20 * 60;
export const SGP_AUDIO_MAX_SEGUNDOS = 60 * 60;
/**
 * Teto de ARQUIVOS de áudio no pedido. Morava solto em `audio/slot/route.ts`;
 * subiu pra cá porque o passo atômico do banco também precisa dele — teto
 * conferido só na hora do slot fura sob concorrência (#238).
 */
export const SGP_AUDIO_MAX_ARQUIVOS = 20;
/** Checkboxes da tela 3. */
export const CIENCIA_AUDIO = ["30min", "silencio", "mesmo_ambiente", "fala_natural"] as const;

export type SgpFotoTipo = "rosto_frente" | "rosto_lado" | "meio_corpo" | "corpo_inteiro" | "outro";

export type SgpFoto = {
  key: string;
  status: "processando" | "aprovada" | "reprovada";
  tipo?: SgpFotoTipo | null;
  sorrindo?: boolean;
  /** Dá pra ver o rosto? Decide qual foto vira a referência padrão. */
  rosto_visivel?: boolean;
  /** Cabeça virada de lado (perfil ou 3/4) — o guia pede pelo menos uma. */
  perfil?: boolean;
  /** Impressões digitais pra barrar foto repetida (ver lib/sgp/impressao-foto.ts). */
  sha256?: string | null;
  dhash?: string | null;
  motivos?: string[];
};

export type SgpAudio = {
  key: string;
  nome: string;
  segundos: number;
  status: "processando" | "aprovado" | "reprovado";
  /** Por que foi barrado. */
  motivos?: string[];
  /** Ressalvas: o áudio vale, mas pode afetar a voz clonada. */
  avisos?: string[];
};

export type SgpPedidoRow = {
  id: string;
  /** Dono enquanto não há conta (cookie httpOnly). Ver lib/sgp/sessao.ts. */
  sessao: string;
  nome: string | null;
  email: string | null;
  whatsapp: string | null;
  email_verificado_at: string | null;
  codigo_hash: string | null;
  codigo_expira_em: string | null;
  codigo_tentativas: number;
  /** O e-mail já tinha conta no FastCloner quando começou o wizard. */
  conta_existente: boolean;
  /** Só depois do "Confirmar e Enviar". */
  user_id: string | null;
  criado_em: string;
  atualizado_em: string;
  status: SgpStatus;
  ciencia_foto: string[] | null;
  ciencia_foto_at: string | null;
  ciencia_audio: string[] | null;
  ciencia_audio_at: string | null;
  aceite_lgpd_at: string | null;
  fotos: SgpFoto[];
  audios: SgpAudio[];
  enviado_em: string | null;
  foto_pronta_em: string | null;
  voz_pronta_em: string | null;
  voice_id: string | null;
  erro: string | null;
  /**
   * "Já cobrei" do time no /admin/sgp (migration 106). OPCIONAIS de propósito:
   * enquanto a 106 não for aplicada as colunas não existem e a rota do painel
   * devolve a linha sem elas — a tela tem que continuar de pé. Ausente e `null`
   * significam a mesma coisa aqui: ninguém cobrou.
   */
  cobrado_em?: string | null;
  cobrado_por?: string | null;
  /**
   * "Marcar erro" do time no /admin/sgp (migration 109). OPCIONAIS pelo mesmo
   * motivo das de cobrança: enquanto a 109 não for aplicada as colunas não
   * existem e a rota do painel devolve a linha sem elas.
   *
   * ⚠️ NÃO é a coluna `erro` acima. Aquela é do SISTEMA (o robô carimba a falha
   * técnica em lib/sgp/etapas.ts); esta é do TIME, que descobriu por fora que o
   * pedido deu errado. As duas aparecem como ERRO na tela, com motivos diferentes.
   */
  erro_manual_em?: string | null;
  erro_manual_por?: string | null;
  erro_manual_motivo?: string | null;
  /**
   * "Concluir atendimento" do time no /admin/sgp (migration 110). OPCIONAIS
   * pelo mesmo motivo das anteriores: enquanto a 110 não for aplicada as
   * colunas não existem e a rota do painel devolve a linha sem elas.
   *
   * ⚠️ NÃO é `status === 'pronto'`. Aquilo é o ROBÔ dizendo que entregou o
   * produto; isto é o TIME dizendo que não precisa mais mexer neste caso (o
   * aluno foi reembolsado, desistiu, resolveu por fora). Um pedido pode estar
   * concluído SEM ter sido entregue — e é justamente esse o caso que a tela
   * não pode deixar de mostrar.
   */
  concluido_em?: string | null;
  concluido_por?: string | null;
  concluido_motivo?: string | null;
  /**
   * A conclusão veio do FECHAMENTO AUTOMÁTICO (migration 118, NÃO APLICADA) —
   * 7 dias depois da ENTREGA, sem reclamação registrada. OPCIONAL pelo mesmo
   * motivo das anteriores.
   *
   * ⚠️ NÃO é redundante com `concluido_por`. Este é o campo ESTRUTURADO, pra
   * contar em SQL sem casar texto ("quantos casos o relógio fechou no mês?").
   * Enquanto a 118 não entra, quem responde é a igualdade EXATA de
   * `concluido_por` com `SGP_CONCLUSAO_AUTOMATICA_AUTOR` (ver painel.ts): isso
   * mantém a TELA honesta, mas não dá uma consulta decente.
   */
  concluido_automatico?: boolean | null;
  /**
   * "Avisei o aluno" do time no /admin/sgp (migration 116, NÃO APLICADA).
   * OPCIONAIS pelo mesmo motivo das anteriores.
   *
   * ⚠️ NÃO é `status === 'pronto'` e NÃO é `concluido_em`. `pronto` é o ROBÔ
   * dizendo que GEROU; `concluido_em` é o time dizendo que não precisa mais
   * mexer no caso; ISTO é alguém afirmando que o ALUNO FOI AVISADO de que o
   * material está pronto — um fato sobre o mundo, não sobre a nossa fila.
   * Confundir os dois primeiros foi o defeito que o recado 6 (15/09) expôs: a
   * tela dizia "Entregue" e "Nada a fazer" para 82 pedidos sem ter ideia se
   * alguém tinha falado com o aluno.
   *
   * Enquanto a 116 não entra, quem responde sozinho é
   * `profiles.onboarding_ready_email_at` — ver lib/sgp/aviso.ts.
   */
  avisado_em?: string | null;
  avisado_por?: string | null;
  /** "e-mail", "WhatsApp"… Por onde o aluno foi avisado. */
  avisado_canal?: string | null;
};

/** Só dígitos, com DDI. "+55 (11) 99999-8888" → "5511999998888". */
export function normalizarWhatsapp(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 10 || d.length > 15) return null;
  return d.startsWith("55") || d.length > 11 ? d : `55${d}`;
}
