# Ronda das falhas — 31/08/2026, 15h40–16h30 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**; nenhum incidente de
causa-planilha foi aberto, reaberto ou comentado. Canal: tudo no **grupo**
(`notify-grupo.sh`), conforme a ordem de 31/08.

## Placar

- Fila no início: **10 investigating + 4 aguardando_aluno**.
- Fila no fim: **10 investigating + 4 aguardando_aluno**. Não abri nem fechei
  incidente.
- Fechados como `fixed`: **0**.
- Alunos respondidos: **0** — e nenhum estava esperando resposta minha. Detalhe
  por caso abaixo.
- Fix escrito, **provado** e enviado: **1** (PR #137). **Em produção: 0.**
- Registro resgatado: **1** (o log da ronda das 15h, que nunca tinha sido
  commitado).

---

## O que eu encontrei ao escolher o caso, e que muda a leitura da fila

Rodei a varredura e fui pelo serial. O resultado da triagem é o fato mais
importante desta ronda:

**Dos 10 incidentes abertos, 9 estão travados em coisa que não é minha.**

| # | trava | desde |
|---|---|---|
| #99 Luciano | decisão dos R$ 97 (Johnny) — **vence na virada de hoje** | 23/08 |
| #192 Robert | PR #135 + alguém **ouvir** o timbre | 29/08 |
| #200 Ritmo | merge do PR #132 | 30/08 |
| #201 Bounce | merge do PR #133 | 30/08 |
| #203 Jussara | merge do PR #134 | 30/08 |
| #205/#208 Cristina | decisão comercial (Johnny) | 31/08 |
| #207 Márcio | bola com o aluno (perguntei às 15h25Z) | 31/08 |
| #209 Manual da Fast | merge do PR #136 | 31/08 |
| **#210 Enviados** | **nada — era meu** | 31/08 |

Sobrou exatamente **um** caso acionável, e foi o que eu levei até o fim.

**O número que resume a fila hoje: 20 PRs abertos**, o mais velho de 21/08 (10
dias). Todos os merges recentes são do Johnny — não é atribuição minha e não
estou reclamando de processo. Estou registrando a consequência medida: **a fila
parou de ser limitada por diagnóstico e passou a ser limitada por merge.** Quatro
incidentes (#200, #201, #203, #209) fecham no dia em que subirem, sem nenhum
trabalho novo de investigação.

---

## Caso único — #210: o e-mail sai e não fica registrado

Aberto na ronda anterior com um caminho **anotado, não tentado**. Peguei porque
era o único que não dependia de terceiro, e porque ele corrompe a fonte que a
própria ronda usa para decidir.

### Por que isso não é cosmético (e por que eu topei nele nesta mesma ronda)

A pasta Enviados é a **única fonte** que a ronda seguinte tem para saber se um
aluno já foi respondido. Cópia faltando faz a ronda seguinte ler **silêncio onde
houve resposta**, e então ou escrever de novo (ruído) ou concluir abandono e
refazer trabalho.

Isso não é teoria: **hoje, nesta ronda, eu decidi não escrever para o Marcelo
exatamente com base em `--enviados --para`** (achei 3 e-mails, o último de 29/08
confirmando análise manual do áudio). Se a cópia daquele e-mail tivesse caído no
buraco do #210, eu teria concluído abandono e escrito pela quarta vez a um aluno
já respondido.

É a metade não consertada do `b2651a6f` — que fechou como `fixed` tendo
consertado só o lado da Fast.

### O conserto

Branch `feat/enviados-prova-e-registro-local`, commit `f3f3658`, **PR #137**.

`enviar_email.cjs`:
1. APPEND retentado até **3×**, cada tentativa em **conexão nova** — a falha é de
   conexão, retentar num socket morto não faria sentido.
2. **"APPEND respondeu OK" deixou de contar como gravado.** Confirma por
   `UID SEARCH HEADER "Message-ID"` e só então afirma, devolvendo o uid. O
   `APPEND OK` era literalmente o *"o script planejava fazer"* que a ordem proíbe
   tratar como entrega.
3. A retentativa **procura o Message-ID antes** de gravar de novo: socket que cai
   depois de um APPEND bem-sucedido não deixa o aluno com **duas cópias**.
4. Falhando as 3, grava `_frank/prova/enviados_local.jsonl` e diz onde ficou.
5. Guarda de socket: depois do `DATA` a queda vira erro legível mandando
   **conferir a caixa antes de reenviar**. Antes o socket não tinha listener de
   `error` e a queda derrubaria o processo do meio do envio.

`ler_caixa.cjs`: `--enviados` lê o registro local junto, **inclusive no caminho
"nada encontrado"** — que é onde a ausência seria lida como abandono. Registro
que ninguém lê não conserta nada, por isso a leitura mora do lado da consulta.

### O que eu deliberadamente NÃO fiz

**Não criei retentativa do ENVIO.** Queda depois do `DATA` é ambígua: repetir
entregaria o mesmo e-mail **duas vezes** ao aluno. Falhar alto e deixar gente
decidir é mais barato que dobrar a mensagem.

### Medido, não ensaiado

Quatro envios **reais** (todos para caixa nossa, nenhum para aluno):

- Busca por Message-ID acha a mensagem certa (uid 381) **e** id inexistente volta
  vazio. As duas pontas de propósito: busca que sempre "acha" faria a retentativa
  **nunca** gravar — eu trocaria um defeito por outro e o teste diria "passou".
- Envios confirmados: uid **382**, **383**, **384**, **385**.
- **O envio do uid 384 reproduziu o defeito ao vivo:** tentativa 1 deu
  `IMAP timeout`, idêntico ao da Cristina; a retentativa gravou. **Sem este fix
  esse envio teria sumido do registro.** O defeito deixou de ser inferido de dois
  logs de ontem — ele aconteceu na minha frente e foi contido.

Teste em `_Bugs/210_prova_search_messageid.cjs` (fora do git, uso único).

### Fato novo que eu não procurava

**1 `ECONNRESET` no connect do SMTP em 4 conexões.** É falha **segura** — rejeita
na promise do connect, nada foi enviado, o script sai não-zero — mas mede a
instabilidade do servidor de e-mail em **~1 em 4 hoje**. Não é o mesmo defeito
do #210 e **não juntei os dois numa causa comum**: cravar causa errada por
semelhança já aconteceu duas vezes neste repo. Fica como medição, não como
diagnóstico.

### Status: `investigating`, não `fixed`

PR aberto não é produção (regra 14). Enquanto o #137 não mergear, todo e-mail que
a ronda mandar continua podendo sumir do registro.

---

## Achado fora do caso: o log da ronda das 15h nunca foi commitado

Descobri por acaso, num `git status` feito para outro fim: o arquivo
`_frank/prova/2026-08-31_rotina_falhas_15h.md` estava **untracked**.

O próprio log terminava dizendo *"Este log vai direto na `main`, como manda a
ordem"*. O commit nunca saiu. O registro existia **só no disco desta máquina** —
em clone novo ele simplesmente não existe, e a ronda seguinte não teria como
saber que ele existiu.

É o mesmo padrão do `2026-08-19_done_falso.md`: **afirmar a ação no texto sem
conferir que ela aconteceu.** E é ruim de um jeito específico — registro sem
commit é pior que registro nenhum, porque quem escreveu acha que documentou.

Resgatado em `a6ade54`, conteúdo preservado exatamente como estava, sem edição.

**Para quem pegar a próxima ronda:** o passo fixo de fim de ronda confere
`origin/main..HEAD` (commit que não subiu) mas **não confere arquivo que nunca
entrou no índice**. Um `git status --short` no `_frank/prova/` fecha esse buraco e
custa nada. Não transformei isso em incidente — não é erro de sistema pelo teste
de bolso da ordem de 27/08; é disciplina de ronda, e o lugar dela é aqui.

---

## Por que não peguei os outros

Conferi cada um em vez de herdar a leitura da ronda anterior:

- **#99 Luciano** — **vence hoje na virada.** Ele já tem o prazo certo por
  escrito (Enviados uid 365) e o caminho que não depende de nós (Hotmart direto).
  Não repeti a 12ª cópia da mesma pergunta.
- **#205/#208 Cristina** — segue na decisão comercial. O compromisso datado da
  ronda anterior (se não vier decisão até a manhã de 01/09, escrever a ela mesmo
  assim com a verdade completa) **continua de pé e não venceu ainda**. Não
  antecipei: um quarto texto nosso hoje, sem trazer a resposta, é enrolação com
  cara de atendimento.
- **#207 Márcio** — perguntei às 15h25Z qual dos cinco defeitos é. Sem resposta
  dele, retreinar com o mesmo material bom devolve o mesmo resultado e queima GPU
  sem causa nomeada.
- **#192, #200, #201, #203, #209** — merge/decisão, nenhum passo meu.
- **#196, #197, #202, #206** — `aguardando_aluno`, nenhum com 7d+ de silêncio.

## Presos na varredura: os dois estão certos, conferido na fonte

- **marcelopersonalthe32@gmail.com** (21 dias sem voz, acesso até 05/09):
  **não é abandono.** Três e-mails nossos, o último em 29/08 23h50 confirmando
  que ouvimos a gravação em 8 pontos — são mesmo duas pessoas no arquivo. Bola
  com ele. Crédito estornado e íntegro (198.950).
- **luanmarcal.com@gmail.com** (import quebrou em 29/08, arquivo não público no
  Drive): **não toquei, de propósito.** É erro de entrada do usuário e o caminho
  de onboarding por Drive está no perímetro da ordem de 29/08. Não abri
  incidente, não reprocessei, não classifiquei. Deixo o fato visível aqui, que é
  o lugar dele.

## Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` conferido, e **desta
vez também `git status --short`** — foi ele que achou o log órfão. Código em
`feat/enviados-prova-e-registro-local` (PR #137); nada de fix preso em branch sem
PR. Este log e o resgate do log das 15h vão direto na `main`.

## Precisa de gente (nesta ordem)

1. **#99 Luciano — VENCE HOJE, na virada.** Devolver ou segurar os R$ 97. Última
   janela; depois de hoje a resposta é "não dá mais", e ele foi avisado disso por
   escrito.
2. **#205/#208 Cristina — SIM ou NÃO** nos 100.000 de cortesia. Se não vier,
   a ronda da manhã escreve a ela assim mesmo (compromisso já gravado no
   incidente).
3. **Os 20 PRs abertos.** Este é o item que mudou de tamanho: #132, #133, #134 e
   #136 fecham **quatro** incidentes no dia em que subirem, sem investigação
   nova. O #137 protege a própria capacidade da ronda de saber quem já foi
   respondido. Nenhum deles tem migration; nenhum toca crédito.
4. **#135** — decisão binária (a recomendação registrada é só o bucket
   reverte-protegida).
5. **#192** — alguém **ouvir** o timbre.
6. **Os 117** — decisão de comunicação do onboarding. O #209 conserta a Fast, não
   conserta a régua de e-mails.
