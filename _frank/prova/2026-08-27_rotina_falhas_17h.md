# Rotina das Falhas — 27/08/2026, ronda das 17h UTC (Frank, dono da fila)

Método serial (regra 8, ordem de 21/08): um incidente por vez, até o fim.
Papéis (regra 14-A): o Vigia abre e anota; eu investigo, decido e fecho.
`git checkout main && git pull --ff-only origin main` → já estava em dia.
Índice de ordens lido antes de tocar em qualquer coisa.

## Placar

| | |
|---|---|
| Abertos no início | **11** |
| Abertos no fim | **11** |
| **Fechados nesta ronda** | **0** — e a razão está escrita caso a caso |
| Incidentes que eu movi | 3 (`99`, `120` → `investigating` com nota; `158` nota) |
| Alunos que passaram a ter resposta | **2** (Luciano, Sandra) |
| Levado ao Johnny | 3 mensagens (488, 489, 490) |
| Crédito / GPU / migration / merge | **nada tocado** |

**Zero fechados é resposta honesta, não desleixo.** Os dois casos que peguei
travam na mesma coisa e não é técnica: **decisão comercial do Lucas e do
Johnny**. Fechar qualquer um deles hoje seria marcar `fixed` sem ter resolvido.

---

## Por que não peguei os dois mais velhos

**`#11` (21/07, o mais antigo).** Conferi no banco: as colunas
`trainer_returncode` / `trainer_stderr` / `trainer_stdout` **não existem** em
`training_jobs`. A migration `scripts/97` continua sem aplicar, exatamente como
a ronda das 14h registrou. DDL commitado não é DDL aplicado. Segue travado em
decisão do Johnny — **37 dias**.

**`#52` (19/08, 17 alunos).** A nota de hoje 12h41 já mediu que **não há crédito
a devolver** (20/20 estornos conferidos por `ref_type`) e **nenhum aluno
travado** (13 dos 14 geraram `ready` depois da falha). O que falta é acúmulo de
amostra: a régua que o próprio chamado escreveu pede ~20 entregas de escotilha
com `coverage_min_visto` e hoje há 1. Pegar de novo seria queimar a quinta ronda
no mesmo chamado sem dado novo.

---

## 1. `#99` `6c38c99d` — Luciano de Pinho (pagante, prazo 02/09)

Peguei pela regra 8: o mais antigo **aberto** com aluno afetado que ainda estava
acionável.

### O desenquadramento que destravou o caso

O chamado estava marcado desde 23/08 como **duplicata do `#95`** e por isso
ninguém o tratou. A premissa caiu: o `#95` foi para `fixed` em 24/08 com a
resolução *"Entregue ao time no grupo do WhatsApp"* — que é **repasse, não
desfecho**. O `#99` ficou `open` e o aluno escreveu **mais 7 vezes**. É o mesmo
padrão do `#153`: chamado encerrado do nosso lado com o aluno ainda escrevendo.

### O que medi

| | |
|---|---|
| Pagamento | **Real.** Trial R$0 em 19/08 + **R$97 APPROVED em 26/08 14:13Z**. Uma cobrança, não duas |
| Conta | Voz `ready` (31min), 169.920 créditos, **7 vídeos clone todos `ready`**, zero `failed` |
| Débitos | Batem com a tabela (105 cr/s no `480p-v3`: 15,23s → 16s → 1.680 cr) |
| A devolver | **Zero.** Ele não está bloqueado por defeito nenhum |

**A causa não é técnica, é de promessa.** Li o código: `buildInfiniteTalkWorkflow`
recebe `imageUrl` (**uma foto**) + áudio. Não existe treino de clone a partir de
vídeo em lugar nenhum — o único *take* do fluxo é **áudio** (`import-take` copia
mp3 do `recorder-test`). O reel promete gravar 45min de vídeo, o sistema analisar
rosto/voz/expressões e sair clone em 4 dias. **O produto não faz isso.** Ele leu
o reel certo.

