# RONDA DAS FALHAS — 19/09, ~17hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_16h.md`.

**Método serial (regra 8), com a ordenação que as três rondas anteriores
deixaram como lição nº1:** abertos com aluno nomeado, ordenados pela data da
**ÚLTIMA NOTA**, não pela de criação.

**O achado desta ronda não é um cartão, é um padrão.** Peguei quatro cartões,
um de cada vez, o mais abandonado primeiro. **Os quatro já estavam
resolvidos.** Nenhum precisava de investigação, conserto ou decisão: os quatro
precisavam que alguém voltasse e **escrevesse a nota**. Somados, 38 dias de
`investigating` em trabalho que já tinha sido feito — em dois deles, feito em
**menos de dois minutos** depois do cartão nascer.

Por isso a ronda terminou com um instrumento novo (§6): a fila parou de ser
uma lista de trabalho pendente e virou, em boa parte, uma fila de
**contabilidade atrasada**. Isso tem tamanho, e agora está medido: **40**.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
728 lidas da pasta "Sent" = 651 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`),
instrumento independente: **0 carta depois do corte**, veredito "buraco é
PASSIVO".

Pasta **726 → 728** desde as 16hZ; as 2 do intervalo já nasceram com linha.
Controle compensatório funcionando.

As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** — decisão de
produção, não de ronda, e eu não a tomei. **Mas esta ronda achou o custo
delas**, e ele não é teórico: ver §2.

## 1. Estado da fila

| status | 16hZ | 17hZ |
|---|---|---|
| fixed | 279 | **288** |
| investigating | 93 | **84** |
| ignored | 60 | 60 |
| aguardando_aluno | 34 | 34 |
| open | 1 | 1 |

Total varrido 467, igual. **Quatro dos nove fechados são meus** (#322, #333,
#334, #321); os outros cinco aconteceram entre as rondas e não são meus — o
`#336`, em particular, importa e aparece na §4.

**Percepção travada (ordem de 17/09): 2 cards, o mais velho parado há 1,2 dia.**
Os mesmos dois da ronda anterior, e nenhum é caso de despacho: o `#450` já foi
medido e declarado falso positivo do detector, e o `#473` espera a própria
aluna ouvir o áudio refeito — espera legítima, com data. **Nada a despachar
para o `olho` ou o `qa` nesta ronda.**

---

## 2. `#322` — respondido em 81 segundos, esquecido por 10 dias

`071d91a7` · aberto **09/09 15:12Z** · última nota **09/09 15:24Z** ·
**10 dias de silêncio** · aluno **Bambolla Store**, `novabbla@gmail.com`.

Ele perguntou no chat do app como subir, para animar, uma foto gerada em outra
IA. A nota do EXECUTOR (15:24:59Z) concluiu certo — não é bug, é limitação de
produto — e deixou o plano: *"responder o aluno por e-mail"*. O cartão ficou
`investigating` dez dias.

**O plano tinha sido cumprido 81 segundos depois.** Pasta "Sent" uid **1418**,
`Date` **2026-09-09 15:26:05Z**. Abri e li a carta: responde exatamente a
pergunta dele (diz que upload externo não existe hoje, assume a limitação como
nossa, ensina o caminho a partir da galeria), avisa que o clipe sai com ~4s e
sem áudio, e aponta o Vídeo Clone para quem quer a pessoa falando.

**E ele não estava travado:** 09/09 15:11 gastou 1.320 cr em "Animar imagem —
Bronze" na geração `724bf343` → `video_status='ready'` com `video_path`
preenchido. Entregue. Depois seguiu: voz "Natasha" [ready] 15:59, áudio 16:06.
Acesso ativo até 10/10, 187.105 créditos, recarga em 16/09, nenhum chamado
novo. **Fechei sem escrever segunda carta.**

### 2.1 O instrumento que a casa usa para isso respondeu ERRADO

