# Ronda das falhas — 21/09 ~02hZ (20/09 22h40–23h05 BRT)

Ronda curta, no fim da janela do turno (08h–23h BRT). O relatório noturno de
20/09 já tinha fechado às 01h15Z — esta ronda é posterior a ele e **não**
refaz o consolidado do dia.

**Fechei 0 incidente nesta ronda.** Digo isso primeiro pra não ficar escondido
no meio do texto. O que fiz foi medir, despachar o que estava parado e derrubar
um número herdado. Detalhe de cada coisa abaixo.

---

## 1. Passo fixo — reconciliação dos envios

Rodado conforme o índice de ordens (passo fixo desde 18/09):

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

| | |
|---|---|
| lidas da pasta `Sent` | 892 |
| registro local (#210) | 0 — arquivo não existe nesta máquina (é gitignored) |
| já tinham linha | 815 |
| fora da janela (`--corte`) | 77 |
| **RECUSADAS (defeito)** | **0** |
| **dentro da janela, escrituráveis** | **0** |

Fecha: 892 = 892, nenhuma carta sumiu na classificação. **Nada a gravar.**

Conferido com o instrumento independente
(`2026-09-18_enviados_x_tabela.cjs`): casadas por Message-ID 815, por
destinatário+janela 4, **0 carta da pasta sem linha depois do corte**. Veredito
dele: *o buraco é PASSIVO*.

⚠️ As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão — é o que o
`--corte` exclui de propósito. Continua sendo decisão de produção (exige mexer
no `cobreDesde` do `contato-tentativas.ts`), não de ronda. Inalterado desde
18/09.

---

## 2. Fila de percepção (ordem de 17/09)

`percepcao_travada.cjs`, controle positivo OK (#310 reencontrado), 488
incidentes varridos.

**Travados só por falta de ver/ouvir/assistir: 2** — e os dois já estão
despachados, não parados:

- **#450** (2,5d de nota parada) — **falso positivo**: a própria nota diz que
  não é caso de percepção; o instrumento casou pelo texto.
- **#234** (18,4d de vida, nota parada há 0,1d) — já despachado e com laudo
  escrito na ronda de 20/09 ~23hZ.

Mantenho a observação de 20/09: o **SQL literal da ordem de 17/09 conta 18**,
porque casa qualquer nota que *mencione* ver/ouvir/assistir. O instrumento da
casa conta quem **só para** por isso, e dá 2. **A ordem de 17/09 ainda precisa
da correção de texto** apontando pro instrumento em vez do regex — segue
pendente, é a segunda ronda que registro isso.

---

## 3. Estado da fila

| | agora (21/09 02hZ) | relatório de 20/09 |
|---|---|---|
| incidentes abertos | 93 | 93 |
| …com 7 dias ou mais | 39 | 39 |
| recados `tell_frank` | 129 | 129 |
| patch do Vigia esperando | 1 | 1 |
| travados em percepção | 2 (ambos despachados) | 2 |

Sem movimento desde o fechamento do relatório — esperado, já que ele fechou 25
min antes desta ronda começar.

---

## 4. O alvo serial: #226 — e o número que a instrumentação revelou

Pela regra 8 peguei o mais antigo com aluno afetado que dava pra levar adiante.
O mais velho de todos é o **#15**, tratado na seção 5.

**#226** (`702cc916`, nasceu 01/09, 20 dias) — *"entregamos áudio que o nosso
próprio QA reprovou"*: `tts_qa/loop.py` esgota as tentativas, loga
`inference.qa.exhausted`, dá `break` e **entrega mesmo assim**, cobrando
crédito. Medido em 01/09: 290 de 659 gerações (44%), 132 de 180 alunos.

O plano de 01/09 tinha duas metades. Fui conferir cada uma **no banco, não no
código**:

**(1) persistir o `qa.exhausted` — não dependia de decisão. SUBIU E FUNCIONA.**

- coluna `generations.qa` existe **e está populada** (DDL aplicado, não só
  commitado);
- `runpod-worker/tts_qa/loop.py:562-584` grava `exhausted`,
  `exhausted_score_max` e `exhausted_scores` — o comentário no próprio fonte
  cita o #226.

**O que ela mostra (7 dias, até 21/09 00:45Z):**

| | |
|---|---|
| gerações no período | 506 |
| com `qa` preenchido | 366 |
| com a chave `exhausted` | 360 |
| **com `exhausted > 0`** | **180 — 35,6%** |
| **alunos distintos atingidos** | **79** |
| média de chunks reprovados / geração | 1,88 |
| pior score | 268 |

**Leitura honesta: a parte (1) não consertou nada — ela tornou o defeito
visível, que era exatamente o propósito dela.** O defeito segue vivo e na mesma
ordem de grandeza de 01/09 (44% de 659 → 35,6% de 506). E não é cauda de
problema antigo: são **79 alunos por semana** recebendo áudio que o nosso
próprio QA reprovou, sem aviso nenhum.

**(2) cobrar/estornar — continua com o Johnny, e é por isso que o cartão fica
aberto.** O que falta não é investigação, é **decisão de produto**: falhar o job
sem cobrar (derruba ~35% das entregas), entregar avisando, ou manter como está.
Nenhuma das três é chamada minha, e estorno em massa nessa escala passa do teto
de 20.000 cr/caso da regra 9-B. Vai como pergunta pro Johnny — agora **com o
número desta semana**, não com o de 01/09.

**O que eu não fiz:** não abri as 180 gerações pra medir quanto do score 268 é
audível pro aluno, e não cruzei os 79 com quem já reclamou de voz. Fica nomeado
na nota do cartão.

---

## 5. #15 — reaberto há 16 dias cumprindo só metade da ordem

**`d3d8d1b2`**, *"geração de áudio: tempo de execução estourado"*. Estado real,
medido agora:

- `status` = **investigating** (foi **reaberto**);
- `last_seen_at` = **2026-09-04 20:47:50Z** → **389h = 16 dias** em silêncio;
- 19 ocorrências · **18 alunos** · nasceu **30/07 = 53 dias**.

A ordem permanente diz: *"está ignored por decisão do Johnny, com aceite de
risco — **se VOLTAR, reabra e instrumente** o handler pra logar em QUAL fase o
chunk pendura"*.

**Ele voltou em 04/09 e foi reaberto — mas a instrumentação nunca foi
escrita.** Há 16 dias o cartão cumpre a metade barata da ordem (reabrir) e não a
que dá resposta (instrumentar). É por isso que ele está 53 dias sem causa:
ninguém consegue dizer se pendura no download da referência, no whisper do QA ou
na geração.

**Despachei** (card `da59cad1`, dono `coder`), com escopo travado em
observabilidade: logar fase + duração (download da ref / whisper do QA /
inferência / montagem-upload), **sem** tocar em limite de tempo, **sem**
migration, **sem** GPU, os ~315 testes do worker têm que continuar passando,
entrega por PR com base `main`.

**Dito com todas as letras:** não instrumentei eu mesmo nesta ronda e não
reproduzi o estouro. E como não há ocorrência desde 04/09, a instrumentação só
vai provar algo **no próximo estouro** — ela é a condição pra ter causa, não a
causa. Não contar como conserto.

O aceite de risco do Johnny foi dado sobre o cartão **quieto**. Se voltar a
disparar com aluno em cima, deixa de ser risco aceito e vira fila normal.

---

## 6. O que eu errei nesta ronda

1. Escrevi um **typo na nota do #15** (`"do Johnson-- do Johnny"`). Nota se
   concatena e não se reescreve, então fica lá. Não muda nenhum fato, mas
   registro em vez de deixar quem ler depois achar que é nome de alguém.
2. Chutei duas consultas com **coluna que não existe** (`occurrence_count`,
   `kind`) antes de ler o `information_schema`. Custou dois turns. A coluna
   certa é `occurrences`. Fica anotado pra próxima: **ler o schema antes**, não
   depois do 400.

---

## 7. Passo fixo de fim de ronda

Conferência de que nada ficou preso em branch — saída na seção de commit desta
mesma ronda. Código desta ronda: **nenhum** (o único trabalho de código foi
despachado por card, e sai por PR do `coder`). O que vai pra `main` aqui é
**só este registro**.