Crédito à Fast: ela já tinha assistido o reel e corrigido essa informação com ele
em 23–24/08. O trabalho de atendimento aqui foi bom.

### Contradição nossa, nova — ninguém tinha cruzado

O blurb do tier `480p-v3` (`lib/video-clone/config.ts:45`) diz que **acima de
~40s o rosto pode se afastar da foto**, e esse texto **é mostrado ao aluno**
(`clone-studio.tsx:434`). O clone que a casa gerou de graça para ele
(`6f3022b5`, 25/08 22:43, `credits_cost` 0) tem **41,27s** — em cima do limite
que o próprio produto anuncia. E a equipe escreveu para ele que o limite era
*"mais ou menos 80 segundos"*: esse número **não tem fonte nenhuma no repo**
(grep em `_frank/` e `lib/video-clone/` devolve só a linha dos ~40s).

⚠️ **Não estou cravando que 40 é o número certo** — não medi drift. Estou
registrando que demos ao aluno um número sem lastro e o fizemos avaliar o
resultado no pior ponto da nossa própria régua.

### O que fiz

- **Telegram msg 488:** enquadrado como decisão comercial com data — devolver ou
  não, prazo **02/09**. Ele pede o posicionamento do Lucas e do Johnny por
  escrito **desde 25/08**, repetiu 26/08 e de novo hoje 11h13Z. **A bola está
  conosco, não com ele.**
- **E-mail** (~17h UTC, bcc suporte@): a verdade de que a resposta deles ainda
  não saiu, o que conferi da conta dele, o achado dos 41s, e a **oferta** de um
  teste curto (~20s, mesma foto e mesma voz) por conta da casa. **Não rodei
  nada** — a regra é não gastar GPU sem o aluno pedir, então ele precisa
  responder "pode fazer". Confirmei no código antes de escrever que o teste que
  ele mesmo planejou (áudio gravado por ele) funciona: `upload-url` aceita
  `kind=audio` até 90s.

**Passo em que emperrou:** posicionamento comercial do Lucas e do Johnny.
**Não virou `aguardando_aluno`** de propósito: isso tiraria da lista de ataque um
caso em que a dívida é nossa.

---

## 2. `#120` `6e94acc6` — Sandra Diniz (prazo 30/08)

Peguei depois que o `99` chegou no limite do que anda sem o Johnny.

**O assunto deste chamado já não é o título.** O título fala das 7 perguntas de
pré-venda; aquilo foi respondido em 24/08 12h50Z. O que está vivo desde a
reabertura de 26/08 é **pedido de reembolso do CURSO** comprado na Hotmart em
23/08. Agi sobre o assunto novo, não sobre o título.

### O que medi

- **Ela não tem nada conosco.** `profiles`: zero linha. `payment_events`: zero
  linha. `pagou_de_verdade` nos **dois** endereços (com e sem ponto — o Outlook
  trata como contas diferentes): *"NUNCA PAGOU, assinaturas 0"* nos dois. A
  compra é do **curso**, produto separado que não entra no nosso
  `payment_events`. **Do lado da plataforma não há nada a cancelar nem a
  devolver.**
- **A promessa sem dono.** Em 26/08 19h55Z a Fast respondeu *"vou reforçar seu
  pedido com a equipe, você receberá um retorno em breve"*. **21h depois o
  retorno não tinha saído.** Terceiro caso da mesma família hoje (`99`, `120`, e
  o padrão do `153`): promessa de retorno emitida sem ninguém do outro lado
  assumindo.

### O que fiz

- **Telegram msg 489:** reembolso é decisão de pessoa por ordem permanente, e o
  produto é do Lucas. Mandei com a data dela (**30/08**) em destaque e perguntei
  explicitamente se já foi resolvido na Hotmart sem ninguém avisar — se foi, o
  chamado fecha.
