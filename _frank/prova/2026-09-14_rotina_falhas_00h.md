# Ronda das falhas — 14/09/2026, ~00hZ (13/09, 21h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais as ordens de
**27/08** (só erro de sistema vira chamado), **29/08** (planilha desligada) e
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.** Janela do Executor: 20h58 BRT, dentro de 08h–23h.

**Item serial: `#246` / `933fd9d6`** (10,0d) — o mais velho **acionável** com
aluno afetado. **Fechei 1 incidente** (`#244`), **desarmei um remendo que eu
mesmo tinha plantado** num pagante, e **provei na produção rodando** a coisa que
duas rondas anteriores disseram que não dava pra provar. Fila: **81 → 80**.

O que esta ronda tem de diferente: os dois cartões estavam parados por uma
**pendência que já tinha sido escrita, com instrumento e tudo**, e que ninguém
executou — um há 5,2 dias, o outro há 8,8. Nenhum dos dois precisou de ideia
nova. Precisou de alguém fazer.

---

## 1. Como escolhi

Os 5 mais velhos seguem travados por motivo próprio (conferido na ronda das 22h,
nada mudou hoje). `#223` (Alana) e `#226` dependem de decisão de dinheiro do
Johnny — os dois foram tratados nas rondas de hoje. `#234` foi tocado hoje às
12:14Z.

Abaixo disso, por idade: `#244` (10,1d) e `#246` (10,0d). **Peguei o `#246` como
serial** porque o `#244` já estava com o lado do aluno fechado desde 11/09 — mas
ele caiu junto, e por acidente (item 3).

---

## 2. `#246` — a dívida estava escrita, com o instrumento no papel, e parada 5,2 dias

O `#246` carrega dois casos. O do **Fábio** eu fechei por inteiro hoje. O do
**jutai** continua com o Johnny.

### 2.1 A pendência que eu mesmo deixei enterrada

A nota de 08/09 (item 3) diz, com todas as letras, onde estava o remendo e qual
era o instrumento pra tirá-lo:

> *"usar a CONTA DE TESTE `suporte@fastcloner.com`, pondo nela
> `access_source='hotmart'` com `access_until` NULL, entrar no app e confirmar
> que o gate abre; depois desfazer e SÓ ENTÃO gravar NULL no Fábio."*

E terminava: *"Não fiz por orçamento de ronda, não por não saber como."*
Ficou **5,2 dias**. Executei exatamente isso, sem inventar instrumento novo.

### 2.2 A prova de runtime, com controle positivo E negativo

Não é *deploy verde* e não é leitura de código: é a produção rodando, lida na
tela. Conta da **casa** (`suporte@fastcloner.com`, ordem de 19/08), login por
**e-mail+senha de propósito** — magic-link/OAuth passa por `auth/callback:50` →
`claimPurchasesOnLogin` e teria reescrito o estado do próprio teste.

Discriminador: `/app/account` renderiza o `subscribed` do `hasActiveAccess`.

| estado do perfil | tela | veredito |
|---|---|---|
| `pro` + `until=NULL` + `source='hotmart'` | **"Plano ativo"** | tem acesso |
| `pro` + `until=NULL` + `source=NULL` | **"Você não tem uma assinatura ativa"** | sem acesso |

Mesma conta, mesma sessão, **um campo mudou**. O instrumento **discrimina** —
não é tela que diz "Plano ativo" pra todo mundo.

**Anti-contaminação, conferida ANTES e não depois** (a armadilha da *medição
contaminando o resultado*, ordem de 19/08 item 4): `suporte@fastcloner.com`
**não** está em `admin_emails` (9 linhas, conferidas uma a uma) e **não** está na
`ALLOWLIST_PADRAO`; `COMP_ACCESS_EMAILS` não existe na config. A própria tela
confirma: *"Acesso de cortesia (equipe)"* = **false nas duas rodadas**. Se o
bypass tivesse pegado, o teste daria acesso pelos dois lados e eu teria concluído
**certo pelo motivo errado**.

Brinde: o estado **sobreviveu ao login** (relido no banco depois), o que confirma
na prática o `claim-guard` — saldo > 0 ⟹ `precisaResgate=false` ⟹ sem claim.

Screenshots em `_Bugs/gate_VITALICIO.png` e `_Bugs/gate_CONTROLE_SEM_SOURCE.png`.
Conta de teste **restaurada ao snapshot exato** (`free`/NULL/NULL/0/0), relido do
banco.

Antes disso, a metade estática que o grep de 08/09 **não** cobria: os **25**
call sites de `hasActiveAccess` passam o 3º argumento **e os 25 `select` trazem
`access_source`**. Query que esquece a coluna fecharia o gate com o código certo
— era o furo que faltava conferir.

### 2.3 O remendo saiu

`profiles 4e2fab63`: `access_until` **2030-01-01 → NULL**. UPDATE com trava
otimista **tripla**, **1 linha afetada**, **relido do banco depois de gravar**:
`pro` / NULL / `hotmart` / 100.000 créditos. Remedi a fonte da verdade antes em
vez de herdar: entitlement `0bcdb9b5`, produto 7283335, **active**, `access_until`
NULL (vitalício).

Efeito colateral que era metade do motivo: com NULL, a tela **para de imprimir
"Acesso garantido até ..."** (linha ausente, confirmado na screenshot). Enquanto
havia 2030, a casa podia dizer a ele uma data que **nós inventamos** — a classe
do `a0bc1f7e`.

