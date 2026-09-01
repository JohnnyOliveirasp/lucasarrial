# Ronda das falhas 01/09 11hZ

Rodada 10:43–11:2xZ (07:43–08:2x BRT). Ronda seguinte à das 02hZ.

## 0. O que esta ronda entrega, em uma linha

Um fix **em produção** que impede a Fast de negar a compra de quem pagou
(PR #141, merge `5b8afad`) — e ele não foi escrito hoje: estava **parado num PR
aberto há 11h**.

---

## 1. O achado que importa mais que o fix: PR aberto também é fix parado

A checagem de fim de ronda que o manual manda fazer é *"não ficou fix preso em
branch"* (`git rev-list main..<branch>`). Ela passou limpo ontem — e mesmo assim
o fix estava fora do ar, porque a armadilha desta vez foi **um degrau adiante**:

| onde o fix estava | a checagem pega? |
|---|---|
| commit num branch sem PR (19/08, custou 9h) | sim |
| commit num branch **com PR aberto e sem merge** (hoje, custou 11h) | **não** |

O commit é de 31/08 19:47 EDT, o PR #141 foi aberto 31/08 23:47Z, `MERGEABLE`,
`CLEAN`, sem review pendente e sem check configurado. Ninguém o mergeou. Não foi
esquecimento num canto escuro: estava na lista de PRs abertos do repositório.

**Mudança de método que eu adoto a partir desta ronda:** o passo fixo de fim de
ronda passa a incluir `gh pr list --state open`. Branch órfão e PR aberto são o
mesmo defeito com roupa diferente — trabalho terminado que não deploya.

---

## 2. O defeito, e por que ele era caro

O manual da Fast (`frontend/src/lib/agent/manual.ts`) mandava ela dizer *"não
estou vendo nenhuma compra nem período de teste na sua conta"* — e **chamava
isso de "a verdade"**.

Não é. O bloco CONTA DO ALUNO lê a **nossa** base (acesso e crédito do
FastCloner) e é **cego** para a compra de CURSO na Hotmart, que é pagamento
único e não assinatura. A Fast estava autorizada a afirmar um negativo que ela
não tem como enxergar.

Dano real e datado, todo em 31/08:

- a Fast escreveu a uma aluna *"você não tem nenhuma cobrança com a gente.
  Nenhuma compra"* — ela havia pago **R$ 185,61** quatro dias antes;
- o aluno do **#173** (Johnathan, **R$ 2.391,00** APPROVED) foi solicitado
  **duas vezes** a provar a compra;
- o **#202** (Vinicius, **R$ 2.697,60** APPROVED) ouviu de nós que *"não existe
  nenhuma compra registrada"*.

### O par que faltava fechar

O **PR #138** (`d4d04c5`) consertou o **instrumento interno** — o
`pagou_de_verdade.cjs` passou a ler `/sales/history`. Ele não tocou no caminho
que **fala com o aluno**. Enquanto só metade estava consertada, a ronda parava
de se enganar e **a Fast continuava negando a compra na cara do pagante**. O
#141 fecha a outra metade.

Correção de registro: a nota do #202 dizia *"PR #138 não está em produção"*, às
31/08 17:48Z. **Ela estava certa quando foi escrita** — o deploy do `c5955f7`
(run `33431799266`) só saiu 31/08 19:39Z, ~2h depois. A nota não errou, venceu.
Hoje `d4d04c5` é ancestral de `origin/main` (`git merge-base --is-ancestor`: sim)
e a leitura de `/sales/history` está no arquivo, linha 101 — conferido no
arquivo, não no commit.

---

## 3. O que mudou no código

Só o manual, **texto de prompt, nenhuma lógica**. A Fast passa a:

- afirmar apenas o que enxerga (*"nenhuma assinatura ativa nem período de
  teste"*), **nunca** negar a compra;
- acreditar no aluno, **não pedir comprovante**, e escalar;
- deixar a afirmação "não pagou" para a única fonte que pode fazê-la —
  `pagou_de_verdade.cjs`, que lê as três fontes.

A regra do trial sem prova ficou **inteira** — o bloco da exceção não foi tocado.
Era a única coisa que não podia sumir junto, porque inventar trial que não houve
faz o aluno cobrar de volta crédito que nunca existiu.

### Verificação minha, do zero

| verificação | resultado |
|---|---|
| `manual.ts` divergiu na main desde o branch point? | **não** — rebase limpo sobre `15cf04a` |
| `npx tsc --noEmit` (projeto inteiro) | exit **0** |
| `npx eslint src/lib/agent/manual.ts` | exit **0** |

### Prova de produção (Action verde não basta)

- PR **#141**, merge **`5b8afad`**;
- deploy run `33499051772` do sha `5b8afad`: **completed success**;
- `BUILD_ID` no Hetzner mudou: `m6fJkGytW3wztNyWda8HV` → **`x8yQF96IYLY76M0LTlgXF`**;
- fonte no servidor: instrução nova presente; frase velha `"nenhuma compra nem"`
  com **0** ocorrências;
- **o texto novo está DENTRO do bundle compilado** `server/chunks/8895.js`, e a
  frase velha está em **0** bundles;
- `pm2`: `aiverse` restartou **1 min** depois do deploy, então o processo no ar
  carregou o bundle novo.

O penúltimo item é o que vale aqui, e é específico deste tipo de mudança:
`manual.ts` é **prompt**. Se o texto ficasse só no fonte e não entrasse no
bundle, a Fast em execução seguiria com o manual antigo e o deploy verde
mentiria.

**Ressalva honesta de método:** não re-derivei nesta ronda os números
6.518 / 528 / 370 que o commit cita. Vêm da medição de 31/08 registrada nele.
São contexto dentro do prompt, não regra de decisão — a instrução operativa
("nunca negue a compra, escale") vale independente da contagem exata.

---

## 4. A fila: 9 não-fechados, e o gargalo é o mesmo há 4 rondas

Peguei os 9 pelo critério serial e conferi **estado atual**, não status herdado.

| # | de quem é a vez | o que apurei hoje |
|---|---|---|
| #99 | aluno (até 05/09) | decisão registrada — ver §5 |
| #173 | **Johnny** | metade técnica **em produção** hoje; comercial aberta |
| #192 | ouvido humano | Robert voltou a gerar 01/09 02:13Z |
| #197 | aluno | perguntado 30/08 |
| #202 | **Johnny** | instrumento **e** manual corrigidos; comercial aberta |
| #206 | aluna | respondida 31/08 |
| #207 | ouvido humano + #212 | medição feita, nada quebrado |
| #212 | **Johnny** | ver §6 |
| #214 | aluna | ainda não entrou; `recovery_sent_at` nulo |

**4 rondas seguidas com a mesma leitura, e ela agora tem nome:** #173, #202 e
#212 são **a mesma pergunta comercial** — *compra de CURSO dá direito a crédito
e acesso dentro do FastCloner?* São ~R$ 5.088 de dinheiro já aprovado, três
pagantes parados. Não é falta de diagnóstico e não destrava com trabalho meu.

Isso foi ao grupo nesta ronda como **uma pergunta só**, não como três chamados —
que é o que estava faltando. Enquanto ia como três casos separados, parecia
backlog; é decisão única.

### Os dois "presos" da varredura já estavam atendidos

Conferi antes de escrever (passo 1 do manual: *já resolveu sozinho?*) e os dois
têm a bola com o aluno — **não escrevi a nenhum dos dois**, aviso repetido é
ruído:

- **Marcelo** (198.950 créditos, 22 dias sem voz): 3 e-mails, o último 29/08
  23:50 confirmando **de ouvido** que o áudio tem duas pessoas. Crédito estornado
  em 10/08, conferido no extrato.
- **Luan** (98.425 créditos, sem voz desde 29/08): e-mail 30/08 01:46 explicando
  que o link do Drive está fechado **e** que o retomar automático foi desligado
  em 29/08 — ele estava seguindo instrução nossa que ficou velha.

---

## 5. #99 — o Vigia pediu decisão do dono da fila, e eu decidi

Ele registrou *"o prazo que a ronda das 21hZ marcou é hoje"*. Fui conferir em vez
de herdar a frase, e **corrijo uma leitura perigosa**: aquilo podia ser lido como
o **acesso** do Luciano vencendo. Não é. Acesso **ativo até 19/09**, 166.035
créditos, voz ready de 31min. O prazo que venceu era o de **revisão**, interno
nosso. Ele não perde nada enquanto espera.

**Decisão: segunda tentativa sim, em 05/09, não hoje.** O relógio que importa é o
da **nossa última palavra**, não o da abertura: a avaliação técnica completa saiu
29/08, faz 3 dias. Cobrar hoje é cobrar quem falou por último.

E **não encerro**: ele parou de usar a plataforma (última geração 25/08, 7 dias).
É o oposto do #192, mesma classe de queixa, comportamento inverso. Pagante que
reclama e some não é caso resolvido, é caso perdido em silêncio.

A data ficou escrita na nota para a próxima ronda **herdar em vez de decidir de
novo** — e o segundo e-mail não é cobrança de resposta: é dizer que a porta
segue aberta, o crédito intacto, e a oferta de refazer por conta da casa de pé.

---

## 6. #212 — uma falha minha, registrada em vez de omitida

O Vigia deixou a objeção certa: o `pagou_de_verdade.cjs` só pergunta à Hotmart
por `buyer_email`, então não enxerga compra feita com **outro** e-mail — e o
Márcio afirma ter comprado o curso.

Tentei fechar essa lacuna consultando `/sales/history` por `buyer_name`. **Não
consegui:** o guard de segurança da máquina bloqueou o script de uso único, por
classificar leitura-de-credencial + chamada externa na mesma execução como
possível exfiltração.

**Não contornei o guard, de propósito.** Dava para escrever o arquivo por outro
caminho e seguir; recusei — rotear em volta de uma trava de segurança para
ganhar um dado de conveniência é exatamente o hábito que não pode existir aqui.
O caminho limpo fica delimitado: acrescentar busca por nome/documento ao próprio
`pagou_de_verdade.cjs`, que já é ferramenta vetada.

O atalho que dispensa isso: **o Johnny tem o painel da Hotmart**. Deixei na nota
do incidente o nome, o documento e a pergunta exata. Nome e documento ficaram
**na nota, não no Telegram** — dado que identifica aluno não vai pro canal
(regra de canal de 20/08).

Assino o que o Vigia assinou e nada além: **no nosso lado não há valor pago a
devolver**. Não assino "nunca pagou" — foi esse erro que custou caro no #173 e
no #202, nos dois casos com o instrumento cego concordando consigo mesmo.

---

## 7. O que eu NÃO fiz

- **não escrevi a nenhum aluno** — nos 9, a bola é do aluno ou do Johnny, e
  e-mail sem fato novo é ruído;
- **não fechei nenhum incidente** — nenhum dos 9 foi resolvido; o #141 fecha a
  metade técnica do #173, não a comercial. Fechar seria `fixed` sem ter
  resolvido (regra 14);
- **não toquei em crédito, acesso ou estorno de ninguém**;
- **não decidi reembolso** no #212 nem liberei nada no #173/#202 — os três são
  decisão comercial do Johnny;
- **não gastei GPU nem crédito**, nenhuma migration;
- **não reabri nada da planilha** (ordem de 29/08): não apareceu incidente novo
  dessa origem nesta ronda.

## 8. Placar de não-fechados: 9 (5 `investigating` + 4 `aguardando_aluno`)

Igual ao da ronda anterior. **A resposta honesta segue a mesma:** 3 dependem de
uma única decisão comercial do Johnny, 2 de ouvido humano, 4 de resposta de
aluno. Nenhum está parado por falta de diagnóstico.

O que mudou hoje não foi o placar — foi que um defeito nosso, que estava **no ar
e ferindo pagante**, saiu do ar.
