# 18/09 ~12hZ — Ronda das falhas (serial, dono da fila)

Um cartão fechado de ponta a ponta. E o que ele tinha de novo não era o defeito
dele: era **por que ele estava aberto**. A resposta mudou o que a casa sabe
sobre como alcançar aluno, e isso está medido abaixo.

## Card serial da ronda: #74 (`8379549c`) — FECHADO

Peguei o #74 por ser **o mais antigo acionável com aluno afetado** (28,0d). Os
dois mais velhos seguem com bloqueio declarado por rondas anteriores e nenhum
dos dois destravou desde então:

- **#15** (`d3d8d1b2`, 49,9d) — telemetria no PR #329 + decisão de produto do
  Johnny. Dormente desde 04/09.
- **#32** (`9119254c`, 39,0d) — aluno entregue às 10h53Z de hoje; o cartão
  espera o Johnny decidir o momento do deploy do PR #338 (recicla GPU).

O **#52** (29,7d) é mais velho que o #74, mas teve fix levado até produção
pela ronda das 02hZ de hoje e segue aberto com motivo medido na própria nota.
Não reabri trabalho de 10 horas atrás.

## O #74 não voltou por defeito. Voltou por reabertura colateral.

Ele aparecia na fila como `open` com `last_seen_at` de **hoje 10:55:05.699Z** —
1h40 antes da ronda. Parecia 8ª ocorrência de um defeito de imagem que já tinha
sido fechado em 21/08. **Não era.**

Às 10:55Z chegou o relatório de entrega de uma carta nossa, e o
`reabrirPorBounce` (`mail-bounce-registro.ts:104`) reabre **todo** chamado
`fixed`/`aguardando_aluno` que tenha aquele endereço em `affected_emails`. O
endereço está em dois cartões, então **um único bounce reabriu dois**:

| cartão | estava | last_seen_at depois do bounce |
|---|---|---|
| #74 (foto fora da geração) | fixed desde 21/08 | 2026-09-18 10:55:05.699Z |
| #101 (registro de envio) | fixed desde 16/09 12:04Z | 2026-09-18 10:55:05.699Z |
| #464 (a própria entrega falhada) | — | nasceu 10:55:06.117Z |

Idêntico **ao milissegundo** nos dois. Não houve ocorrência nova de nenhum dos
dois defeitos.

Isso é o desenho do detector, não avaria: *e-mail que voltou não é e-mail
respondido*, e o fechamento do #74 dizia "7 e-mails enviados 21/08". Vale
registrar, porém, o que fica de fora: o `marcarNaoEntregue`, **15 linhas
acima**, já casa o bounce ao envio pelo **Message-ID** — a casa sabe
exatamente qual carta morreu — e o `reabrirPorBounce` joga esse vínculo fora e
reabre por *"o endereço aparece no cartão"*. Deixei a medição escrita no #101.
**Não abri chamado disso** e não mexi no detector: é uma linha de decisão de
quem é dono da classe de bounce, e inventar um cartão pra ela hoje seria somar
ruído a uma fila de 96.

## O que o #74 tinha de fato, conferido por mim

Nada disso foi herdado de nota anterior.

**1. O conserto está VIVO em produção** (regra 5-B — Action verde não basta):

