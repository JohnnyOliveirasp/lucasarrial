# Ronda das falhas — 17/09/2026, ~15hZ (12h BRT)

Dono da fila (14-A). **Fechei um incidente**: o `#434` (`2614845d`), com o
conserto **em produção** (deploy SUCCESS) e a população de vítima **re-medida
por mim**, não herdada da nota anterior.

Ordens lidas antes de tocar em qualquer coisa: `_frank/ordens/README.md`, a de
**29/08** (planilha desligada) e a de **31/08** (canal). **Nada da planilha foi
lido, escrito, classificado ou reprocessado.** Aviso no **grupo**, com
`notify-grupo.sh`.

Patches do Vigia esperando revisão (§1-B, que vem antes do resto): **0**.
Conferido no `agent_state` — a chave do `patch_75c33ee1` foi apagada na ronda
das 14hZ e não voltou.

---

## 1. Qual item peguei, e por que não foi a cabeça da fila

A fila tem **85 abertos**. A regra 8 manda o mais velho **com aluno afetado**.
Conferi hoje, um a um, e os de cima seguem travados em decisão que **não é
minha**:

| cartão | idade | onde trava |
|---|---|---|
| `#15` `d3d8d1b2` | 49,1 d | risco aceito pelo Johnny; só reabre se voltar |
| `#99` `6c38c99d` | 24,9 d | resposta comercial |
| `#226` `702cc916` | 15,9 d | decisão de produto |
| `#234` `f8587cef` | 14,9 d | aval de GPU |
| `#249`/`#250` | 12,9 d | falta o "pode" pra WhatsApp/ligação |
| `#254` `f1ada07e` | 12,8 d | falta a palavra escrita do titular |
| `#263` `5c68eb33` | 12,1 d | falta a definição de R$ 97 |
| `#270` `9d9baab6` | 12,0 d | "pode" pro estorno/lote dos 14 (25.000 cr) |
| `#305` `54c14038` | 11,0 d | causa só por arqueologia; já instrumentado (PR #315) |
| `#288` `df008dcf` | 10,9 d | decisão comercial: devolver ou não o trial de R$0 |
| `#290` `446c3ae4` | 10,7 d | "pode" pro lote dos 8 — **13 dias esperando** |

Peguei o **`#434`** porque ele era o **único cartão em `fixing` da casa
inteira**: conserto escrito, **PR #316 aberto desde 16/09 19:51Z e não mergeado
há 19 horas**.

**Isso não é começar item novo — é terminar o que já estava em voo.** Fix
pronto parado em branch é exatamente a armadilha que custou 9h em 19/08, e a
regra serial que abandona o item em voo pra abrir outro é o oposto de serial.

---

## 2. O "CLEAN" do GitHub não é prova de nada

O PR voltava `mergeable: MERGEABLE`, `mergeStateStatus: CLEAN`. Quase mergeei em
cima disso.

Fui conferir e a **main tinha mexido no mesmo arquivo depois da base do
branch**: `7871f59`, o fix do `#435` ("porta sem chave"), que carimba o
`PARAGRAFO_SENHA` nos três fins de onboarding — o `pronto.ts` inteiro.

`CLEAN` só quer dizer **"sem conflito de texto"**. Não diz se o resultado
compila, nem se as duas mudanças se mordem. Então testei o **estado resultante**,
não o branch: merge de ensaio numa worktree destacada (`/tmp/wt316`), e o que
saiu de lá:

- `PARAGRAFO_SENHA` nas linhas 35 e 50 (o `#435`, intacto)
- `temAssinaturaPlataformaPorEmail` nas linhas 13 e 207 (o `#434`)

São **ortogonais**: uma mexe no **texto** da carta, a outra na **decisão** de
qual carta sai. Convivem. Mas isso eu **soube**, não supus.

---

## 3. Minhas verificações, no estado já mergeado

Não confiei no relato do PR (§1-B passo 4):

| instrumento | resultado |
|---|---|
| `tsc --noEmit` | exit 0 |
| `eslint` nos 2 arquivos | exit 0 |
| `node --test` em `src/lib/payments/*` + `src/lib/onboarding/*` | **327/327** |

O PR declarava 89/89 em 4 arquivos. Eu rodei a suite inteira das duas pastas.
**Instrumento mais largo, mesmo veredito** — que vale mais que um instrumento
confiante.

E a prova que realmente decide, contra **produção viva**: rodei a consulta nova
(mesmos critérios — `product_code` 7851642 + `entitlementValeAcesso`) contra as
**8 linhas reais** dos afetados do `#290`. **TRUE em 8 de 8.** Com este código
no ar, nenhum dos 8 teria recebido a carta "Assine aqui".

Sobre o desenho: a função nova é **byte a byte a mesma consulta** da gêmea que
já está em produção desde o fix `0b672b2` (`temAssinaturaFastclonerAtiva`). É
forma de consulta **já provada no ar**, não invenção nova. E a régua é a
`entitlementValeAcesso` **do próprio gate** — não se copia regra de acesso. Erro
de consulta devolve `false`, que é o comportamento de hoje: nada regride se o
banco falhar.

---

## 4. Em produção, pelas três pontas

Merge **`8e8729a`** na main (PR #316) às 14:48Z → *Deploy Frontend (production)*
run **35236080339 = SUCCESS**.

Conferido **na main e no servidor**, não no PR:

- `merge-base --is-ancestor 7135f29 origin/main` = **SIM**
- `md5sum` no Hetzner bate com `origin/main` nos dois arquivos:
  `pronto.ts` `83e6870b…`, `entitlements.ts` `746502f2…`
- `.next/BUILD_ID` `PhdgajEqzo249sz8O09HF`, mtime **14:50:39Z** (depois do merge)
- `pm2 aiverse` online desde **14:51:39Z** (depois do build)

Sem DDL, então não há coluna pra conferir.

---

## 5. A vítima: re-medida, e por que isso não era formalidade

A nota de 16/09 dizia "zero vítimas" e eu **não herdei o número**. A medição de
lá parou em **23** envios de `onboarding_ok_mas_assine`. Hoje são **26**.

Os **3 novos nasceram dentro das 19h em que o fix ficou parado no branch** — ou
seja, são exatamente os que a nota velha **não podia** cobrir. Se houvesse
vítima, ela estaria aí, e eu teria aluno pra escrever hoje.

| e-mail | carta saiu | veredito |
|---|---|---|
| `jefersonpontes@hotmail.com` | 17/09 09:56Z | nenhum entitlement — carta certa |
| `raimundof1@outlook.com` | 16/09 21:28Z | nenhum entitlement — carta certa |
| `official.successwithnice@gmail.com` | 16/09 20:06Z | tem entitlement, **posterior** à carta |

No terceiro eu **apliquei a lição de instrumento** da nota de 16/09 em vez do
atalho. O `created_at` do entitlement dele é 17/09 08:28Z, e datar por ele daria
"assinou 12h depois", que é a resposta certa **pelo motivo errado**.
`created_at` de entitlement **não serve pra datar o que o aluno sabia**. Datei
pelo `approved_date` + `price.value` da compra: `payment_events` tem dois
eventos — 08/09 10:01:55Z produto **7283229** (SGP) valor 54 APPROVED, e 17/09
08:27:47Z produto **7851642** valor **0** APPROVED, trial, aprovado **12h depois
da carta**.

Ele recebeu a carta e **então** assinou. Mesmo padrão dos 7 medidos em 16/09.

**Zero vítima nova.** Logo, neste cartão, não há aluno a avisar e não há crédito
a devolver — e digo isso como **medição**, não como conveniência de fechamento.

---

## 6. O que este fechamento NÃO conserta

1. **A consulta casa e-mail por igualdade** (`.ilike` sem curinga). O `#306`,
   fechado hoje às 13hZ, provou que isso **perde o alias do Gmail** (ponto no
   nome, `+sufixo`): comprador com `buyer_email` pontuado e conta sem ponto
   continua caindo no "Assine aqui". Não consertei e **não inflei**: o raio está
   medido — a varredura do `#306` achou **UM único par vivo** em toda a base, já
   tratado — e a gêmea que está em produção tem a **mesma** limitação, então
   consertar só aqui criaria divergência entre duas consultas que existem de
   propósito pra dar a **mesma** resposta. Fica declarado, com o número na mão.
2. **A consulta está duplicada.** Deliberado no PR, pra não mexer num conserto
   que já está no ar. A **regra** é única (`entitlementValeAcesso`); o que está
   em dois lugares é a **consulta**. Dívida registrada.
3. **O `#290` não muda de status por causa disto** e segue travado no mesmo
   único passo: o "pode" do Johnny pro e-mail de reparação dos 8, pedido desde
   04/09 — **13 dias**. Não reposto no grupo nesta ronda porque a ronda das 19h40
   de ontem já o fez com os números (R$ 291 em 19-20/09, R$ 485 no total); repetir
   em 19h vira ruído e o Lucas está no canal. Continua de pé.

---

## 7. O que eu NÃO fiz

Não escrevi pra aluno nenhum (não há vítima). Não mexi em crédito, acesso,
entitlement, plano nem assinatura. Não estornei e não cancelei nada. Não gastei
GPU. Não apliquei migration. Não mergeei nenhum branch stale do origin — não
toquei em `feat/onedrive-401`, `feat/fix-image-upload-retry`,
`fix/referencia-fronteira-de-frase-por-palavra` nem
`feat/fabricar-referencia-fronteira-por-palavra`. Não li a caixa do `suporte@`
pra triagem. Não toquei em nada da planilha.

---

## 8. Lição

**"Sem conflito" e "seguro" são coisas diferentes, e a ferramenta só sabe dizer
a primeira.**

O `CLEAN` do GitHub responde uma pergunta sintática: *as duas edições tocam as
mesmas linhas?* A pergunta que importa é semântica: *o que sai do merge ainda
faz o que os dois consertos queriam?* Aqui a resposta foi sim — mas por sorte de
os dois mexerem em camadas diferentes do mesmo arquivo, não porque a ferramenta
tenha verificado. Um branch de 19h já é velho o bastante pra main andar por
baixo dele.

E fecha com a de ontem e a de hoje de manhã, que são a mesma família:

- 14hZ: a guarda respondia a pergunta certa com o **dado errado** ("tenho o
  link" em vez de "existe vídeo").
- 15hZ (esta): eu quase aceitaria a **evidência errada** da pergunta certa
  ("não conflita" em vez de "funciona junto").

Nos dois casos ninguém mente, tudo compila, e o dano mora **na diferença entre a
coisa e a evidência da coisa**. A defesa é sempre a mesma e é barata: quando o
instrumento responder, pergunte **o que exatamente ele mediu** — e se a resposta
não for a sua pergunta, meça você.

Vale pro fechamento também. Eu poderia ter fechado este cartão citando o "zero
vítimas" de 16/09, e o número estaria **certo**. Mas ele tinha sido medido
**antes** das 19h que mais importavam, e um número certo na janela errada é só
outro jeito de não ter olhado.
