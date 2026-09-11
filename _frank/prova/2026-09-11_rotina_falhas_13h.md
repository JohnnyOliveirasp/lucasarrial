# Ronda das falhas — 11/09/2026, ~12h20–13hZ

Método serial (regra 8, ordem de 21/08): um incidente, até o fim, antes do próximo.
Canal: ordem de 31/08 — tudo de FastCloner no **grupo**, nunca no privado.
Alvo escolhido pela ronda das 12h: a **fila de recados** (`para_frank_*`), o maior
bolsão de aluno esperando.

---

## O que saiu daqui

| fato | onde |
|---|---|
| **2 incidentes FECHADOS** (`#237`/`92b1cc85`, `#243`/`9e574363`) | `ignored`, 1 linha afetada cada, conferido na releitura |
| **1 aluno respondido** (`daniel@dlima.adv.br`) — corrigindo erro NOSSO | Enviados **uid 1725**, cópia confirmada |
| **1 erro nosso achado e registrado** (afirmação falsa mandada ao aluno) | nota no `#244` |
| **3 chaves de recado apagadas** (2 de `92b1cc85`, 1 de `f5325bf7`) | `DELETE`, 0 sobrando na releitura |
| **0 crédito movido, 0 GPU, 0 migration, 0 e-mail em massa, 0 PR** | — |

A fila de recados tinha **64** chaves `para_frank_*`, não ~30 como a ronda das 12h
estimou. Registro o número que eu medi. Paginei de propósito (armadilha das 1000
linhas) e o primeiro `select` **falhou** por coluna inexistente (`created_at`) —
apareceu como erro em vez de virar zero silencioso, que é o ponto da armadilha.

---

## 1. `#237` / `92b1cc85` — irrespondível por construção · **FECHADO**

Era o recado mais antigo com cara de aluno esperando (8,6d). **Não fechei por
cansaço da fila: fechei porque provei que não existe aluno do outro lado.**

**Por que é irrespondível.** O chamado nasceu no painel admin sem e-mail, e o
`signature` carrega um uuid **sorteado no insert**
(`admin/incidents/route.ts`). O PEDIDO do recado — *"identifique o aluno pelo
user id 20a69a24…"* — apoiava num campo que não identifica ninguém. A nota [1]
do Frank já tinha matado essa pista em 02/09; **o recado continuou na fila
mandando a próxima ronda caçar o mesmo fantasma.** Foi por isso que ele saiu.

**Reconferi em vez de acreditar na minha própria nota:** o uuid dá **0 linhas** em
`profiles.id`, `voices.user_id` e `image_generations.user_id`.

**Ângulo NOVO, que nenhuma ronda anterior tentou** — procurar o relato no chat do
app:

| busca | resultado |
|---|---|
| `help_messages` 30/08–04/09, regex "não aparece/sumiu/enviei fotos\|áudio" | 347 linhas, **11** casando, **nenhuma é este relato** (são crédito por Pix, botão Gravador da Alana, áudio no Animar Imagem) |
| janela fechada 02/09 16:00–21:30Z, **sem** filtro de texto (chamado criado 20:38:42Z) | **12** linhas, duas conversas, **ambas de outro aluno e outro assunto** |

O relato **não nasceu do chat do app**. A Fast escalou de um canal que não grava em
`help_messages`. Não há caminho de volta até essa pessoa.

**Não chutei identidade, de propósito.** Daria para procurar "alguém que por volta
de 02/09 teve foto/áudio que não apareceu" e escrever pro palpite mais parecido. É
exatamente a armadilha do casar-no-escuro já escrita no
`detector_preso_fora_da_conta` (*"ambiguidade é resultado, não erro"*). Escrever
pro aluno errado dizendo "suas fotos não apareceram?" é pior que fechar.

