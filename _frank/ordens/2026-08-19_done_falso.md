# ORDEM — O "Done." falso

Diagnóstico certo, e a leitura de gravidade também. `|| 'Done.'` converte
**resposta vazia em confirmação de tarefa cumprida** — é o modo de falha mais
silencioso possível se apresentando como sucesso, na cara do sócio.

E você viu a ironia sozinho: passamos o dia fixando que silêncio não pode
parecer saúde, e o seu próprio canal converte vazio em sucesso.

---

## 1. A correção (card do coder, `main`)

Trocar o `|| 'Done.'` das duas linhas por uma falha honesta: dizer que a
resposta veio vazia, que a pergunta **não foi processada**, e pedir pra
repetir.

Duas exigências:

- **Nunca invente conteúdo pra preencher o vazio.** Nem "Done.", nem "Ok", nem
  um resumo do que você acha que ia responder. Vazio é vazio, e a mensagem
  tem que dizer isso.
- **Registre no log toda vez que cair nesse caminho**, com quem perguntou e o
  quê. Se isso voltar a acontecer, você precisa saber — hoje não sabe.

## 2. ⚠️ O que você não levantou: quantos "Done." falsos já saíram

Se essa linha existe há tempo, **isso já aconteceu antes** — com o Lucas e com
o Johnny. E cada um é uma tarefa que eles acham que está feita e não está.

**Levante:** quantas vezes o bot respondeu "Done.", pra quem, e o que tinha
sido pedido. Se der pra recuperar as perguntas do histórico, traga-as.

Isso não é curiosidade: **é trabalho perdido que ninguém sabe que perdeu.** Se
o Lucas pediu alguma coisa há duas semanas, leu "Done." e nunca cobrou, aquilo
sumiu.

## 3. A causa, antes do sintoma

Você está certo em não parar no `||`. A pista do `Session locked. Send your
PIN to unlock` às 04:15 é forte: se a sessão está travada, as mensagens caem
no caminho vazio e viram "Done.".

Confirme **no log**, não por suposição. E se for isso, a correção do item 1
não basta — sessão travada tem que responder **"estou travado, preciso do
PIN"**, não uma falha genérica. O Lucas precisa saber o que fazer.

## 4. A pergunta do Lucas: faça como você propôs

**Levante a lista completa de cancelados** — nome, e-mail, data, valor e saldo
— com o motivo marcado como **desconhecido** onde não houver registro. É
exatamente o certo: entregar o que se sabe e marcar o que não se sabe, em vez
de deixar de entregar por falta do motivo.

**Sobre o motivo declarado:** não varra a caixa. Os cancelados que escreveram
já foram respondidos pela Fast, então estão **`SEEN`** — abrir só essas, com
`BODY.PEEK`, não atropela ninguém. Faça só dos casos da lista, nunca varredura
geral.

E priorize o `ler_caixa.cjs` (ordem `2026-08-19_ler_caixa.md`): ele resolve
isso de vez, e você acabou de esbarrar nele pela terceira vez hoje.

## 5. Ao responder o Lucas

Diga o que aconteceu: que as mensagens dele não foram processadas e que o
"Done." foi um bug, não uma resposta. Ele precisa saber que não foi ignorado —
e precisa saber que aquilo que ele achou que estava feito não está.

Vale a regra 12: **diga o que aconteceu de verdade, inclusive quando a culpa é
nossa.**
