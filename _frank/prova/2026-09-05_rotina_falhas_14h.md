# Ronda das falhas — 05/09/2026 ~14:41–15:00Z (Frank, dono da fila)

Fila no início: **28 não-fechados** (15 investigating + 13 aguardando aluno) e 3
presos na varredura. Peguei os itens pela regra 8 (serial, o mais antigo com
aluno afetado onde a bola era NOSSA).

**Não fechei nenhum incidente, e abri um.** O backlog subiu de 28 para 29. O
motivo está caso a caso abaixo. Escrevi para **2 alunos** e o achado do dia é um
defeito de dinheiro que estava invisível.

---

## 0. Por que não peguei o `#15`, que é o mais antigo

O `#15` (`d3d8d1b2`, 37d, 18 alunos) continua sendo o mais antigo com aluno
afetado, e continua **bloqueado no mesmo ponto de ontem**: a migration 82 não foi
aplicada. Conferi hoje pelo banco, não pelo git — `information_schema.columns`
para `generations.delay_seconds` e `generations.execution_seconds` volta
**vazio**. Sem as colunas o incidente segue cego e não há o que medir.

Passo que falta: **aval do Johnny para aplicar a migration 82.** Não é trabalho
parado por minha falta de tempo.

O `#47` (Katia) também não era meu: a bola está com ela desde 11h32Z de hoje.

---

## 1. `#99` Luciano — o relógio que ninguém tinha olhado

Era o mais antigo com a bola do nosso lado. Última palavra dele: **28/08**.
Último e-mail nosso: **31/08 11h43Z**. Cinco dias de silêncio nosso.

Primeiro conferi se já tinha se resolvido sozinho (é o caso mais comum): não.
Nenhuma geração desde 28/08, nada novo na caixa dele.

**O que eu medi, e ninguém tinha medido: a linha do tempo do dinheiro**, lida do
payload cru da Hotmart, não do resumo.

| quando | trx | rec | valor | garantia |
|---|---|---|---|---|
| 19/08 | HP1152886059 | 1 | **R$ 0** (trial de 7 dias) | 26/08 |
| 26/08 | HP2024654259 | 2 | **R$ 97** APPROVED | 02/09 |
| 03/09 | HP2024654259 | 2 | `PURCHASE_COMPLETE` | **janela FECHOU** |

E o que ninguém tinha visto: `date_next_charge` = **19/09/2026 12:00Z**, presente
no evento de 26/08 **e** no de 03/09, batendo exatamente com
`entitlements.access_until`. Confirmado na Hotmart **viva** (ensaio do
`cancelar_assinatura.cjs`, sem `--confirmar`): `LGKZLCLN` **ACTIVE**.

**Por que isso importa.** Ele escreveu em 27/08: *"Tenho esperança que até a
próxima cobrança do plano, isso se resolva."* A próxima cobrança é **19/09**, e a
posição do Lucas/Johnny que ele pediu em **24/08** faz **12 dias** que não sai. Se
19/09 chegar sem decisão, repetimos exatamente o 26/08 — aluno cobrado enquanto
esperava resposta nossa, coisa que a própria Fast já reconheceu por escrito como
*"consequência da nossa demora, não de uma escolha sua"*.

**Diferença para o Solon: sobram 14 dias, não 24h.** No Solon só escalamos com o
relógio virando. Este foi escalado com duas semanas.

**Escrevi para ele** (regra 8, e-mail individual, decido sozinho): uid **1075** na
Enviados, cópia CONFIRMADA. Ensaiado em `--dry-run` e lido inteiro antes de sair;
endereço conferido contra `profiles` (3 parecidos, **1 match exato** — armadilha
do homônimo). Conteúdo: a garantia fechou em 02/09 (dito sem cobrar nada dele), a
cobrança de 19/09 existe e é de R$ 97, a posição do Lucas/Johnny ainda não saiu
(sem prazo novo, que ele já ouviu "em breve" demais), e **uma pergunta só**:
encerrar antes de 19/09 ou manter. Deixei explícito que encerrar **não** devolve
por si só os R$ 97 e que o estorno é decisão do Johnny/Lucas.

`aguardando_aluno`, e desta vez o rótulo é honesto: existe pergunta nossa em
aberto, feita hoje, com data. **Não é `fixed`** — nada foi consertado no código;
o que estava do nosso lado era o aviso da data, e ele saiu.

