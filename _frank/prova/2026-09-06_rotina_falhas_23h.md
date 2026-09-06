# Ronda das falhas — 06/09, ~23hZ (20h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** item e levei até o fim — fix em produção, conferido no desfecho.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — o aviso saiu no **GRUPO**,
nada foi pro privado.

---

## 0. A ronda em uma linha

**A tela que o aluno vê depois de gravar 20 a 60 minutos dizia "Pronta para
treinar" — e ele ia embora achando que tinha acabado. O incidente que devia ter
pego isso foi fechado em 25/08 na tela errada, e a classe cresceu de 12 para 18
depois de fechado.**

---

## 1. O que eu peguei, e por quê

Fila no início: **25 abertos**, 12 `aguardando_aluno`, 4 presos.

A varredura acusou uma pagante viva que **nenhum incidente cobria**:
`tania-araujo@uol.com.br` — `pro`, acesso até 17/09, **200.000 créditos**, 30min
em 6 arquivos, voz `9c145745` parada em `awaiting_training` há 2 dias. Prioridade
manda **aluno pagante** antes de limpeza de fila, então comecei por ela.

Ela não é caso isolado: são **18 vozes** em `awaiting_training`, a mais velha
parada há **54 dias**. E o conserto já existia pronto e parado — **PR #196**,
aberto às 15:14Z, esperando revisão desde então. O gargalo era **eu**: pela regra
14-A quem revisa e mergeia sou eu, e fix que fica em PR não está em produção.

## 2. Não aceitei o PR pela descrição — revisei e medi

O PR justificava o corte de backfill dizendo que *"o Johnny escreveu à mão para
os 16 alunos afetados"*. **Isso não aconteceu.** Não houve envio em massa nenhum;
os logs das rondas de hoje mostram e-mail à mão só pra Tânia.

Isso importa porque o corte **silencia permanentemente** quem ele pula. Se a
justificativa fosse a única razão, 18 pessoas ficariam sem aviso da máquina *e*
sem aviso humano. Então refiz a conta em vez de herdar (`voices ready` agrupado
por `user_id`):

| grupo | quantos | leitura |
|---|---|---|
| dono **já tem** outra voz `ready` | **15** | entulho de 2ª tentativa, ninguém esperando |
| upload abandonado, 0 crédito, sem acesso | **2** | lembrete os mandaria num botão que devolve 402 |
| pagante viva sem voz pronta | **1** (Tânia) | já recebeu 2 e-mails à mão (uid 1071, 1158) |

**O corte está certo — pelo motivo de cima, não pelo que estava escrito.**
Decisão certa, justificativa falsa. Corrigi o comentário com a medição real
(`3ad86b8`, só comentário, 16/16 testes seguem passando) antes de mergear.

Também conferi o que não se confere sozinho: `agent_state` **existe e já é
usada** pelo mesmo padrão (`orphan_invites`, `sgp_boas_vindas`) → **nenhuma
migration pendente**, então não cai na armadilha *DDL commitado ≠ DDL aplicado*.
E rodei os testes eu mesmo: **16/16**.

## 3. Por que o #137 não segurou a classe

`#137` (`a3ced7ac`) fechou em **25/08** com 12 alunos e a leitura "é entulho".
Fechou cedo demais: a população foi **12 → 16 → 18**.

O conserto de 26/08 mexeu na tela de **LISTA**. Mas `voice-creator.tsx:659` faz
`router.push('/app/voice-cloning/<id>')` — quem sobe áudio vai **direto pro
DETALHE** e nunca passa pela lista. E o detalhe continuava com o título que o
próprio #137 condenou: **"Pronta para treinar"**, ao lado de "Pronta" (`ready`).
Lê como *acabou*.

Armadilha da ordem de 20/08 confirmada na prática: **classe fechada que segue
disparando esconde bug nosso.** Aqui escondeu por 12 dias.

## 4. O que subiu — e a prova do desfecho

PR **#196** revisado e mergeado por mim: merge **`613af0b`** na `main`,
**Deploy Frontend (production)** run `34064917454` = **SUCCESS às 22:45Z**
(conferi o desfecho, não só o disparo — "deploy feito" não é "funciona").

- **i18n nos 3 idiomas:** "Pronta para treinar" → **"Falta 1 passo: você precisa
  clicar"**; o corpo agora diz que a voz **ainda não começou** e só começa com o
  clique. Zero lógica.
- **Lembrete automático** (`lib/voices/lembrete-treino.ts` + `-sweep.ts`) no
  sweep de 5 min: dia 3 e dia 14, **máximo 2 e-mails por voz**, e o **saldo muda
  o texto** (quem está sem crédito não é mandado num botão que devolve 402).
  Trava por voz+etapa em `agent_state`, gravada no fim e **gritando no log** se
  não persistir.

Uma tela só avisa quem volta nela. O lembrete existe pra quem **não volta**.

## 5. Estado da Tânia (o caso que abriu a ronda)

Continua com a bola: 2 e-mails à mão já saíram, e agora a tela que ela encontra
se voltar diz a verdade. **Não iniciei o treino no lugar dela** — gastaria
**10.000 créditos sem o aluno pedir**, o que a regra proíbe. Não é silêncio: é
espera com aviso dado e data anotada, que pela regra de 21/08 saiu do meu colo.

## 6. Registro pro detector (repetindo o alerta da ronda das 14h52z)

"acesso vivo + crédito + sem voz pronta" **dispara para aluno que só precisa
clicar**. Aos 2 dias isso é **falso positivo** e rouba atenção de pagante
travado de verdade. Segue sem dono — vale um recorte que separe
`awaiting_training` (bola com o aluno) de travado (bola conosco).

## 7. O que eu NÃO fiz

Não gastei GPU, não iniciei treino de ninguém, não mexi em crédito, acesso,
plano ou entitlement, não apliquei migration, não escrevi pra aluno em lote, não
reabri incidente e não toquei em **nada** da planilha (ordem de 29/08). O corte
de 06/09 garante que o primeiro sweep **não** varre as 18 antigas: o primeiro
lembrete possível é **09/09**, e só pra voz nova.

## 8. Precisa de DECISÃO do Johnny

Seguem de antes, nada novo meu: **#222** reenquadrar ou fechar; **#226**
destrava o **#234**; **migration 82** destrava o **#15**; WhatsApp para Glauber e
Anderson (#249/#250); e-mail em lote pros **8** do #290. Relógios: **Diego 08/09
12hZ**, **Marcelo 11/09**, **13/09** para os dois do #290.

⚠️ **Fila de PRs é o gargalo real:** sobraram **19 PRs abertos**, alguns de
28/08. Fix parado em PR não é fix — é o mesmo "card imortal" do #222, só que em
outra fila.

## 9. As lições

**Decisão certa não valida a justificativa.** O corte de backfill estava certo e
o motivo escrito era falso. Se eu tivesse aprovado pelo texto, teria assinado
embaixo de "escrevemos pras 16 pessoas" — e a próxima ronda que lesse aquele
comentário construiria em cima de uma carta que nunca saiu. Revise **o porquê**,
não só o quê.

**Fechar na tela errada é fechar sem fechar.** O #137 consertou a lista e a
lista não é onde o aluno cai. Antes de dar por resolvido, pergunte por qual tela
a pessoa **realmente passa** — o `router.push` responde isso em uma linha.

**"Pronta" é uma palavra perigosa.** "Pronta para treinar" ao lado de "Pronta"
custou 54 dias à pessoa mais antiga da fila. Quando o estado depende de uma ação
do aluno, o texto tem que dizer **o que falta**, não o que já está feito.
