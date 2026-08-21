# Caso Manu Martins (nutrimanumartins@gmail.com) — "não comprei e fui cobrada"

Incidente `f8cd8c0e` | Cards 07094229 (medição) + continuação (execução) | 21/08/2026

## O que era

Aluna sem conta no app recebeu e-mail de "compra aprovada / créditos
reservados" e um aviso de PIX de R$ 97, disse que nunca comprou nada e pediu
cancelamento. Medo de chargeback.

## O que a medição provou (fontes: banco + Hotmart viva, corpos crus no card 07094229)

- **Nunca pagou nada.** Hotmart `/subscriptions/JDAIYO25/purchases`:
  rec#1 HP3299687519 R$ 0 (trial Founder, 13/08) COMPLETE; rec#2 HP3199363814
  R$ 97 PIX **WAITING_PAYMENT** (nunca pago, expira 22/08 23:59 UTC).
  `pagou_de_verdade.cjs`: zero PURCHASE_APPROVED com valor > 0.
- **Sem conta, sem crédito.** `profiles` = vazio; só existia a reserva
  `entitlements 26db5264` (user_id null, active, access_until 13/09).
- **Assinatura já cancelada** na Hotmart (CANCELLED_BY_SELLER, 20/08 ~18:17 UTC),
  antes da reclamação. O e-mail que a assustou foi o webhook PURCHASE_COMPLETE
  do trial R$ 0 chegando 21/08 06:28, depois do cancelamento — timing infeliz
  do pipeline, não cobrança nova.
- **Sem risco de chargeback:** pagamento era PIX, nada foi pago, nenhum cartão
  envolvido.

## O que foi executado (21/08, autorizado pelo Frank)

1. **Reserva cancelada:** `entitlements 26db5264` `active → expired`
   (17:29:10Z, UPDATE com guarda `.eq(status,'active')`, `.select()` devolveu
   1 linha, releitura independente confirmou). `expired` e não `canceled`
   porque `recomputeProfileAccess` dá acesso a `canceled` com data futura;
   `expired` nunca dá acesso nem crédito — o caso exato ("dinheiro não entrou").
2. **Aluna avisada:** e-mail para `nutrimanumartins@gmail.com` (endereço
   resolvido no banco na hora do envio, regra #876; confirmado também por
   `aluno.cjs`), bcc suporte@lucasarrial.com, aceite SMTP 250 entre
   17:30:28Z e 17:30:30Z. Texto: nada foi cobrado, assinatura cancelada,
   PIX expira sozinho, reserva removida.
3. **PIX pendente na Hotmart:** a API que usamos (payments v1) só tem
   `/subscriptions/{code}/cancel` como escrita — já feito. Não existe endpoint
   para anular cobrança pendente; HP3199363814 expira sozinha 22/08 23:59 UTC.
   Nenhum movimento de dinheiro foi tentado.
4. **Fix de código: NÃO HÁ BUG DE CÓDIGO.** Nada quebrou: o trial R$ 0 foi
   assinado (por ela ou por alguém com os dados completos da empresa dela,
   MANU FOOD CONSULTANT FZCO), a Hotmart emitiu a recorrência normal e nosso
   pipeline mandou o e-mail padrão de compra. Pergunta aberta não-bloqueante:
   quem rodou o CANCELLED_BY_SELLER de 20/08 (provável limpeza nossa de trials).
5. **Crédito: nada a devolver.** R$ 0 cobrado, R$ 0 creditado.
