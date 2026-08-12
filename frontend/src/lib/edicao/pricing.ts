/**
 * Wizard Vídeo Edição 2.0 — preços das operações próprias do wizard.
 * ⚠️ ASSUNÇÃO W5 (12/08): legendar um vídeo pronto custa o MESMO que uma
 * montagem do Estúdio (200 cr) — é um render ffmpeg no mesmo worker. A
 * decisão fina de preço por estação segue EM ABERTO com o Johnny (item 5
 * da spec 11/08); trocar aqui muda o gate e o débito juntos.
 */
export const EDICAO_CAPTION_COST = 200;

/** ⚠️ Mesma assunção: aplicar b-roll por cima do clone = 1 render ffmpeg. */
export const EDICAO_BROLL_COST = 200;
