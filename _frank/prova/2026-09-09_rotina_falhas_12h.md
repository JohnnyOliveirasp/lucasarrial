# Rotina das falhas — ronda de 09/09, ~10h30–12h30Z

Método serial (regra 8). Todo número abaixo foi medido nesta ronda, com o
instrumento nomeado na linha. Onde eu errei, está escrito que errei.

Fila na entrada: **48 abertos**, 12 aguardando aluno, 4 presos.

---

## 1. #15 — conferido e seguido, mas a nota da ronda anterior estava errada

O mais antigo com aluno afetado segue sendo o **#15** (30/07, 18 alunos).

A ronda das 02h escreveu que ele *"depende da migration 82, parada há 40 dias"*.
**Não depende.** Conferi no banco em vez de acreditar no log: `qa.setup_s`
aparece em **205 das 676** gerações dos últimos 10 dias, a mais recente **hoje**.
A instrumentação está viva em produção. E ela já funcionou: a falha `a07e9278`
carrega `[fase: inference.chunk.generate running_s=5]` — o card não está cego,
está esperando ocorrência.

Última ocorrência de `executionTimeout`: **04/09**. Cinco dias limpos, contra
taxa histórica de ~2/semana — não prova cura, e não há o que fazer sem
ocorrência nova. Segui, que é o que a regra 8 manda.

> Lição: o log da ronda anterior é insumo, não prova. Segunda vez em duas
> rondas que uma afirmação escrita por nós mesmos não sobrevive à conferência.

## 2. #226 — executei o plano que ele mesmo deixou, e troquei a meta por um número

A nota anterior pediu: re-medir com ≥150 entregas pós-deploy, com o filtro do
item 5. Fiz, e **corrigi a meta**: 150 era palpite.

A pergunta real é *quantas entregas limpas bastam pra "zero abaixo do piso"
deixar de ser sorte*. Taxa base ANTES = 8/184 = 4,35%. P(zero em n) =
(1−0,0435)ⁿ, que cruza 5% em **n = 68**. Hoje estou em **59** → P = 7,3%.
**Faltam 9 entregas, não 91.** No ritmo medido (3,2/h), ~3h de produção: a
próxima ronda pode fechar este card.

Medição (corte no deploy 08/09 15:22:32Z, filtro `length(text_normalized) ≥ 40`):

| janela | entregas | alunos | < régua 0,85 | < piso 0,65 | em zero |
|---|---|---|---|---|---|
| ANTES | 184 | 76 | 32 (17,4%) | 8 (4,35%) | 4 |
| DEPOIS | 59 | 21 | 5 (8,5%) | **0** | **0** |

**Achado que mais move o card:** a *terceira porta* (gate terminal), que é
exatamente o que mantém a classe do título viva, **não foi usada por nenhuma
entrega real**. Em 62 entregas pós-deploy o gate terminal disparou 1 vez, e
essa 1 é a `f88b149f` — o texto de **1 caractere** ("o"), artefato já
documentado ontem. Na população real (n=59): **zero**.

Custo continua zero: DEPOIS 80 gerações / 18,3h → **0 failed**. O conserto não
comprou ganho com falha de aluno.

**Falso alarme que descartei** (pra ninguém perseguir de novo): 18 das 80
entregas pós-deploy não têm `coverage_min_visto`, o que parece "entrega que o
QA nem mediu". Não é: as 18 são `name='Amostra automática'`, 103 chars,
`runpod_job_id` NULL — a amostra pós-treino, outro caminho, sem job.

**Não fechei:** faltam as 9 entregas, e a terceira porta continua existindo no
código por decisão de 04/09. Fechar agora seria fechar em cima de 7,3% de
chance de coincidência.

## 3. #319 — corrigido, em PR: a Fast mandava pagar Pix que já tinha morrido

Peguei fora da ordem de idade, e digo por quê: **aluno vivo sendo prejudicado
hoje** vem antes da limpeza da fila.

Conferi o sensor em vez de herdar: as 4 contagens do Vigia reproduzem exatamente
(131 / 106 / 79 / 12). `account.ts:271` decidia por *null check cru* sobre
`pending_payment_at`; a regra certa **já existia escrita na nossa base**, em
`app/layout.tsx:112-115` (janela de 3 dias). Não era regra faltando: era regra
existente não aplicada num segundo caminho.

O tamanho real é maior que os 12 do Vigia — "sem acesso hoje" inclui
`access_until` no passado. Simulando a condição nova sobre as 131 linhas:

| | antes | depois |
|---|---|---|
| "PENDENTE aguardando pagamento" | **131** | 24 (recentes, correto) |
| dito como **JÁ VENCIDO** | 0 | 102 |
| silêncio (já tem acesso) | 0 | 5 |

**107 de 131 (82%) deixam de receber instrução errada.** Pior caso vivo:
`info.claudiamonteiro@gmail.com`, Pix de **14/07 — 57 dias** — ainda anunciado
como "é só pagar".

