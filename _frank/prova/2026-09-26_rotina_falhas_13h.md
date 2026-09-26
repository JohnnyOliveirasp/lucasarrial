# Ronda das falhas — 26/09/2026, ~13hZ (rodou 13:40–14:0xZ)

> Conferi a primeira linha dos arquivos vizinhos antes de escolher o nome
> (aviso da ronda das 22h30: os nomes desta pasta não são índice confiável).
> `12h30` é do Vigia, `12h` é a ronda anterior; este é o `13h`.

**Método: serial (regra 8).** Um caso levado até o fim: o **`#432`**, que
**FECHOU** (`investigating` → `fixed`). É o primeiro fechamento do dia.

**Produção tocada:** nenhuma. Zero GPU, zero migration, zero DDL, zero crédito
movido, zero código de produção alterado. As escritas foram: **1 cartão fechado**
(`#432`) e **1 nota** em cartão existente (`#566`, status inalterado). **Nenhuma
carta enviada** — e o motivo está dito abaixo, porque não escrever também é
decisão que precisa de justificativa.

**Ordem de 29/08 respeitada:** nada vindo da planilha foi lido, escrito,
classificado ou reprocessado. **Canal (ordem de 31/08):** o aviso saiu **no
grupo**, nada no privado do Johnny.

---

## ⚠️ O FATO MAIS IMPORTANTE DESTA RONDA: EU NÃO ESTAVA SOZINHO NA FILA

Antes de qualquer trabalho, medi que **outra instância estava escrevendo no
banco enquanto eu começava**. Isto não é suspeita, é medição:

```
13:13:34Z  nota em #597 por `carol`
13:28:18Z  notas em #597 e #596 por `agent` ("EXECUTOR 26/09 13h25Z")
13:37:33Z  nota em #597 por `frank`
13:37:34Z  nota em #594 por `frank`  → "CONSOLIDADO NO c4e3c304", carta uid 3492
13:40:33Z  profiles.updated_at da Graziela (eu abri o terminal 13:40:36Z)
```

E `ps` mostra **dois processos `claude --model claude-opus-5`** vivos desde
12:38Z e 12:40Z, que não são o meu.

**Consequência prática, e foi ela que desenhou esta ronda:** a regra 14-A diz
*um incidente = um dono*. Duas instâncias na mesma fila, sem trava, é como
nascem **carta duplicada pro mesmo aluno** e — muito pior — **estorno em
dobro**. Por isso eu **não encostei em nada do cluster da Graziela**
(`#551`, `#594`, `#596`, `#597`) e escolhi meu caso serial **fora** dele.

### O que a outra instância resolveu (conferido por mim, não herdado)

As duas decisões que a ronda das 12hZ deixou nomeadas pro dono **foram
tomadas** enquanto eu subia:

| o que | estado medido agora |
|---|---|
| os 719 cr do `#594` | **DEVOLVIDOS** às 13:37:00Z — `ref_type='generation_refund'`, `ref_id=399014a3`, +719. Conferido **por `ref_type`, nunca por `kind`** (a armadilha que quase pagou em dobro pra 13 alunos) |
| o acesso da Graziela (`#551`) | `access_until` **2026-09-26 12:00Z → 2026-10-03 12:00Z** |

⚠️ **E aqui vai uma correção que ninguém pediu, mas que muda a leitura:** o
acesso dela **não foi reativado** — foi **esticado**. O `entitlements` segue
`status='canceled'` e o `updated_at` dele continua **congelado em 25/09
12:24:12Z**. Ou seja: aplicaram a alternativa barata e reversível dos 7 dias,
que era exatamente a proposta da ronda das 12hZ. **Isso é trégua, não
solução** — em **03/10 12:00Z o mesmo precipício volta**, com a assinatura
ainda cancelada. Quem ler "resolvido" no `#551` vai ser pego de surpresa de
novo. A decisão de fundo (reativar na Hotmart / reembolso da Comunidade)
**segue do Johnny**.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
1324  lidas da pasta "Sent"      (12hZ: 1322 — +2 no intervalo)
1247    já tinham linha
   0    repetidas · 77 fora da janela (--corte) · 0 recusadas
   0    DENTRO DA JANELA — escrituráveis
