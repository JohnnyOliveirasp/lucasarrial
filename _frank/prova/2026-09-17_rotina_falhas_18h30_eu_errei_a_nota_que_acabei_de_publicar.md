# Retratação — 17/09 ~18h30Z

**Corrijo a prova que eu mesmo publiquei 25 minutos atrás**
(`2026-09-17_rotina_falhas_18h_o_cancelamento_saiu_em_11min_e_o_aviso_levou_2_dias.md`,
commit `35da993d`).

**O fecho do `6c38c99d` continua certo. O motivo que eu escrevi estava errado.**
O título daquele arquivo é falso a partir da segunda metade.

---

## 1. A afirmação central era falsa

Escrevi que *"a promessa de avisar ficou 2 dias sem cumprir"* e que o aluno
*"ficou esperando uma confirmação que já existia"*.

Medido agora na pasta de enviados:

| uid | quando | assunto |
|---|---|---|
| **2416** | **15/09 12:02:24Z** | "Sua assinatura foi cancelada - FastCloner" |
| **2494** | 16/09 01:52:55Z | "Correcao: seus creditos NAO expiram em 19/09 - eu te informei errado" |

O `uid 2416` saiu **20 segundos** depois da execução do cancelamento
(12:02:03Z). **A promessa foi cumprida, na hora.** O `uid 2494` mostra que
outra ronda já tinha achado o erro sobre créditos, conferido no código,
corrigido com o aluno e aberto chamado.

**Não houve silêncio de 2 dias. Houve dois avisos antes do meu.**

---

## 2. Como eu errei: instrumento cego, e o controle positivo que eu não rodei

Concluí "ninguém avisou" a partir de `emails_enviados`. **Essa tabela não
registra envio feito pelo `enviar_email.cjs`** — ela é populada pelo app (a
Fast).

A prova é o **meu próprio e-mail**: mandei às 17:05Z, a cópia está nos enviados
como `uid 2665`, e ele **não aparece** em `emails_enviados`.

O mais grave não é o erro, é a forma dele. Eu **escrevi**, no item 6 da nota
anterior, uma ressalva dizendo que aquela tabela é instrumento fraco — e apoiei
a **conclusão principal** no mesmo instrumento sem rodar a contraprova. A regra
5-B é explícita: *"toda busca que volta VAZIA pede a mesma contraprova: rode
contra algo que você SABE que está lá"*. Eu tinha o controle positivo na mão (a
caixa de enviados, que eu **já tinha lido nessa mesma ronda**) e não rodei antes
de concluir.

Cai na armadilha que este repositório documenta desde 18/08, **com a ressalva já
escrita no mesmo arquivo**.

---

## 3. O número 63/64 cai junto, e mais fundo que a minha ressalva

*"63 de 64 cancelamentos sem e-mail depois"* saiu do mesmo instrumento cego.
Agora está **provado** que ele perde envios do nosso lado. O número não vale nem
como indício — não é "fraco", é **inválido**.

---

## 4. O que eu chamei de achado já era sabido há 39 horas

Minha "hipótese (a) refutada" (o aluno não perde os 166.035 créditos) está certa
no mérito, mas **não é minha e não é nova**. O chamado **`1e133bcd`** já media
isso em 16/09 01:52 — *"102 alunos pagantes, 23.598.446 créditos válidos, os
créditos FUNCIONAM, quem mente é a tela"* — e já está **`fixed`**.

Re-derivei sozinho o que já estava medido, comunicado e consertado. Gastei ronda
redescobrindo chão conhecido **porque investiguei antes de ler a caixa**.

---

## 5. O que custou ao aluno

Mandei a ele um **terceiro** e-mail sobre o mesmo assunto em 3 dias, **pedindo
desculpa por um atraso que não aconteceu**.

O conteúdo factual está certo e bate com o `uid 2494` (cancelamento feito, sem
cobrança em 19/09, créditos ficam). Nada do que ele leu é falso e nada o
prejudica no dinheiro nem no acesso. Mas eu me desculpei por uma falha nossa que
não existiu, e isso é ruído para quem já pediu para sair.

**Não vou mandar um 4º e-mail corrigindo o 3º.** Ele está de saída e já recebeu
3 mensagens em 3 dias sobre a mesma coisa; uma 4ª dizendo "na verdade a gente
tinha avisado" serve a mim, não a ele. Registro a decisão em vez de escondê-la.

---

## 6. O que continua valendo, sem mudança

- Cancelamento **pedido pelo titular** (uid 626/628) e executado em 11 min —
  regra 9-C cumprida.
- Dinheiro conferido, **nada devido**: 630 estornados, 3.885 são cortesia
  comercial, saldo 166.035 intacto.
- **`fixed` está certo** — e mais certo do que eu achava, porque o aviso que eu
  julgava faltar já tinha saído duas vezes.

---

## 7. O que fica de verdade desta ronda

Não é o cartão do Luciano, que já estava tratado. É o método:

> **`emails_enviados` NÃO enxerga o que o Frank manda pela ferramenta.**

Qualquer ronda futura que medir *"o aluno foi avisado?"* por aquela tabela vai
concluir "ninguém avisou" sobre gente que **foi** avisada — e vai reescrever pro
aluno, como eu acabei de fazer. O instrumento certo é a pasta de enviados
(`ler_caixa.cjs --enviados --para`), e ele tem que ser lido **ANTES** de
investigar, não depois de concluir.

**Ordem de leitura que eu deveria ter seguido:** caixa → banco → código.
Eu fiz banco → código → caixa, e a caixa desmentiu as duas primeiras.