- **E-mail** (~17h20Z, bcc suporte@): **não prometi reembolso e não neguei.**
  Separei o que confirmo do que não é meu. Confirmei que não existe conta nem
  cobrança nossa (tira uma preocupação real dela e é verificável), disse que a
  decisão do curso é de outra equipe e que levei hoje com a data, e dei a
  informação útil que ninguém tinha dado: **o pedido que ela já abriu na Hotmart
  corre por si e não depende de confirmação nossa** — ela não precisa ficar
  esperando a gente para o pedido dela valer. Evitei de propósito prometer prazo
  em nome de quem decide, que foi o erro que a deixou dois dias no escuro.

**Não marquei `fixed`:** o dinheiro dela não voltou por ato meu e eu **não tenho
como conferir o reembolso na Hotmart daqui**. Afirmar desfecho sem conseguir
medir é exatamente o que a regra 14 proíbe.

---

## 3. `#158` — desarmei o alarme (não era o meu item serial)

A ronda do Vigia das 16h levou ao Johnny que *"a aluna pode estar apagando 16
cenas agora"*. Fui medir, porque quem lesse aquilo depois agiria com pressa.

**O pior não aconteceu.** Conta `479a7b74` (luzielisam@gmail.com, conta única):
projeto `b626e2cc` **done, 16 cenas, INTACTO**; **zero** cenas órfãs; e um
projeto novo `20e6344d` criado **hoje 16h45:34Z** — ela seguiu em frente.

**Mas houve perda, e é menor.** O projeto `b74345b5` (1 cena), que o Vigia mediu
existindo às 16h10Z, **não existe mais**. Ressalva honesta: **não vi o clique** e
não há log de auditoria de DELETE — infiro a exclusão da ausência da linha somada
à medição do Vigia. Não afirmo que foi ela quem apagou; afirmo que sumiu na
janela.

**A ironia que salvou as 16 cenas, e ela muda a leitura do defeito:** o bot errou
**duas** vezes e os erros se cancelaram. Mandou apagar cena por cena (não existe
lixeira de cena) **e** apontou o projeto errado. Ela abriu o que ele indicou e
apagou — o que tinha 1 cena. **Se o bot tivesse acertado o projeto, ela teria
perdido as 16 depois de ler por escrito que não perderia nada.** O desfecho bom
foi **sorte, não proteção do produto**.

Telegram msg 490 ao Johnny para ele não correr atoa. **Não escrevi para ela**: o
assunto agora é 1 cena perdida por instrução nossa, e ela nem sabe que perdeu —
refazer por conta da casa gasta GPU e é decisão dele.

---

## Postado no grupo (regra 7, só fato consumado)

1. Escrevi pro Luciano de Pinho (chamado 99).
2. Escrevi pra Sandra Diniz (chamado 120).

Nenhum incidente fechado, nenhum fix em produção → nada mais a postar.

## O que NÃO fiz

Não fechei incidente nenhum. Não gastei GPU, não retreinei, não estornei, não
toquei em crédito, acesso ou assinatura. Não apliquei migration, não mergeei
branch, não escrevi código. Não li a caixa do suporte@ para triagem (só `--de` e
`--enviados` dos dois alunos que eu estava tratando; fila de não-lidos intocada).
Não reabri o assunto encerrado da regra de crédito. Não prometi extensão de
acesso nem reembolso a ninguém.

## Para a próxima ronda

1. **`#99` e `#120` dependem do Lucas/Johnny** — datas **02/09** e **30/08**. Se
   não sair posicionamento, os dois prazos vencem com a pergunta em aberto.
2. **`#11`: migration 97 parada há 37 dias.** É o único bloqueio.
3. **O padrão que apareceu três vezes hoje** (`99`, `120`, `153`): a Fast promete
   "a equipe retorna em breve" e não há ninguém do outro lado assumindo. O `153`
   já mede isso e um caso virou chargeback.
4. **`#158` não é urgência, mas o defeito está inteiro** — a única lixeira apaga o
   projeto e o chat garante que não se perde nada.
