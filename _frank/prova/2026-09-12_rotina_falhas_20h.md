# Ronda das falhas — 12/09/2026, 20hZ

Dono da fila: Frank (regra 14-A). Metodo serial (regra 8, ordem de 21/08):
peguei UM incidente e levei ate o fim antes de qualquer outra coisa.

## Estado da fila na entrada

`varredura_travados.cjs`: **79 incidentes abertos**, 9 aguardando aluno, 1 item
preso, 0 fechado sem retorno humano. Lista de estorno em dia (13 devolucao / 13
nao-devolucao, 3153 linhas varridas, nada por classificar).

## ACHADO DE ENTRADA: fix pronto, escrito, e fora de producao

A arvore da **main estava suja**, com 8 arquivos modificados e 2 rotas novas nao
commitadas — trabalho de SGP solto desde 12/09 13:50Z, atravessando as rondas das
15h, 17h, 18h e 19h sem ninguem subir nem registrar. E a mesma classe do fix que
ficou 9h preso em branch em 19/08, so que pior: aqui nao havia nem branch.

Junto disso, o **PR #250 estava ABERTO desde 14:35Z** com o conserto do #365
pronto e testado. O Vigia ja tinha anotado as 16hZ: *"ABERTO, NAO MERGEADO -> os
expostos seguem expostos"*. Passaram mais 3h35 e tres rondas.

## O incidente que levei ate o fim: #365

**O defeito** (provado, arquivo:linha): `enviarCodigo`, em
`frontend/src/lib/sgp/codigo.ts:29-34`, montava o corpo do e-mail com *"Digite
ele na tela pra continuar"* e **nenhuma URL**. Quem fechasse a aba ou lesse no
celular ficava com um codigo de 6 digitos e nenhum caminho de volta. O proprio
comentario no topo do arquivo registrava que o template do Supabase mandava um
LINK — na troca por codigo proprio, o link saiu e nada entrou no lugar.

**O gatilho real**, medido pelo Vigia: Angela Cleomar respondeu ao proprio e-mail
do codigo, 11/09 20:32:01Z, com duas palavras — *"Qual tela??"*.

### O que eu fiz

1. **Revisei o PR #250 antes de mergear** (nao mergeei no escuro): diff lido,
   `codigo.test.ts` novo com 132 linhas, **8/8 testes passam** rodados por mim no
   worktree. O caso (3) do teste trava justamente o fallback — que e o que impede
   o #365 de voltar. Merge limpo conferido contra `origin/main`; a main nunca
   tocou `codigo.ts` desde que o branch saiu. Assinatura de `enviarCodigo` ganhou
   4o parametro **opcional** (canal injetavel pro teste): unico chamador,
   `inicio/route.ts:59`, nao muda.
2. **Merge `97b910b`**; deploy *Frontend (production)* run **34715017158
   SUCCESS**, 19:46Z, 2m40s.
3. **Conferi o destino**, porque deploy verde nao prova nada sozinho:
   `https://fastcloner.com/sgp` responde **HTTP 200**. O fallback
   `https://fastcloner.com` e a mesma convencao do `siteUrl()` em
   `sgp-boas-vindas-canal.ts`, nao invencao minha.

### A correcao do numero: eram 9, sao 7

O cartao anunciava **9 expostos**. Medi de novo: das 9 linhas com `codigo_hash`
preenchido e `email_verificado_at` nulo, **duas sao da propria casa** —
`frank-teste-enviado@fastcloner.invalid` e `frank-teste-novo@fastcloner.invalid`,
criadas 09/09 21:43, dominio `.invalid`. Linha de teste contada como aluno
exposto inflou o cartao em 2. Mesma classe de erro que a ordem de 20/08 mandou
parar de cometer, e por isso a correcao esta na `resolution_note`, nao so aqui.

**Dos 7 reais, desfecho um a um:**