Nota gravada (37 notas). Não cancelei assinatura, não estornei, não mexi em
crédito. Os 630 cr do clipe de 28/08 seguem estornados desde 29/08 01h55
(`ref_type='video_clone_refund'`, casado por **ref_id**, nunca por `kind`).

---

## 2. Marcelo — cobrado hoje, 30 min antes desta ronda começar

Estava na varredura como preso: acesso vivo, 298.950 créditos, **sem voz desde
10/08** (26 dias). Fui olhar esperando encontrar abandono nosso e encontrei o
contrário: as rondas de 24/08, 27/08 e 29/08 trataram o caso bem. A causa está
confirmada **de ouvido**, não por detector: o arquivo de 47min é uma entrevista
com duas pessoas, e o treino não separa vozes. A bola é dele desde 29/08.

`pagou_de_verdade`: **PAGOU** — R$ 368,64 (Fábrica de Conteúdo) + R$ 97 em 12/08 +
**R$ 97 hoje, 05/09 14h17Z** (`HP0618766977`, recurrence 3, APPROVED).

**O problema que eu achei é o nosso e-mail de 29/08.** Ele dizia *"o seu acesso
atual vai até 5 de setembro"*. Dava a data como um **fim de acesso** e não avisava
que naquela data o plano **renova e cobra**. Hoje renovou e cobrou. Nenhuma frase
ali era falsa; a omissão é que criou urgência errada e escondeu uma cobrança.

**Escrevi para ele**: uid **1076**, cópia CONFIRMADA, `--dry-run` antes, endereço
único em `profiles`. Corrigi a minha própria frase de 29/08, informei a cobrança
de hoje, e dei o prazo que importa: a garantia desta cobrança é **12/09 00h00**,
ou seja **último dia útil 11/09** — com 6 dias de folga, de propósito, para não
repetir o Luciano, cuja janela fechou enquanto ele esperava. Uma pergunta só:
seguir ou sair. Disse que se ele não responder **eu não faço nada por conta
própria**.

---

## 3. O achado do dia: `#265` — a janela de garantia que a Fast obedece está errada

Saiu do caso do Marcelo, não de leitura de código. Fui ver o que a Fast enxerga da
conta dele e caí em `frontend/src/lib/agent/account.ts:153-192`,
`linhaGarantiaHotmart()` — a função que monta a linha que o próprio texto manda
obedecer: *"calculado pelo sistema — obedeça esta linha"*.

**Dois defeitos, os dois medidos hoje:**

**(1) Âncora errada** (`account.ts:171-178`). Usa `min(approved_date)` das compras
pagas — a **primeira** mensalidade. O comentário de `:139` diz que é conservador
de propósito, *"a janela fecha antes → nunca promete reembolso a mais"*. Em
assinatura isso **inverte o sinal**: a Hotmart emite `warranty_date` novo a cada
recorrência e o código nunca enxerga.

> **523** alunos com compra paga · **150** dentro de uma janela válida pela
> Hotmart · **57** deles o código diz **FORA** e a Hotmart diz **DENTRO**.

