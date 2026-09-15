# Rotina das falhas — 15/09/2026, 16hZ (13h BRT)

Dono da fila (14-A). Repo em `main`, `pull --ff-only` limpo antes de tocar em
nada. Li `_frank/ordens/README.md`, a ordem de **20/08** (dono da fila), a de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha
desligada). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.** Canal: por ordem de **31/08**, o aviso desta ronda saiu **no
grupo**, e só no grupo.

Ronda anterior das falhas: **15hZ**. Abertura **15:40Z**, `now()` medido no
banco em **2026-09-15 15:43:40,595Z**.

**Esta ronda fechou zero incidentes e subiu um PR.** O que ela tem de diferente
das cinco anteriores de hoje está no item 2: eu quase publiquei um número 25×
maior que o real, e o que me segurou foi um aviso que já estava escrito no
próprio arquivo que eu ia consertar.

---

## 1. O serial: por que o `#265`, e o que trava cada um acima dele

Regra 8 manda pegar o mais antigo com aluno afetado. Conferi a cabeça da fila
**um a um hoje**, sem herdar "travado" de relatório — e digo em QUE PASSO cada
um emperra, porque é isso que a regra cobra de quem pula:

| card | idade | onde emperra | é minha? |
|---|---|---|---|
| `#15` `d3d8d1b2` | 47,1 d | linha de env, 22 dias parada | não |
| `#99` `6c38c99d` | 23,0 d | decisão comercial, data 16-17/09 | não |
| `#101` `b2651a6f` | 22,8 d | envio em MASSA sem o "pode" | não |
| `#223` / `#226` / `#234` | 14-13 d | política, produto, aval de GPU | não |
| `#246` `933fd9d6` | 11,6 d | ponta (b) é dinheiro do Johnny | não |
| `#249` `132f7808` | 11,0 d | aval de WhatsApp, pedido de 13/09 | não |
| `#250` `8c29740f` | 10,9 d | idem — e-mail morto, 4 tentativas / 4 bounces | não |
| `#263` `5c68eb33` | 10,1 d | falta só a definição dos R$ 97 | não |
| **`#265`** `71410a81` | **10,0 d** | **perna 2 é CÓDIGO** | **sim** |

Os `#249` e `#250` merecem uma frase, porque é fácil ler "aguarda aval" como
desleixo: nos dois o canal de e-mail está **medido como morto** (o do Anderson
com 4 tentativas e 4 bounces em 10 dias), o telefone já foi achado na Hotmart, e
o que falta é autorização para um canal externo. Não sobra passo meu neles.

O `#265` é o mais velho cuja perna restante é **código** — e código é meu: não
precisa de aval, precisa de PR. A perna 1 (constante de 7 dias) já está em
produção desde `ed0f266`.

## 1-B. A objeção do Vigia como insumo, não como ordem

O Vigia anotou o defeito em 14/09 (10hZ e 12hZ) e **não abriu chamado**, porque
é a mesma porta e a mesma cadeia deste card. Ele fez o papel dele — sensor — e a
decisão de consertar é minha (14-A). A cadeia que ele mapeou está certa e eu a
confirmei no fonte:

- `garantia.ts:60` — `type Janela` **sem campo de produto**
- `garantia.ts:88` — `pagas.reduce(...)` colapsa N produtos em **1**
- `account.ts:189` — `linhaGarantiaHotmart(email)` assina por **e-mail**

A linha que a Fast é mandada **obedecer** numa conversa sobre dinheiro não diz
QUAL produto ela descreve. Ela recebe uma data sem dono e atribui ao produto que
o aluno perguntou. Com 2+ compras isso é **erro garantido, não risco**.

---

## 2. 🔴 O número que eu quase publiquei, e por que ele estava 25× inflado

Medi a classe antes de escrever qualquer linha de código. Primeira medição:

> **237 alunos** têm 2+ janelas distintas. Desses, **76** recebem "FORA" hoje
> tendo `warranty_date` ainda no futuro.

Setenta e seis pessoas sendo mandadas embora com a garantia viva é manchete. Eu
estava a um parágrafo de mandar isso ao grupo como vítima deste bug.

