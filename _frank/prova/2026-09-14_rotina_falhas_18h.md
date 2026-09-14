# 14/09 ~18h40Z — Rotina das falhas

Método serial (regra 8): peguei **um** caso e levei até onde dava. Fila **81
abertos** na abertura (1 com 30d+, 3 entre 15-30d, 29 entre 7-15d).

Varreduras fixas da ronda, antes de tudo:

- **2 (travados):** 4 em "acesso vivo, com crédito e sem voz pronta", **nenhum
  novo**: Marcelo (35d, já tratado em rondas anteriores), Eric e Euneiva em
  `awaiting_training` esperando o clique **deles**, e Thyago em `training` no
  dia 0 — prazo normal. Mais 1 `training_jobs` obsoleto (voz já `ready`,
  escrituração pendente, ninguém esperando). Nada a fazer.
- **2-B (pedido de saída × assinatura viva):** **0 sangrando**, com os dois
  controles OK (esquerda reencontrou o Marcelo, direita devolveu `SUR21VU9`).
  Zero de instrumento com controle vivo é zero de verdade, não cegueira.

## Qual peguei, e por que — conferido um a um, não presumido

A cabeça da fila inteira está **parada em decisão do Johnny**, e eu conferi
antes de pular, porque "o velho não dá" é exatamente a frase que esconde
trabalho:

| incidente | por que não peguei |
|---|---|
| `d3d8d1b2` #15 (46,2d) | trabalhado **hoje** 13:47Z |
| `ce6e157d` #47 (26,3d) | trabalhado **hoje** 14:48Z |
| `6c38c99d` #99 (22,1d) | **decisão com data** herdada de 10/09: o e-mail prometido sai 16-17/09. Escrever hoje seria a 13ª cópia sem fato novo |
| `b2651a6f` #101 (21,9d) | trabalhado **hoje** 10:22Z |
| `506b7c3a` #223 (13,1d) | aluna escrita 13/09, bola com ela + decisão de dinheiro do Johnny |
| `702cc916` #226 (13,0d) | a parte autorizada subiu 12/09 (PR #253). O resto é **produto**, não código |
| `5c68eb33` #263 (9,2d) | **zero nota desde 05/09** — fui conferir achando que era esquecimento. Não era: aluna respondida 05/09, sobram os R$ 97 na fila do Johnny (§8.4) |

Sobrou o **`#282`** (`03e7b34b`, 8,2d) — e nele o **8º caso**, que o Vigia
registrou em 09/09 e que estava **invisível nas duas listas**: ninguém tinha
tocado nela.

## O que era, de verdade

**Uma pagante escreveu duas vezes e ficou 5 dias no escuro.**
`walsicleia_kaka@hotmail.com`, INBOX uid 515 (09/09 19:20Z) e uid 516 (19:21Z):
*"Comprei o curso e não to tendo acesso"* e *"Entrei na plataforma Hotmart e não
tá lá"*. Conferi os Enviados: **zero resposta humana**.

**Ela pagou, e o nosso banco não sabe disso.**

| fonte | o que diz |
|---|---|
| Hotmart **viva** (`pagou_de_verdade.cjs`) | 2 compras COMPLETE em 21/08, **R$ 936,15** — SGP R$ 639,15 + Fábrica de Conteúdo Invisível R$ 297,00 |
| nosso banco | `payment_events` **0** (por `buyer_email` **e** por `payload::text`), `entitlements` **0**, compras **NENHUMA** |

**E a entrega saiu — o que nunca saiu foi a resposta.** `sgp_pedidos 8fbb0e8c`
está `pronto`: portal preenchido 11/09 19:13Z, foto pronta 20:16:52Z, voz
pronta 20:20:38Z (22 min, `[ready]`). No dia em que ela escreveu (09/09) o SGP
dela **ainda não tinha sido feito**; ela achou o portal sozinha dois dias depois
e o ciclo rodou inteiro. O R$ 639,15 está entregue.

## A medição nova, que é o que interessa pra classe deste cartão

**114 de 248 pedidos do SGP (46%) não têm nenhum `payment_event` no e-mail
deles.** Controle de que não é zero cego: os outros **134 têm**, então o join
enxerga.

Causa conferida em **arquivo:linha**, não repetida de nota antiga —
`webhooks/hotmart/route.ts:88-108`: o descarte de produto `de_fora` dá `return`
**antes** do insert em `payment_events`, e o comentário do próprio arquivo
documenta que o SGP só passou a ser aceito em **03/09**. A Walsicleia comprou em
**21/08** — antes da abertura. O evento dela foi descartado **por desenho**.

