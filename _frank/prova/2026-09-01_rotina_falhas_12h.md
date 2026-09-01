# Ronda das falhas 01/09 12hZ

Rodada 12:40–13:0xZ (09:40–10:0x BRT). Ronda seguinte à das 11hZ.
Canal: relatório **no grupo** (`notify-grupo.sh`), ordem do Johnny de 31/08.
Nada da planilha foi lido, escrito, classificado ou reprocessado (ordem 29/08).

## 0. O que esta ronda entrega, em uma linha

O **#215 fechado com o fix em produção**: a Fast parou de mandar aluna gravar a
voz numa tela que não tem botão de gravar — defeito que já tinha sido
identificado em 29/08, fechado como *"fora deste chamado"*, e que voltou em 3
dias para cobrar a **segunda aluna pagante**.

---

## 1. A armadilha desta ronda: o trabalho já estava feito, e eu quase refiz

Comecei pelo caminho certo (varredura → escolher o incidente → **card no board
com o `coder`**) e o card estava **errado**: enquanto eu apurava, uma ronda
paralela já tinha aberto o **PR #144** (12:36:36Z) e **escrito para a aluna**
(12:39:08Z). Descobri porque fui conferir Enviados antes de escrever para ela —
não porque o board me avisou.

**Cancelei o card `0bb76a78` antes de o worker rodar.** Se ele tivesse rodado,
teria criado uma **segunda branch para o mesmo defeito por outro caminho** —
exatamente o que as ordens marcam como perigo em `feat/onedrive-401` e
`feat/fix-image-upload-retry`, onde uma branch concorrente derrubaria o fix que
está em produção.

**Método que eu adoto a partir daqui, e ele é barato:** antes de criar card ou
branch para um incidente, rodar `gh pr list --state open` e `git branch -a`
**filtrando pelo número do chamado**. A checagem de fim de ronda de ontem
(§1 do log das 11hZ) já tinha promovido `gh pr list` a passo fixo — o que faltou
foi rodá-la **no começo**, não só no fim. Duplicar trabalho é mais caro que
esquecê-lo: o esquecido só atrasa, o duplicado derruba produção.

---

## 2. O defeito, medido no código antes de eu tocar em qualquer coisa

A aluna Lucila (conta desde 30/07, **100.000 créditos**) perguntou **quatro
vezes** no chat onde apertava para gravar. A Fast — que **recebe o `pathname` em
toda mensagem** e leu `/app/voice-cloning/new` nas quatro — respondeu quatro
vezes para apertar *"Iniciar gravação"* / *"o ícone de microfone na tela onde
você tá"*. Conferido por SQL na conversa inteira: **nenhum desses botões existe
naquela tela.**

| | grava? | endereço | o que tem |
|---|---|---|---|
| menu Vozes → **Gravador** | **sim, única tela** | `/app/voice-cloning/script` | roteiro + iniciar/parar + barra de fala |
| botão "+ Treinar nova voz" | **não** | `/app/voice-cloning/new` | só dropzone + botão "Treinar voz" |

O único `<Mic>` em `/new` é **ícone decorativo** (`voice-creator.tsx:541-542`).

**A causa não estava na tela, estava no manual da Fast.** `manual.ts:152-156`
descrevia as duas telas como uma só — *"menu Vozes → Treinar Voz → grava a
própria voz no gravador guiado do navegador (recomendado) ou envia áudios"*. O
manual inteiro vai no system prompt, então a Fast herdava a fusão e afirmava
*"você já está na tela certa"* contra o `pathname` que ela mesma estava lendo.

### Dois achados que eu acrescentei à apuração

1. **Não existe item "Treinar Voz" no menu Vozes.** Os itens são Gerar Voz,
   Gerar Áudio, **Gravador** e Histórico (`sidebar.tsx:150`). "Treinar Voz" é o
   `h1` da página Gerar Voz. A instrução velha mandava clicar em **duas** coisas
   inexistentes, não uma.
2. **O manual não dizia a duração mínima — e a Fast inventou.** Ela escreveu
   para a aluna: *"você não precisa falar 20-30 minutos não, relaxa! são só
   algumas frases curtas (uns 2-3 minutos)"*. O portão real é
   **20 minutos** (`MIN_DURATION_SECONDS = 20*60`, `voice-creator.tsx:18`;
   recomendado 30, máximo 60). Essa é uma **segunda mentira independente**: mesmo
   se a aluna tivesse achado o gravador, ela pararia aos 3 min e o botão
   continuaria morto. Não estava no chamado; entrou no fix.