Isto vale além do cartão. Rodei `ja_falaram.cjs`, que é a ferramenta da casa
para a pergunta *"a equipe já falou com este aluno?"*. Resposta:

```
⬜ SEM REGISTRO de resposta humana a este aluno.
```

**Falso negativo, num aluno que tinha sido respondido.** O motivo é estrutural:
ele não lê a pasta "Sent", e `emails_enviados` só nasceu em ~14/09 — então
**para todo aluno anterior a essa data a resposta dele é "sem registro" por
construção**. O próprio texto de aviso do script admite não ser prova, e é
justamente por isso que ele não fecha cartão nenhum: quem lê aquele "SEM
REGISTRO" e age escreve **carta duplicada**.

Quem achou a carta foi
`2026-09-19_uid_por_message_id.cjs --para novabbla@gmail.com` — o modo `--para`
que a ronda das ~12hZ criou depois de quase duplicar carta para a Katia. **É a
segunda vez em um dia que esse modo salva um aluno de receber a mesma carta
duas vezes.**

**É também o custo concreto das 77 cartas sem decisão do #101:** elas estão na
pasta e não na tabela, e é exatamente essa faixa que o `ja_falaram.cjs` não
enxerga.

---

## 3. `#333` — o conserto subiu TRÊS MINUTOS depois do cartão abrir

`d5194779` · aberto **10/09 01:48:01Z** · 10 alunos no cartão · 9 dias parado.

O defeito era do próprio alarme: `deveAvisar()` (`aviso-orfao.ts`) decidia por
evento + e-mail + produto e **nunca olhava pagamento**, então mandava "tratar
como PAGANTE URGENTE" quem tinha comprado trial de R$ 0 — 10 dos 16 alertas da
fila de 09/09.

Commit do conserto: **`a49f432e`**, *"aviso de compra orfa so quando entrou
dinheiro"*, **2026-09-10 01:51:24Z**. Três minutos depois da abertura. Quem
consertou não voltou para fechar.

**Conferido em três camadas, e a terceira é a que vale:**

1. **Main.** `git merge-base --is-ancestor a49f432e origin/main` = sim. Em
   `origin/main` o `deveAvisar()` tem a 4ª trava delegando a
   `eventoEhPagamento()` de `acesso-regra.ts` — a **mesma** função que o
   sweeper `orphan-outreach` já usava, que era a incoerência de fundo. Os
   campos `valorCompra`/`statusCompra` são **obrigatórios no tipo**, então
   nenhum chamador novo consegue esquecer.
2. **Chamador.** `webhooks/hotmart/route.ts:304-305` passa
   `extractPurchaseValue(data)` e `purchaseStatus || null`.
3. **Produção — e esta prova não é o git, é a fila.** Os avisos
   `para_frank_orfa_*` gravados **depois** do conserto carregam os campos
   novos preenchidos:

| aviso | quando | valor | status |
|---|---|---|---|
| rodrigo.limas.1978@ | 14/09 09:06 | 97 | COMPLETED |
| josephgois@ | 17/09 13:58 | 97 | APPROVED |
| isaias.enf@ | 18/09 13:45 | 97 | APPROVED |

Os anteriores ao conserto têm `valorCompra: null` — o campo nem existia.
**Código velho não grava campo novo:** a fila está sendo escrita pelo binário
corrigido. E o falso alarme acabou: **3 de 3 pós-conserto têm dinheiro de
verdade**, zero aviso de R$ 0 desde 10/09. A fila caiu de 16 para 9, e os 6
remanescentes pré-conserto são **exatamente** os 6 que a abertura listou como
pagantes reais.

Ninguém precisava ser avisado por este cartão: o dano dos 10 falsos era
potencial (ruído + risco de escrever "você está pagando" para quem não pagou),
e o sweeper nunca convidou nenhum deles porque já usava a regra certa.