✔ 1324 = 1324 · 🕳️ cartas sem linha dentro da janela: 0
```

Irmão de leitura independente (`2026-09-18_enviados_x_tabela.cjs`): o veredito
de 12hZ (**0 carta depois do corte**) segue de pé. Buraco **PASSIVO**.

⚠️ As 77 anteriores a 14/09 14:06:31Z seguem sem decisão — é o `--corte`, não
recusa.

## Passo fixo 2 — percepção travada (ordem de 17/09)

```
controle positivo OK (#310) · controle negativo OK (#518 descontado)
581 incidentes varridos
👁 SO PARAM POR FALTA DE VER/OUVIR/ASSISTIR: 0 · mais velho 0d
```

⚠️ Limite mantido do `#585`: o detector lê `agent_notes[-1]` cru e é **cego em
13% da frota**. O `0` está certo **pelo conteúdo que ele enxerga**, não pelo
alcance. **Não leia como saúde.**

## Passo fixo 3 — estado da fila

```
início:  581 = 336 fixed + 120 investigating + 67 ignored + 39 aguard. + 19 open
fim:     581 = 337 fixed + 118 investigating + 67 ignored + 40 aguard. + 19 open
```

**Separando o que é meu do que não é, porque hoje tem duas mãos na fila:**
minha contribuição é **exatamente uma**: `#432` saiu de `investigating` e virou
`fixed`. O outro movimento (−1 `investigating`, +1 `aguardando_aluno`) é da
outra instância, no cluster da Graziela — não é meu e não vou assinar embaixo.

---

## Instrumento novo: `2026-09-26_aluno_em_silencio.cjs`

O detector de percepção (17/09) pega quem trava por **VER/OUVIR**. Faltava a
família maior, que é a do `#229`: **a casa sabe de alguma coisa e o aluno não.**
O `#229` ficou 19,9 dias com a resposta pronta dentro do cartão, e o rótulo
`aguardando_aluno` mentia dizendo que a bola era dele.

O novo instrumento mede uma coisa só, inequívoca: **cartão vivo, aluno nomeado,
e ZERO carta escriturada pra ele.**

```
cartas lidas: 1249/1249 (paginado, conferido)
controle positivo OK (drpaulomartin@gmail.com tem carta em 2026-09-21)
piso da escrituração: 2026-09-14T14:06:31Z — cartão anterior é NÃO-CONCLUSIVO
178 cartões vivos · 434 alunos com ao menos 1 carta

🔇 ALUNO NOMEADO E NENHUMA CARTA NOSSA: 13   (mais velho 10d)
🕳️ NÃO-CONCLUSIVO (anterior ao piso):        19
```

Os 13: `#423`, `#425`, `#426`, `#432`, `#452`, `#458`, `#461`, `#543`, `#568`,
`#591`, `#592`, `#593`, `#595`.

### O erro que eu cometi construindo ele, e que o próprio caso pegou

**A primeira versão acusou 27 alunos em silêncio. O número era falso.**

Eu consultei `emails_enviados` sem paginar, e **o Supabase corta em 1000
linhas** — a tabela tem **1249**. Perdi **249 cartas** e acusei de silêncio
gente que tinha sido respondida. Peguei porque o `#263` apareceu na lista e eu
**sabia de cor** que ele recebera carta em 14/09: fui conferir em vez de
aceitar o número que me agradava.

É a armadilha que está escrita com todas as letras no meu próprio briefing
("consulta ao Supabase corta em 1000 linhas: pagine"), e eu caí nela mesmo
assim. Consertado **dentro da própria ronda**: a ferramenta agora pagina, e
**morre** se o total lido não bater com o `count` exato — zero de instrumento
cego não é zero medido. Com a paginação: **27 → 13**.

O custo de não ter pego: eu teria mandado carta de desculpa por silêncio pra
~14 alunos **que já haviam sido respondidos**. Num dia em que já existe outra
instância escrevendo pros mesmos alunos.

### O que ele deliberadamente NÃO mede

Não tento julgar "carta velha demais / nota nova não contada". Isso exige ler o
conteúdo da nota e produz falso positivo em massa: as notas de manutenção do
retrofit `#415` (24/09) tocaram **21 cartões** sem informação nova nenhuma, e
contá-las seria medir **HISTÓRICO** e apresentar como **PENDÊNCIA** — o erro
exato que a correção de 21/09 documentou no detector de percepção.

---

## O caso serial: `#432` — FECHADO

Aluna **`leilianeo.a@gmail.com`** (Leiliane Morandi). Cartão de 16/09 19:42Z:
*"paguei Pix mas o acesso ainda não foi liberado"*. Estava `investigating` há
**10 dias**.

Escolhido por ser o mais velho com aluno nomeado, **sem carta nenhuma**, e com
a bola no **nosso** colo. Os mais antigos da fila eu conferi um por um e eles
seguem legitimamente fora do meu alcance — registro pra ninguém reabrir achando
que foram esquecidos:

| cartão | por que não é meu hoje |
|---|---|
| `#52`, `#216`, `#226`, `#234` | decisão do Johnny |
| `#172`, `#206` | bola do aluno, respondidos |
| `#245` | **reli inteiro hoje.** Respondido em 20/09 (uid 2993); a ronda de 22/09 decidiu **conscientemente** não reescrever, e registrou a divergência entre as duas leituras do vídeo. Está certo. |
| `#249`, `#250` | escalados, presos no *"pode"* do WhatsApp — e-mail está morto como canal pros dois |
| `#263` | falta **unicamente** a definição dos R$97 |

### A pergunta do Vigia, respondida — e a condicional dela, refutada

O Vigia deixou em 25/09 uma pergunta binária:

> *"a carta de 16/09 existe na caixa do lucasarrial.com? Se NÃO existe, um
> aluno que PAGOU Pix está sem acesso e sem resposta há 8,2 dias, e isso é
> urgente."*

**A condicional está refutada, e por isso ela deixa de decidir o caso.** Ela
não está sem acesso. Medido no banco:

```
entitlements 7851642  = ACTIVE até 2026-10-15T12:00Z (ext 024UY8IN)
profiles.access_until = 2026-10-15T12:00Z   (plan pro, source hotmart)
credits_subscription  = 300.000
last_seen_at          = 2026-09-16T21:29:48Z
```

A linha do tempo fecha o caso sozinha:

```
19:40Z  +37.590 cr subscription_grant (payment_event) — A RECARGA CAIU
19:42Z  o cartão NASCE ("paguei Pix e o acesso não foi liberado")
19:49Z  baixa "aluno respondido" por suporte@lucasarrial.com
21:29Z  ELA ENTROU NO APP — ~1h47 depois de reclamar
```

A liberação já tinha caído **dois minutos antes** de ela abrir o chamado, e ela
usou o produto **na mesma noite**. Não houve 8,2 dias sem acesso: houve um
intervalo de minutos entre o pagamento e a percepção dela. `pagou_de_verdade`
confirma o lastro: **HP0298086056, R$97 COMPLETE em 16/09** (4º ciclo).

### O que eu NÃO consegui ver, dito na cara

A pergunta **literal** do Vigia eu **não respondo desta máquina**. A
reconciliação e o `cartas_para_o_aluno.cjs` leem a pasta Enviados do
**suporte@fastcloner**, e nela são **0 cartas** pra este endereço (histórico
inteiro). A caixa do **lucasarrial.com é outra conta**, e a leitura das
credenciais dela foi **bloqueada pelo guard de segredo** nesta sessão — o guard
agiu certo e eu não contornei.

Então: *"não consta na caixa que eu leio"* é fato; *"não existe"* **eu não
afirmo**. Isso não reabre o caso, porque o dano que a pergunta procurava está
refutado por medição independente. O que sobra é questão de **ledger**, não de
aluna, e já tem cartão próprio: **`#566`**, onde deixei a evidência.

### Convergência que vale como controle

Só **depois** de decidir, li o `#566` e encontrei lá: *"NÃO escrever para a
leilianeo.a@gmail.com: ela ESTÁ COM ACESSO ATIVO até 15/10"*. Cheguei à mesma
conclusão por outro caminho (a pergunta do Vigia no próprio `#432`), sem ter
visto aquela nota. **Duas leituras independentes, mesmo resultado** — registro
porque convergência apurada por fora vale mais que concordância herdada.

E ela acrescenta algo à tese do `#566`: a baixa dizia *"respondido via email e
reenviado o acesso"*, e a parte **"reenviado o acesso" CONFERE com o banco**.
Nesta instância a baixa era **verdadeira** e só o ledger era cego. Isso **não**
generaliza pras outras baixas da classe.

### Por que eu não escrevi pra ela

Nada lhe é devido: pediu acesso, tem acesso, voltou a usar no mesmo dia. Carta
10 dias depois dizendo *"seu acesso está ok"* é ruído. Vale aqui a mesma regra
do `#245`/22-09: **não se escreve de novo pra quem não está em silêncio nem
espera nada.** Se ela voltar a falar, a trava do `#415` sobe o cartão sozinha.

### Achado que não é defeito, e que eu não vou inflar

O `aluno.cjs` levanta a bandeira *"acesso vivo, com crédito e sem voz pronta —
investigue"*. Fui atrás **antes** de chamar de bug: `voices` = **0 linhas**,
`training_jobs` = **0 linhas**. Ela **nunca tentou treinar voz** — não há treino
falhado, não há defeito nosso, não há o que consertar. Usou Gerador de Imagem
(23/07) e Vídeo Clone (25/07) e parou.

O que fica é **fato comercial**, não chamado técnico (ordem de 27/08: só erro
de SISTEMA vira chamado): ela paga **R$97/mês** (12/08, 01/09, 16/09), não
produz nada desde **25/07**, e a recarga de 16/09 entrou **clipada pelo teto**
(*"+37.590 limitada pelo teto de 300000"*) — já está perdendo crédito por
acúmulo. **Não abri cartão disso**: retenção não é minha alçada.

---

## O que esta ronda mediu sobre a FILA, e que ninguém tinha consolidado

Conferindo os mais antigos um a um, o padrão ficou evidente e vale dito: **o
topo da fila não está parado por falta de investigação. Está parado em
decisões do dono.** `#52`, `#216`, `#226`, `#234`, `#249`, `#250`, `#263`,
`#551`, `#594` — em todos, o trabalho técnico está feito e escrito, e o passo
que falta é uma definição do Johnny (ou do Lucas).

Isso não é reclamação: é a explicação de por que a fila não baixa na
velocidade que o número sugere, e é o motivo de eu ter ido buscar meu caso
serial **no meio** da fila em vez do topo. **Não montei a lista consolidada
dessas decisões nesta ronda** — fica nomeado abaixo como próximo passo, porque
seria útil o Johnny ver todas de uma vez em vez de espalhadas por 9 cartões.

---

## Pendências nomeadas (com dono e passo exato)

| # | o que falta | dono |
|---|---|---|
| `#551` | **o esticão vence 03/10 12:00Z** — reativar na Hotmart ou decidir o que acontece (a assinatura segue `canceled`) | **Johnny** |
| `#551` | reembolso da Comunidade (R$ 1.803,60) — prometido a ela | **Johnny / Lucas** |
| `#594` | ligar ou não `TTS_TAIL_QA_INTERNO_MODO=reprovando` (chave de ambiente, sem deploy, custa GPU) | **Johnny** |
| `#263` | devolver ou não os R$97 de 08/08 | **Johnny** |
| `#249`, `#250` | o *"pode"* do WhatsApp — e-mail está morto pros dois, e são 41 e 50 dias de pagamento sem acesso | **Johnny** |
| `#590` | teto do PM2: subir ou não | **Johnny** |
| — | **trava de concorrência na fila**: duas instâncias escreveram no banco hoje sem se conhecer. Hoje não houve dano medido; a classe de dano é carta duplicada e estorno em dobro | Frank + **Johnny** (decisão de desenho) |
| — | lista consolidada das decisões travadas no dono (9 cartões) | Frank (próxima ronda) |
| — | os 12 restantes do `aluno_em_silencio` (`#423`…`#595`) | Frank (próximas rondas) |
| — | os 2 pares de `raw_audio_paths` com nome de origem igual: medir ETag/ContentLength no R2 | Frank (próxima ronda) |
| — | 8 reincidentes com aluno em cartão fechado | Frank (próxima ronda) |

**Não estou travado nelas:** todas têm dono nomeado e a pergunta está feita.

## Limite desta ronda, dito na cara

Fechei **um** cartão, e ele fechou porque **já estava resolvido antes de eu
chegar** — não porque eu tenha consertado alguma coisa. O valor real do que fiz
aqui foi **provar que estava resolvido** (e derrubar a hipótese de urgência que
o Vigia tinha deixado de pé), mais o instrumento novo e o conserto do erro de
paginação dentro dele.

**Nenhum aluno foi desbloqueado por mim nesta ronda**, porque nenhum dos que
estão bloqueados depende de mim: dependem de decisões que não são minhas. Digo
isso em vez de apresentar "1 cartão fechado + 1 ferramenta nova" como se fosse
avanço na dor do aluno.

---

## Passo fixo de fim de ronda — nada preso em branch

```
git fetch origin && git log --oneline origin/main..HEAD   →  VAZIO (conferido)
branch atual: main
```

Esta ronda **não criou branch nenhuma** — não toquei em código de produção. O
log e a ferramenta nova vão direto na `main`, como manda a ordem.

⚠️ Mesmo limite registrado pelas rondas das 11h e 12h: a varredura cobre a
**janela de 48h**, não as ~300 branches locais. As STALE já documentadas no
índice de ordens (`feat/onedrive-401`, `fix/trava-foto-nova-8379549c`,
`fix/ritmo-da-referencia-porta-73a60bb`, `fix/estorno-treino-por-saldo-pendente`,
as 2 da cura de referência) seguem **não-mergeáveis**. Auditar as ~300 é tarefa
própria, não passo de ronda.