---

## 3. O que subiu, e a revisão que eu fiz (não herdei a do PR)

**PR #144**, branch `fix/215-gravador-vs-upload`, commit `0c3496c`, merge
**`7203007`**. Autor: ronda paralela. **Revisor: eu** — e o manual é explícito
que `tsc` verde não é revisão.

O que eu conferi **do zero**, e por que cada coisa:

| verificação | resultado | por que importa |
|---|---|---|
| `Link` é exportado por `@/i18n/navigation`? | **sim** | import errado = tela quebrada |
| o `t()` do CTA é do namespace da chave nova? | **sim** — `useTranslations("app.voiceCloningNew")`, linha 89 | namespace errado = `MISSING_MESSAGE` em runtime |
| `"Gravador"` e `"+ Treinar nova voz"` são os rótulos REAIS? | **sim** (`nav.recorder`, `voiceCloning.createButton`) | o defeito era nome de botão inventado; a correção não podia inventar outro |
| `npx tsc --noEmit` | exit **0** | |
| `npx eslint` nos 3 arquivos | exit **0** (1 warning pré-existente na linha 351, fora dos hunks) | |
| `node --test manual.test.ts` | **6/6 pass** | |
| 3 JSON de locale reparseados + chave presente | **pt-BR / en / es OK** | locale faltando = tela quebrada só para alguns |

As duas primeiras linhas são as que interessam: eram as únicas capazes de
**quebrar a tela em vez de consertá-la**, e nenhuma delas aparece no `tsc`.

### Prova de produção (Action verde não basta)

- deploy run `33509407323` do sha `7203007`: **completed success**;
- no Hetzner, frase nova no fonte (**1**), frase fundida velha (**0**);
- **o texto novo está DENTRO do bundle compilado** `server/chunks/8895.js` — que
  é onde o manual mora — e a frase velha está em **0** bundles;
- `pm2 aiverse` reiniciou **12:47:10Z**, depois do deploy: o processo no ar
  carregou o bundle novo.

O penúltimo item é o que vale, e é específico deste tipo de mudança: `manual.ts`
é **prompt**. Se o texto ficasse só no fonte, a Fast em execução seguiria com o
manual antigo e o deploy verde mentiria.

### ⚠️ Armadilha de medição nova, e ela quase me fez errar

**Grep por string ACENTUADA em bundle minificado dá FALSO NEGATIVO** — o
minificador escapa não-ASCII. Meu primeiro grep por
`"NÃO EXISTE BOTÃO DE GRAVAR NESTA TELA"` voltou **vazio em todos os bundles**, e
a leitura óbvia seria *"o fix não entrou"*. O mesmo trecho casou na hora com
agulha ASCII (`"GRAVAR NESTA TELA"`). A ronda das 11hZ passou por essa checagem
sem cair porque a agulha dela era ASCII **por sorte**, não por método.
**Confira bundle sempre com pedaço ASCII.**

---

## 4. A aluna, e a promessa que este merge cumpre

A Lucila **já tinha sido respondida** por e-mail hoje 12:39:08Z (conferido em
Enviados, uid 407): caminho certo, a culpa assumida como nossa, e os créditos
confirmados intactos. **Não escrevi de novo** — aviso repetido é ruído.

Mas aquele e-mail prometeu, textualmente, *"estamos colocando um atalho pro
Gravador na própria tela onde você estava"*. **O merge de hoje é o que torna
essa frase verdadeira.** Se o PR tivesse ficado aberto mais um dia, teríamos
prometido a uma aluna pagante uma coisa que não existia.

**Dinheiro: nada.** 0 vozes, 0 takes, 0 `training_jobs`; o extrato só tem os dois
`subscription_grant` (30/07 e 07/08). Saldo 100.000 intacto, **nada a estornar**.
Nenhuma migration, nenhuma GPU.

A aluna do `#e05561c5` (29/08) já recebeu o caminho certo no fechamento daquele
chamado; também não reescrevi.

---

## 5. Um defeito meu de canal, achado por desconfiança e consertado

Depois de postar no grupo, **fui conferir se tinha chegado** em vez de acreditar
no `enviado` impresso na tela — porque havia um card aberto justamente sobre o
`notify-grupo.sh` mentir sucesso.

