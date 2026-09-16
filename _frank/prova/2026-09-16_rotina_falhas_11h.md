# Rotina das falhas — 16/09/2026, 11hZ (08h BRT)

Dono da fila (14-A). Li `_frank/ordens/README.md`, a de **20/08** (dono da fila),
a de **21/08** (serial + regra 8), a de **27/08** (só erro de sistema vira
chamado) e a de **29/08** (planilha desligada). **Nada da planilha foi lido,
escrito, classificado ou reprocessado.** Canal: por ordem de **31/08**, o aviso
desta ronda sai **no grupo**, e só no grupo.

Ronda anterior das falhas: **01h40Z**. Entre elas, a ronda do Vigia das **10hZ**.
Abertura desta: **10h11Z**.

Peguei o **`#101`** (`b2651a6f`, 23,6 d). Não é o mais velho da fila — é o mais
velho **onde a bola ainda é nossa**: o `#11` (56,5 d) e o `#15` (47,9 d) seguem
em decisão do Johnny, e o `#99` parou num posicionamento **comercial** que não é
meu (isso está escrito no cartão desde ontem, e continua igual).

Peguei ele por um motivo específico: a nota de 15/09 **deixou a pergunta que
faltava escrita com todas as letras** — *"NÃO conferi se os 17 bounces ORIGINAIS
de agosto chegaram a ser tratados um a um. Essa é a pergunta que falta pra
decidir o fechamento."* Cartão que nomeia o próprio passo pendente é o mais
barato de terminar, e ninguém tinha voltado nele.

**O que esta ronda entrega:** (1) a pergunta de 24 dias **respondida, aluno por
aluno**; (2) um aluno tratado; (3) um defeito **novo** achado, medido, consertado
e **provado em produção**; (4) **duas hipóteses derrubadas** — uma delas minha, de
ontem, que era manchete e era artefato.

---

## 1. A pergunta que faltava: os "17 bounces", um por um

Varri a caixa com `varrer_bounces.mjs --desde 1-Aug-2026` (EXAMINE + `BODY.PEEK`,
nada foi marcado como lido, a fila da Fast não foi tocada).

### 1.1 Antes de auditar, o número não bate — e eu digo isso em vez de escolher

| | |
|---|---|
| o cartão foi aberto dizendo | **17 bounces** |
| relatórios de falha que existem **hoje** na INBOX até 23/08 20:54:31Z | **13** |
| destes, para aluno | **12** |
| destes, só da cópia interna | **1** |
| **pessoas distintas** | **4** |

Os 4 que faltam **não estão na caixa hoje** e eu **não consegui reconstruir** de
onde saíram. Registro como número que não fecha. A alternativa seria auditar 13 e
escrever "os 17 foram tratados" — que é exatamente o tipo de arredondamento que
esta fila existe pra não fazer.

### 1.2 As 4 pessoas

| aluno | bounces | classe | tem conta? | dinheiro | veredito |
|---|---|---|---|---|---|
| `epotentia@gmail.com` (Maurilio) | 8 (22/08) | inexistente | sim, material pronto | **nenhum** | **sem canal** |
| `leusousavedder@gmail.com` (Leu Sousa) | 1 (14/08) | inexistente | sim, material pronto | **nenhum** | **sem canal** |
| `betobass27@hotmail.com` | 1 (07/08) | bloqueio-destino | **não** | compra cancelada 23/07 | nada devido |
| `pc.sul157@gmail.com` (Paulo Cesar) | 2 (23/08) | caixa-cheia | sim | **estorno já feito** | **tratado hoje** (§3) |

**Os dois "inexistente" não são desleixo nosso, e eu chequei antes de dizer
isso.** O diagnóstico cru é o 550 do Google — *"550-5.1.1 The email account that
you tried to reach does not exist"* — nos dois casos. Procurei canal alternativo
nos quatro lugares que existem: `profiles.whatsapp` (nulo), `sgp_pedidos`
(nenhum pedido), `entitlements` por e-mail parecido **e pelo nome dentro do
`raw_event`** (nada), `agent_chats` (sem vínculo). **Nenhuma compra, nenhum
crédito, nenhum dinheiro.** São leads do onboarding antigo com o endereço errado
na origem: não há para onde escrever e não há o que devolver.

O `betobass27` é outra coisa: o 550 é a **Microsoft recusando a nossa saída**
(IP `198.54.127.137`, block list S3150). Não é aluno em silêncio sobre algo
devido — é reputação de saída, e cai na família do `#201`.

---