**Pendência que NÃO é deste cartão e não fecha com ele:** os 9 avisos que
restam na fila são de gente **sem conta no e-mail da compra** — conferi os 9
contra `profiles`, os 9 dão `profile_id` NULL. Três têm R$ 97 confirmado. Fui
ver se estavam em silêncio e **não estão**: `orfao-convite` (o sweeper diário
das 14:00) escreveu para `josephgois` em 18/09 e `isaias.enf` em 19/09, e
rondas manuais escreveram para 5 deles em 17/09 e 19/09. `rodrigo.limas.1978`
tem cartão próprio. **Nenhum pagante em silêncio nesta classe.**

---

## 4. `#334` — o prazo já tinha vencido, e a carta certa foi para o endereço errado

`a22a3862` · aberto **10/09** · última nota **10/09 13:14Z** · 9 dias ·
**Renata Cristina Arielo**, `rearielo@hotmail.com`.

Compra duplicada. A direção correta foi cravada pelo Vigia em 10/09 depois de
a própria aluna se corrigir: **MANTER `rearielo@`, CANCELAR
`arielorenata1@`** — e a nota do Executor avisava que havia **prazo**:
*"renovação anunciada para 17/09 — cancelar a duplicata antes disso resolve sem
estorno"*.

**Hoje é 19.** Apliquei a lição do `#314` da ronda passada (*prazo de reparo
manual tem evento, não data; se um card disser "confira depois de tal dia",
confira antes*) e fui ver o dia 17 **antes de qualquer outra coisa**. A notícia
é boa:

- `arielorenata1@` (a duplicata): só `rec#1` **R$ 0** COMPLETE de 10/09.
  **Nada em 17/09 — não renovou.** E já estava cancelada:
  `cancelar_assinatura.cjs --orfa` em **ensaio** → `LZKDL23W`,
  **CANCELLED_BY_CUSTOMER**, `trial: true`, *"nada a fazer"*.
- `rearielo@` (a que ela mantém): `rec#2` **R$ 97 APPROVED em 17/09**. **Uma**
  cobrança, na conta certa, na data certa. Acesso até 10/10, 200.000 créditos,
  recarga do ciclo em 17/09 14:17.

**Não houve cobrança em dobro e não há estorno a fazer.** Não cancelei nada
(não havia o que cancelar) e não toquei em crédito, acesso nem assinatura.

### 4.1 Por que escrevi mesmo assim

O cartão irmão `#336` foi fechado hoje **15:41:44Z** por outro agente, pelo
lado da conta duplicada, e a carta dele (Enviados uid **2891**, 15:40Z) foi
para `arielorenata1@gmail.com` dizendo *"a sua assinatura já está cancelada"* e
*"obrigado por ter testado a FastCloner"*.

**Está correta sobre a duplicata.** Mas quem a escreveu não sabia que é a
**mesma pessoa** que mantém uma assinatura **paga** no outro endereço e
**acabou de ser cobrada em R$ 97 no dia 17**. Lida sozinha, ela diz a uma
cliente pagante que a FastCloner dela acabou — no mesmo mês em que uma cobrança
aparece na fatura. Isso é reclamação ou chargeback esperando acontecer.

Escrevi para `rearielo@hotmail.com` (Enviados uid **2898**, registrada em
`emails_enviados`, origem `ronda-manual`): ficou como você pediu, esta conta
segue ativa, a duplicada foi cancelada sem cobrar nada, **o e-mail que você
recebeu hoje no outro endereço fala só da duplicada**, e os R$ 97 do dia 17 são
a mensalidade **desta** conta — esperada e única. Desculpa pelos 9 dias.

No último contato que ela tinha recebido **neste** endereço (uid 1597, 10/09) a
casa dizia *"CORREÇÃO: mantenha a rearielo e cancele a arielorenata1"*. **Ela
nunca tinha recebido a confirmação de que foi feito.** Agora recebeu.

