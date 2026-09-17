# Fecho do dia — relatório noturno de 06/09 (escrito 07/09 ~01:00–01:40Z)

Consolidado do dia inteiro. Tudo que está aqui foi **medido nesta ronda**, não
herdado do log de quem passou antes — a lição de hoje (§7) é justamente que
número herdado apodrece.

---

## 1. O que eu resolvi hoje

### 1.1 Nove pagantes presos em ZERO crédito receberam o que já tinham pago

O maior item do dia, e ele nasceu de uma correção **minha** que estava errada.

A ronda das 13hZ restituiu **acesso** a 7 pagantes de R$97 presos pelo lote do
SGP e anotou que "o crédito entra sozinho no primeiro acesso". A ronda das 15hZ
foi conferir essa promessa e derrubou ela: a restituição gravou `plan='pro'`, e
a guarda do resgate em `app/[locale]/app/layout.tsx:43` só chamava
`claimPurchasesOnLogin` quando `!profile.plan || plan === 'free'`. **A guarda
enxergava ACESSO faltando, nunca CRÉDITO faltando** — ou seja, a própria
restituição desligou o auto-conserto que ela prometeu.

- **9 pagantes** restituídos, **1 grant cada, zero dobra** (conferido às 14hZ
  por instrumento próprio, casando `ref_id` entre contas).
- Caso-âncora: `gestao@qooqi.com.br` — pagante confirmado, `plan='pro'`, saldo 0
  e nenhuma linha `subscription_grant`. **47 dias travado** (21/07 → 06/09).
- Causa corrigida no código: incidente **#283**, PR **#195**, commit `6f153ac`,
  em produção **14:27Z**. Conferi às 16hZ que a guarda nova **não creditou
  ninguém indevidamente**: 3 grants no período, todos com referência Hotmart real.

### 1.2 O apagão do Vídeo Clone de 05/09 está encerrado — provado, não presumido

- **24h fechadas: 42 vídeos `ready`, 0 falha.**
- Fonte honesta: **nenhum** `video_clone_refund` no ledger em 06/09. O último foi
  **05/09 23h**. (Ver §1.3 pra entender por que o ledger é a fonte e a tabela não.)
- Prova de entrega feita por `HeadObject` no R2 (`voices-clone-ai-verse`), não por
  `video_path is not null` — `video_path` está preenchido **também nas linhas
  `failed`**, é o destino pretendido gravado na criação. Concluir cura por ele
  daria 100% de sucesso inclusive durante o apagão.
- Raio real, medido pelo ledger: **8h25m** (05/09 14:46:58Z → 23:12:25Z),
  **53 falhas · 9 alunos · 200.350 cr devolvidos**. Débito e estorno casados
  **por `ref_id`** em todas as 53. **Nenhum aluno pagou por falha nossa.**
- Detalhe: o PR #190 (17:25Z) **não** foi o que curou — as falhas seguiram até
  23:12Z. Quem curou foi o #192 (pin `transformers==5.14.1`).

### 1.3 Achado de instrumento: a tabela de jobs não é o registro das falhas

`DELETE /api/v1/video-clone` (`route.ts:319+`) apaga a linha **de vez** para clone
finalizado — não existe `deleted_at` em `video_clones`. O aluno limpa a tela e o
registro da falha deixa de existir; o que sobrevive é a contabilidade.

| fonte | falhas do apagão |
|---|---|
| ledger (`ref_type='video_clone_refund'`) | **53** |
| ainda existem em `video_clones` | 27 |
| **sumiram** | **26** |

**Regra que nasce daqui:** para "quem foi atingido" e "quanto", a fonte é o
**ledger**, nunca `video_clones`. Minha primeira medição do dia (15:0xZ) disse
"27 falhas, 8 alunos" e estava errada por isso — e quem tinha sumido inteiro era
justamente **o mais atingido do dia** (`pcezardireito`, 11 falhas, aparecia com 0).

### 1.4 Seis incidentes fechados

| # | desfecho | commit |
|---|---|---|
| #283 | `fixed` — pagante com `plan=pro` preso em zero crédito | `6f153ac` |
| #289 | `fixed` — a tela emudecia enquanto o envio de voz corria | `1ba71a5` |
| #253 | `fixed` — 1h de áudio na tela de treino, botão morto | — |
| #287 | `fixed` — mesma classe do #253 | — |
| #261 | `ignored` — refutado no MIME cru: era autorresposta vazia, não aluna sem resposta | — |
| #284 | `ignored` | — |

12 abertos, 6 fechados. Saldo do dia: **+6**. Não escondo o sinal.

### 1.5 Dois números meus derrubados por medição (os dois pra menos)

- **#265: "57 alunos dentro da garantia e o sistema diz fora" → são 43** — e,
  mais importante, **as 43 são 100% política e 0% defeito**. O bug (janela de 7
  dias fixos ignorando `warranty_date`) foi corrigido e está no ar desde 05/09
  22:48Z. Medido em SQL cru pela Management API, sem o teto de 1000 do PostgREST.
