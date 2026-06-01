/**
 * Documentos legais (pt-BR). RASCUNHO — em revisão jurídica.
 *
 * Versionamento: quando o texto mudar (ex.: após o advogado entregar a versão
 * final), suba CONSENT_VERSION. O popup de aceite reaparece automaticamente
 * pra todos, porque a query não acha aceite registrado na versão nova.
 */

export type LegalSection = {
  heading: string;
  body: string[];
};

export type LegalDoc = {
  /** usado na URL pública: /termos, /privacidade, /uso */
  slug: "termos" | "privacidade" | "uso";
  title: string;
  /** data da última atualização (texto livre) */
  updatedAt: string;
  intro: string[];
  sections: LegalSection[];
};

/** Versão atual do conjunto de termos. Subir => reapresenta o popup. */
export const CONSENT_VERSION = "2026-06-rascunho";

/** Aviso exibido enquanto o texto não passou pela revisão jurídica final. */
export const DRAFT_NOTICE =
  "Este documento é um rascunho preliminar e está em revisão jurídica. " +
  "O texto definitivo poderá ser alterado. Ao usar a plataforma você concorda " +
  "com a versão vigente.";