**A lição, que é de coordenação e não de código:** dois cartões marcados como
"a MESMA pessoa, tratar uma vez só" foram fechados por dois agentes em
horários diferentes, e o que fechou primeiro escreveu ao aluno **sem o contexto
do outro lado**. A marcação de irmão existia e estava escrita — não bastou.

---

## 5. `#321` — respondido em 67 segundos, e o "zero" já nascia vencido

`35304c01` · aberto **09/09 14:00:21Z** · 10 dias · **Edésio Andrade Campos**,
`grupouniprox@grupouniprox.com.br`.

Ele achava ter feito duas assinaturas. Eram **duas compras avulsas de produtos
diferentes** em 31/08 (Sistema de Geração Pronto R$ 741,00 + Fábrica de
Conteúdo Invisível R$ 313,32), sem recorrência.

Respondido em **09/09 14:27:18Z** — 67 segundos depois da nota do EXECUTOR.
Pasta "Sent" uid **1409**. Li a carta: explica os dois produtos, diz que
nenhum se repete no mês seguinte **e ainda avisa espontaneamente** que um trial
da plataforma começaria a cobrar em 16/09, com o caminho para cancelar sem
afetar as compras.

A pendência técnica que a nota deixou — *"conferir se a Fábrica de Conteúdo
Invisível exige entitlement na plataforma (hoje ele tem zero)"* — fica
respondida, de duas fontes:

1. **Não exige.** Curso não dá acesso ao FastCloner: está documentado na trava
   de produto do próprio `aviso-orfao.ts`, e a carta já encaminhou o aluno ao
   canal certo desse produto.
2. **O "zero entitlements" já estava vencido quando foi escrito.** O
   entitlement `4LB5BGWD` nasceu em **09/09 14:01:33Z** — um minuto depois de o
   cartão abrir e **25 minutos antes** da nota que relatou zero.

Hoje: acesso ativo até 09/10, 180.607 créditos, recarga em 16/09, voz + 3
áudios + 5 imagens + 2 Vídeo Clone todos `ready`. **Ele ficou com a assinatura
por escolha**, depois do aviso. Fechado sem segunda carta.

---

## 6. O instrumento novo: a fila de contabilidade tem tamanho, e são 40

Quatro de quatro é padrão, não coincidência. Três rondas seguidas
redescobriram a mesma coisa **um cartão por vez, na unha**. Então virei
ferramenta:

`_frank/ferramentas/2026-09-19_aberto_mas_ja_respondido.cjs` — para cada
chamado `open`/`investigating` com **um** aluno nomeado, pergunta à pasta
"Sent" se saiu carta para aquele endereço **depois** de o cartão nascer. Uma
conexão IMAP, `EXAMINE` (leitura pura), mesma tripwire anti-escrita do
`ler_caixa.cjs` e do `dump_enviada.cjs`.

```
chamados open/investigating com UM aluno nomeado: 62
📮 ABERTOS QUE JÁ TIVERAM CARTA DEPOIS DE NASCER: 40
📭 sem carta depois de nascer: 22
```

Os mais abandonados da lista, para quem pegar a próxima ronda:

| cartão | aluno | parado | última carta |
|---|---|---|---|
| `#347` | raulcssavatar@ | 8,9d | 14/09 "Sua chave do HeyGen está certa" |
| `#344` | gusperandio2@ | 8,8d | 10/09 "Achei a causa do ritmo" |
| `#348` | ellen.atp@ | 8,8d | 10/09 "Parte disso eu resolvo agora" |
| `#357` | luminous.assessoria@ | 7,9d | 11/09 "A cobrança de hoje NÃO foi feita" |
| `#343` | welrisson@ | 7,9d | 14/09 "Seus 2 estornos caíram" |

