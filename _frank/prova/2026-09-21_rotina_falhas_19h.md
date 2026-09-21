# Ronda serial 21/09 ~19hZ — FastCloner

Serial (regra 8). Cartão do Mission Board: `41d1caa1`.

**Resumo em uma linha:** o item serial (`#216`, 20,3 dias) não era o que o
cartão dizia — a percepção já estava cumprida havia dias, e o que estava
realmente aberto era **um pedido de cancelamento de aluna pagante com 13 dias
de silêncio**, que ninguém tinha pego porque o cartão vivia fora da contagem.
Aluna respondida. E a medição do dia: **19 pedidos de cancelamento/devolução
estão parados esperando mão humana no painel da Hotmart, o mais velho há 14
dias** — o `#207` de ontem não era um caso, era um sintoma.

---

## 1. Passos fixos

### 1.1 Reconciliação de envios — fecha, dois instrumentos concordando

`2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar`:

| | |
|---|---|
| lidas da pasta "Sent" | 952 |
| já tinham linha | 875 |
| fora da janela (`--corte`) | 77 |
| recusadas | 0 |
| **dentro da janela sem linha** | **0** |

Contagem fecha (952 = 952). O irmão de leitura independente
(`2026-09-18_enviados_x_tabela.cjs`) dá o mesmo veredito: **0 carta depois do
corte** fora da tabela. As 77 pré-tabela seguem sem decisão.

*(942 → 952 desde a ronda das 18h; as 10 novas já nasceram com linha, inclusive
a minha desta ronda.)*

### 1.2 Percepção — o conserto subiu, e o número seguinte também mentia

**Os dois PRs do detector estavam EMPILHADOS, não concorrentes.** Conferido
antes de encostar neles: `git rev-list B..A` saiu **vazio**, ou seja o
`feat/percepcao-aguardando-aluno` **contém** o `feat/percepcao-travada-ultima-nota`.
Não era a família de branch STALE que já derrubou fix em produção 5 vezes nesta
casa — o `coder` rebaseou como a ronda das 18h mandou. Isso fecha o item 5 dos
nomeados de ontem.

