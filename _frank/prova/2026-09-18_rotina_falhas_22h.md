# Ronda das falhas — 18/09, ~21h40–22h30Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).
Ronda anterior: `2026-09-18_rotina_falhas_21h.md` — **que eu corrigi nesta ronda**
(ver seção própria). Vigia mais recente: `2026-09-18_vigia_20h.md`.

---

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado ANTES de tocar na fila, com os dois instrumentos independentes.

```
2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  667 lidas da pasta "Sent" = 589 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 1   → INSERT devolveu 1 linha
  ✔ 667 = 667, nenhuma carta sumiu na classificação
  ✔ conferido Message-ID por Message-ID no banco: 1/1 existe de fato
  ✔ nenhuma com data de hoje — o carimbo histórico pegou

2026-09-18_enviados_x_tabela.cjs  (irmão de leitura, instrumento independente)
  casadas por Message-ID: 590 · por destinatário+janela: 4
  VEREDITO: 0 carta depois do corte ficou fora da tabela
```

**A carta órfã que ele pescou não é detalhe — é o fio que puxou a ronda inteira.**
Era a de **21:06:21Z para a Janice**, *"ignore o e-mail anterior: sua voz já está
pronta e devolvemos os 10.000 créditos"*. Saiu de um **worktree descartável**,
exatamente o buraco que o passo fixo existe para compensar: a carta chegou na
aluna e **não entrou em livro nenhum**. Sem este passo, ela teria sumido — e com
ela a única prova escrita de que a casa se retratou.

Crescimento desde as 21h: 656 → **667** na pasta. As **77** anteriores ao corte
seguem **sem decisão**, por desenho do `--corte`.

## A classe de percepção (ordem de 17/09)

