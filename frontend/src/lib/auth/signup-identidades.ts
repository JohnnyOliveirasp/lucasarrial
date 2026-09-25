/**
 * Detecta e-mail que já tem conta na resposta do `supabase.auth.signUp`.
 *
 * O Supabase responde 200 (sem `error`) tanto pra e-mail novo quanto pra
 * e-mail que já tem conta — de propósito, pra não vazar pra quem pergunta
 * quais e-mails existem na base (doc oficial de `signUp`: "If a user with
 * this email address already exists, this function ... returns an obfuscated
 * / fake user object"). O único sinal que diferencia os dois casos é
 * `data.user.identities`: array VAZIO quando o e-mail já tinha conta, com 1+
 * item quando é conta nova.
 *
 * MEDIDO em produção (caso irleygurgel@gmail.com, conta criada pela CASA no
 * onboarding em 10/09): `email_confirmed_at` e `created_at` só 59ms de
 * diferença, `confirmation_sent_at` NULL — a conta nasceu confirmada, sem
 * nenhum código de verificação enviado nem a enviar. Sem esta checagem, o
 * `signup-form.tsx` levava esse aluno direto pra tela "enviamos um código de
 * 6 dígitos" mesmo sem nada ter sido enviado, e o código nunca chegava.
 * Escala citada pelo Vigia: 2.234 contas carregam essa condição (é o universo
 * que PODE cair nisso ao tentar se cadastrar de novo, não afetados hoje).
 *
 * Módulo PURO de propósito: testável sem Supabase nem DOM.
 */
export function emailJaTemConta(identities: unknown): boolean {
  return Array.isArray(identities) && identities.length === 0;
}