## 2. 🔴 O defeito novo: a carta que a RONDA escreve é invisível pra casa

Auditando o item acima, esbarrei na outra metade do título deste cartão — *"não
existe registro do que foi enviado"* — e ela **ainda tinha um buraco**, do
tamanho exato do trabalho que esta rotina faz toda noite.

`emails_enviados` só se alimenta de **dentro do `sendSupportMail`**. O
`_frank/ferramentas/enviar_email.cjs` — que é como a **ronda responde aluno**
(regra 8) — fala SMTP na mão e não passa por lá.

### 2.1 A prova, num aluno só, com os dois caminhos lado a lado

`lucianodepinho@gmail.com`:

| o quê | onde está | linha em `emails_enviados` |
|---|---|---|
| 2 mensagens da Fast, 15/09 | app (`sendSupportMail`) | ✅ 2 linhas, `fast-resposta` |
| carta da **ronda**, 16/09 01:55Z | Enviados uid **2494** | ❌ **nenhuma** |

Mesmo aluno, mesma caixa, um caminho registrado e o outro invisível.

### 2.2 O dano não é de escrituração, é de atendimento — e já se materializou

1. `contato-ficha.ts` calcula **TENTATIVAS DE CONTATO** e **PRÓXIMO PASSO** lendo
   essa tabela. Carta da ronda ausente faz a ficha dizer *"ninguém tentou"*
   depois de alguém ter tentado — que é literalmente como nascem as **quatro
   ordens de reenvio** narradas no cabeçalho do `ficha_bounce.cjs`.
2. Se a carta **quicar**, `marcarNaoEntregue` casa por Message-ID, não acha linha
   e devolve `envio-nao-registrado`: **o aluno segue contado como avisado sendo
   que a mensagem voltou.**

**Já aconteceu.** 14/09 19:45Z, Anderson (`andy.silvestre@icloud.com`, assunto
*"4a tentativa"*, caixa-cheia). Desde que a tabela nasceu chegaram **3 bounces** e
**só 2 foram carimbados** — e o não-carimbado é justamente o da ronda.

### 2.3 Consertado, e a prova é em produção — não é ensaio

**PR #311**, branch `feat/registrar-envio-da-ronda`, commit `ea77d4f`.

- `OrigemEnvio` ganha `"ronda-manual"` (dá pra separar na consulta o que a casa
  mandou sozinha do que a ronda escreveu à mão).
- A linha é gravada **depois do envio e ANTES do APPEND**. A ordem é o ponto: o
  bounce do `guitaschetti` voltou **2 minutos** depois do envio, e o APPEND leva
  segundos e pode falhar 3× (`#210`). Linha atrás do APPEND é apostar a prova na
  sorte.
- A linha **não é remontada**: vem do `linhaDoEnvio` do `mail-envio.ts`, o mesmo
  que produção usa (type-stripping do Node 22, como no `ficha_bounce.cjs`).
- **Best-effort, nunca lança.** O e-mail já saiu quando isso roda; virar "FALHOU"
  faria o operador reenviar e o aluno receber duas vezes.

**Conferido NO BANCO depois de gravar**, não na fala do script: a carta do §3
produziu linha com `origem = ronda-manual`, `user_id 3522e128` casado,
`message_id <frank-1789555787727-gqd04tspqvr@fastcloner.com>`, `bounce_em` nulo.
`tsc --noEmit` limpo, 10/10 testes de `mail-envio.test.ts`.

---

## 3. 🟢 Aluno tratado (regra 8 — e-mail individual, decisão minha)

**Paulo Cesar** (`pc.sul157@gmail.com`), enviado **16/09 10:49:49Z**, cópia
confirmada em Enviados (**uid 2499**). Era o único dos 4 com algo real a receber:
as duas mensagens de 23/08 que voltaram avisavam do estorno do `#152`/`8379549c`
(foto que não entrava na geração).

No e-mail: assumi que as mensagens voltaram por caixa cheia e que **não ter
insistido foi falha nossa**; confirmei o estorno **conferido por
`ref_type='image_refund'`** (2 × 525 em 21/08 — **nunca por `kind`**, armadilha de
20/08); e disse que os **66.623 créditos continuam dele** mesmo com a assinatura
encerrada em 26/08 (`REGRA_FINAL_CREDITO`).

Avisei **de antemão** que a tela dizia *"Assine para liberar"* pra quem está na
situação dele e que a mentira era da **tela**, não do saldo — corrigido em
`1acf147`, deploy **SUCCESS 02:28Z de hoje**. Mesma lógica de ontem com o
Luciano: o aluno sabe **antes** de esbarrar.