Mergeados na ordem da pilha: **PR #390** (`fb6a8c39`) e **PR #392**
(`8217f536`). Antes de mergear: 16/16 testes do
`percepcao_travada.test.cjs` passando localmente, e rodei a versão do PR contra
o banco **de produção** com o controle positivo (#310) intacto. Depois do
merge, reconferido na `origin/main`: `STATUS_VARRIDOS` na linha 95 inclui
`aguardando_aluno`.

Efeito medido, antes → depois: **18 → 5**.

🔴 **Mas os 5 que sobraram são TODOS falso positivo, então a classe real hoje é
ZERO.** Conferi um por um, lendo a última nota de cada, em vez de aceitar o
número:

| cartão | por que casou | o que a nota realmente diz |
|---|---|---|
| `#450` | `[precisa olhar]` | *"NAO e caso de percepcao"* |
| `#406` | `[olho humano]` | *"OLHEI AS IMAGENS, UMA POR UMA. NAO HA DEFEITO"* |
| `#455` | `[nao ouco]` | *"O QUE FOI FEITO === Audio LIBERADO"* |
| `#438` | `[humano olhar]` | relato de perna que saiu do papel |
| `#216` | `[olho humano]` | a minha nota desta ronda, dizendo que já foi cumprida |

O defeito residual tem nome: **o detector casa a NARRATIVA de percepção
cumprida, não só o pedido pendente.** Virou card de código (`1f33c59e`,
`coder`) e não mais uma nota, porque nota sobre instrumento cego já se perdeu
duas vezes nesta mesma família. O card manda partir da main de agora e exige
teste com o texto real das 5 notas, sem derrubar o controle positivo do #310.

**Número honesto pro relatório: 0 cartão travado em percepção.** O 5 é ruído
do instrumento.

### 1.3 Fila

**95 abertos**, **42 com 7+ dias**. Não-lidos do `suporte@`: não consultei a
caixa para triagem (ordem: a fila de incidents é a fonte).

---

## 2. 🔴 A medição do dia: 19 pedidos de dinheiro parados por falta de mão no painel

Peguei isto porque o item serial esbarrou **no mesmo passo** que o `#207` de
ontem esbarrou, e dois casos batendo na mesma parede deixam de ser coincidência.

Medido em `agent_state`, filtrando **só pelo assunto** e só por verbo de ação no
painel (cancelar assinatura / reembolso / estorno em dinheiro), para o número
ser defensável — a regra frouxa dava 107 de 140 e não valia nada:

> **19 pedidos. O mais velho há 14,1 dias.**

Da Lucila (14,1d, R$291) até o Márcio (hoje). Pelo meio: Maria Teresa cobrando
**pela 2ª vez** R$ 2.809,32 prometidos em 11/09; Gregório com **notificação
formal e prazo de CDC**; Rodrigo com garantia vencendo **no próprio dia** do
alerta; Teresa que **confirmou por escrito** o reembolso total.

**Valor só nos assuntos que nomeiam valor: R$ 3.488,32 + € 188.** Os outros 13
não dizem quantia — o total real é maior e eu não o afirmo.

**Nenhum deles é bug.** Todos já foram diagnosticados. O passo que falta é
sempre o mesmo, e não é meu: **alguém com o painel da Hotmart executar.** Eu
tenho a Hotmart só por GET.

Escalado ao grupo com a pergunta que resolve a classe inteira em vez de caso a
caso: **quem executa no painel, e a partir de quando.** Enquanto não houver essa
mão, a fila cresce e cada dia vira mais promessa quebrada.

Junto foram os dois relógios: **Carlos** (`caplastica@hotmail.com`, 2 pernas
renovam **22/09 12:00Z**, R$291, segue sem o "pode") e **Márcio** (21º dia).

---

## 3. O item serial: `#216` (Fabiana, `fabianabedin2016@gmail.com`) — 20,3 dias

Peguei por ser o mais antigo com aluno afetado **que estava acionável** (o
`#207`, mais velho, foi tratado ontem e o que falta nele é a decisão de
dinheiro, que não é minha).

### 3.1 O cartão não era sobre o que dizia

Ele casou o detector por `[olho humano]`. **É falso positivo: a percepção já
estava cumprida havia dias.** A nota [4] (02/09) já tinha olhado foto e vídeo
(rosto ~10-11% da altura do quadro 480x832) e a nota [7] (vigia, 19/09) já
tinha baixado o render do R2 (`56508a06`, 4.001.902 bytes, ffprobe 480x832 /
45,8s) e despachado ao `olho`: **render íntegro, sem defeito de máquina**.
Ninguém precisava olhar nada de novo.

### 3.2 O que estava realmente aberto, e tinha dono nenhum

As objeções do vigia (notas [5] e [6], de 16/09) já tinham medido o que
importava **e ficaram sem dono há 5 dias**:

- A aluna **voltou em 08/09 20:22:12Z** no chat do app: *"como cancelo
  assinatura? nao tem suporte nao me atendem"*.
- **Zero resposta.** Reconferido hoje por mim na fonte forte (pasta Enviados,
  que sobrevive a checkout): **UMA carta na história inteira**, uid 446 de
  02/09, sobre realismo. Nada depois.
- O pedido de cancelamento dela **nunca teve cartão próprio**. Este `#216`, que
  nasceu sobre realismo do Vídeo Clone, é o único que ela tem.

**13 dias de silêncio sobre um pedido de cancelamento**, com *"não me atendem"*
registrado por escrito.

### 3.3 Dinheiro, remedido hoje (não herdado da nota)

`pagou_de_verdade.cjs`: avulsa **PAGA de R$297** (`HP2922120201`, Fábrica de
Conteúdo Invisível, 26/08) — **ela pagou**, só não pela assinatura. Assinatura
FastCloner rec#1 `0 BRL COMPLETE`; **rec#2 `97 BRL OVERDUE`**, ou seja cobrança
**existe mas não foi paga** (OVERDUE não é pagamento — armadilha já registrada
nesta casa). Logo **não há estorno a fazer hoje**; o risco real é retentativa
futura, e é por isso que o cancelamento importa. `access_until` 30/09.

### 3.4 Aluna respondida — carta enviada, cópia confirmada

Enviada 21/09, **Enviados uid 3121**, chave `cancelamento-216-fabiana`,
registrada em `emails_enviados`. Ensaiada com `--dry-run` antes.

A carta assume os 13 dias sem desculpa; explica que **o chat do app é robô e
resposta humana só sai por e-mail** (ninguém nunca tinha dito isso a ela, e ela
passou 13 dias falando com uma parede achando que era descaso); diz que a
cobrança de R$97 consta **não paga** e pede que ela confira o extrato e avise se
houver débito; separa a compra de R$297, que continua dela; e resume o achado do
realismo (do peito pra cima o rosto fica 3-4x maior no quadro), com oferta de
conferir a próxima foto **antes** de ela gastar crédito.

**Não prometi data de cancelamento e não afirmei que está cancelado.** Prometi
**uma** coisa: escrever de novo confirmando quando estiver feito. **Essa
promessa é dívida da casa** — quem pegar o cartão honra.

### 3.5 Status mudado de propósito

`aguardando_aluno` → **`investigating`**. O que falta **não depende dela**:
depende da casa executar o cancelamento no painel. Em `aguardando_aluno` o
cartão fica **fora da contagem de abertos**
(`admin/falhas/page.tsx:81`) e some do placar — foi exatamente assim que ele
ficou 20 dias parado. Nota gravada e **conferida na releitura: 1 linha afetada,
7 → 8 notas**, no cartão certo (resolvido por id, não por número — o
`anotar_incidente` tem bug conhecido de gravar no cartão errado e imprimir
sucesso).

---

## 4. O que eu NÃO afirmo

- **Não afirmo que a Fabiana não foi cobrada.** O `OVERDUE` diz que a cobrança
  não foi paga **no nosso registro**; eu não enxergo a fatura do cartão dela. Por
  isso a carta **pede a ela** que confira e avise, em vez de eu concluir por ela.
- **Não afirmo o total da fila do painel.** 13 dos 19 assuntos não nomeiam
  valor. O R$ 3.488,32 + € 188 é **piso**, não total.
- **Não afirmo que os 19 são todos legítimos** caso a caso. Afirmo que os 19
  pedem a mesma ação e que **ninguém os está executando**.
- **Não li o corpo da carta uid 3112** (a que teria prometido o reembolso ao
  Márcio às 17:55Z). O `dump_mime_cru.cjs` procura na INBOX e não achou o uid,
  que está em Enviados. Tenho assunto e data, não o texto. **Não repito a
  promessa como se a tivesse lido.**
- **Não afirmo que a Fabiana vai responder.**

## 5. O que eu NÃO fiz

Não cancelei assinatura. Não estornei. Não mexi em crédito, carteira, acesso
nem plano. Não liguei nem mandei WhatsApp. Não gastei GPU, não apliquei
migration. **Não li a planilha** (ordem de 29/08). Hotmart só por GET.
**Escrevi para UMA aluna** (Fabiana, §3.4) — nenhuma outra. Não mandei 11ª
carta ao Carlos (canal esgotado, medido ontem). Não mergeei nenhum dos branches
STALE conhecidos.

## 6. Fica nomeado para a próxima ronda

1. 🔴 **Quem executa no painel** (§2) — é a pergunta que destrava 19 casos de
   uma vez. Sem ela, os itens 2, 3 e 4 abaixo não andam.
2. 🔴 **Carlos** (`caplastica@hotmail.com`) — renova **22/09 12:00Z**. Se o
   "pode" chegou, cancelar a órfã pelo 9-C; se passou, a 3ª R$97 caiu e vira
   devolução.
3. 🔴 **Márcio `#207`** — a casa **deve** a ele uma resposta sim-ou-não com
   motivo sobre os R$97. Promessa escrita.
4. 🔴 **Fabiana `#216`** — a casa **deve** a ela a confirmação do cancelamento.
   Promessa escrita **minha, desta ronda**.
5. **Conferir o PR do card `1f33c59e`** (falso positivo do detector) e que não
   nasceu branch concorrente.
6. 🔴 **Os 90 do SGP** — segue sem o "pode".
7. **Segunda perna do `#510`**: `ingest` casa por assinatura sem filtro de status.
8. **Ponto cego da Nassara**: quem tem 2+ assinaturas e foi creditado só numa.
9. **`#407`**, **`#226`**, **`#343`/`#324`** — sem retorno humano / falta escolha.
10. **`feat/resumo-diario-grupo-suporte`** — decisão do Lucas de 04/09 nunca subiu.

## 7. Armadilhas registradas nesta ronda

1. **Instrumento consertado continua podendo mentir — só troca a direção.** O
   detector saiu de 18 (mentindo pra baixo, escondendo aluno) para 5 (mentindo
   pra cima, com ruído). **Conferir um por um depois do conserto** é o que
   revelou que a classe real é zero. Merge verde ≠ número confiável.
2. **`payment_events` não tem `status` nem `created_at`.** As colunas reais são
   `id, provider, event_id, event_type, buyer_email, payload, received_at,
   processed_at, error`. Imprimi o erro cru (42703) **duas vezes** em vez de
   aceitar vazio, como manda a armadilha já registrada.
3. **Os alertas `para_frank_*` moram em `agent_state`, não em `incidents`.**
   Consultar `incidents` por essa assinatura devolve **0 linhas em silêncio**, e
   zero aqui parece "não existe" quando na verdade é tabela errada.
4. **Regex frouxa infla classe e destrói o argumento.** "cancel|reembols|cobran"
   no objeto inteiro dava **107 de 140**; restringir ao **assunto** e a verbo de
   ação deu **19** — que é o número que se sustenta. Número inflado é tão
   inútil quanto número cego.
5. **`aguardando_aluno` mente sobre quem deve o próximo passo** (confirmado pela
   2ª ronda seguida, agora com caso próprio). Quando o que falta é a casa agir,
   o rótulo tira o cartão do placar e ele para. O `#216` custou 13 dias assim.

## 8. Passo fixo de fim de ronda

Registro direto na `main`. Código desta ronda: **nenhum meu** — o que subiu para
produção foram os **PRs #390 e #392 do `coder`** (merges `fb6a8c39` e
`8217f536`), conferidos no conteúdo da `origin/main` depois do merge, não no
"card completed".