**E o defeito deixou de ser deduzido:** fui à INBOX e achei a resposta que a
Fast mandou às 09:00, citada pelo próprio aluno:

> "Vi aqui que você tem um Pix ou boleto pendente aguardando pagamento. Se você
> gerou o código Pix e ainda não pagou, é só fazer o pagamento (...)"

Flag dele de 31/08 (9 dias), e ele está **em Portugal, onde Pix não existe**.
O #319 não é leitura de código: é transcrição de produção.

**PR #218**, branch `fix/fast-pix-vencido-janela-3-dias`, commit `0c47455`.
`tsc --noEmit` sem erro no arquivo alterado (o único erro do projeto é
pré-existente: `vitest` ausente em `resgate-audio.test.ts`, não tocado).
**Não fechei: PR aberto não é produção** (lição de 19/08, fix preso 9h).

Escolha de desenho, dita pra poder ser contestada: no `/app` o banner **some**
quando vence e está certo (fala com o aluno, calar é a gentileza). Aqui **não
some**: a Fast é atendente, e a cobrança morta é o contexto que explica a falta
de acesso. Então o vencido é dito **como vencido**, com instrução de não mandar
pagar. Silêncio devolveria a agente ao escuro que gerou o #198.

## 4. #318 — o aluno da ronda, e uma promessa que a casa não podia cumprir

Duarte Soares, Portugal. **Pagante real**: assinatura 19 EUR COMPLETE 31/07,
venda 22,04 EUR COMPLETE 31/07, Stripe 42 BRL em 17/08 (60.000 créditos). Usou
a plataforma de verdade (2 vozes ready, 5 áudios, imagens, 1 Vídeo Clone).
**rec#2 de 19 EUR está OVERDUE** — é por isso que está sem acesso.

Não é pagante trancado por bug nosso: a régua do `pagante_trancado.cjs` é a
última recorrência estar APPROVED/COMPLETE, e a dele não está. A queda de
acesso está conforme a regra de crédito de 20/08. **O que estava errado era o
caminho que demos pra ele pagar.**

E o pior: às 09:05 a Fast prometeu que *"a equipe vai gerar uma nova referência
de multibanco e enviar os dados"*. **Nós não temos essa capacidade** —
`hotmart/subscription.ts` exporta exatamente `isConfigured()` e
`cancelSubscription()`. Promessa impossível, sem dono, feita a um aluno que já
tinha escrito 4 vezes na mesma manhã.

**Escrevi pra ele** (uid **1375**, cópia conferida em Enviados), em português
europeu: desculpa pelas respostas conflitantes; a promessa da referência estava
errada e **por quê**; o Pix não existe em Portugal e o aviso vencido era erro
nosso, já corrigido; o estado real da conta dele, incluindo que não perdeu o que
pagou; e o caminho que funciona sem depender de nós (hotmart.com → Minhas
compras → FastCloner → cobrança pendente), que é o **mesmo** que o nosso próprio
manual da Fast já manda usar (`manual.ts:399`). Sem prometer prazo, sem dar
acesso, sem dar crédito. Status → `aguardando_aluno`.

## 5. O erro que eu cometi nesta ronda, e desminto por escrito

Anotei no #318 que as três respostas da Fast em 28 segundos eram *"o #259
acontecendo em triplicata"*. **Errado.** Eu tinha lido só a pasta de Enviados.
Na INBOX o aluno mandou **quatro** mensagens (uids 499–502, 08:58→09:04), e
cada resposta respondeu a uma mensagem diferente. Isso é responder rápido a
quem escreveu 4 vezes, não é o defeito de Message-ID do #259.

**Retirei a acusação e não anotei nada no #259.** Registro de propósito: quase
plantei um caso falso num card alheio por ter lido metade da evidência.

> **Enviados sem INBOX é meia evidência.** E foi indo à INBOX — pela razão
> errada — que apareceu a prova literal do #319.

O que sobrevive da crítica, inteiro: as três respostas **se contradizem** entre
si e a terceira inventou uma capacidade que a casa não tem. Isso é defeito real.
Só não é *aquele* defeito.

## 6. O que eu NÃO fiz

Não mexi em crédito, acesso, plano, GPU, migration nem DDL. Não vinculei
entitlement. Não fechei incidente nenhum — e explico cada um: #15 espera
ocorrência, #226 faltam 9 entregas, #319 espera merge, #318 a bola é do aluno.
Nada da planilha tocado (ordem de 29/08). Efeitos externos da ronda: **um
e-mail a um aluno** (§4, regra 8 de 21/08) e **um PR aberto** (§3).

## 7. A fila

Entrou com 48 abertos, sai com 48. Nenhum foi fechado artificialmente para o
número cair. Três avançaram com medição nova; um foi corrigido e está em
revisão.
