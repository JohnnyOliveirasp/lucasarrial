# Ronda das falhas — 06/09, ~19hZ (16h BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08: peguei
**um** incidente e levei até onde ele vai.

Repo sincronizado (`main`, `pull --ff-only`) e índice de ordens lido antes de
tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — o aviso saiu no **GRUPO**,
nada foi pro privado.

---

## 0. A ronda em uma linha

**Um aluno pagante estava trancado fora da plataforma há 7 dias com 100.000
créditos parados, esperando uma "decisão comercial do Johnny" que NUNCA
EXISTIU: o sistema já tinha decidido sozinho que ele tem acesso, e o bug é que
a mesma função que decide isso grava um valor que o portão lê como "negado".
Destravei o aluno, escrevi pra ele (primeiro contato em 7 dias) e deleguei o
conserto de verdade — recusando fechar como resolvido um paliativo que eu
mesmo provei que reverte.**

---

## 1. Por que peguei este

Fila no início: **23 incidentes abertos**, 13 `aguardando_aluno`, 3 presos.

Os quatro mais antigos (**#15, #222, #226, #234**) seguem parados em **decisão,
não em investigação**, e foram reconferidos nas rondas das 16h50Z e 17h50Z —
menos de 2h atrás. Não refiz a medição: não havia dado novo e repetir seria
queimar a ronda em trabalho já feito.

O próximo pela regra serial era o **#237** (02/09), e cheguei a abri-lo: segue
bloqueado em **identificação** (chamado manual sem e-mail do aluno, uuid de
`signature` sorteado). Não há o que investigar sem alguém dizer quem é a
pessoa.

Segui pro **#246** (04/09) — e ali a regra de prioridade passou na frente da
ordem da fila: *"aluno esperando vem ANTES da limpeza da fila; aluno pagante
travado = avise na hora."* A última nota dele, de **04/09 01:48Z**, descrevia
um pagante travado e **parava ali**. Dois dias sem ninguém voltar.

## 2. Fui conferir se o aluno ainda estava travado — estava

Medido agora, não herdado da nota: `drfabiovilhena29@gmail.com`, conta de
30/08, **SEM ACESSO**, **100.000 créditos**, `plan='pro'`,
`access_source='hotmart'`, entitlement `active`. **7 dias trancado com o
crédito parado.** Nunca reclamou — e é justamente por isso que ninguém voltou.

## 3. O enquadramento anterior estava ERRADO, e o erro custou 2 dias

A nota de 04/09 fechou assim: *"Preencher o access_until do Fabio É decidir a
pergunta comercial que está parada com o Johnny — isso não é minha alçada."*

**Não é.** Não há decisão comercial nenhuma a tomar sobre este aluno, e agora
está provado no código, não deduzido.

### 3.1 A prova, linha a linha

`payments/entitlements.ts:157` — `recomputeProfileAccess()`:

- `valeAcesso()` (~181): `if (e.status === "active") return e.access_until === null || e.access_until > nowIso;`
  → entitlement `active` com `access_until` **NULL vale acesso**. O tipo diz por
  quê — `db/types.ts:714`: *"NULL = vitalício (pagamento único)"*.
- no `sort`, NULL vira **Infinity** (vitalício = a data mais longe). Ele é
  **selecionado** como o entitlement vencedor.
- e aí a **mesma função** grava no profile: `access_until: active.access_until`
  → **NULL**.
- e o portão, `credits/access.ts` → `hasActiveAccess()`: `if (!accessUntil) return false;`

**A função que concluiu "este aluno tem acesso VITALÍCIO" grava um valor que o
portão lê como "SEM ACESSO".** NULL em `entitlements` = vitalício; NULL em
`profiles` = negado. A escrita é **lossy** e colapsa o **melhor** caso no
**pior**.

### 3.2 A desambiguação já está documentada — e nunca foi implementada

`db/types.ts:58`: *"access_until: NULL = sem acesso OU vitalício (**ver
access_source**)"*. O "ver access_source" não existe em lugar nenhum:
`hasActiveAccess` nem recebe esse campo. E o par desambigua sem ambiguidade:

| situação | plan | access_source | access_until |
|---|---|---|---|
| sem acesso | `free` | NULL | NULL |
| **vitalício** | `pro` | preenchido | NULL |

Estava escrito no tipo o tempo todo. Só ninguém lê.

### 3.3 Raio remedido hoje, com controle positivo

`active` + `access_until` NULL + `user_id` preenchido = **1 linha**, ele.
**CONTROLE:** a mesma consulta enxerga **768** entitlements `active` **com**
data, de **1.122** no total — o zero enxerga. Confirma a medição de 04/09 dois
dias depois.

## 4. O que eu fiz

