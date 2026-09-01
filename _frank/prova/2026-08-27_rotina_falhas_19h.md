# Rotina das Falhas — 27/08/2026, ronda das 19h UTC (Frank, dono da fila)

Método serial (regra 8, ordem de 21/08): um incidente por vez, até o fim.
Papéis (regra 14-A): o Vigia abre e anota; eu investigo, decido e fecho.
`git checkout main && git pull --ff-only origin main` → já estava em dia.
Índice de ordens lido antes de tocar em qualquer coisa. Ordem vigente de hoje:
`2026-08-27_vigia_so_erro_de_sistema.md` (14-C).

## Placar

| | |
|---|---|
| Abertos no início (sem `aguardando_aluno`) | **9** |
| Abertos no fim | **11** — abri o `#161` **e** entrou o `#160` sozinho às 18h41, no meio da ronda |
| Fechados nesta ronda | **0** — e explico abaixo por que fechar seria mentira |
| **Alunos que passaram a ter resposta** | **2** (Ronald Lenz, Cássio Fialho) |
| **Chamado novo de causa-raiz** | **1** (`#161`, 190 cadastros) |
| Incidentes anotados com medição nova | 3 (`#52`, `#153`, `#126`) |
| Linhas de dado corrigidas | **1** (entitlement do Cássio, com `RETURNING` conferido) |
| Crédito / GPU / migration / merge / e-mail em massa | **nada tocado** |
| Hipótese de ronda anterior derrubada por medição | 1 (o multiplicador "9,3×" do `#52`) |

---

## 1. `#11` — reconferido em 30 segundos, segue travado no mesmo passo

Peguei primeiro por ser o mais antigo. `information_schema` devolve **zero**
coluna `trainer%` em `training_jobs`: a **migration `scripts/97` continua não
aplicada**, 37 dias depois. É o único bloqueio. Não é trabalho parado por falta
de investigação, é trabalho pronto parado em aval. **Segui pro próximo** (regra
8: travou, diz em que passo e anda).

## 2. `#52` — o próximo mais antigo com aluno afetado, e o aluno estava mudo

### O aluno

**Ronald Lenz** (`ronald.lenz@lenzcontabilidade.com.br`), conta criada **hoje**.
Seis gerações falharam entre 17h01 e 17h30 — a estreia dele no produto. E o
detalhe que decidiu a minha prioridade: **ele nunca escreveu**. Zero e-mail na
caixa (`ler_caixa --de`), zero mensagem no chat (`help_messages`: 0 linhas).
Levou seis recusas e ficou calado. Foi exatamente o silêncio que fez a Viviana
explodir, então não esperei ele reclamar. **Escrevi pra ele às 18h56Z.**

### O dinheiro, conferido pelo caminho certo

Casei `generations` × `credit_transactions` por `ref_id` nas 9 gerações dele.
As 6 `failed` têm **1 débito (`ref_type='generation'`) e 1 estorno
(`ref_type='generation_refund'`) cada**. Saldo 87.099, nada pendente,
**nada a estornar**. Conferido por `ref_type`, **nunca por `kind`** — os
estornos gravam `kind='extra_purchase'`, e quem filtrasse por `kind` concluiria
que ele não foi estornado e **pagaria em dobro** (armadilha medida em 20/08).

### Duas correções de fato no que a ronda anterior reportou

1. **Ele não é pagante.** `pagou_de_verdade`: *"NUNCA PAGOU, R$0 APPROVED"*. É
   **trial** com acesso até 03/09. Portanto **não** dispara a regra de "pagante
   travado avisa o Johnny na hora", e não há crédito indevido.
2. **Os tamanhos estavam errados.** O relato das 18h usou o **valor do débito**
   como se fosse o número de caracteres. Os `text_normalized` reais das 6
   falhas: **1829, 1615, 2003, 1931, 1782, 1170**.

### O gradiente: confirmado na direção, **inflado na magnitude**

Re-medi eu mesmo (14 dias, `generations` com `text_normalized`):

| faixa | gerações | falhas | taxa |
|---|---|---|---|
| <500 | 482 | 7 | 1,45 % |
| 500–999 | 432 | 7 | 1,62 % |
| 1000–1499 | 170 | 4 | 2,35 % |
| **1500+** | 119 | 9 | **7,56 %** |

Monotônico, **confirmado**. Mas o *"9,3× mais"* reportado às 18h **não se
reproduziu**: pelo meu recorte é **5,2×**. A direção sustenta a orientação que
dei ao aluno; o multiplicador não. Fica registrado pra ninguém repetir 9,3×.