A mensagem chegou. Mas o conserto do worker estava **NÃO COMMITADO na árvore da
`main`** do FrankClaw — solto, a um `git checkout` de sumir, que é **exatamente o
acidente de 31/08**. Salvei em branch `fix/notify-grupo-parse` (`b320909`) e abri
o **PR #3**.

O defeito real que ele consertou é sério para esta rotina: `curl -d` **não faz
URL-encode**, então um `&` no relatório virava separador de campo e **cortava a
mensagem em silêncio**; e recusa de parse do Telegram matava a notícia inteira.
Sob a ordem de canal de 31/08, aviso que não chega ao grupo **não aconteceu**.

Registro a premissa do card que se mostrou **errada**: ele supunha `exit 0` na
recusa, e a guarda `ok:true` já existia e já saía 1. O `exit 0` observado não vem
daquele arquivo — suspeita de `| tail` do chamador ou do `notifyOnDemand`
(`src/scheduler.ts:49`). **Não provado**, então fica como suspeita, não como
achado.

**Fica nomeado e não coberto:** `notify-photo.sh` e `notify-video.sh` têm o
`exit 0` **de verdade** (arquivo faltando sai 0, resposta do curl descartada) e
**não têm variante de grupo** — hoje não existe canal que cumpra a ordem de 31/08
para screenshot.

---

## 6. O que eu NÃO fiz

- **não escrevi a nenhum aluno** — a Lucila já tinha sido respondida 1 min antes
  de eu começar, e nos outros a bola é do aluno ou do Johnny;
- **não fechei nenhum outro incidente** além do #215;
- **não toquei em crédito, acesso ou estorno de ninguém**;
- **não mergeei nada em massa** dos PRs abertos, e não decidi o comercial do
  #173/#202/#212;
- **não gastei GPU nem crédito**, nenhuma migration;
- **não reabri nada da planilha** (ordem 29/08): nenhum incidente dessa origem
  apareceu;
- **não contornei o guard de segurança** que bloqueou meu primeiro card do `qa`
  (o texto juntava referência a credencial + URL externa). Reescrevi o card
  apontando para as ordens onde a credencial está documentada, em vez de rotear
  em volta da trava — mesma decisão registrada no #212 em 11hZ.

---

## 7. Placar: 9 não-fechados (era 10)

O #215 entrou e saiu **na mesma ronda**, em ~25 min do abrir ao fechar. Sobram os
mesmos 9 da ronda anterior, e a leitura **não mudou**:

| # | de quem é a vez |
|---|---|
| #99 | aluno — segunda tentativa marcada para **05/09** (decidido em 11hZ, herdar, não redecidir) |
| #173, #202, #212 | **Johnny** — a mesma pergunta comercial única, ~R$ 5.088 aprovados, 3 pagantes parados |
| #192, #207 | ouvido humano |
| #197, #206, #214 | aluno |

**Quinta ronda seguida com a mesma leitura.** Nenhum está parado por falta de
diagnóstico. A pergunta comercial (*compra de CURSO dá direito a crédito e acesso
dentro do FastCloner?*) segue sendo o gargalo e não destrava com trabalho meu.

## 8. Pendente e nomeado

A **renderização do CTA no navegador não foi vista por ninguém** — o próprio PR
admitiu, e eu não encobri. Está no card `dd891792` com o `qa` (login na conta da
casa, screenshot da tela de upload, clique no CTA, caça a `MISSING_MESSAGE`).
**Fechei o #215 como `fixed` mesmo assim**, porque a *causa* — o manual que fazia
a Fast mentir — está corrigida e **provada no ar**, e a aluna está desbloqueada e
informada. **Se o `qa` achar o CTA quebrado ou chave crua na tela, eu reabro.**

## 9. A lição, e ela não é sobre esta tela

> **"Permanece em aberto como UX, fora deste chamado" não é um destino.**

O `#e05561c5` foi **bem atendido**: a aluna de 29/08 recebeu o caminho certo no
mesmo dia. O que faltou foi a causa, que o próprio fechamento **cravou por
escrito**, ter virado chamado com dono. Ficou fora do chamado, ficou fora da
fila, e **3 dias depois custou a segunda aluna**.

Causa reconhecida no fechamento ou vira chamado com dono, ou volta.