⚠️ **O que ele NÃO faz, e está escrito no cabeçalho do script em letras
grandes: ele não diz que o chamado está resolvido, e ninguém pode fechar
cartão com a saída dele.** Carta depois da abertura é **indício**, não prova —
a carta pode ser de outro assunto, pode ser aviso automático, e pode até ser a
carta **errada** (foi o caso do `#334` desta ronda). Ele entrega **ordem de
visita**: por onde começar a ler. Quem fecha abre a carta
(`dump_enviada.cjs <uid> --texto`), confere o estado do aluno e decide. **A
regra 14 continua inteira.**

E o zero também não conclui nada: "sem carta" pode ser carta mandada de
worktree que não registrou, ou resposta por WhatsApp/chat.

---

## 7. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 728 = 728, 0 escrituráveis, conferida por
   instrumento independente.
2. **Quatro cartões fechados** (`#322`, `#333`, `#334`, `#321`), cada um com
   nota medida e relida, e o `#333` com `resolved_commit` gravado.
3. **Uma carta a aluno** — Renata (`rearielo@`), Enviados uid **2898**,
   registrada em `emails_enviados`.
4. **Medi que não houve cobrança em dobro na Renata** e, por isso, **não
   executei cancelamento nem estorno**.
5. **Provei o `#333` em produção pela fila**, não pelo git (§3).
6. **Instrumento novo** `2026-09-19_aberto_mas_ja_respondido.cjs`, rodado:
   **40 de 62**.
7. **Três linhas no grupo** — os três fechamentos com aluno nomeado e a carta.

## 8. O que eu NÃO fiz

- **Não fechei nada em lote.** Os 40 da §6 continuam abertos; o instrumento é
  ordem de visita, e cada um exige abrir a carta e conferir o aluno.
- **Não escrevi para os outros três alunos** (§2, §5) — já tinham sido
  respondidos, e segunda carta repetindo é pior que silêncio.
- **Não mergeei nada.** Os PRs **#351** e **#355** seguem abertos, e o `#355`
  continua esperando a decisão do Johnny — com a bomba do Jesus ainda armada
  enquanto a rec#3 dele estiver OVERDUE.
- **Não estornei, não concedi crédito, não gastei GPU, não toquei em migration,
  assinatura nem acesso de ninguém.**
- **Não decidi o backfill das 77 cartas** do #101 — mas registrei o custo
  medido delas (§2.1), que é decisão de produção e não de ronda.
- **Não li a caixa do suporte@ para triagem.** As leituras de hoje foram todas
  na pasta **Sent** e por endereço de um aluno que eu estava tratando.
- **Nada da planilha** (ordem de 29/08).

## 9. Para quem pegar a próxima ronda

1. **Rode o `2026-09-19_aberto_mas_ja_respondido.cjs` junto com a contagem.**
   São 40 cartões com carta já enviada. Comece pelo topo da lista dele, que já
   sai ordenado por abandono.
2. **Mas leia a carta antes de fechar.** O `#334` desta ronda é o
   contra-exemplo: tinha carta, a carta estava factualmente certa, e mesmo
   assim faltava escrever para a aluna — porque a carta foi para o **outro**
   endereço dela e dava a entender o contrário do que aconteceu.
3. **`ja_falaram.cjs` não vê a pasta "Sent".** Para aluno anterior a ~14/09 ele
   diz "SEM REGISTRO" por construção. Use
   `2026-09-19_uid_por_message_id.cjs --para <email>` antes de escrever para
   qualquer aluno. Duas vezes em um dia isso evitou carta duplicada.
4. **Cartão marcado como irmão de outro precisa ser tratado junto, de fato.**
   Em 19/09 os dois lados do caso da Renata foram fechados por agentes
   diferentes com uma hora de diferença, e a carta do primeiro não sabia do
   segundo. Antes de escrever a um aluno, procure **todos** os cartões da
   pessoa, inclusive pelos outros e-mails dela.
5. **Desconfie de "zero" escrito à mão.** Nesta ronda dois zeros estavam
   vencidos no minuto em que foram escritos (o `ja_falaram.cjs` do `#322` e os
   "0 entitlements" do `#321`, que já não eram zero havia 25 minutos).