`percepcao_travada.cjs`: **1** card, parado há **0,4 dia** (`#450`) — e esse 1 é
o **falso casamento** já declarado pelo próprio Frank na ronda das ~13hZ (o
script casa pelo texto da nota, e a nota é justamente a que diz *"não é caso de
percepção"*). Controle positivo OK (`#310` reencontrado), **459** incidentes
varridos. **Percepção travada real: ZERO.** Sem mudança desde as 19h/20h/21h.

## Números da fila

**Abertos: 91 — 51 técnicos, 40 de atendimento** (`open` + `investigating`,
corte pela coluna `categoria`, que é o critério da casa — não `kind`).

| status | 21h | **esta ronda** |
|---|---|---|
| open | 1 | **1** |
| investigating | 90 | **89** |
| aguardando_aluno | 33 | **34** |
| fixed | 275 | **276** |
| ignored | 59 | 59 |

O `investigating` caiu de 90 → 89 e o `fixed` subiu de 275 → **276** porque eu
**fechei o `#448`**, abaixo. É fechamento de verdade, com as três pernas
(entrega + dinheiro + aluno avisado) conferidas — não é mudança de gaveta.

---

## O log das 21h ficou velho, e isso quase virou o erro da ronda seguinte

**Este é o achado da ronda**, e ele é de processo, não de código.

A ronda das 21h descobriu o próprio erro e o corrigiu **na nota do incidente**,
às **21:08:35Z**. Mas o arquivo `_frank/prova/2026-09-18_rotina_falhas_21h.md`
**foi commitado sem essa correção** e ficou afirmando, com todas as letras, que
*"a voz não existe, nada foi treinado"* e que o caminho era a aluna subir áudio
novo.

**Por que isso é grave:** o log da ronda anterior é a **primeira coisa que a
ronda seguinte lê**. Eu li. Se eu tivesse confiado nele — que é exatamente o que
o método manda fazer — eu teria continuado tratando uma aluna já atendida como
aluna parada, e teria levado adiante uma recomendação de merge cuja justificativa
tinha morrido. **A correção existia e estava invisível**, que é o mesmo modo de
falha do fix preso em branch de 19/08: a coisa certa feita num lugar que ninguém
lê.

**O que refutei, medindo eu mesmo (por `user_id`, não por `voice_id` do pedido):**

```
voices 9e94f1f6-f2fd-4dfa-9b8b-754ca6d7aff7 "Minha Voz Principal"
  user_id a46aa1c7 · status READY · criada 18/09 08:31:32Z
credit_transactions b430533b · -10000 · kind 'training'  · ref_type 'voice'          · 08:32:29Z
credit_transactions dee72271 · +10000 · kind 'extra_purchase' · ref_type 'voice_train_refund' · 21:05:20Z
  sum(amount) where ref_id = 9e94f1f6  →  0, em 2 linhas  ⇒ QUITADO
saldo da aluna: 100.000
```

Repare na armadilha registrada do estorno funcionando na prática: a devolução
gravou `kind='extra_purchase'`. **Quem conferisse por `kind` concluiria que ela
não foi estornada** e poderia pagar em dobro. A conferência correta é por
`ref_type`, e foi assim que eu fiz.

**Ação:** pus um bloco `⛔` no topo do log das 21h apontando para esta seção, no
mesmo padrão que o `ordens/README.md` usa para ordem superada. O arquivo continua
lá inteiro — o modo de errar importa e não se apaga —, mas ninguém mais o lê sem
ver que a premissa caiu.

## O incidente que peguei: `#448` (`3b148810`) — Janice · **FECHADO**

Peguei este e não o mais velho por data porque é a **cauda do caso que a ronda
anterior estava carregando**: método serial manda levar um caso até o fim antes
de pegar outro, e o fim deste estava a um passo.

`#448` não é cartão de conserto. É o cartão de *"alguém da casa precisa
responder esta aluna"* — nota da `carol` de 17/09: *"FICA ABERTO até alguém
responder o aluno (decisão do Johnny, 29/08, #153)"*. **Enquanto ele fica
aberto, a Fast fica travada para ela.**

A condição foi cumprida, e é verificável nos dois lados:

| quando | uid | assunto |
|---|---|---|
| 18/09 20:53:15Z | 2825 | "o caminho pra subir o seu áudio novo (sem pagar nada)" — **nasceu velha** |
| 18/09 21:06:21Z | 2830 | "ignore o e-mail anterior: sua voz já está pronta e devolvemos os 10.000" — **a que vale** |

Ambas com cópia confirmada na pasta de enviados **e** linha em
`emails_enviados`. Entrega técnica completa, dinheiro quitado, aluna avisada e
a casa se retratou nominalmente. **Fechei como `fixed`**, com a nota e a
`resolution_note` dizendo o que era e o que foi feito.

**O `#444` NÃO fechei**, de propósito: é o cartão da **entrega**, e falta a única
coisa que eu não posso fazer — **ouvir a voz e dizer se ficou boa**. Isso foi
pedido a ela na carta. Fechar os dois juntos seria mentir sobre o `#444`; deixar
os dois abertos seria manter a Fast travada para uma aluna já respondida duas
vezes. Regra 14 inteira: `fixed` só onde resolvi.

---

## ⚠️ PARA O JOHNNY DECIDIR: 27 alunos do SGP pagaram 10.000 pelo próprio clone

Isto apareceu na nota das 21h08Z e **não estava em log nenhum na main**, ou seja,
tinha grande chance de nunca chegar até você. **Eu não repeti o número: medi de
novo, sozinho, antes de trazer.**

```sql
sgp_pedidos sp JOIN credit_transactions ct
  ON ct.ref_id = sp.voice_id::text AND ct.kind = 'training' AND ct.amount < 0
```

| medida | valor |
|---|---|
| pedidos do SGP com a **própria voz do pedido** cobrada | **27** |
| alunos distintos | **27** |
| créditos | **270.000** |
| vieram do caminho da casa (`note` com `onboarding`) | **27 de 27** — nenhum foi o aluno clicando |
| já estornados | **0** |
| janela | 29/08 23:17Z → 10/09 02:56Z |

Em bom português: **em 27 casos a casa disparou o treino do clone do SGP e
cobrou 10.000 do aluno por isso.** Se o SGP já inclui a montagem do clone, esses
27 pagaram duas vezes.

**NÃO estornei, e não vou**, por dois motivos que a própria regra dá: (a) são
**270.000**, muito acima do teto diário de 100.000 da 9-B, e a 9-B diz que
quando o volume é esse a resposta certa é **parar e chamar**; (b) decidir se o
SGP inclui o treino é **preço**, e preço é seu (06). A Janice **não** está entre
os 27 — a cobrança dela veio do botão, numa voz que não é a do pedido, e o caso
dela está quitado independente desta decisão.

## Decisões que continuam com o Johnny (herdadas, sem resposta)

1. **Janela para mergear os PRs do worker — três:** `#338` (mitigação de
   entrada), `#342` (despejo dos acumuladores, causa do `#32`) e `#343`
   (recuperação de senha pelo SMTP da casa, classe do `#438`). Merge recicla o
   endpoint de GPU: alguns minutos sem capacidade com aluno treinando ao vivo.
   Alternativa que o próprio `#338` recomenda: push na `dev`, que aponta o
   endpoint isolado `fast_cloner_TESTE_dev` (`workersMax` 0). **Pedida desde as
   18h, sem resposta.** Enquanto não abre, **nenhum dos três está em produção.**
2. **Walsicleia** (`#1a37605a`, `#430`) — pagante, R$ 936,15, **14,2 dias**,
   `last_sign_in_at` ainda **NULL**. Três links de acesso já morreram sem
   ninguém do outro lado. Não gerei um quarto: link novo só vence de novo às
   escondidas. O que encerra isto é **uma pessoa chamar ela no WhatsApp**.
3. **`feat/reabrir-audio-sgp`** — o merge continua **defensável pelo mérito
   próprio** (a ferramenta limpa `enviado_em`, que é a trava contra o "some em
   silêncio"), mas **a justificativa "por causa da Janice" morreu**: não há
   etapa de áudio a reabrir para ela. Quem decidir, decida pelo mérito.

---

## O que eu NÃO fiz

- **Não mexi em crédito de ninguém.** O estorno de 21:05Z é da ronda anterior;
  eu apenas **conferi** que existe e que quita (por `ref_type`, não por `kind`).
- **Não estornei os 270.000** dos 27 alunos — acima do teto da 9-B e é decisão
  de preço.
- **Não ouvi a voz da Janice** e não opino sobre como ela soou.
- **Não rodei a ferramenta do branch `feat/reabrir-audio-sgp`**, que segue não
  mergeada e não revisada.
- **Não apaguei nem reescrevi o log das 21h** — pus o aviso no topo e deixei o
  erro visível.
- **Não li o diff dos PRs #338/#342/#343.**
- **Não li a caixa do suporte@ para triagem** (a Fast marca como lido) — a fonte
  foi a fila de incidents e a pasta de enviados.
- **Não sei** quem apagou a voz `4703d0b0`, nem por que os outros 77 pedidos com
  voz não foram cobrados. O **27** é o que está medido; o resto é pergunta em
  aberto e fica escrita como pergunta.
