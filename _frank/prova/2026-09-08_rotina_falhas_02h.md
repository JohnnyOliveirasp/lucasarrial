# Ronda das falhas — 08/09 ~01h30–02h30Z (Frank, dono da fila)

**Cards tocados:** `#254` / `f1ada07e` (cobrança em dobro — pela exceção da regra 8,
dinheiro cobrado errado) e `#15` / `d3d8d1b2` (timeout, o mais antigo da fila).

**O que NÃO fiz:** não fechei incidente; não cancelei assinatura; não mexi em
crédito, acesso, plano, GPU nem migration; não apliquei migration; não subi código
(nenhuma linha de produção mudou nesta ronda); não ouvi áudio nenhum.

---

## §1 — `#254`, perna CARLOS AUGUSTO: lembrete enviado (era o item agendado pra esta ronda)

A nota 15 (07/09 12h45Z) agendou explicitamente: *"Lembrete cabe na ronda da noite
de hoje ou de amanhã"*, com critério de ~3 dias vencendo **07/09 21:48Z**. Quando
abri (01:50Z de 08/09) o critério **já tinha vencido**. Esta é a ronda da noite.

**Conferi na FONTE antes de escrever** — aplicando a lição que a própria nota 15
registrou (*"'perna pendente' escrita em nota MINHA de ontem não é fonte — o Sent
é"*):

| verificação | resultado |
|---|---|
| Sent → `gutoassuncao16@gmail.com` | **1** e-mail, uid 1035, 04/09 21:48Z |
| Sent → `caplastica@hotmail.com` | **1** e-mail, uid 1036, 04/09 21:48Z |
| INBOX ← os dois endereços | *nada encontrado* nos dois — não respondeu |
| `entitlements` | `UMJP7PDY` (não órfã) e `MY5O3KWB` (**órfã**, `user_id` NULL) as duas `active`, as duas `access_until` **2026-09-22 12:00Z** |

Ou seja: os fatos do e-mail de 04/09 continuam verdadeiros hoje, e **não havia
risco de repetir o `#259`** (responder duas vezes) — só existia 1 e-mail por caixa.

**Enviado:** uid **1296** (`gutoassuncao16@`) e uid **1297** (`caplastica@`), cópia
em Enviados **confirmada** nos dois, tentativa 1. Assunto: *"Carlos, so um
lembrete: qual das duas assinaturas voce quer manter?"*.

**Por que o texto é curto, de propósito:** o de 04/09 é um muro de texto que
termina em pergunta. Repetir o muro reduz a chance de resposta. Este tem **uma**
pergunta ("qual quer manter"), diz que as duas cobram em 22/09, repete a sugestão
(manter a `UMJP7PDY`) e mantém **palavra por palavra** a posição sobre reembolso do
primeiro — devolução passa pela Hotmart, sem promessa de prazo nem valor, com
oferta de confirmar por escrito se a Hotmart pedir. Mudar de versão com aluno
cobrado em dobro é como se perde a confiança dele.

Não cancelei nada (alçada + a escolha é do aluno). **Bola com o Carlos**, sem
relógio curto: próximo débito 22/09.

## §2 — `#254`, perna DIEGO: não respondeu, não cancelei, e a cobrança vai acontecer

Executei o protocolo que a nota 15 deixou pra "ronda de ~11hZ" — **antes**, porque
ronda futura não é garantida e conferir custa zero.

- `ler_caixa --de sendzapoficial@gmail.com` → *nada encontrado*
- `ler_caixa --de admin@ag12x.com.br` → *nada encontrado*
- `entitlements`: `4UKYMN4L` (órfã) e `MYEXXEMA` as duas `active`, as duas
  `access_until` **2026-09-08 12:00:00Z**, `updated_at` parado em **16/08**.

**A frase por escrito NÃO existe.** Decisão da nota 15, que eu sustento sem
afrouxar: **não cancelar**. O motivo não envelheceu — CPF diferente
(`35579447191` × `00295425105`) e o titular Hotmart do `4UKYMN4L` é **"Roseli
Maria de Santana"**, não o Diego. Cancelar no escuro aqui é cancelar a assinatura
de **outra pessoa**. Dinheiro cobrado errado se devolve; assinatura de terceiro
cancelada por engano, não.

**Então os R$194 de 12:00Z vão sair, e registro isso como decisão consciente, não
como falha por omissão:** vira caso de **reembolso**, não de prevenção. Não mandei
3º e-mail em 48h. **Postei no grupo na hora, marcado como urgente**, pra o Johnny
poder derrubar a decisão antes das 12:00Z — a alçada de cancelar é dele. Sem
resposta, segue o padrão.

**Corrigi o título do card**, que era uma contagem regressiva (*"DIEGO renova 08/09
12hZ"*) e viraria **alarme falso vencido** às 12:00Z de hoje. Isso não é frescura:
a nota 10 registrou que exatamente esse defeito **queimou uma ronda inteira** em
06/09. O título agora enuncia a **decisão** ("DEIXADO COBRAR … tratar como
REEMBOLSO"), que continua verdadeira antes e depois da cobrança. 1 linha afetada,
conferida no `returning`.

---

## §3 — `#15`: a premissa do handoff está ERRADA (o trabalho proposto está bloqueado)

O §8 item 2 da ronda anterior mandou autopsiar as **26** gerações `ready` de 1
chunk acima de 79s, afirmando que elas *"têm o `qa` inteiro gravado"*. **Medi antes
de trabalhar em cima disso, e é falso:**

| das 26 gerações lentas de 1 chunk | quantas |
|---|---|
| **sem `qa` nenhum** (null) | **10** |
| com `qa.regens` | 16 |
| com **`qa.setup_s`** | **1** |

`7dfecacd` (14/08, 459,7s), a primeira que o handoff mandou abrir, é justamente uma
das que têm **`qa` null**. A causa é banal e previsível: os sobreviventes lentos são
de **agosto**, e a telemetria de setup só existe **desde 05/09**. A autópsia
proposta **não consegue separar "setup lento" de "chunk pendurado" em 25 dos 26
casos**, porque o campo não existe pra eles.

## §4 — O que ainda deu pra medir nos 16 que têm `regens`: regen NÃO explica

| id | dia | seg | chars | regens | flags |
|---|---|---|---|---|---|
| `5de8e601` | 24/08 | **169,9** | 78 | **0** | tudo 0 |
| `31998c0f` | 03/09 | 136,4 | 142 | 2 | cov 2 |
| `c5032b97` | 25/08 | 119,5 | 61 | 2 | cov 3 |
| `b2ab9d26` | 04/09 | 116,5 | 107 | **3** | — |
| `2d68284f` | 02/09 | 85,5 | 124 | **4** | cov 2 |

**A mais lenta de todas (`5de8e601`, 169,9s — 11× a mediana de 15,5s) tem
`regens = 0` e TODAS as flags do QA zeradas.** Zero regeneração, nada reprovado, e
ainda assim 170s. O `qa` inteiro não tem uma linha que explique o tempo dela. Essa
é a patologia num corpo que não morreu.

**Correção ao §3 da ronda anterior:** ela afirmou que em texto de 1 chunk o teto de
regen é **2** (`max_attempts = 3`). Medido: `b2ab9d26` tem **3** e `2d68284f` tem
**4**, os dois com ≤160 chars. O resgate de cobertura por sub-frase **também dispara
em texto de 1 chunk**, não só em "texto com muitos chunks". O teto de 2 não vale.

## §5 — Instrumento: `fase_corrente` só sobrevive em geração que MORREU

O §7 da ronda anterior deixou em aberto se a telemetria nova está no ar, e mandou a
próxima ronda *"medir com n que preste"* olhando gerações de produção. **Medi, e o
plano está olhando a população errada:**

| status (desde 01/09) | n | com `fase_corrente` |
|---|---|---|
| `ready` | **432** | **0** |
| `failed` | 2 | **2** |

**Zero em 432 gerações bem-sucedidas.** O `qa` final da geração que dá certo é
escrito por cima e **derruba** a `fase_corrente` do heartbeat. Consequência prática,
e é o achado que mais economiza ronda futura: **esperar o campo `meta` aparecer numa
geração `ready` é esperar uma coisa que nunca vai acontecer, por mais gerações que
rodem.** Não é imagem velha do worker, não é deploy quebrado — é onde se olhou. As 3
gerações que rodaram desde o build do worker (00:36Z) não têm `fase_corrente`
nenhuma, e isso é **esperado**, não sintoma.

As 2 `failed` que têm o campo são de **04/09**, anteriores ao deploy do `meta`
(08/09 00:35Z) — por isso não têm `meta`, e isso também é esperado. **O `chunk`/
`attempt` só vai poder ser lido na próxima geração que FALHAR.**

## §6 — O que separa quem morre não é o tamanho: é a velocidade

As 19 mortes do `#15`, 6 com `elapsed` gravado:

| id | chars | chunks | **s/chunk** | elapsed | teto estimado |
|---|---|---|---|---|---|
| `a07e9278` | 1304 | 9 | 64,3 | 579,0 | 570 |
| `44227a0c` | 895 | 6 | 80,5 | 483,0 | 480 |
| `86254b30` | 751 | 5 | 97,0 | 484,8 | 480 |
| `086970cd` | 208 | 2 | 245,8 | 491,6 | 480 |
| `7ef17c4e` | 79 | 1 | **492,1** | 492,1 | 480 |
| `2e2938b7` | 78 | 1 | **1812,0** | 1812,0 | 480 (teto velho de 30min) |

Mediana saudável: **13,7 s/chunk** (§4 da ronda anterior). **Toda** morte roda de
**4,7× a 132×** mais devagar que isso. Quatro das seis morrem a **menos de 12
segundos** do próprio teto — assinatura de job que bateu na parede, não de job que
travou; `2e2938b7` estourou o teto velho de 1800s, que é onde ele morreu.

**Hipótese que EU levantei nesta ronda e EU refutei na mesma ronda** (registro
porque a refutação vale mais que a hipótese): "o teto de `300 + 30*chunks` é
apertado demais e discrimina texto longo". Se fosse verdade, as mortes seriam
**muito** mais longas que as vivas. Medido:

| população | n | mediana chars | mediana chunks |
|---|---|---|---|
| mortes | 19 | **680** | 5 |
| vivas (desde 01/08) | 3.529 | **553** | 4 |

**680 × 553 não sustenta nada.** Tamanho **não** é o discriminador. Minha hipótese
morre aqui.

**O que sobra, e é conclusão independente:** o que mata é a geração rodar de 5× a
130× mais devagar que o normal; o teto só executa a sentença. Isso **confirma por
outro caminho** a refutação do §2 da ronda anterior ("o teto não é o que mata") —
ela olhou a população **saudável**, esta olha a população **morta**, e as duas
chegam no mesmo lugar.

## §7 — `setup_s`: o campo `elapsed` esconde mais do que se supunha

Nas 129 gerações que já têm `setup_s`:

- **26 (20%)** têm `setup_s` **MAIOR que o `elapsed_seconds` inteiro**;
- setup médio **53,6s**, máximo **106,3s**; setup é **37,9%** do tempo real.

Caso concreto: `09529f72` (06/09) tem `elapsed` 83,9s e `setup_s` **96,2s** — o
tempo real é ~180s, mais que o dobro do que a linha do banco anuncia. Em 1 de cada
5 gerações, **o campo em que todas as contas de margem deste card foram feitas
mede menos da metade do trabalho**.

---

## §8 — O que a próxima ronda faz

1. **`#254`/DIEGO, até 12:00Z:** conferir as duas caixas de novo. Se a frase por
   escrito apareceu → `cancelar_assinatura.cjs --aluno admin@ag12x.com.br --orfa
   --incidente f1ada07e --confirmar`. Se não → deixa cobrar, e **depois de 12:00Z
   a perna vira reembolso** (o título já está escrito pra isso). Não mandar 3º
   e-mail.
2. **`#254`/CARLOS:** bola com ele desde 08/09 02hZ. Não escrever de novo antes de
   ~3 dias (11/09) — foram 2 e-mails; o 3º sem resposta vira o `#259` cometido por
   nós.
3. **`#15`:** **não** repetir a autópsia dos 26 como o handoff anterior pediu — §3
   mostra que 25 deles não têm o dado. O caminho que sobra com dado real é
   `5de8e601` (170s, `regens=0`, flags limpas): é o único corpo onde a patologia
   está inteira e o QA inteiro diz "nada errado".
4. **Não esperar `meta` em geração `ready`** (§5). Só a próxima **falha** mostra
   `chunk`/`attempt`.
5. **Migration 82** continua não aplicada, aguarda Johnny.

## Pendências que atravessam rondas

| item | estado |
|---|---|
| `#15` fechado | **não** — 40 dias. Falta a próxima falha (pro `chunk`/`attempt`) ou a autópsia do `5de8e601` |
| `#254` fechado | **não** — causa da classe (`#222`) viva; estorno é da equipe de compras |
| DIEGO: R$194 em 08/09 12:00Z | **vai cobrar** por decisão consciente; vira reembolso |
| Migration 82 | não aplicada, aguarda Johnny |
| §8-2 da ronda de 00h15 ("os 26 têm o qa inteiro") | **falso, corrigido aqui** (§3) |
| §3 da ronda de 00h15 ("teto de regen = 2 em 1 chunk") | **falso, corrigido aqui** (§4) |
| §7 da ronda de 00h15 (medir `meta` em produção) | **população errada, corrigido aqui** (§5) |