| prova | resultado |
|---|---|
| `git merge-base --is-ancestor f48358c origin/main` | SIM |
| `git merge-base --is-ancestor 765da14 origin/main` (PR #27) | SIM |
| md5 de `image-studio.tsx` no Hetzner **vs** `origin/main` | `aaf6af8df14c1072ce6fbb0f7376b153` — **idêntico** |
| BUILD_ID no servidor | `3bH63zWfWsxB6kM4LgliI` |

E li o arquivo vivo, não só o hash: `l.518-531` tem o conserto da Joanna
(quadro vazio adota a 1ª foto, o botão Gerar deixa de nascer morto) e
`l.231/302-309` tem o aviso do PR #27.

**2. O dinheiro do aluno está pago, pela régua certa.** 2 × 525 = **1.050 cr**
em 21/08 14:48:41Z, conferido por **`ref_type='image_refund'`**. Os dois
lançamentos estão com `kind='extra_purchase'` — que é exatamente a armadilha de
20/08 que quase pagou 13 alunos em dobro. Quem conferisse por `kind` concluiria
que ele não foi estornado.

## Hipótese derrubada com número: "pagante trancado"

O raio-x do aluno abre com **`acesso: SEM ACESSO`** e **66.623 créditos**. Isso
é a cara exata de aluno pagante travado — que pela regra vai pro grupo **na
hora**, não espera relatório. Antes de tocar o alarme, medi.

Os **dois** eventos da Hotmart (`PURCHASE_APPROVED` 19/08 14:45Z e
`PURCHASE_COMPLETE` 27/08 09:11Z) têm **`price.value = 0`**, oferta
`ewxrfw9j`, produto FastCloner. Valor zero não é pagamento (critério do README
das ordens: `value > 0` **E** COMPLETE/APPROVED). É trial encerrado, e
`SEM ACESSO` é a `REGRA_FINAL_CREDITO` aplicada **certo**.

Não é pagante trancado. Não toquei em acesso nem em crédito.

## O que o cartão escondia: o aluno nunca soube de nada

Paulo Cesar (Coach), `pc.sul157@gmail.com`. A casa escreveu pra ele **três
vezes** e ele **não recebeu nenhuma**:

| quando | o que dizia | fim |
|---|---|---|
| 23/08 (×2) | o estorno do #74 | quicou |
| 16/09 10:49:49Z | *"Nossas duas mensagens de agosto não chegaram em você"* | quicou 18/09 10:55:04Z |

As três na mesma classe: **caixa-cheia** (`452-4.2.2 out of storage space`,
gsmtp). Caixa cheia há **pelo menos 26 dias**. A terceira carta existia
justamente pra contar que as duas primeiras tinham morrido — e morreu igual.

**Não mandei a quarta, e o motivo é concreto:** o Gmail reteve e retentou a de
16/09 por ~48h antes de desistir, ou seja a caixa seguiu cheia a janela
inteira. Uma 4ª quicaria igual **e reabriria o #74 e o #101 de novo**. Insistir
por e-mail aqui não avisa o aluno; só suja a fila.

Isso vai como **bloqueio real declarado com data** (ordem de 17/09), não como
"precisa de alguém ver".

## O achado que vale além dele: a casa tem o telefone e não olha lá

Procurando canal alternativo, achei o número do Paulo Cesar em
`payment_events.payload->data->buyer->checkout_phone` — **gravado desde 19/08
14:45Z**, nos dois eventos. `profiles.whatsapp` dele é **NULL**.

A ronda de 16/09 deu *"sem canal"* pra esta família depois de procurar nos
**quatro** lugares que a casa conhece: `profiles.whatsapp`, `sgp_pedidos`,
`entitlements`, `agent_chats`. Os quatro estão certos. `payment_events`
simplesmente não está na lista.

Medido na base inteira, pra não virar caso isolado:

| medida | valor |
|---|---|
| e-mails de comprador com `checkout_phone` gravado | **1.589** |
| perfis com `profiles.whatsapp` preenchido | **101 de 2.761 (3,7%)** |
| endereços com bounce registrado em `emails_enviados` | 9 |
| …desses, com telefone em `payment_events` | **2** |
| …desses, com whatsapp no perfil | **0** |

**Justiça com a ronda de 16/09, porque o achado não a desmente.** Conferi os
outros dois *"sem canal"* dela: `epotentia@gmail.com` e
`leusousavedder@gmail.com` **não têm evento de pagamento nenhum** — não há
telefone a achar, e o veredito dela continua certo. O `betobass27@hotmail.com`
tem (`61993678484`), mas ali não havia nada devido. **O único caso em que a
busca curta custou alguma coisa é este.**

Os outros 7 endereços com bounce são erro de digitação na origem
(`gmail.com.br`, `hotmal.com`, `hotmaim.com`, `hormail.com`, `gmmail.com`) —
outra classe, já coberta pelo `[endereço obsoleto]` do #440/#441.

**Não usei o telefone.** A regra 8 me autoriza e-mail individual, não abrir
canal novo com aluno. Virou pergunta ao Johnny no grupo, com a medição junto.

## O que foi gravado

| cartão | ação | conferência |
|---|---|---|
| **#74** | `open` → **`fixed`**, nota + `resolution_note` concatenada, `resolved_commit f48358c` | 1 linha afetada, relida |
| **#464** | `aguardando_aluno` → **`investigating`** + nota com bloqueio e canal achado | 1 linha afetada, relida |
| **#101** | **status inalterado**, só nota explicando a reabertura colateral | 1 linha afetada, relida |

O #464 saiu de `aguardando_aluno` de propósito: **a bola não está com o aluno.**
Ele nunca recebeu nada pra poder responder. Deixar "aguardando aluno" ali era a
fila mentindo — e é o tipo de silêncio que produziu os 16 dias que a ordem de
17/09 denunciou.

E **não re-fechei o #101**, embora a reabertura dele seja colateral igual à do
#74: o fechamento de 16/09 não é meu, eu não o remedi, e há uma **objeção do
Vigia de 16/09 18:17Z nunca respondida** (o conserto vale pra próxima carta; o
passivo não teve backfill). Carimbar `fixed` por cima de objeção sem medir é
fechar mais rápido do que se resolve — o que a regra 14 proíbe. Fica anotado
qual é a pergunta viva, pra próxima ronda não reinvestigar a reabertura de hoje.

## Contagem da ronda

| medida | valor | instrumento |
|---|---|---|
| chamados abertos | **96** (eram 96; −1 pelo #74 fechado, +1 pelo #464 reclassificado) | `varredura_travados.cjs` |
| aguardando aluno | **32**, 12 com 7d+, mais velho **20d** | idem |
| itens presos | **0** | idem |
| travados em percepção | **0 reais** (1 apontado, falso positivo — abaixo) | `percepcao_travada.cjs` |
| fechado sobre o próprio disparo | 1 (`#407`) | `varredura_travados.cjs` |

### Percepção — o número, com a idade, e por que ele não é zero na tela

O varredor aponta **1 card** (`#438`, parado há **0,0d**). Confirmei **eu
mesmo**, não herdei da ronda das 10hZ: extraí o trecho que casou e ele é
*"Quem pegar precisa olhar `auth.users.created_at` contra a data do pedido"* —
**consulta SQL, não imagem, áudio ou vídeo**. Falso positivo do padrão
`%precisa olhar%`. A classe real segue em **zero**, e isso é a segunda ronda
seguida em que o mesmo card ocupa a linha do relatório.

## O que NÃO fiz

- Não mandei a 4ª carta pro Paulo Cesar (motivo medido acima) e não usei o
  WhatsApp dele — pendente do "pode" do Johnny.
- Não mexi no `reabrirPorBounce` nem abri chamado pra ele. Medição registrada
  no #101.
- Não re-fechei o #101.
- Não toquei em crédito, acesso, migration, voz ou GPU de ninguém. **Zero GPU
  gasta nesta ronda.**
- Continuo sem atacar os **12 `aguardando_aluno` com 7d+** que pedem segunda
  tentativa — dívida das rondas de 02hZ e 10hZ, declarada de novo com número e
  idade em vez de silêncio. E vale o aviso que esta ronda mesma produziu: pelo
  menos parte dessa fila pode não ser aluno calado, e sim **carta que não
  chegou**.

## Faxina de fim de ronda

Achei **três instrumentos de 17/09 sem commit nenhum**, só no disco:
`2026-09-17_conjunto_dhash_81438b60.cjs`, `..._custo_gate_81438b60.cjs`,
`..._medir_tamanho_rosto_81438b60.cjs` (incidente `81438b60`). Conferi que os
três são **somente leitura** (nenhum `update/insert/delete/upsert`) e
**commitei na main junto deste log**.

O motivo é o próprio #74: a nota 1 dele registra que o fix do Vigia
(commit local `c788b40`, branch `agent/fix-ref-quadro-desatualizado`) **sumiu
com o container** e o trabalho se perdeu. Instrumento fora do git é instrumento
que a próxima ronda não tem.

### Conferência de branch — e um 4º STALE da família documentada

`git log --oneline origin/main..HEAD` saiu **VAZIO**: nada meu ficou preso.

Conferindo se não havia fix do #74 pendurado em branch (foi assim que um fix de
aluno ficou 9h preso em 19/08), achei **`fix/trava-foto-nova-8379549c`** — o
sufixo é o id deste cartão. Ele **existe no origin**, tem **2 commits fora da
main** e **nenhum PR**:

```
136c4956 chore(frank): medicao reproduzivel do incidente 8379549c (R2 paginado)
87203148 fix(imagem): trava bloqueante quando foto nova do banco ficou fora da geracao
```

Autor Frank, **21/08 16:49Z** — exatamente a janela em que o `f48358c` do
Claude subiu (nota 4 do cartão, 16:14Z). São **duas tentativas paralelas pro
mesmo defeito**: o aviso + auto-adoção foi pra produção, a **trava bloqueante**
ficou no branch e foi abandonada sem PR.

**Isso não invalida o fechamento** — o que subiu resolveu (24 alunos
destravados, 13 estornados, zero ocorrência nova em 28 dias). Mas o branch soma
**123 linhas** em `image-studio.tsx`, arquivo que a main moveu em **5 commits**
desde a base dele. Mergear hoje derrubaria o que está no ar: é a **mesma
família** do `feat/onedrive-401`, do `feat/fix-image-upload-retry` e das duas da
cura de referência. **Registrei na tabela do `_frank/ordens/README.md`**, que é
onde os outros três já estão — quem for mexer em imagem lê ali antes de abrir o
branch.

Não apaguei o branch no origin: apagar coisa dos outros não é decisão de ronda.