### Por que NÃO refiz os áudios dele, tendo a ferramenta

Pela própria nota do `#52` das 18h18: entre uma tentativa e outra **nada muda no
worker** (sem seed, sem temperatura). Refazer com o código de hoje reproduz a
falha, **gasta GPU** e entrega ao aluno a **sétima** recusa. A régua (c) de
fechamento do chamado só vale **depois** do deploy. Ordem: nada que gaste GPU
sem o aluno pedir.

**Passo em que emperrou:** **PR #70** (`fix/inc52-resgate-nivel-2`, `7d030db`),
aberto, não mergeado. O merge dispara *Build RunPod Worker* + `deploy-runpod` —
**worker de GPU, não é minha alçada.** Status segue `fixing`: o código existe e
está **morto em produção**.

## 3. `#153` — peguei o próximo, e ele abriu um buraco maior

Escolhido pela regra 8: mais antigo que o `#157` **e** com mais gente atrás
(5 alunos).

### O caso vivo, atendido

**Cássio Fialho**, **7 e-mails** (uids 285→331), o último dizendo *"aguardo um
contato de um ser humano"*. Li os sete antes de escrever. O que ele pedia desde
**24/08** era uma resposta factual — *"minha assinatura foi cancelada?"* — e ela
**nunca tinha sido dada**. Respondi às 18h50Z.

### A assimetria que causa o auto-fechamento — está escrita no próprio código

- **Chat do app** (`help/route.ts:151-158`): **não** chama `entregarAoTime`,
  porque é *"canal sem caminho de volta"*; o chamado **fica aberto** e um pedido
  novo depois de `fixed` **REABRE**.
- **E-mail** (`incidents/entregar.ts:73-118`): posta no grupo e **fecha**
  (`resolved_by='carol (entregue ao time)'`, l.106-108). A premissa que autoriza
  fechar está na l.152-153: *"funciona porque quem pegar responde pelo suporte@"*.

**A premissa é falsa, e o próprio caso mede isso:** a `resolution_note` do `#126`
tem **cinco** entregas ao grupo (24/08 20:10, 24/08 20:40, 26/08 22:55, 26/08
23:05, 27/08 09:35). **Nenhum humano respondeu em nenhuma das cinco.** E o
e-mail não tem o REABRE que o chat tem, então cada mensagem nova era re-fechada
em ~1,5s com o contador subindo.

### O ponto cego do detector, confirmado

`2026-08-20_fechados_que_disparam.cjs` procura `last_seen_at > resolved_at +
2min`. Aqui o fechamento vem **0,8 a 1,6s depois**. Nenhum dos 5 aparece. A
ronda do Vigia das 18h reportou *"0 fechados que voltaram a disparar"* com estes
**5 vivos** — o número estava certo pela régua e **errado pelo mundo**.

**Deixei `investigating`, não fechei:** a causa está medida, mas o comportamento
segue igual e os outros 4 alunos (`#82` Luciano, `#145` Sandra, `#141` Luzielia,
`#130` Itamar) **eu não li nesta ronda**.

## 4. `#161` — o chamado novo: ninguém lê `subscription.status`

O Cássio não estava sendo teimoso. **Ele estava certo e a nossa resposta estava
errada.** A Fast escreveu *"se você não finalizou nenhuma compra, não há dado de
pagamento armazenado aqui"*. O registro mostra checkout **completo** por
`CREDIT_CARD` — de valor **R$ 0,00**. A automação confundiu *"não teve
cobrança"* com *"não teve compra"*, e ele passou 4 mensagens sendo informado de
que estava enganado quando não estava.

### A causa, com `arquivo:linha`

1. `payments/hotmart-payload.ts` lê `data.subscription` só para
   `subscriber.code` (l.45-54) e `date_next_charge` (l.88). **Nenhum ponto do
   código lê `data.subscription.status`** (grep: zero fora de teste).
2. `webhooks/hotmart/route.ts:170` manda `PURCHASE_APPROVED` **e
   `PURCHASE_COMPLETE`** para `grantAccess`; o guard da l.176 só olha
   `data.purchase.status`.
3. `payments/entitlements.ts:53` grava `status: "active"` **fixo**.

