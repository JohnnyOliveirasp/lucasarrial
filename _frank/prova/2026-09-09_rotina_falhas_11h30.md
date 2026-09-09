# Rotina das falhas — ronda de 09/09, 11h41–11h55Z

Método serial (regra 8). Todo número abaixo foi medido nesta ronda, com o
instrumento nomeado na linha. Onde o instrumento não reproduziu, está escrito
que não reproduziu — e a conclusão foi retirada junto.

Fila na entrada: **48 abertos** (1 `open` + 47 `investigating`), 12 aguardando
aluno, 4 presos. Na saída: **46**, 12 aguardando aluno. Dois fechados, os dois
com trabalho real atrás.

> Nota de arquivo: o log anterior está salvo como `..._12h.md` e diz no corpo
> "10h30–12h30Z", mas a nota que ele gravou no #226 é de 10:44Z e o commit é
> anterior às 11h41Z. A ronda dele foi ~10h30–11hZ. Nomeei esta de `11h30` pra
> não colidir nem herdar a hora errada.

---

## 1. #318 — FECHADO. O aluno pagou no meio da ronda, e a casa quase não percebeu

Era o item mais quente da fila e não estava na fila: o Vigia reabriu o #318 às
11:25Z, 16 minutos antes desta ronda começar, com o aluno de Portugal pedindo
multibanco. Fui à INBOX e o quadro tinha mudado de novo: **às 11:37Z ele mandou
o comprovativo** — "já consegui fazer pagamento, mas ainda aparece por pagar".

Aluno pagante, com dinheiro já saído da conta, sem acesso e ameaçando cancelar
às 11:29 ("caso contrário cancelo subscrição"). Isso vem antes de qualquer
limpeza de fila, e por isso peguei fora da ordem de idade.

**Já tinha se resolvido sozinho** — o caso (1) do manual, e o mais comum.
Confirmei em três fontes independentes, porque relato de aluno não é prova e
extrato sozinho também não:

| fonte | o que diz |
|---|---|
| comprovativo do banco dele (anexo uid 505) | entidade **50470**, ref **403 458 590**, **22,04 EUR**, OP014971528, executada 09-09 |
| Hotmart viva (`pagou_de_verdade.cjs`) | venda 22,04 EUR **APPROVED** 09/09 **HP3384777202** — a mesma referência do assunto do e-mail dele; assinatura rec#2 19 EUR **APPROVED** (estava OVERDUE) |
| nosso banco (`aluno.cjs`) | **+100.000** créditos `subscription_grant` às **11:38Z**, acesso **ATIVO até 30/09**, saldo 100.261 |

O grant caiu **1 minuto depois** do e-mail dele. Ele escreveu achando que estava
travado, e já não estava.