**O que me segurou foi o cabeçalho do próprio `garantia.ts`**, que eu estava
prestes a editar. Ele avisa, desde 05/09, com todas as letras: a função **não
decide se renovação reabre a garantia**, isso é política de dinheiro parada com
o Johnny, e naquela data **54 dos 57** dependiam só dessa decisão. Fui separar:

| | |
|---|---|
| declara FORA com janela futura | **76** |
| └ renovação do **MESMO** produto → **política do Johnny** | **73** |
| └ produto **DIFERENTE** → **este defeito** | **3** |

**O bug são 3. Os outros 73 são a decisão dele**, e cresceram de 54 para 73 em
dez dias — o que é um fato sobre a decisão parada, não sobre o meu conserto.

O conserto **não toca** nessa política, e eu travei isso com um teste: se
`janelasPorProduto` passar a devolver duas linhas para renovação do mesmo
produto, alguém decidiu política de dinheiro dentro de um conserto de
atribuição, e o teste quebra.

### Os 3 reais, com a janela AINDA ABERTA

| aluno | âncora (fechada) | vivo, e negado hoje |
|---|---|---|
| `claudiobeneditod@yahoo.com.br` | SGP, 13/09 | FastCloner até **21/09** |
| `leleodacuca@gmail.com` | SGP, 13/09 | FastCloner até **22/09** |
| `silvaporto@silvaporto.adv.br` | SGP, 14/09 | FastCloner até **21/09** |

Os três têm a mesma forma: a âncora é o Sistema de Geração Pronto, já fechado, e
o que está vivo é o FastCloner. Hoje a Fast diz **FORA** aos três e manda não
prometer reembolso. **Restam ~6 dias.**

---

## 3. A segunda variante — a da Evelyn — que não tinha nome

A Evelyn (`#385`) **não aparece nos 3**, e o motivo importa o bastante pra virar
classe própria: o FastCloner dela é **adesão de R$ 0**, então `garantia.ts:78`
descarta a linha **inteira** — regra **certa**, R$ 0 não tem o que reembolsar — e
sobra a do SGP descrevendo um produto que não é o dela.

Não é "janela errada". É **janela de outro produto se passando pela dela**. Foi
assim que a casa lhe disse *"sua compra foi feita em 07/09 e a garantia vai até
13/09"* sobre um FastCloner comprado em **10/09**: as duas datas eram do outro
produto.

E o dado que resolveria o caso dela estava no mesmo payload, lido por ninguém: o
`date_next_charge` (**17/09 12:00Z**) — que para quem está em adesão trial é a
única data que importa, porque é quando ela passa a pagar. O Vigia tinha varrido
o repo e achado que ele não aparece em nenhum ponto de `garantia.ts` ou
`account.ts`. Confirmei, e agora aparece.

---

## 4. O conserto: **PR #294** (aberto, NÃO é produção)

Branch `feat/265-garantia-com-identidade-de-produto`, commit `7d709ae`.

`janelasPorProduto()` devolve **uma janela por produto**. Com 2+, a Fast recebe
linhas **rotuladas** e a instrução explícita de nunca carregar a data de um ao
falar de outro, e de **perguntar** se não estiver claro de qual produto a pessoa
fala.

**O que NÃO muda, de propósito:**

- **`janelaGarantia()` fica idêntica** — quem tem um produto só não regride, e
  é a maioria da base.
- **Renovação segue colapsada** — política do Johnny, com teste travando.
- **O filtro `price.value > 0` fica.** R$ 0 não tem o que reembolsar, e essa
  regra custou 1.356.554 créditos a 14 pessoas pra ser aprendida em 18/08. O
  produto de R$ 0 passa a **aparecer marcado**, o que é diferente de passar a
  valer.

**Prova:** 16/16 em `account-garantia.test.ts` (6 novos, com o payload real da
Evelyn e a classe dos 3; os 10 antigos **intactos**), **0 falhas** em 24 suites
vizinhas de `lib/agent` e `lib/payments`, `tsc --noEmit` **exit 0**.

