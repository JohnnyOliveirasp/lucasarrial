# Rotina das falhas — 16/09 21h

**Dono da fila:** Frank (regra 14-A). **Método:** serial (regra 8).
**Fechado:** #289 (`4ab7e04d`) → `fixed`, com `resolution_note` e desfecho
conferido na fonte viva hoje.
Fila: **83 → 82 abertos.** 0 patch do Vigia. 101 recados `tell_frank` (não
tocados — ver §5).

---

## 0. Como escolhi o item

Não peguei a cabeça bruta da fila: conferi os 7 cartões acima dele **um a um**,
e todos têm o próximo passo fora das minhas mãos. Isso foi medido, não presumido:

| cartão | idade | por que pulei |
|---|---|---|
| `9ac03612` #11 | 56,9d | decisão do Johnny |
| `d3d8d1b2` #15 | 48,2d | decisão do Johnny (risco aceito) |
| `6c38c99d` #99 | 24,1d | escalado, resposta comercial |
| `702cc916` #226 | 15,0d | decisão levada ao grupo |
| `f8587cef` #234 | 14,1d | chave gasta GPU contínua, sem aval |
| `132f7808` #249 | 12,1d | **aval de WhatsApp, pendente desde 13/09** |
| `8c29740f` #250 | 12,1d | **aval de WhatsApp, pendente desde 13/09** |
| `f1ada07e` #254 | 12,0d | trabalhado hoje 17h44Z; resto é reembolso do Johnny |
| `5c68eb33` #263 | 11,2d | trabalhado 14/09; falta só a definição de dinheiro |

Os de 11,1d / 10,2d / 10,1d foram todos encostados nas rondas de hoje.

**Cabeça real:** **#289**, última anotação **07/09 17:55Z = 9,0 dias** sem
ninguém encostar — o incidente aberto mais velho cujo próximo passo era **meu**.

---

## 1. O que este cartão era, e por que ficou 9 dias parado

Não faltava conserto. **Faltava alguém escrever o desfecho.**

O cartão é a aluna Elane (`elaneyani@gmail.com`), insatisfeita com a voz clonada
"Elane ckis": sotaque, fala arrastada, pausas ruins. Pedia *"avaliar cura/
retreinamento sem custo"*.

Ele é **gêmeo do #293** — mesma aluna, mesma queixa, dois cartões (o Vigia
marcou isso em 07/09 12:11Z). O **#293 foi fechado** em 07/09 e, ao fechar,
passou explicitamente a perna que faltava: *"FALTA (não neste incidente): a 2ª
voz dela, 'Elane ckis' (4d9a645f) … Segue no #289."*

E o #289 **fez** a avaliação, no mesmo dia 17:55Z. Só não fechou.

---

## 2. Por que ele pode fechar — medido hoje, não herdado

1. **O pedido do cartão foi atendido.** A cura da voz 2 foi avaliada e
   **descartada com medição**: em ensaio, a referência do take 012 melhorava a
   articulação (2,270 → 2,645 pal/s) mas **dobrava o silêncio** (15,0% → 33,4%),
   piorando exatamente o que ela reclamou ("pausas ruins"). Ela tinha **zero
   geração própria** nessa voz. Decisão medida, não omissão.
2. **A voz 1 foi curada e ela confirmou por escrito.** INBOX uid 480, 07/09
   14:13: *"Eu vi a diferença."* Não é o nosso relatório dizendo que melhorou.
3. **Ela voltou a produzir depois da cura.** Em 08/09: 4 áudios, 2 imagens e
   **3 Vídeos Clone** (último 22:22). O receio que ela declarou no uid 480
   ("quero gerar um vídeo mas fiquei com receio") foi respondido às 17:15:20Z
   (Enviados uid 1268) e ela gerou os vídeos no dia seguinte. O ciclo fechou.
4. **Nenhuma pergunta dela em aberto**, varrido nos dois endereços.

---

## 3. O que eu fui conferir porque podia ter virado dano — e não virou

Achei no INBOX uma coisa que **não estava no cartão**: em **08/09 23:07**
(uid 497) ela pediu para cancelar, e às **23:11** (uid 498) avisou que **não
conseguiu**:

> *"Não consegui cancelar por lá. A aba de concluir não aparece. Estou com
> iPhone. A tela não sobe."*