**O que era nosso e o que não era.** Não emitimos referência multibanco —
`hotmart/subscription.ts` exporta `isConfigured()` e `cancelSubscription()`, e
mais nada. Quem emite é a Hotmart. Nosso foi o aviso de Pix vencido que o mandou
pagar por um meio que **não existe em Portugal** (isso é o #319, abaixo). Ele
pagou apesar de nós, não graças a nós, e escrevi isso a ele com essas palavras.

**Aluno avisado** (Enviados uid **1381**, cópia confirmada), em português
europeu, com os três números acima e a explicação do "ainda aparece por pagar"
(o painel da Hotmart demora a virar depois de multibanco; o pagamento já estava
aceite).

Detalhe que me fez escrever mesmo com a Fast já tendo respondido: às **11:40:13**
ela prometeu que *"a equipa técnica vai verificar e responder"*, e **13 segundos
depois** mandou outra dizendo que estava tudo certo. A segunda estava correta,
mas a primeira criou uma promessa sem dono, a um aluno que falava em cancelar.
Fechei o laço em vez de deixar a promessa no ar.

## 2. #319 — FECHADO, e agora em produção de verdade

Herdei o card com **PR #218 aberto** e a nota certa da ronda anterior: *"PR
aberto não é produção"*.

Antes de mergear, conferi o que a régua nova lê, porque o `temAcesso` depende de
`access_source` e a casa já se queimou com "DDL commitado não é DDL aplicado":
`account.ts:199` usa `.select("*")` e as três colunas (`access_until`,
`pending_payment_at`, `access_source`) **existem no banco de produção**.
Conferido, não presumido.

- merge **`ecf58d9`** na main · deploy `Deploy Frontend (production)` run
  **34347132586** · esperei o **desfecho**: `conclusion=success`.

**Efeito re-medido em produção depois do merge** (não herdei o número de 10h):

| | antes da regra nova | depois |
|---|---|---|
| perfis com a flag | 129 | 129 |
| ditos "PENDENTE, é só pagar" | **129** | 23 (recentes, correto) |
| ditos **JÁ VENCIDO**, com instrução de não mandar pagar | 0 | **101** |
| silêncio (já tem acesso) | 0 | 5 |

**106 de 129 (82%)** deixam de receber instrução errada. Bate com os 82% da
ronda anterior por outro caminho.

**Limite honesto do que provei:** deploy verde e efeito medido sobre dados
reais. **Não** observei ainda uma resposta nova da Fast carregando a linha
corrigida — a próxima ocorrência é que fecha isso empiricamente, e escrevi isso
dentro da `resolution_note` pra ninguém ler o card como mais provado do que está.

## 3. #226 — o instrumento reproduziu, o card não andou, e a culpa é do relógio

A nota anterior deixou plano explícito: rodar a MESMA consulta; se `n>=68` com
zero abaixo do piso, fechar.

Rodei, e ela **reproduziu exatamente**: ANTES 184/76/32/8/4, DEPOIS 59/21/5/0/0.
Instrumento confirmado — e por isso o resto da medição vale.

Só que **DEPOIS continua em 59**: zero entrega nova em ~1h. Em vez de assumir
fila fraca, fui conferir se era **produção parada**, que seria muito pior que
este card. **Não é:** últimas 8h = 7 gerações (2 às 09h, 2 às 07h, 2 às 05h, 1
às 03h), **todas `ready`, zero `failed`**, nada preso.

**Corrijo a ETA da ronda anterior, que era minha e estava otimista.** "9
entregas ≈ 3h" saiu de uma média de 3,2/h medida sobre 18,3h que **incluem o
pico brasileiro da tarde**. Às 11h50Z são 08h50 BRT: o ritmo real agora é ~1/h,
e parte nem entra na população filtrada. **Este card avança por relógio, não por
esforço** — e deixei escrito na nota que só vale re-medir depois das 18hZ, pra
próxima ronda não gastar turno medindo cedo demais.

## 4. #15 — sem ocorrência nova, seguido sem gastar a ronda

`last_seen_at` continua **04/09 20:47Z**. Cinco dias sem ocorrer. Não há o que
instrumentar sem ocorrência; segui, que é o que a regra 8 manda. Não reabri
discussão nem reescrevi nota — o card já tem a dele.

## 5. #265 — corrigi o enquadramento, e desminto uma frase que era nossa

Card com `resolved_commit` gravado e **aberto há 4 dias**. Fui ver se era card
esquecido: **não era**. A metade de código está resolvida e no ar (`warranty_date`
em vez da constante de 7 dias, merge `b4a7a390`, deploy SUCCESS 05/09 22:48Z). O
que segura é **decisão de política do Johnny**: renovação reabre a garantia?

**O que eu NÃO consegui:** reproduzir o instrumento da nota de 07/09. Reconstruí
a lógica de `garantia.ts` em SQL cru e obtive universo **639 / 219 dentro / 420
fora / 50 só-política**, contra **566 / 114 / 409 / 43** da nota. Régua diferente
(a minha conta `buyer_email` sem perfil, e provavelmente todos os produtos).
**Então não afirmo que o balde subiu de 43 para 50.** Número medido com
instrumento que não reproduz não vale — é a mesma disciplina que apliquei no
#226, onde a consulta reproduziu *antes* de eu confiar nela.

**O que eu afirmo, e não depende de régua nenhuma:** a frase *"a decisão decai
sozinha — em 13/09 sobram 3"* está certa sobre **aquelas 43 pessoas** e errada
sobre **a decisão**. Compras pagas por dia (`PURCHASE_APPROVED`, `value>0`):

```
01/09  16 · 02/09  13 · 03/09  15 · 04/09  29 · 05/09  44
06/09  34 · 07/09  43 · 08/09  40 · 09/09  10 (dia em curso)
```

São **15 a 44 pagamentos por dia**, e toda renovação cria compra nova com
`warranty_date` fresco por cima de uma âncora velha — que é exatamente a
condição do balde. **Esperar o relógio não esvazia o problema, só troca as
pessoas dentro dele.**

Isso muda o pedido ao Johnny, e por isso foi ao grupo: não é "decida até 13/09
senão passa", é "isto é política **permanente**, hoje reincidindo sobre uma
população rotativa de algumas dezenas". Um **não** explícito é resposta legítima
e encerra o assunto. O que não serve é seguir sem resposta — porque o
comportamento de hoje já é um "não", tomado por omissão em vez de decisão.

## 6. O aluno que estava dentro deste card e ninguém estava olhando

`marcelopersonalthe32@gmail.com`. Assinante **pagante desde 05/08**, **2 ciclos
cobrados**, 298.950 créditos, acesso até 05/10 — e **até hoje sem uma voz
pronta**. A tentativa de 10/08 falhou por **erro de infraestrutura nosso**.

Conferi antes de escrever, pra não repetir aviso: já tinha recebido **três**
e-mails (27/08, 29/08, 05/09), todos bons e detalhados, e **nunca respondeu** —
e não é mensagem perdida, a fila de não-lidos do INBOX está em **0**.

O que mudou hoje é só o relógio: **o prazo de reembolso da cobrança de 05/09
fecha em 11/09**, depois de amanhã. Mandei um e-mail **curto**, sem repetir nada
do que já foi explicado: o prazo e as duas portas (sair até 11/09, ou gravar 25
a 30 min só ele, sem custo). Cópia confirmada em Enviados uid **1382**.

Defendo o quarto e-mail assim: o custo de mandar é ele ignorar mais um; o custo
de não mandar é ele perder R$ 97 que não voltam, por um problema que começou com
erro nosso.

## 7. O que eu NÃO fiz

Não mexi em crédito, acesso, plano, GPU, migration nem DDL. Não refiz áudio nem
disparei treino (o do Marcelo depende de gravação nova **dele**, e gastar GPU
sem o aluno pedir é proibido). Não toquei em nada da planilha (ordem de 29/08).
Não fechei card sem resolver: #226, #15 e #265 seguem `investigating`, cada um
com o passo que emperra escrito na nota.

Efeitos externos desta ronda: **1 merge em produção**, **2 e-mails a alunos**
(individuais, sobre casos que eu estava tratando — regra 8 de 21/08), **2
incidentes fechados**, **4 avisos no grupo**.

## 8. A fila

Entrou **48**, sai **46**. Os dois que saíram foram resolvidos de verdade: um com
fix em produção e efeito medido, outro com o dinheiro do aluno confirmado em três
fontes e o aluno avisado. Nenhum fechado pra o número cair.