**Consequência prática, e é a classe do `#173`/Alana:** qualquer varredura nossa
que pergunte *"essa pessoa pagou?"* olhando o **nosso** banco responde "nunca
pagou" pra quase metade dos clientes de SGP. É o erro que já quase negou crédito
a pagante. A fonte de verdade continua sendo `pagou_de_verdade.cjs` (Hotmart
viva) — nunca `payment_events`, nunca `profiles.ja_pagou`.

**Não abri chamado novo pra isso**, pela ordem de 27/08 §3: a classe já está
aberta aqui e no `#290`. Um 3º cartão da mesma coisa infla a fila e esconde o
que dá pra resolver.

## O que fiz

- **Escrevi pra ela** (Enviados **uid 2315**, cópia CONFIRMADA na 1ª tentativa).
  Assumi os 5 dias sem desculpa, dei as 2 compras com nome e valor, expliquei a
  causa mais provável do *"não tá lá"* (entrar na Hotmart com e-mail diferente
  do da compra — as dela estão no `walsicleia_kaka@hotmail.com`) e avisei que o
  **clone dela ficou pronto em 11/09**, coisa que ela podia não saber.
- **Anotei o `#282`** com a medição e o caminho (7 notas, releitura conferida,
  1 linha afetada).
- **Apaguei o recado `para_frank_702cc916`**, parado há **13 dias**: ele pedia
  UMA coisa acionável ("persistir `qa.exhausted` num campo que o suporte lê") e
  ela foi entregue em 12/09 (PR #253, merge `999aeb4`, deploy success). `DELETE`
  com releitura conferida em **0**.
- **Postei no grupo**: o e-mail pra aluna e, separado, o achado dos 46%.

## O que NÃO fiz, e por quê

- **Não liberei acesso, não dei crédito, não criei entitlement.** O que compra
  avulsa dá direito aqui dentro é **decisão comercial** (`#173`), não de script.
  E o curso Fábrica de Conteúdo Invisível **nem é entregue pela nossa
  plataforma** — é produto da Hotmart.
- **Não inventei obstáculo nem facilidade pra ela.** É a lição do `#223`, onde
  eu inventei um bloqueio de acesso que não existia e custei 4,2 dias à Alana.
  Disse o que medi e só isso.
- **Não mexi no descarte do webhook.** A perna estrutural dos 46% envolve PII de
  produto de terceiro e precisa de decisão, não de patch apressado no fim da
  ronda.
- **Não marquei `fixed` o `#282`** (regra 14): respondi a aluna, não consertei a
  classe.

## Lições

1. **"Card sem nota há 9 dias" nem sempre é esquecimento — mas só dá pra saber
   abrindo.** Abri o `#263` esperando achar aluno abandonado e achei um caso
   corretamente parqueado. O custo de conferir foi baixo; o custo de presumir
   nos dois sentidos é alto — presumir "tá parado" refaz trabalho, presumir
   "alguém viu" é o que deixou a Walsicleia 5 dias sem resposta.
2. **O 8º caso é o que se perde.** Os 7 do lote do `#282` viraram lista, foram
   restituídos e ficaram visíveis. A Walsicleia chegou depois, não entrou em
   `affected_emails` de nada, e por isso ficou fora de toda varredura. **Quem
   chega depois da lista fica invisível pra lista.**
3. **Entrega feita não é atendimento feito.** O sistema montou o clone dela
   inteiro em 11/09 e mandou 5 e-mails automáticos — enquanto as duas perguntas
   que ela fez em 09/09 seguiam sem resposta. Automação em dia convive
   perfeitamente com aluno no escuro, e o painel não distingue os dois.
4. **Meia fila cega pro pagamento é um multiplicador de erro, não um detalhe de
   registro.** 46% não é uma lacuna de bookkeeping: é a taxa em que a pergunta
   "essa pessoa pagou?" responde errado pro lado que nega dinheiro a quem pagou.

## Estado do repo ao fim da ronda

- branch reconferida imediatamente antes do commit deste log;
- `git log origin/main..HEAD` **vazio** após o push (conferido abaixo);
- **nenhum código subiu nesta ronda** — só este log, e-mail, nota de incidente e
  o `DELETE` do recado. Logo não há branch `feat/` com commit preso.