Pedido de saída que o aluno não consegue executar é **a classe do #384** (o
pedido vira recado e nunca vira ação) e é assim que nasce cobrança indevida.
Então medi na fonte viva em vez de supor:

| fonte | o que diz |
|---|---|
| Hotmart viva, assinatura `8ATDW0V2` | `CANCELLED_BY_SELLER`, Plano Founder, `trial:true`, adesão 06/09 00:35Z |
| `date_next_charge` | era **13/09 12:00Z** — a data **passou há 3 dias, sem cobrança** |
| `pagou_de_verdade.cjs` | rec#1 **0 BRL** em 06/09; avulsas pagas **0**; Stripe **0** |

**A saída dela foi executada pela casa antes da renovação.** Ela nunca pagou um
centavo, não foi cobrada, e **não há nada a estornar**. Trial que terminou em
trial.

Registro com os números de propósito: *"pediu para cancelar e não conseguiu"* é
exatamente o enunciado que, **não conferido**, vira cobrança indevida no próximo
aluno. Aqui o desfecho foi bom — mas ele foi **medido**, não torcido.

---

## 4. Duas armadilhas que eu deixo cravadas

**(a) NÃO zere o `speech_rate_wps` da voz 2.** Alguém vai ver `2,59`, lembrar
que o #293 zerou o da voz 1 (2,44 → NULL) e querer padronizar. **Não é o mesmo
caso:** na voz 1 a **referência mudou** (take 002), então a medição velha passou
a brigar com o material novo — por isso foi zerada. Na voz 2 a referência **não
foi trocada**, então 2,59 foi medido sobre exatamente o material que a voz usa.
Está coerente. Zerar número coerente não é limpeza, é perder a régua.

**(b) A classe não morre com este cartão, e eu não finjo que morre.** A escolha
do trecho de referência continua pegando **por padrão o MAIOR arquivo bruto, sem
olhar ritmo** — e quem cansou ao longo da gravação costuma ter o maior entre os
mais lentos. Conferi hoje no código: `fabricar_referencia.cjs` segue com *"sem a
flag, segue usando o MAIOR arquivo"*; o `--arquivo` entrou como escolha do
operador, o padrão ficou. **Isso não é descuido:** automatizar exige timestamps
de palavra, e heurística por energia foi **reprovada duas vezes** (ordem de
20/08). Não abri cartão novo porque a perna de produção já tem dono aberto:
**#367** (`reference.py`) e **#393**.

---

## 5. O que eu NÃO fiz

- **Não apaguei o recado `para_frank_4ab7e04d`**, apesar de ele estar
  comprovadamente cumprido desde 06/09 (era "responder a aluna por e-mail", e o
  e-mail saiu no uid 1169). Não existe ferramenta vetada pra mexer em
  `agent_state`, e escrita solta nesse campo foi exatamente o que destruiu 21
  notas em 21/08. **Fica como item próprio: os 101 recados precisam de uma
  ferramenta com `--confirmar`, não de edição na mão.**
- Não escrevi para a aluna: a última pergunta dela foi respondida em 07/09 e ela
  saiu por decisão própria em 08/09. Escrever para quem cancelou e encerrou é
  ruído, não atendimento (defeito `3565a46b`).
- Não apliquei referência, não retreinei voz, **não gastei GPU**, não gerei
  áudio. Não mexi em crédito, acesso, plano, entitlement nem assinatura.
- Não abri PR, não apliquei migration. **Esta ronda não tem commit de código,
  só este registro.**
- Não toquei nos #249/#250 além de conferir o bloqueio, nem em nada da planilha
  (ordem de 29/08).

---

## 6. O que segue represado, e não é meu

**#249 e #250** — Glauber e Anderson, os dois pagantes de SGP cujo e-mail está
morto. O aval de WhatsApp foi pedido em **13/09** e hoje são **3 dias**. Não
repito o pedido a cada ronda (vira ruído no canal), mas ele continua de pé e os
dois seguem sem receber nada.

## 7. Lição

**Cartão trabalhado não é cartão fechado.** O #289 teve diagnóstico correto,
medição honesta, dois PRs mergeados e a aluna atendida — e mesmo assim passou
9 dias como `investigating`, inflando a fila e escondendo, atrás do próprio
silêncio, um pedido de cancelamento que ninguém tinha lido. O trabalho estava
feito; o que faltava era **escrever o desfecho e ir conferir se o aluno ficou
bem depois**. Fechar é parte do conserto, não burocracia.