| Quem | Situacao medida |
|---|---|
| otnielbarbosa@, souzaprado@, contato@luzadvogado.com | **Nao estavam travados** — passaram sozinhos num pedido POSTERIOR que saiu de `dados` |
| maiaroberto682@ | Ja respondido em 10/09 23:53Z (Enviados uid 1688, conferido por mim) |
| eduardo.newton@uol.com.br | **PAGANTE**, parado 150,9h → avisado nesta ronda, **uid 2002** |
| maxalax6629@ (Marcia, R$ 849,45) | **PAGANTE**, parado 46,0h → avisado nesta ronda, **uid 2003** |
| walter_rapuano@ (Walter, R$ 794) | **PAGANTE**, parado 23,7h, sem perfil → avisado nesta ronda, **uid 2004** |

Os 4 restantes sao **todos pagantes**, conferidos no `pagou_de_verdade.cjs`. Os 3
sem contato receberam e-mail individual com o passo a passo e o link; as 3 copias
em Enviados voltaram **CONFIRMADAS**.

### O que eu NAO afirmo

Segue valendo o limite da nota de abertura: **o defeito no arquivo estava provado,
a causa dos parados nao**. Nenhum dos 4 tem `codigo_tentativas > 1` (Eduardo tem
1, os outros 0) — entao **nao ha prova de que a tela recusou ninguem**. O que esta
medido e que o codigo venceu (15 min) e eles nao voltaram. Correlacao, nao causa.
Nao toquei em credito e nao afirmo nada sobre cobranca.

**Fica aberto, fora deste cartao:** os 3 avisados aparecem com *"compras:
NENHUMA"* no nosso banco apesar de pagos na Hotmart viva, e o `walter_rapuano`
nao tem perfil nenhum. Isso e a classe do **#312/#282** (compra orfa fora da
reconciliacao). Nao misturei e nao fechei nada por tabela.

## Segundo cartao: #326 → `ignored`

Premissa nao confirmada. A queixa (*"e-mail ja cadastrado bloqueia a tela 1"*)
nunca foi reproduzida, e os dois casos que deram nome ao cartao ja estavam
medidos por outros: welrisson **concluiu sozinho** (pedido `a38ed55e`, voz
treinada 09/09 23:03Z, 4 min depois de chegar na tela) e maiaroberto **nao foi
recusado** (`codigo_tentativas = 0`; o codigo venceu). Fechei porque manter
aberto um cartao com premissa medida-e-nao-confirmada suja o placar — nao porque
consertei algo nele.

## Achado latente registrado (sem cartao novo)

`lib/sgp/retomada.ts` esta na main desde 11/09 **como codigo morto**: exporta
`linkDeRetomada()`, que monta a URL `/api/v1/sgp/retomar` — e **essa rota nao
existe na main** (conferido com `git ls-tree` em `origin/main`). Ninguem chama o
modulo em producao, entao **hoje nao ha vitima**; mas se o suporte usar essa
funcao pra mandar link a aluno, o aluno recebe **404**.

**Nao abri cartao**: nao houve ocorrencia, e a ordem de 27/08 manda nao abrir
chamado sem erro de sistema acontecido. Registrado na nota do #326.

## O WIP que estava solto: preservado, nao subido

Commit **`76c01ca`**, branch **`wip/sgp-retomada-por-email-NAO-MERGEAR`**
(pushado). Contem exatamente o que falta pro codigo morto acima: a rota
`/api/v1/sgp/retomar`, a rota de admin pro suporte pegar o link, retomada do
pedido **pelo e-mail** na tela 1, destino do wizard vindo do **status** em vez de
fixo em `/sgp/foto`, e o `.limit(1)` no lugar do `.maybeSingle()` — que dava
**erro** (e portanto "nao tem conta") justamente pra quem tem dois perfis no mesmo
e-mail.

**Por que nao subiu:** nao e o defeito do #365; a premissa que o originou (#326)
foi medida e nao se confirmou; e **nao rodei build, typecheck nem teste nisso**, e
nao ha teste novo junto. Preservei em branch porque trabalho solto na arvore sume
no primeiro commit distraido — mas nao subo codigo que nao verifiquei so porque
ja estava escrito.

## Fechamento

- **#365** → `fixed`, commit `97b910b`, em producao, 3 pagantes avisados.
- **#326** → `ignored`, premissa nao confirmada, os dois casos atendidos.
- Fila: 79 → **77** abertos.
- Arvore da main: **limpa**.