Não mexi em crédito, não prometi nada sobre assinatura e não empurrei recompra.

---

## 4. Duas hipóteses derrubadas (uma delas minha, de ontem)

### 4.1 "Os dois caminhos de bounce DISCORDAM" — REFUTADA

A nota de 15/09 (minha) levantou que os incidentes carregavam classe boa e a
coluna `bounce_classe` estava `desconhecida` em 2 de 2. **Está errado, e a falha
é de método:** as 2 linhas são **as duas do mesmo `guitaschetti`**, e a varredura
da caixa classifica esse mesmo caso **também** como `desconhecida`. Os caminhos
**concordam**. A nota de ontem comparou 2 linhas de uma pessoa com títulos de
incidente de **outras**.

E no código nem dá pra divergir: `mail-bounce-registro.ts:208` passa `a.classe` do
**mesmo objeto** `planoDoBounce(medido)` que monta o título do chamado
(`abrirChamadoDaAcao`). **Fonte única** — prova estrutural, mais forte que
amostra. Aquele `desconhecida` já tinha dono: era o regex de *"No MX server
found"* do `#402`, **fixed**. **Fio morto, não puxar de novo.**

### 4.2 "O `#379` mostra a classificação errando hoje" — REFUTADA, com 28 minutos

O `#379` (`luctec@gmail.com`) nasceu com classe `desconhecida` e o diagnóstico
cru é *"550 Rejected due to high probability of spam"* — que é **spam-saída**.
Parecia bug vivo. Não é: o bounce chegou **13/09 17:26:52Z** e o commit `3461733`,
que adicionou justamente o padrão `/high probability of spam/i`, é de **13/09
17:54Z** — **28 minutos depois**. O cartão foi classificado pelo código velho;
com o código de hoje o mesmo diagnóstico sai `spam-saida`. **Não abri chamado.**

Anotei isso **no `#379`** com o passo certo da classe (reenviar pelo mesmo
caminho dá o mesmo 550) e o estado do aluno: Lucas Emiliano Brucker, sem acesso,
**0 créditos, nenhuma compra** — duas tentativas de contato, dois motivos
diferentes, zero contato, **e nenhum dinheiro envolvido**. Não fechei e não
inventei canal.

---

## 5. Por que o `#101` segue `investigating`

Porque falta **um passo, e ele é do Johnny: mergear o PR #311.** Enquanto não
entra na main, a ronda seguinte puxa o repositório **sem** o conserto e volta a
escrever pro aluno sem deixar rastro — ou seja, a primeira metade do título ainda
tem buraco em produção. Card verde e PR aberto não são a mesma coisa; **só a main
deploya**, e esta ferramenta roda do repositório.

| o que está de pé | o que falta |
|---|---|
| cópia em Enviados desde 24/08 | **merge do PR #311** |
| bounce vira chamado desde 31/08 (13 fichas) | (e só) |
| os bounces originais, auditados um a um (§1) | |

Fechar hoje seria marcar `fixed` em cima de um PR que não deployou — regra 14.

---

## Fim de ronda

- `#101` (`b2651a6f`): `open` → `investigating`, **21 notas**, `resolution_note`
  2.717 → 4.464 chars. A pergunta de 24 dias está respondida dentro do cartão.
- `#379`: anotado com a classe medida e o próximo passo real. **Não fechei.**
- **PR #311** aberto (`ea77d4f`), base `main`. **Não mergeei** — não é minha alçada.
- **Aluno avisado: 1** (Paulo Cesar, uid 2499 confirmado). **E-mail em massa: nenhum.**
- **Chamado novo aberto: nenhum** — os dois candidatos não sobreviveram à medição (§4).
- **Crédito mexido: nenhum. Assinatura cancelada por mim: nenhuma. GPU gasta:
  nenhuma. Migration aplicada: nenhuma.**
- Números que eu **matei** antes de publicar: "os dois caminhos de bounce
  discordam" (artefato meu, de ontem) e "o `#379` prova a triagem errando hoje"
  (28 minutos de diferença).
- Número que **não bate e eu não escondi**: o cartão diz 17 bounces, a caixa tem
  13 até a abertura dele.
- `#11`, `#15`, `#99`, `#422`: **não toquei.** Seguem em decisão do Johnny; o
  `#15` faz **23 dias** parado numa linha de env.
- Aviso do grupo: enviado por `notify-grupo.sh`, só fato consumado.