### 2.4 O achado que muda a natureza do item, e que nenhuma nota tinha

**O Fábio só tem Google.** `auth.users`: `provider=google`, `providers=['google']`,
sem credencial própria. Logo **todo** login dele passa por `auth/callback:50`,
que chama `claimPurchasesOnLogin` **sem guarda** → `recomputeProfileAccess` →
grava `access_until=NULL`.

Ou seja: o 2030 não era "até alguém limpar", era **até ele logar**. A pergunta
*"a produção lê NULL+source como acesso?"* nunca foi cosmética — ela ia ser
respondida **sozinha, no aluno**, no próximo login dele. Se o gate estivesse
errado, ele seria trancado **pela nossa própria reconciliação**, 7 dias depois de
a casa ter escrito "seu acesso está liberado" (uid 1170). Provar antes era a
única ordem segura de fazer isso — e por sorte, não por método, ele ainda não
tinha voltado (`last_sign_in_at` = 30/08).

---

## 3. `#244` fechado — e eu achei de rasteira

Estava `investigating` há 10,1 dias. O lado do aluno fechou em 11/09. Sobrava
**uma** coisa: o bloco *"Alterar senha"* em `/app/account`, que a nota de 11/09
mandou pro coder e classificou como decisão de produto.

**Ele está em produção desde 05/09** — commit `ad3167e`, PR #174, **8,8 dias**.
Eu vi porque estava com a tela de `/app/account` aberta **por outro motivo** (a
prova do `#246`), e o bloco estava lá, renderizado.

Fechado como `fixed`, com o commit. **A lição não é boa:** PR mergeado **não
volta sozinho** pro cartão que o pediu. É a terceira vez hoje — a ronda das 22h
achou o mesmo no `#280` (7,8 dias) e a das 18h no PR #260 (3h20). Aqui o custo
foi só fila suja, porque o aluno já tinha se resolvido. Nas outras duas foi
**aluno esperando por trabalho que já estava pronto**.

O que eu vou mudar: quando delegar conserto de produto, deixar no cartão a
**frase que prova o conserto** ("existe bloco Alterar senha em /app/account"),
pra ronda seguinte conferir em 10 segundos em vez de reler 3 notas.

---

## 4. O que NÃO fechou, e por quê

**O jutai.** Pagante de R$ 313,32 (Fábrica de Conteúdo Invisível, 29/05).
Remedido hoje: `free`, **0 crédito, 0 entitlement**, sem acesso, calado desde
**04/09 06:53Z** — ele voltou uma vez depois do nosso e-mail, não viu nada, e
não voltou mais.

A pergunta está parada com o Johnny desde **04/09 — 9,7 dias**. E o enquadramento
que a ronda de 08/09 corrigiu continua valendo e não foi respondido: o **mesmo
produto** concede acesso automático a todo comprador que a integração viu; o que
separa o jutai do Fábio são **11 dias**, que é quando `payment_events` passou a
existir. **Não é exceção comercial, é backfill que a casa não fez.**

Ele segura **duas** explicações nossas que se contradizem (uid 506 e uid 507), e
a segunda mandou um pagante **comprar de novo**. Continuo **não** mandando uma
3ª versão sem desfecho, pelo motivo registrado em 08/09 — e isso **não** é
segurar resposta de aluno por permissão (regra 8): é não trocar de versão pela
terceira vez sobre uma coisa cuja resposta eu comprovadamente não tenho.
**Reescalado no grupo nesta ronda, marcado urgente, com a idade na cara.**

---

## 5. Placar honesto

- **Incidentes fechados: 1** (`#244`, com commit `ad3167e`). Fila **81 → 80**.
- **Remendo meu desarmado: 1** (`2030-01-01` do Fábio), com o gate **provado em
  produção** antes de tocar no aluno, com controle positivo e negativo.
- **Alunos escritos: 0.** Nenhum dos dois pedia carta hoje: o do `#244` já estava
  respondido e resolvido; pro Fábio **nada mudou** (tinha acesso antes, tem
  agora) e escrever de novo só geraria dúvida onde não há.
- **Escalação reaberta: 1** (jutai, urgente, 9,7 dias parada).
- Crédito de aluno tocado: **0**. GPU: **0**. Migration: **0**. PR mergeado: **0**.
  Acesso de aluno: **1 campo**, num aluno que **já tinha** acesso, pra tirar uma
  data inventada.
- Conta da casa usada e **restaurada ao snapshot exato**, relido do banco.

**O que emperrou, na cara limpa:** o `#246` não fecha e não vai fechar por mim.
A ponta técnica acabou hoje; a que sobra é R$ 313,32 de um pagante e uma resposta
que é do Johnny. Está parada há 9,7 dias e eu só sei gritar mais alto.

**O que eu NÃO fiz:** não herdei afirmação sem remedir (refiz o entitlement do
Fábio e o estado do jutai antes de agir), não marquei `fixed` o que não resolvi,
não mexi em crédito/GPU/migration, não mergeei PR, não li a caixa do `suporte@`
pra triagem, não toquei nos branches STALE, não relitiguei a regra de crédito e
não toquei em nada da planilha.

---

## 6. Passo fixo de fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` vazio e `git branch` /
`git rev-list` conferidos — ver o commit desta ronda.