O Marcelo é um: primeira paga 12/08 (janela do código fecha 19/08), mas a cobrança
de hoje tem `warranty_date` **12/09**. O sistema afirma que a janela dele fechou há
17 dias, quando ele tem até 11/09. O comentário de `:187` (*"Renovação mensal NÃO
reabre a garantia"*) é a premissa errada, e o payload da própria Hotmart contradiz.

**(2) A constante também está errada** (`account.ts:116`, `GARANTIA_DIAS = 7`). O
payload já traz `product.warranty_date` **pronto** e o código ignora e recalcula.
Distribuição real de `warranty_date − approved_date` nas compras pagas:

| dias | compras |
|---|---|
| **6** | **642** |
| 14 | 24 |
| 7 | 17 |
| 15 | 3 |
| 30 | 1 |

O 7 fixo erra em **686 de 687**. No caso dominante erra **para mais** (o
`warranty_date` cai 00h00, então de uma aprovação à tarde sobram ~6,5 dias e o
código promete 7) — e **esse erro de 1 dia já nos mordeu na mão**: foi ele que
obrigou o e-mail de correção ao Luciano em 31/08. Nos 28 casos de oferta de
14/15/30 dias erra **para menos** e nega janela que existe.

**O que eu NÃO afirmo:** o ramo FORA manda *"escale pro humano"*, então a Fast
**escala, não nega** na cara do aluno. O dano não é recusa automática. É que o
humano recebe um número errado com selo de "calculado pelo sistema", e que a Fast
nunca vai avisar sozinha *"você tem até DD/MM"* porque acredita que a janela
fechou. **Não medi nenhum aluno que tenha perdido reembolso por causa disso** —
medi a população exposta: 57 hoje.

**Conserto proposto, e por que não subi PR:** parar de recalcular e **ler** o
`warranty_date` da compra paga **mais recente**, mantendo as três proteções boas
que já existem (só `price.value > 0`; erro de banco devolve ESCALAR e nunca
silêncio; a conta vem pronta do servidor porque modelo não faz aritmética de prazo
com dinheiro — `#198`). Não escrevi o PR **de propósito**: é código de dinheiro,
já existem **20 PRs parados** esperando aval (levantado pelo Vigia às 14hZ, 5 deles
fechando chamado aberto agora), e um 21º feito com pressa em cima da regra de
reembolso é exatamente onde não se corre. Fica **medido e especificado**, e
**não** marcado como resolvido.

Mesma família do `#260`: lá o `account.ts:217` injetava transação sem
`ref_type`/`ref_id` e a Fast afirmou estorno que não existiu. Aqui é o inverso —
o contexto afirma com autoridade um número errado. Nos dois casos a Fast só pode
ser tão honesta quanto o contexto que a gente entrega.

---

## 4. Correção de fato ao §1 da ronda do Vigia das 14hZ

O Vigia escreveu que *"não existe um único incidente com `status='open'`
persistido, o insert vira `investigating`"*. **Insert por SQL direto mantém
`open`** — o `#265` que eu abri às 14h52Z está `open` e continuou `open` na
releitura. A conversão acontece no caminho da aplicação (`escalate.ts`), não no
banco.

Isso **não derruba a objeção dele**, que segue de pé e correta: o filtro por lista
positiva do texto do cron continua cego aos `aguardando_aluno`. Só corrige o
diagnóstico, para ninguém procurar um trigger que não existe.

---

## 5. O que continua aberto (sem maquiagem)

- **Luciano:** cobrança de **19/09**, R$ 97. Posição do Lucas pedida em 24/08, 12
  dias. Estorno dos R$ 97 de 26/08 agora só sai **manual** (garantia fechou).
- **Marcelo:** prazo de garantia até **11/09**. Bola com ele.
- **`#265`:** 57 alunos com a janela errada. **Não consertado**, sem PR.
- **Migration 82:** `#15` cego até o aval do Johnny.
- **20 PRs parados**, 5 fechando chamado aberto (levantamento do Vigia, 14hZ).
- **`victor@lucasarrial.com`** com papel de suporte e caixa inexistente.
- **Estorno do `#254`**, **Diego (08/09)**, **Alana (07/09)**, **Vinícius**,
  **Jackson**: todos sem mandato ou sem decisão.

## 6. O que eu NÃO fiz

Não fechei incidente, não reabri, não mexi em crédito, não estornei, **não
cancelei assinatura**, não gastei GPU, **não apliquei migration**, não mergeei PR,
não escrevi código, não alarguei régua nenhuma e não toquei em nada da planilha
(ordem de 29/08).

## 7. Próxima ronda começa por aqui

1. **Marcelo** — se ele pedir para sair, o prazo é **11/09**; não deixar fechar
   como fechou o do Luciano.
2. **Luciano** — se respondeu, é o desfecho do `#99`. Se não, escrever de novo
   **perto de 19/09**, como eu prometi a ele por escrito.
3. **`#265`** — se o Johnny liberar, o conserto é pequeno e está especificado.
4. **Migration 82** — se houve aval, aplicar e **conferir a coluna no banco**, não
   o DDL no git.

## Registro

`git checkout main && git pull --ff-only origin main` limpo no início. Estorno em
dia (10 tipos, 2.788 linhas, nenhum tipo desconhecido) — conferido por
`ref_type`, nunca por `kind`. Leitura da caixa com `EXAMINE` + `BODY.PEEK`; fila
de não-lidos da Fast conferida em **0**, intacta. Os dois e-mails com cópia
confirmada na Enviados (uid 1075 e 1076). Log commitado na **main**. Relatório no
**GRUPO** (ordem de canal de 31/08), nunca no privado.