E, porque teste com fixture não é produção, rodei a função nova contra os
payloads **vivos** de `payment_events` (jiti, só leitura):

```
=== evelyn.cheida@gmail.com
  ANTES: compra 2026-09-07 · fim 2026-09-14 · FORA
  DEPOIS · Sistema de Geração Pronto: 2026-09-14 · FORA
  DEPOIS · FastCloner: adesão R$0, sem garantia · 1a cobrança 2026-09-17T12:00:00Z
=== claudiobeneditod@yahoo.com.br
  ANTES: compra 2026-09-06 · fim 2026-09-13 · FORA
  DEPOIS · Sistema de Geração Pronto: 2026-09-13 · FORA
  DEPOIS · FastCloner: 2026-09-21 · DENTRO
```

**Não fechei o card.** PR aberto não é produção — **só a `main` deploya**.
Enquanto não mergear, os 3 seguem levando "FORA". O `#265` fecha quando o merge
estiver na main **e** a linha sair certa em produção.

---

## 5. O que foi ao grupo

Marcado **urgente** (pagante travado com prazo correndo), com duas perguntas
fechadas: **(1)** merge do PR #294; **(2)** se escrevo aos 3 antes da janela
fechar. Mandei o **3**, não o 76, e disse no próprio recado que desinflei o
número e por quê — porque instrumento de dinheiro com número inflado afoga a
urgência verdadeira, que é a lição que a ronda das 15hZ já tinha pago com o
`garantia_na_fila.cjs` saltando de 6 para 24.

Não citei e-mail de aluno no grupo (ordem de 20/08: nada que identifique aluno
sem necessidade) — os nomes estão no cartão, que é onde se trabalha.

---

## 6. O que esta ronda diz

As rondas de hoje vinham escrevendo sobre **instrumento que mente** e, na das
15hZ, sobre **nota que envelhece**. Esta é sobre a terceira forma: **o aviso que
estava certo, no lugar certo, e que quase não foi lido.**

O cabeçalho do `garantia.ts` dizia exatamente o que eu precisava saber — que a
maior parte daquele volume é política e não defeito. Estava no arquivo que eu
tinha aberto para editar, dez linhas acima da função. Eu só não passei direto
porque fui reler o contrato da função antes de mexer nela. Se eu tivesse ido
direto ao código, teria publicado "76 alunos sem garantia por um bug nosso",
e 73 daquilo é uma decisão comercial que o Johnny sabe que está parada.

O que salvou não foi esperteza: foi ler o cabeçalho antes de editar o corpo. A
ronda das 15hZ fechou dizendo que texto não é executável e por isso virou guarda
em código. Hoje o texto funcionou — mas funcionou por um fio, e a diferença
entre os dois casos é só se alguém abriu o arquivo pelo topo ou pelo meio.

E o que de fato muda para gente: **3 pessoas que pagaram estão sendo informadas
de que perderam um prazo que elas não perderam**, e o prazo delas fecha em seis
dias. O conserto está escrito, testado e conferido no dado vivo. Ele não vale
nada enquanto estiver em PR.

---

**O que eu NÃO fiz:** não fechei incidente, não reabri incidente, não mudei
status de cartão nenhum, **não mergeei** (PR #294 é aberto; só a main deploya),
não subi migration, não mexi em crédito, acesso, plano nem entitlement, não
estornei, não prometi reembolso a ninguém, **não escrevi para os 3** (a janela
deles ainda está aberta e o passo seguinte é decisão de reembolso, que é 9-C),
**não decidi nada sobre renovação reabrir garantia** (política do Johnny), não
reabri nem mexi no `#385` (14-A), não publiquei o 76 como se fosse vítima de
bug, não toquei nos branches STALE (`feat/fix-image-upload-retry`,
`feat/onedrive-401`, `fix/referencia-fronteira-de-frase-por-palavra`,
`feat/fabricar-referencia-fronteira-por-palavra`), não gastei GPU nem crédito de
aluno, não li a caixa de entrada para triagem, e **não li nem reprocessei nada da
planilha** (ordem de 29/08).
