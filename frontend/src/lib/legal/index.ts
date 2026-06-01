import type { LegalDoc } from "./types";
import { TERMS } from "./terms";
import { PRIVACY } from "./privacy";
import { ACCEPTABLE_USE } from "./acceptable-use";

export type { LegalDoc, LegalSection } from "./types";
export { CONSENT_VERSION, DRAFT_NOTICE } from "./types";
export { TERMS, PRIVACY, ACCEPTABLE_USE };

/** Ordem em que os documentos aparecem no popup e no rodapé. */
export const LEGAL_DOCS: LegalDoc[] = [TERMS, PRIVACY, ACCEPTABLE_USE];

/** Lookup por slug (usado nas páginas públicas /termos, /privacidade, /uso). */
export const LEGAL_BY_SLUG: Record<LegalDoc["slug"], LegalDoc> = {
  termos: TERMS,
  privacidade: PRIVACY,
  uso: ACCEPTABLE_USE,
};