- **Destravei o aluno**, confirmado **pelo banco**: `access_until` NULL →
  `2030-01-01`. UPDATE com trava otimista (`.is('access_until', null)`),
  **1 linha afetada**, e **relido** depois de gravar. O script conferia a fonte
  da verdade antes e abortaria se `plan != pro`, se `access_source` fosse NULL
  ou se o campo já tivesse sido mexido.
- **Escrevi pra ele** — o **primeiro contato em 7 dias**. Conferi antes:
  `ler_caixa --enviados` = *"nada encontrado"*. Ninguém nunca falou com ele.
  Cópia **conferida em Enviados, uid 1170** (relida do IMAP, não é "o script
  disse que mandou"). Disse: a falha era **nossa**, a compra e os créditos
  sempre estiveram certos, já pode usar, não precisa comprar de novo.
  **Não prometi duração/vitalício e não citei valor** — de propósito, pra não
  amarrar o Johnny na pergunta comercial que segue aberta.
- **Nota no #246** (10 → 11 notas, conferida na releitura).
- **Card `fcb34e4c` ao `coder`**: 3º parâmetro **opcional** `access_source` em
  `hasActiveAccess` (NULL + fonte = vitalício), propagado nos gates, com teste
  dos 4 quadrantes + retrocompatibilidade de 2 argumentos.

## 5. O que eu RECUSEI fazer, e por quê

**Não marquei como fixed, e o motivo é medido.** `profiles.access_until` é
**cache**: `claimPurchasesOnLogin → reconcileUserEntitlements →
recomputeProfileAccess` **reescreve NULL e tranca o aluno de novo**. Medi os
dois gatilhos:

| caminho | reverte? |
|---|---|
| `auth/callback/route.ts:50` — chama **sem guarda** | **SIM**, todo login por OAuth/magic-link |
| `app/layout.tsx:86` — só se `precisaResgate`, e pra ele é **falso** (`plan=pro` + saldo 100k) | não, login por senha sobrevive |

**O destrave sobrevive à senha e morre no link mágico.** Um paliativo com essa
cara é exatamente o que produz `fixed` falso: o banco mostra o campo
preenchido, o relatório diz "resolvido", e o aluno segue trancado no momento em
que tenta entrar. Por isso ele está registrado como paliativo, o incidente
segue `investigating`, e o conserto é o card.

**Também reprovei a saída fácil** que o `coder` poderia tomar: gravar sentinela
`9999-12-31` no lugar de NULL. Vaza pra tela do aluno via `agent/account.ts:241`
(*"ativo até…"*) e corrompe o significado do dado. **Não se cura um bug de
escrita lossy com outra escrita lossy.**

E **deixei dito onde enterrei o corpo**: quando o fix subir, o `access_until`
dele tem que **voltar pra NULL**, senão eu plantei uma validade de 2030 num
acesso vitalício.

## 6. O que eu NÃO fiz

Não toquei na tabela `entitlements` (é fonte de verdade de pagamento), não mexi
em crédito/saldo de ninguém, não apliquei migration, não mergeei PR, não gastei
GPU, não reabri nem fechei incidente, não toquei em nada da planilha.

## 7. Precisa de DECISÃO do Johnny

Nada novo meu. Seguem os das rondas anteriores: **#226** destrava o #234;
**migration 82** destrava o #15; **#222** reenquadrar ou fechar; **PR #196**
(vítima viva, Tânia) e **PR #176** esperando revisão. Relógios: **acalbamonte**
vence 09/09, **Marcelo** 11/09, **Diego** renova 08/09 12hZ.

Do #246 fica pendente **só o caso do jutai** (compra de 29/05, anterior ao
primeiro entitlement da base em 09/06 — sem conserto técnico possível, depende
da resposta comercial). E segue devida a **correção do e-mail uid 506**, que
disse a ele que "curso e assinatura são produtos separados" quando a produção
concede acesso pelo curso.

## 8. Lição que fica

**"Não é da minha alçada" é uma decisão técnica disfarçada de humildade — e
precisa da mesma prova que qualquer outra.** A nota de 04/09 mandou o caso pro
Johnny de boa-fé, e o aluno pagou 2 dias por isso. Bastava ler a função: ela
já tinha decidido que o acesso era devido. Escalar sem conferir se a pergunta
existe não é cautela, é o mesmo abandono com uma etiqueta melhor — e é pior que
errar, porque ninguém revisa o que está "esperando decisão".

A outra: **cache que perde informação mente na direção do bloqueio.** Três
estados (vitalício / com data / sem acesso) foram gravados num campo que só
expressa dois, e o estado que sumiu foi o melhor deles, colapsado no pior. O
código até sabia disso — estava escrito no comentário do tipo, com a solução
junto (*"ver access_source"*), há sabe-se lá quanto tempo. **Comentário que
descreve uma desambiguação que ninguém implementou não é documentação, é um
bug com boa reputação.**
