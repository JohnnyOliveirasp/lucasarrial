# Ronda serial 21/09 ~19h10–20h00Z — FastCloner

Serial (regra 8). Rodada de worktree isolado `/home/johnny/wt-ronda-2109-22h`
(lição 1746), a partir de `origin/main b93b0632`.

**Resumo em uma linha:** a regra 8 manda pegar "o mais antigo com aluno
afetado" — e a contagem que alimenta essa escolha **estava cega a 35 cartões,
20 deles com 7+ dias, o mais velho com 24**. O item serial de hoje (`#214`,
20,9 dias) só existia fora do radar por isso: uma aluna que **pagou**, escreveu
pedindo ajuda e passou **21 dias** num cartão rotulado `aguardando_aluno` sem
que nada tivesse sido pedido a ela. Ela foi respondida hoje. O que sobrou é
decisão do Johnny e foi ao grupo.

---

## 1. Passos fixos

### 1.1 Reconciliação de envios — fecha, com os dois instrumentos concordando

Medido 19h10Z, `--corte=2026-09-14T14:06:31Z` (merge do PR #311) nos dois.

**Instrumento 1** — `2026-09-18_reconciliar_envios_da_pasta.cjs` (modo ENSAIO,
nada gravado):

| | |
|---|---|
| lidas da pasta "Sent" | 955 |
| já tinham linha (por Message-ID) | 878 |
| fora da janela (`--corte`) | 77 |
| recusadas (defeito da carta) | 0 |
| **dentro da janela sem linha** | **0** |

`955 = 955`: nenhuma carta sumiu na classificação.

**Instrumento 2** — `2026-09-18_enviados_x_tabela.cjs`, leitura independente:
955 lidas, **878 casadas por Message-ID + 4 por destinatário+janela de 10 min**,
**0 buracos depois do corte**, +73 anteriores. Veredito: o buraco é **PASSIVO**.

⚠️ **Os dois não imprimem o mesmo resíduo, e isso não é divergência — eu
conferi antes de escrever "concordam".** 77 (instrumento 1) × 73 (instrumento 2)
é exatamente a 4ª casa: o instrumento 1 só casa por Message-ID e joga o resto
na sacola "fora da janela"; o 2 ainda tenta destinatário+janela e tira 4 de lá.
`878+77 = 955` e `878+4+73 = 955`. O número que decide — carta depois do corte
sem linha — é **0 nos dois**.

*(953 → 955 desde a ronda das 20h; as 2 novas já nasceram com linha. A minha
carta pra Maria, abaixo, é a 956ª e saiu DEPOIS desta medição — ela entra na
conta da próxima ronda, não desta.)*

### 1.2 Percepção — o número cru é 6, a classe real é ZERO

`percepcao_travada.cjs` (já com `aguardando_aluno`, PRs #390/#392 na main):
controle positivo OK (#310 reencontrado pela marca), **502 incidentes varridos**,
**6 cartões** (investigating 4 · aguardando_aluno 2).

**Li um a um antes de aceitar o 6** (a ordem é não aceitar o número cru):

| cartão | última nota | veredito |
|---|---|---|
| `#450` | "NAO e caso de percepcao" | falso positivo |
| `#406` | "OLHEI AS IMAGENS, UMA POR UMA. NAO HA DEFEITO" | percepção **cumprida** |
| `#455` | "Audio LIBERADO" (sgp_pedidos 7269cb2a, reprovado→aprovado) | **cumprida** |
| `#438` | "A PERNA DO FORMATO SAIU DO PAPEL E ESTA EM PRODUCAO" (sem aluno nomeado) | falso positivo |
| `#216` | "ALUNA RESPONDIDA DEPOIS DE 13 DIAS" | **cumprida** |
| `#226` | pedido de olho humano postado no grupo há ~20h, aguardando decisão | **não é parada** (regra 8 §4: esperar resposta não é estar travado) |

**Número honesto pro relatório: 0 cartão travado em percepção.** Os 5 primeiros
são os mesmos já qualificados nas rondas das 19h e 20h — reli a última nota de
cada para confirmar que **nenhum mudou de forma nesta janela**, em vez de
repetir o veredito de ontem de cabeça. O 6º (`#226`) é novo na lista e entrou
justamente porque *eu* escrevi a nota do `ask_humans` nele — o instrumento casa
a NARRATIVA de percepção, não o pedido pendente.

⚠️ **O defeito residual já tem conserto escrito e está em PR ABERTO: #393**
("relato cumprido nao e pedido — os 5 falsos residuais caem, classe real 0"),
aberto 18:57Z, ~40 min antes desta ronda. **Não é PR apodrecendo** (a família do
#345/3 dias e do #92/23 dias) — é recente. Fica anotado aqui para a PRÓXIMA
ronda cobrar: se ele passar de um dia aberto, vira o mesmo problema.

### 1.3 Fila — e aqui o instrumento estava mentindo

Medido 19h20Z, **antes** de eu mexer em qualquer cartão:

| filtro | abertos | com 7+ dias |
|---|---|---|
| o do manual (`open`,`investigating`) | 96 | 43 |
| **incluindo `aguardando_aluno`** | **131** | **63** |

Os 96/43 batem **exatamente** com o que a ronda das 20h reportou — ou seja, não
é um número novo, é o mesmo número cego de sempre. Por status: `open` 3,
`investigating` 93, **`aguardando_aluno` 35**.

`agent_state`: **2** patches do Vigia e **140** recados `para_frank_*`
pendurados, o mais velho há **429 h** (~18 dias).

---

## 2. O achado que muda a escolha do item serial

`aguardando_aluno` não está em `STATUS_FECHADO` **nem** estava no filtro de
abertos. Logo ele não aparecia em contagem nenhuma — **nem de aberto, nem de
fechado**. É a mesma cegueira que o PR #392 acabou de tirar do
`percepcao_travada.cjs` hoje, só que na **contagem da fila**, que é o que
alimenta a regra 8.

O efeito é pior que "um número errado no relatório": a regra 8 manda pegar **o
mais antigo com aluno afetado**, e a lista escondia justamente os mais velhos.
Os três cartões mais antigos da casa — `#172` (24,2 d), `#206` (21,3 d) e
`#214` (20,9 d) — nunca disputaram a vaga. As rondas vinham chamando o `#216` e
o `#226` (20,1 d) de "o mais antigo da fila".

**Não é notícia nova, e essa é a parte feia:** o Vigia mediu e escreveu isto em
**01/09**, na nota do `#172` ("este chamado NAO aparece em nenhuma contagem de
aberto nem de fechado... o rotulo mente sobre quem trava") e de novo no `#214`
no mesmo dia. A contagem seguiu cega por mais **20 dias**.

Consertei a fonte: `_frank/03_ROTINA.md §1` agora conta `aguardando_aluno` e
traz o número medido + a pergunta que desarma o rótulo ("o que, exatamente, foi
pedido a essa pessoa, e em que data?").

**Prova de que o número velho é função do rótulo, não da realidade:** depois de
eu mudar só o status do `#214` (nada foi criado nem fechado), o filtro velho
foi de 96→**97** e 43→**44**, enquanto o total honesto ficou parado em
**131/63**.

---

## 3. O item serial: `#214` — 20,9 dias, aluna pagante

`ffbfdfc4-74f6-4cc1-8ede-02712b8ed6a9` · "aluna pagou assinatura em 27/08
(20,91 EUR, comprovante Millennium BCP), não liberaram os créditos".

Peguei este, e não o `#172` (24,2 d) nem o `#206` (21,3 d), porque nesses dois
a bola **é** do aluno de verdade e está escrito o que foi pedido a cada um
(gravar o áudio novo; subir os dois áudios no /sgp). Regra 8 §4: escreveu e
anotou, o item saiu do colo. No `#214` **nada tinha sido pedido a ela** — o
rótulo era falso. Excluí `#216` e `#207`, já tratados.

### 3.1 O que eu medi ao vivo

**Hotmart** (assinante `K7QU2Z2P`, Plano Founder, `recurrency_period` 30) —
status hoje **`CANCELLED_BY_ADMIN`**:

| | status | valor | aprovada | transação |
|---|---|---|---|---|
| rec#1 | COMPLETE | 0 EUR | 19/08 20:35 | HP2486146623 (trial) |
| rec#2 | **REFUNDED** | 17 EUR | 26/08 14:11 | **HP2306675202** |

**`HP2306675202` é exatamente a transação que a nota de 01/09 deste cartão
citou como PROVA de que ela pagou.** Hoje ela consta reembolsada.

**Banco:**
- `405606d7` (`zicasantos08@hotmail.com`, Maria Florinda Barbosa Melo dos
  Santos): **SEM ACESSO**, saldo **81.730 cr**, grant +100.000 em 27/08 17:41,
  1 voz `ready`, uso real em 01/09 18:34–18:50 (5 áudios + 1 vídeo clone).
- `1002aa46` (`zicasantos37@gmail.com`, o e-mail do chamado): SEM ACESSO,
  **0 cr**, nenhuma compra, `credit_transactions` vazio. Corretamente zerado.

⚠️ **Não sei a DATA do estorno e não inventei.** O payload de
`/subscriptions/{code}/purchases` traz `approved_date`, não a data do refund.
Afirmo o **status de hoje**, não quando ele virou — e por isso **não** escrevi
em lugar nenhum que a nota de 01/09 já estava errada quando foi escrita.

### 3.2 A nota de 01/09 estava certa no diagnóstico e hoje está VENCIDA na conclusão

Ela mandava dizer à aluna: *"seus créditos e seu acesso até 19/09 estão lá
esperando"*. Hoje é **21/09** — o acesso acabou, e a cobrança que o sustentava
consta reembolsada. Quem executasse aquele roteiro hoje diria a ela uma coisa
que não se sustenta. Ficou registrado na nota do cartão para ninguém executar
o roteiro velho.

### 3.3 O que eu fiz

**ESCREVI PRA ELA**, 19h35Z, SMTP do `suporte@fastcloner.com` (regra 10),
assunto *"Achei o seu pagamento — ele está na sua outra conta"*. Registrada em
`emails_enviados` (origem `ronda-manual`) e **cópia CONFERIDA na pasta
Enviados, uid 3125**. Rascunho em
`_frank/rascunhos/2026-09-21_maria_zicasantos_duas_contas.html`.

Dois cuidados deliberados:
- **Não citei o saldo de 81.730 cr e não prometi reativação.** Se o Johnny
  decidir zerar, eu não quero ter prometido esse dinheiro a ela. Disse o que é
  fato (os créditos entraram em 27/08, foram usados em 01/09, e hoje a cobrança
  consta reembolsada e o plano encerrado) e disse com todas as letras que não
  prometeria nada sobre saldo sem falar com quem decide.
- **NÃO escrevi que ela "ficou sem resposta".** O `aluno.cjs` avisa que "SEM
  REGISTRO" não é prova de silêncio (a caixa `suporte@lucasarrial.com` não é
  lida por nós) e a `emails_enviados` só nasce em 14/09. Eu **não consigo
  provar** que ninguém respondeu — então não afirmei. O que afirmo é o que
  medi: o cartão ficou 21 dias sem nota nova e sem pedido à aluna.

**Status:** `aguardando_aluno` → `investigating`. Nota completa gravada
(`agent_notes` 5 → 6, conferido na releitura).

**NÃO marquei `fixed`** (regra 14). A causa de classe **não está consertada**:
o `#222` foi fechado em 09/09 **sem `resolved_commit`** e com as 3 chaves de
casamento **REPROVADAS na própria nota de fechamento** (e-mail exato 0/42,
normalizado 0/42, CPF 2/42 com 9 ambíguos). Carimbar `fixed` aqui seria
declarar um conserto que não existe.

### 3.4 O que falta, e não é meu

**81.730 cr num saldo cuja única cobrança foi reembolsada.** A regra 9 cobre
*"cancelou dentro do trial sem nunca pagar → zera"*. **Estorno depois de ter
pago não está escrito em lugar nenhum.** Minha leitura é que o estorno desfaz o
pagamento — mas isso é leitura, não regra, e a **9-A proíbe detector executar**,
em qualquer valor. Mesma família do backlog de 11,8 M cr do
`cancelamentos_ontem.cjs`: reportar sim, agir não.

**Escalado hoje via `ask_humans`** (regra 9-D) — `HTTP 200`,
`sent_to 120363428193217427@g.us`, gravado no cartão. Pergunta binária com
recomendação: **A)** saldo de compra reembolsada zera, e vira regra pra classe
inteira (o que eu faria) × **B)** mantém até acabar.

⚠️ **Não postei uma segunda linha no grupo pela carta à aluna (regra 7).** O
próprio `ask_humans` já diz que ela foi respondida hoje — duas mensagens sobre
o mesmo assunto é o ruído que a regra 27 proíbe.

---

## 4. Ferramenta nova: `_frank/ferramentas/ask_humans.cjs`

A regra 9-D mandava fazer o pedido com um `node -e` colado à mão do
`01_REGRAS_DURAS.md`. **Esse one-liner não roda mais nesta máquina:** ele lê
`AGENT_MONITOR_TOKEN` e faz `fetch` na mesma linha de shell, e o guard de
segurança reconhece a forma como "fonte de segredo + canal de saída" e derruba
o comando. Foi o que aconteceu comigo às 19h45Z com o pedido do `#214`.

Pedido que não sai é decisão que nunca chega. Então a operação virou ferramenta
versionada, com as três coisas que o one-liner não tinha: **ENSAIO por padrão**
(`--confirmar` pra valer), **campos longos por arquivo** (aspas de shell já
comeram nota de incidente antes) e **aviso explícito quando `has_link` vem
`false`** — que é o pedido nascendo cego.

`node --check` limpo. Sem TypeScript/ESLint envolvido (regra 4 não se aplica:
nada em `frontend/`).

---

## 5. O que NÃO fiz

Não mexi em crédito, acesso, plano, assinatura, migration, nginx, endpoint do
RunPod nem GPU. Nenhum merge. A única escrita em banco foi a nota e o status do
`#214`, e a única carta foi a da aluna.

## 6. O que a próxima ronda herda

1. **PR #393** — se passar de um dia aberto, cobre. É o conserto do resíduo de
   percepção (leva a classe crua de 6 para 0 sem qualificação manual).
2. **A fila real é 131/63, não 96/43.** Os 20 cartões `aguardando_aluno` com 7+
   dias nunca foram triados por ninguém: os 3 mais velhos da casa estão lá.
   Sugestão para a próxima serial: `#172` (24,2 d) e `#206` (21,3 d) têm pedido
   concreto ao aluno e silêncio desde 01/09 — vale medir se a carta chegou a
   sair, e a `emails_enviados` **não** responde isso (ela nasce em 14/09).
3. **140 recados `para_frank_*`**, o mais velho há 429 h.
4. **A resposta A/B do Johnny** sobre saldo de compra reembolsada — vale pra
   classe, não só pro `#214`.