**A causa sistêmica está em produção, conferida no fonte e não no card:**
`git merge-base --is-ancestor d2dc5fa main` = **SIM** (PR #210). Hoje o
`signature` é `reported:manual:${randomUUID()}` **com comentário** dizendo que o
uuid não identifica ninguém (a armadilha ficou auto-documentada, que era o dano
real: queimou duas rondas); `affected_emails` recebe o e-mail quando vem; o audit
log grava `has_email`; e o painel avisa *"sem ele o chamado fica irrespondível"*.

**O limite, dito e não escondido:** reportes manuais no banco = **2 no total**.
Antes de `d2dc5fa`: 2, sendo 1 sem e-mail (este). Depois: **0 reportes**, logo 0
fantasmas novos. **n=0 depois do fix não prova que o fix funciona** — prova que não
houve tráfego. E o campo segue **opcional**: o conserto **avisa, não impede**.
Tornar obrigatório é decisão de produto, não minha.

Fechado como **`ignored` = irrespondível**, e a nota diz na cara que **nenhum aluno
foi ajudado** — para ninguém ler o fechamento como entrega.

---

## 2. `daniel@dlima.adv.br` — **nós dissemos a ele uma coisa falsa** · aluno respondido

Peguei este como o serial seguinte (recado de 7,6d). O que era "mandar um e-mail
que ninguém mandou" virou outra coisa: **o e-mail já tinha sido mandado, e estava
errado.**

A nota [1] de 03/09 afirma: *"NÃO MANDE ele usar Esqueci minha senha com o
daniel@dlima.adv.br: NÃO EXISTE conta nesse endereço. Varri auth.users inteiro
(1.824 usuários)."* O e-mail que saiu (uid 499) repetiu isso ao aluno.

**Era falso quando o e-mail saiu.** Cronologia medida agora ao segundo, pela admin
API (2.496 usuários varridos hoje):

| quando | o quê |
|---|---|
| 21:20:14.2Z | `#243` criado |
| 21:21:00.1Z | `#244` criado |
| **21:26:36.9Z** | **conta criada** em `auth.users`: `daniel@dlima.adv.br`, `17c0603c`, provider **email** |
| **21:27:18.0Z** | **nosso e-mail sai** dizendo que a conta não existe — **41s depois de ela existir** |
| 21:27:45.5Z | a nota repete a afirmação já falsa |
| **08/09 19:28:27Z** | **último login dele** — entrou sozinho |

A varredura estava certa no instante em que rodou e **morreu em ~6 minutos**.
Mandou-se sem re-medir.

**Mesma classe do `#212`** (premissa verdadeira no dia em que foi escrita, morta
depois, ninguém voltou a medir) — só que ali a janela foi de **4 dias** e aqui de
**41 segundos**. A lição não é "medir melhor", é **re-medir imediatamente antes de
afirmar ao aluno**: afirmação negativa sobre existência de conta apodrece mais
rápido que qualquer outra, porque **é o próprio aluno quem cria a linha que a
invalida**.

**O dano real:** mandamos o aluno **não** usar o único caminho que funcionava, e
pedimos que ele respondesse *"qual e-mail você usa"* — pergunta que não tinha
resposta diferente. Ele nunca respondeu (INBOX: **0** mensagens dele, conferido) e
resolveu sozinho.

**O que conferi antes de escrever, para não errar duas vezes:** conta `17c0603c`
existe, `provider=email` (logo o reset por e-mail funciona), último login 08/09.
Sem compra, 0 crédito, SEM ACESSO — **é lead, não pagante**, então não há dinheiro
nem crédito neste cartão.

**O que eu não consegui provar, e por isso não afirmei ao aluno:** não achei o chat
dele. `help_messages` tem **0** linhas para a conta `17c0603c` e **0** com o texto
do `sample_error` em toda a tabela. Como não sei de qual sessão ele falou, **não
reconstruí essa parte no e-mail** — disse a ele só o que está medido.

Enviado agora, cópia **confirmada** em Enviados **uid 1725**: a correção do que
dissemos, o passo a passo do reset que agora funciona, e que não existe tela de
alterar senha no app. **Não prometi data** para o que é decisão de produto.

`#243` fechado como **duplicata** do `#244` (mesmo aluno, mesma queixa, 46s de
diferença, dois canais da Fast) — a nota de 03/09 já pedia para não tratar como
dois; executei em vez de deixar os dois na fila.

**O que fica aberto e não é meu:** não existe tela de alterar senha para quem entra
com e-mail/senha (`sidebar-tree.tsx:353-360` tranca Configurações por
`creditos<=0` e aquela tela é só API keys; `/app/account` não tem o campo). Levar
o bloco `supabase.auth.updateUser` pro `/app/account` é **decisão de produto,
alçada do Johnny**. Não subi código por isso.

---

## O que continua parado (herdado, não tocado nesta ronda)

| | idade | passo em que está |
|---|---|---|
| Marcelo + Márcio — **dois** R$97 | **fecham hoje 00:00Z** | palavra do Johnny |
| `#304` Emanuel — 180,81 EUR, garantia vencida | 122d | palavra do Johnny |
| `#341` `b633b18c` — 16 pessoas, crédito a devolver | ~24h | palavra do Johnny (teto 9-B) |
| `#313` `2d0509b4` — 15 vitalícios de graça | 63,5d | ordem de conserto anotada |
| `#331` `3528dd59` — Mastroianni | ~36h | reposição de crédito |
| `#244` — tela de alterar senha | 8d | decisão de produto |
| PR **#92** em DRAFT | 15 dias | — |

⚠️ **Fila de recados: 61 chaves restantes**, muitas pedindo e-mail a aluno que
espera dentro do app. Das 3 que tirei, **as 3 estavam podres** (premissa morta ou
patch já aplicado) — então o tamanho da fila **superestima** o trabalho real, mas
cada chave podre queima uma ronda. Alvo da próxima: continuar descendo por idade.

## Aluno que eu conferi e NÃO precisou de ação

- **hellengrasso@gmail.com** — apareceu na varredura como "acesso vivo, com crédito
  e sem voz pronta" (5d). **Já foi atendida corretamente** em 06/09 23:48Z (uid
  1182): 2 dos 7 arquivos chegaram, 6min55s contra o portão de 20min, nada foi
  cobrado, e o e-mail a manda pro `/sgp`, que ela já pagou (R$597). Não é caso de
  silêncio e não reescrevi.
  ⚠️ **Mas fica um risco que não é meu:** a assinatura da plataforma dela é
  **0 GBP** e o acesso marca **12/09** — ela pagou R$597 + 47,94 GBP em avulsas e
  tem **95.375 créditos**. Pela regra final de crédito (*"pagou, fica com o
  crédito"*) ela **não** deveria perder nada amanhã. Não mexi em acesso nem em
  crédito; **registro para quem decide**, porque o relógio é hoje.

## Números da ronda

- **71 → 71** em `open`/`investigating`. **A conta fecha e eu não vou maquiar:**
  −1 (`#237` fechado) −1 (`#243` fechado, mas ele estava em `aguardando_aluno`,
  não nos abertos) **+1** (`#244` promovido de `aguardando_aluno` para
  `investigating`, porque a lacuna de produto é real e não é espera de aluno).
  **O número de cima não se moveu; o que se moveu foi `aguardando_aluno`: 12 → 10.**
  `ignored` 46 → **48**.
- **50 de aluno, 21 técnicos.** Nenhum em `open`.
- **Nada fechado voltou a disparar** nesta janela: o detector sai **1**, o `#8`,
  último disparo em **22/08** — velho e conhecido. O detector honesto (*aberto com
  `resolution_note` preenchida*) dá **10 de 71**, igual às 20h, 22h, 00h, 10h e 12h.
- Caixa lida só com `EXAMINE` + `BODY.PEEK`, busca `SEEN`. **Não toquei em
  não-lido.** 1 e-mail enviado (individual, regra 8 — decisão minha).
- 🧹 Higiene, **estável**: seguem **8 arquivos** modificados não commitados em
  `frontend/**/sgp*` e `frontend/messages/*`, mais os não rastreados em
  `_frank/rascunhos/`. **Décima segunda ronda seguida.** Não são meus, **não
  toquei**; commitei só este log. Scripts de investigação ficaram em `_Bugs/`
  (fora do git), como manda o README das ferramentas.
- Custo desta ronda: leitura + 1 e-mail. **0 GPU, 0 crédito, 0 visão paga.**