- **#15: não são "18 vozes em `awaiting_training`"** — overlap medido = **1**. O
  18 vinha sendo herdado há rondas.
- Também desinflei um número meu: abandono do SGP é **3 de 11**, não 4 de 10.

### 1.6 Descoberto hoje: #290, o e-mail que nega a plataforma a quem pagou por ela

`sgp-boas-vindas.ts:390` manda o parágrafo *"NÃO inclui a assinatura da
plataforma FastCloner"* de forma **incondicional** — inclusive pra quem comprou a
assinatura no MESMO checkout. **15 assinantes ativos receberam**, e **os 8 que
nunca logaram são exatamente esses**. É a causa a montante dos 9 restituídos do
§1.1: a gente cobrou, travou e ainda escreveu dizendo que eles não tinham o
produto. PR **#203** aberto; o e-mail de correção pros 8 depende do Johnny (§2).

---

## 2. O que precisa de você

Ordenado por relógio. Cada item é sim ou não.

1. **Diego (#254), renova amanhã 08/09 12hZ, R$194.** Ele tem duas assinaturas
   FastCloner ao mesmo tempo. A órfã (`4UKYMN4L`) tem **CPF e titular Hotmart
   diferentes** da outra conta, então eu não cancelo sem pedido escrito.
   **Deixo cobrar amanhã?**
2. **Garantia (#265): renovação mensal reabre a janela de garantia, sim ou não?**
   São 43 pessoas. **7 saem da janela amanhã (08/09)**, 28 em cinco dias. Adiar
   não preserva a opção — adiar é dizer "não" pra 40 das 43.
3. **Renata (`renatarcpsi`): dou cortesia sem ela pedir?** Prometi por escrito em
   05/09 que o caso foi "levado à diretoria" e que eu **acompanharia até ter
   retorno**. Ela não respondeu, não pediu nada, e **renovou hoje 14:13Z**
   (ativo até 30/09, +100.000 cr). Se a resposta for não, eu ainda preciso mandar
   uma linha fechando — silêncio nosso agora é quebra de promessa.
4. **Paulo Moura (`pcezardireito`): zero os 46.007 créditos dele?** Cancelou em
   31/08 (antes do apagão, não foi churn causado por nós), trial venceu hoje
   12:00Z, `pagou_de_verdade.cjs` não achou pagamento neste e-mail. ⚠️ Isso **não
   prova** que nunca pagou — pode ter comprado com outro e-mail (armadilha #214/#218).
   Se quiser, eu confiro por nome/CPF antes. **Não toquei em nada.**
5. **#226: as 290 gerações que o nosso próprio QA reprovou e a gente entregou —
   estorno?** 132 de 180 alunos. Isso destrava o #234 junto.
6. **Migration 82: aplico?** É o que destrava o **#15**, parado há **39 dias**.
7. **#290: mando o e-mail de correção pros 8 assinantes pagantes** que receberam
   a carta dizendo que não têm a plataforma? (É lote, por isso pergunto.)
8. **#222: reenquadrar ou fechar?**

Também pendentes de gente, não de código: WhatsApp pro Glauber e pro Anderson
(#249/#250 — e-mail voltou, caixa inexistente).

---

## 3. O que subiu pra produção

| PR | commit | o que corrige | merge |
|---|---|---|---|
| #195 | `6f153ac` | o resgate no login passa a enxergar **crédito** faltando, não só acesso (#283) | 14:27Z |
| #196 | `613af0b` | lembrete automático pra voz parada em `awaiting_training` + conserta a tela do detalhe | 22:44Z |
| #201 | `1ba71a5` | a tela não emudece enquanto o envio de voz corre (#289) | 23:44Z |

**Confirmação de que está NO AR** (BUILD_ID no servidor, não Action verde):

- `BUILD_ID` = **`7PiWj1wZVgz3hoSRlBHni`**, gerado **06/09 23:46:27Z** — depois do
  último merge do dia (#201, 23:44:39Z).
- Arquivos dos três PRs **presentes** em `/mnt/volume/aiverse/frontend`, mtime
  `23:44:48`: `src/lib/payments/claim-guard.ts` (#195),
  `src/lib/voices/lembrete-treino.ts` + `lembrete-treino-sweep.ts` (#196),
  `src/components/voice/progresso-envio.ts` (#201).
- pm2 `aiverse` **online desde 07/09 00:27:43Z**, ou seja, rodando este build.

---

## 4. Estado geral

**Chamados:** 25 abertos (`investigating`) + 12 `aguardando_aluno` = **37
não-fechados**. Ontem eram 18 + 13 = 31. **Piorou em 6** — 12 abriram, 6
fecharam. Mesmo instrumento dos dois dias (a mudança de contagem foi em 05/09
00:07Z, antes do relatório de ontem), então a piora é real, não de régua.

**Mais antigos, com idade:** #15 (39d, preso em migration), #222 (6d, decisão),
#226 (6d, decisão), #234 (5d, destravado pelo #226), #237 (5d, aluno não
identificado). ⚠️ **Dos 6 mais antigos que eu poderia atacar, 4 esperam você.**
A fila está travada em decisão, não em trabalho.

**Presos na varredura: 4.** Nenhum abandonado — conferi um por um:
- `marcelopersonalthe32` · 298.950 cr · 28 dias sem voz. Bola com ele: escrito
  3× (27/08, 29/08, 05/09), última carta com pergunta binária e prazo (garantia
  até **11/09**). A falha de 10/08 foi nossa; o que trava agora é o arquivo dele
  (47min de entrevista, duas pessoas — confirmado de ouvido em 8 pontos).
- `tania-araujo` · 200.000 cr · 2 dias em `awaiting_training` — o lembrete
  automático que subiu hoje (#196) é exatamente pra este caso.
- `hellengrasso` · 0 dias · 5 de 7 arquivos perdidos no envio — já escrito às
  23:48Z, e o fix da tela muda subiu hoje (`1ba71a5`).
- 1 `training_job` obsoleto (voz já `ready`): escrituração pendente, ninguém
  esperando.
- +1 fora da fila: `luanmarcal.com`, import quebrou em 29/08 (arquivo não
  público no Drive), 9 dias.

**Pagante sem acesso: 0** hoje — os 7 do lote SGP foram restituídos às 13hZ e os
9 sem crédito às 15hZ.

**Dinheiro:** lista de estorno em dia — 10 tipos, **2.895 linhas varridas**
(ontem 2.854), **nenhum tipo desconhecido**.

**Vídeo Clone:** 42 prontos, 0 falha nas 24h.

**⚠️ Número que piorou e é meu:** a fila de recados do `agent_state` foi de
**23 recados + 3 patches** (ontem) pra **34 recados + 4 patches**, o mais antigo
de **01/09 18:25Z (≈5,3 dias)**. Ninguém está drenando. É a §1-B/1-C do
`03_ROTINA.md` sendo desobedecida em silêncio, e é exatamente o acúmulo que já
fez três rondas "limparem" sem limpar. **Assumo: eu não drenei hoje.**

---

## 5. Dívida técnica que continua não paga (repetida de ontem, de propósito)

Apagar os diretórios parciais de `transformers`/`wav2vec` e `TORCH_HOME`/Demucs
no volume `ff442v3132` e rodar `download_models.sh`. **Não foi feito.** O pin do
#192 resolveu sem isso, mas o carregador só testa `os.path.exists`: enquanto
houver diretório parcial no volume persistente, ele vê o caminho, não baixa,
devolve `None` em silêncio e o nó 194 quebra de novo — basta a pinagem escorregar
uma vez. Mexer nesse volume é **produção fora do fluxo normal**, então depende do
seu "sim" (§06 do manual).

---

## 6. O que eu decidi NÃO fazer, e por quê

**Não mandei a terceira carta pros 9 alunos do apagão.** Eles já foram avisados
duas vezes (05/09 15:28–23:26 "está fora do ar"; 06/09 00:36 "voltou") e cinco
deles três (06/09 01:08, duplicata). Os rascunhos
`_frank/rascunhos/2026-09-06_A_nao_tentaram.html` e `..._B_ja_geraram.html`
abriam com *"Prometi te avisar quando voltasse"* — promessa já cumprida há ~14h.
Mandar seria a mensagem genérica que a **regra 11** proíbe e repetiria o
incidente `3565a46b`. Os rascunhos ficam no diretório como registro da decisão.

Conferi antes de decidir: o estorno que os dois rascunhos afirmam **existe
mesmo**, casado por `ref_id`, nas 53. A afirmação era verdadeira — o problema é
que já tinha sido feita.

---

## 7. As lições do dia

**Número herdado é dívida, não fato.** Caiu duas vezes hoje ao ser medido: o "57"
do #265 virou 43, o "18" do #15 virou 1. E o meu "27 falhas" virou 53. **Meça o
número do título antes de agir sobre ele, mesmo quando quem escreveu foi você.**

**Correção que conserta metade cria o próximo incidente.** A ronda das 13hZ
restituiu acesso e, ao gravar `plan='pro'`, desligou o conserto automático do
crédito. Se a ronda seguinte não tivesse ido conferir a promessa que a anterior
deixou escrita, 9 pagantes ficariam em zero por tempo indeterminado — e o log
diria "resolvido".

**Chamado com dois defeitos vira meia verdade.** O #265 juntou um bug de código e
uma política de dinheiro sob um título só; o bug foi corrigido e o chamado
continuou parecendo um bug de 57 pessoas.

**Decisão adiada não fica parada, ela expira.** No #265, 7 pessoas saem da janela
amanhã. Escalar sem o relógio junto deixaria parecer que dá pra ver na segunda.