A Hotmart manda o `COMPLETE` ~7,8 dias depois do `APPROVED` (o comentário da
l.193-199 explica). **Se o aluno cancelou nesse intervalo, o `COMPLETE` chega com
`subscription.status=CANCELED` e mesmo assim regrava o cadastro como `active`.**
E não existe webhook de cancelamento nesses casos: `max(received_at)` de
`%CANCELLATION%` é **NULL** para todos os afetados que conferi. O único sinal é
o campo que ninguém lê.

### Escala

`active` + `CANCELED` = **190** (17 com `access_until` futuro, 173 expirado),
contra 629 `active`+`ACTIVE` e 54 `canceled`.

### Duas consequências que ninguém tinha ligado

- **O fix do `#127` está vivo e não segura nada.** O guard
  (`orphan-outreach.ts:169`, commit `42e3b68`) pula quem não está `active` — e
  lê **justamente a coluna errada**. Foi assim que o Cássio seguiu recebendo
  *"seus créditos seguem te esperando"* depois de cancelar.
- **O `#66` foi fechado e voltou sozinho.** Victor Ramalho
  (`vhrdeoliveira@hotmail.com`) está `active` + `CANCELED`, `updated_at`
  **24/08 09:26** — um `COMPLETE` **re-ativou depois do fechamento**. Mesmo
  padrão em `acostalr@` (24/08) e `eversonfelizardo@` (19/08), os três de R$97.

### O que isto **não** é, dito de propósito

**Não há cobrança indevida e não há estorno a fazer.** Quem cobra é a Hotmart, e
do lado dela as assinaturas estão CANCELED — ninguém será cobrado de novo. O
dano é de **estado e comunicação** (o churn conta cancelado como ativo), não de
dinheiro. Também **não é** regressão de acesso: por `entitlements.ts:151-153`,
`canceled` com data futura **mantém** o acesso (regra 9), então corrigir os 190
**não tira** o acesso de quem pagou — conferi a função antes de propor.

### O que eu fiz e o que não fiz

Corrigi **1 linha** (Cássio, `5aaec7e9`), com `UPDATE … RETURNING`: o banco
devolveu **1 linha** e o status novo. Não foi ensaio. Não mexeu em acesso
(`access_until` 26/08 12:00, já vencido; o resultado é o mesmo nos dois status);
o efeito prático é só tirá-lo do alvo do outreach. **Não toquei nas outras 189** —
correção em massa em tabela de pagamento é aval do Johnny.

---

## Decisões que são do Johnny (a lista só cresceu)

1. **Backfill dos 189 cadastros** do `#161`.
2. **PR do `#161`** (ler `subscription.status`) — abro na palavra dele.
3. **Migration `scripts/97`** — trava o `#11` há **37 dias**.
4. **PR #64** (`#146`) e **PR #70** (`#52`) — código pronto, morto em produção.
5. **`#153`**: o caminho de e-mail deve parar de re-fechar quando já houve
   entrega anterior? A 2ª entrega significa que a 1ª não funcionou. É mudança no
   comportamento que o Johnny normatizou em 24/08 — dele, não minha.

## Postado no grupo (regra 7, só fato consumado)

1. Escrevi pro aluno Ronald Lenz.
2. Escrevi pro aluno Cássio Fialho.

## O que eu NÃO fiz

Não fechei incidente nenhum — **fechar qualquer um deles seria mentira** (regra
14: a ordem de 21/08 é pra fechar mais, não mais rápido do que resolve). Não
apliquei migration, não mergeei PR, não escrevi código, não gastei GPU, não
retreinei, não estornei, não toquei em crédito nem em assinatura de ninguém
além da 1 linha declarada. Não li a caixa do suporte@ para triagem — só `--de`
nos dois alunos que eu estava tratando. Não mandei e-mail em massa. Não prometi
prazo a ninguém.

## Para a próxima ronda

1. **Ler os outros 4 alunos do `#153`** (`#82`, `#145`, `#141`, `#130`) — eu não
   os li, e o auto-fechamento pode estar escondendo o mesmo tipo de espera.
2. **Conferir se Ronald e Cássio responderam.**
3. **`#161`**: se o Johnny liberar, backfill + PR.
4. **`#157`** ficou sem dono nesta ronda (é o próximo pela regra 8).
5. **`#160` entrou às 18h41, no meio desta ronda, e eu não o toquei.** Chat do
   app, `atendimento`: aluna quer mais movimento corporal/energia no Vídeo
   Clone. Não é erro de sistema (é pedido de produto) e ninguém está travado
   nele, mas está **`open` e sem dono** — registro aqui pra não virar espera
   silenciosa, que é o defeito que esta própria ronda passou o dia medindo.
