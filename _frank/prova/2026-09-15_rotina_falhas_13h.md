# Rotina das falhas — 15/09/2026, 13hZ (10h BRT)

Dono da fila (14-A). Repo em `main`, `pull --ff-only` limpo antes de tocar em
nada. Li `_frank/ordens/README.md`, a ordem de **20/08** (dono da fila), a de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha
desligada). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.** Canal: por ordem de **31/08**, o aviso desta ronda saiu **no
grupo**, e só no grupo.

A ronda anterior foi a das **12h40Z**. Esta é continuação dela.

---

## 1. O serial: por que este item, e não outro

Regra 8 manda pegar **o mais antigo com aluno afetado**. Conferi os seis mais
velhos **hoje**, um a um, em vez de herdar "travado" de relatório:

| card | idade | onde emperra | trava é minha? |
|---|---|---|---|
| `#15` `d3d8d1b2` | 47,0d | classe dormente (0 timeout em 815 gerações); espera ocorrência nova pra instrumentação falar | não |
| `#99` `6c38c99d` | 22,9d | aluno em silêncio há 13d; decisão comercial | não |
| `#101` `b2651a6f` | 22,7d | envio em MASSA precisa do "pode" do Johnny | não |
| `#223` `506b7c3a` | 13,9d | aluna já respondida 13/09; perna de política com o Johnny | não |
| `#226` `702cc916` | 13,8d | parte autorizada em produção (PR #253); decisão de produto | não |
| `#234` `f8587cef` | 12,9d | espera aval de GPU | não |

Todos travados **fora do meu alcance**. Então fui para o card de dinheiro mais
antigo cuja perna ainda é nossa — o **`#254`** (`f1ada07e`, 10,7d, cobrança em
dobro) — e para a pergunta que o **`#390`** deixou escrita e sem resposta.

### Um fio que eu segui e derrubei antes de gastar a ronda nele

As 12h40Z deixaram anotados "2 alunos com acesso vivo, crédito e nenhuma voz
pronta" (`ericb.malzone`, `euneivaprestes`). Fui atrás achando travamento de
treino. **Não é.** As duas vozes estão em `awaiting_training` **com áudio já
enviado** (13 e 7 arquivos) — o estado que espera o **clique do aluno**
(`start-training/route.ts:93`).

Medi o controle antes de concluir: em 21 dias, **396 vozes criadas, 393
`ready`** — só 3 paradas. A taxa normal é ~0,8%, então os dois **são** anomalia
estatística, mas a causa é conhecida e já tem máquina: `lembrarVozesParadas()`
escreve pra quem parou, no dia 3 e no dia 14 (`lembrete-treino.ts`).

**O que eu achei e vale ficar escrito:** a chave `lembretes_treino` **não existe
em `agent_state`** — essa máquina nunca disparou uma vez desde que subiu (merge
`613af0b1`, 06/09 22:44Z). Fui conferir se isso é defeito: **não é.** Nenhuma
voz criada depois do corte de backfill (`SEM_LEMBRETE_ANTES_DE = 06/09`) chegou
aos 3 dias parada — a única que passou disso está em `rejected_too_short`, não
em `awaiting_training`. Ou seja: o silêncio está **correto**, não havia o que
mandar. O Eric completa 3 dias em **16/09 09:59Z** e é o **primeiro teste real**
desse instrumento. Fica dito para a próxima ronda conferir se a carta saiu, em
vez de assumir que sim.

---

## 2. `#390` — a pergunta que o cartão declarou não ter medido está respondida

O `#390` (aberto 14/09) escreve, com todas as letras, o que não sabia:

> *"quantas outras pessoas hoje têm assinatura viva num e-mail silencioso
> enquanto pediram pra sair por outro. Pode ser zero e pode não ser."*

### 2.1 O instrumento

`_frank/ferramentas/saida_por_pessoa.cjs` — **só leitura**. Casa **pessoa** por
CPF **ou** telefone **ou** nome (union-find, mesmo método do
`assinatura_em_dobro.cjs`) **antes** de cruzar com o vocabulário de
pedido-de-saída do `saida_x_assinatura.cjs`.

**Detalhe de instrumento que cegaria metade da varredura**, e que só apareceu
porque fui olhar o payload cru: o webhook de **compra** grava `raw_event.buyer`
(com `document`/`checkout_phone`); o de **cancelamento** grava
`raw_event.subscriber` (`phone:{ddd,cell}`, **sem** documento). Ler só `buyer`
faz **toda assinatura cancelada perder a chave de pessoa** — e é justamente nas
canceladas que mora o controle positivo.

**Controle positivo com `exit 1`:** o grupo da Lucila tem que juntar
`contatoecocannabis@` (que pediu) com `blancolucila539@` (o silencioso). Se não
juntar, aborta em vez de imprimir relatório limpo e vazio. **Passou.**

### 2.2 A resposta: **zero — e é um zero conferido, não cego**

O script acusou **2 linhas**. Conferi as duas antes de reportar nome, e as duas
são **falso positivo, pelo mesmo motivo**:

| pessoa | assinatura viva | pediu por | veredito |
|---|---|---|---|
| Renata Cristina Arielo | `FQD787K5` `rearielo@hotmail.com` (até 17/09) | `arielorenata1@gmail.com` | `#334`/`#336` dizem que ela quer **MANTER** a `rearielo@`. A duplicada `LZKDL23W` está `canceled` desde 10/09 11:49Z. |
| Solon Andrade | `IJA1SHDQ` `lscontabilidade813@` (até 13/10) | `solonandrade03@gmail.com` | `#254` já diz: `lscontabilidade813` = **a conta real** (1 voz `ready`, 2 gerações). A duplicada `POTX6UYJ` está `canceled` desde 05/09. |

**Ninguém está sendo cobrado hoje num endereço silencioso depois de ter pedido
pra sair.** O medo que abriu o cartão não se materializou em mais ninguém além
da Lucila.

### 2.3 🔴 O que isso CORRIGE no plano de cura do próprio cartão

O `#390` propõe como cura *"casar pessoa (CPF/nome) antes de perguntar à
Hotmart"*. Implementei só a parte de **medir**, e ela já mostra que a cura,
**como está escrita, está incompleta e seria perigosa**.

Casar pessoa resolve *"achar a segunda assinatura"*. **Não** resolve *"saber
QUAL das duas o aluno pediu pra cancelar"* — esse dado vive no **texto do
e-mail**, não na chave de identidade. E nos 2 casos medidos hoje a assinatura
que a varredura por pessoa aponta é **precisamente a que o aluno pediu pra
MANTER**.

Em número: ligada num caminho de **ação**, ela teria produzido **2 de 2
cancelamentos na conta ERRADA** — a conta boa da Renata e a do Solon, esta com
a única voz treinada dele dentro. A ronda de 14/09 não fez a cura porque
*"casar no escuro põe cancelamento na conta errada, e isso não tem desfazer"*.
Aquilo era receio justificado; **agora está medido, com 2 nomes e 2 códigos.**

> Casar pessoa é condição **necessária e não suficiente**. O detector por pessoa
> só pode produzir lista **pra humano ler**, com os dois endereços lado a lado e
> a pergunta "qual delas ele pediu?" em aberto. Ligado direto em ação, ele
> **inverte** o defeito: hoje o risco é deixar viva uma assinatura que devia
> morrer (R$ 97); com a cura pela metade o risco passa a ser **matar a que devia
> viver** — pior, e sem desfazer.

---

## 3. `#254` — lista remedida na Hotmart viva

`assinatura_em_dobro.cjs` rodado por mim hoje (regra `value > 0` **E**
`COMPLETE/APPROVED`). **Pagando em dobro agora: 4** — Johnny Oliveira (conta de
teste, R$ 1, excluída pelo método do card), Nássara, Leandro Lopardi, Carlos
Augusto.

**Lucila saiu da lista**, e não sozinha: a ronda de 14/09 ~11h50Z cancelou as
duas assinaturas dela **a pedido escrito dela** (9-C) e avisou por e-mail.
Conferido na fonte: `2Q4Y1CDE` e `6JEANY3Z` ambos `canceled`, `cancellation_date`
da Hotmart às 11:52:36,901Z e 11:52:38,975Z. Acesso e crédito intocados.
**Cancelamento não é devolução:** os **R$ 291** seguem com o Johnny — pedidos por
escrito por ela em **07/09**, hoje são **8 dias**.

**O relógio que sobra:** Carlos Augusto tem as duas assinaturas `active` até
**22/09** — 7 dias pra renovar e cobrar errado de novo. Já foi escrito 2x nos
dois endereços, conferido que **não quicou**. Ele recebeu e não respondeu. Pela
9-C ninguém cancela assinatura de titular sem pedido escrito: **não é falta de
ação minha, é escolha dele.** Registro a data porque em 12/09 a janela do
Leandro venceu exatamente assim, esperando na nossa fila.

---

## 4. Estado da fila no fechamento

- **83 abertos** (eram 81 nas 12h40Z). Por idade: 1 com 30d+, 2 entre 15-30d,
  27 entre 7-15d, 34 entre 3-7d, 19 com menos de 3d.
- **0 patches do Vigia** esperando.
- **87 recados `para_frank_*`**, o mais velho com 11,6 dias. **Não os tratei** —
  eram 86 nas 12h40Z, a dívida cresceu de novo. Já passou de ronda própria:
  precisa de decisão sobre o que fazer com a leva.
- **Fechei nesta ronda: 0.** Onde cada um emperrou está na tabela do item 1. O
  `#390` **não fecha** porque a cura continua por fazer — só que agora com o
  escopo certo; o `#254` **não fecha** porque 4 pessoas seguem em dobro e a
  decisão de devolver é do Johnny.
- **`#410`, aberto hoje 11:55Z por outra ronda** (dedupe subiu sem migrar os
  cartões abertos; 20 de 21 chamados em formato legado ficaram inalcançáveis):
  **vi e não peguei**, para não atropelar quem está nele. Fica registrado que
  ele existe e é recente.

---

## 5. O que esta ronda diz

Cinco rondas seguidas com lição de **instrumento**, e esta fecha o arco de um
jeito novo. Nas anteriores o instrumento **mentia** — número fora de contexto,
campo vazio que parecia explicação, zero cego. Hoje o instrumento **acertou o
alvo que lhe pediram e mesmo assim estaria errado**: ele encontrou exatamente
as pessoas que o `#390` mandou encontrar, e as duas respostas certas eram "não
toque nisso".

A diferença entre "achar a segunda assinatura" e "saber qual delas o aluno quer"
é uma leitura de e-mail que nenhuma chave de identidade substitui. O `#390`
tinha escrito que a cura era casar pessoa. Casar pessoa é metade da cura, e a
metade que falta é a que decide se alguém perde a voz que treinou.

---

**O que eu NÃO fiz:** não fechei incidente, não reabri incidente, não mudei
status de cartão nenhum, não cancelei assinatura, não estornei, não dei crédito,
não dei acesso, não prometi devolução, não escrevi para nenhum aluno (nem Renata
nem Solon precisam de carta: o estado deles já é o que pediram), não li a caixa
de entrada para triagem, não tratei os 87 recados, não mexi nos branches STALE
(`feat/fix-image-upload-retry`, `feat/onedrive-401`,
`fix/referencia-fronteira-de-frase-por-palavra`,
`feat/fabricar-referencia-fronteira-por-palavra`), não subi migration, não rodei
nada que gastasse GPU ou crédito de aluno, e **não li nem reprocessei nada da
planilha** (ordem de 29/08).
