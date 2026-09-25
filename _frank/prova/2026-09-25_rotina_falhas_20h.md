# Ronda das falhas — 25/09/2026, ~20hZ

**Método: serial (regra 8, ordem de 21/08).** Um caso levado até o fim antes de
pegar outro. Esta ronda **não fecha o caso do aluno** e diz exatamente em que
passo ele parou e de quem é o passo — não é ronda incompleta disfarçada.

**Produção tocada: ZERO.** Zero merge, zero deploy, zero GPU, zero migration,
zero DDL, zero crédito movido, zero carta nova a aluno, zero link gerado, zero
vítima nova. O que subiu foi **medição** e **verdade na fila**.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

- **1310** cartas lidas da pasta `Sent`, 1310 com cabeçalho lido.
- **1233** já tinham linha. **0 escrituráveis** dentro da janela.
- 77 fora da janela (decisão do `--corte`, não defeito).
- Contagem fecha: **1310 = 1233 + 0 + 77 + 0**. Nenhuma carta sumiu na
  classificação.
- Registro local (#210) não existe nesta máquina — *gitignored*, morre com o
  worktree. É o buraco que esta reconciliação compensa.

Instrumento independente (`2026-09-18_enviados_x_tabela.cjs`): **0 cartas**
depois do corte fora da tabela. Veredito: o buraco é **passivo**. Bate.

## Passo fixo 2 — estado da fila (início)

**166 → 165 abertos** na abertura (open 14 · investigating 112 ·
aguardando_aluno 39). Idade: 30d+ **1** · 15–30d 37 · 7–15d 59 · 3–7d 30 ·
<3d 38. Patches do Vigia esperando: **1** (`patch_cfde107d`). Recados
`para_frank_*`: **141**.

## Passo fixo 3 — percepção travada (ordem de 17/09)

`percepcao_travada.cjs`: **1** cartão (`#580`, 0,0d parado). Tratado nesta
ronda — ver § "o falso positivo da marca". Ao fim da ronda: **0**.

---

## A escolha do serial

O mais velho da fila segue sendo o **`#52` / `37bacb68`** (37,0d, 22 alunos) e
segue **travado na decisão de produto do Johnny** via `#702cc916` (24 dias).
Não o peguei, pelo motivo já medido na ronda das 18hZ — e o
`esperando_johnny.cjs` confirma hoje que ele está na classe "contestados" com a
anotação *"travado na MESMA decisão (a)/(b)/(c) do 702cc916 — 1 pergunta, não 2"*.

Peguei o que a **prioridade** manda pegar antes da limpeza da fila: **aluno
esperando, com promessa da casa vencendo amanhã**. `rafaelzan@me.com` abriu
**3 cartões em 90 min** e é, ao mesmo tempo, o único cartão da classe de
percepção. Duas ordens apontavam para o mesmo caso.

---

## O caso: a casa prometeu crédito a quem, pela nossa própria regra, não compra crédito

### O que o Vigia deixou na mesa (14-A: ele mediu e anotou, não decidiu)

O `#505` ("ENTREGAMOS O CLONE E TRANCAMOS A PORTA") foi **fechado como
não-defeito em 21/09**: comprar o SGP é produto de CURSO e não dá a plataforma
(regra do Lucas, 31/08). Em 25/09 o Vigia mediu a mesma régua e a classe tinha
ido de **39 → 55**, apontou que os três "não consigo entrar" do dia pertenciam a
ela, e registrou a contradição: a casa escreveu ao Rafael, **pagante de R$894**,
que a falta de acesso dele era *"UMA FALHA NOSSA"*, com promessa de crédito e
**prazo de amanhã**. Ele declarou que não escolhia entre as duas leituras.

Estava certo em não escolher. **Mas havia uma medição capaz de decidir metade
da questão, e ninguém a tinha feito.**

### A pergunta que o `#505` nunca fez

O `#505` mediu *"20 dos 39 têm compra paga conferida"* — e **não perguntou QUAL
compra**. Era a única pergunta que mudava a decisão, porque separa dois casos
que o cartão tratava como um:

| caso | quem decide |
|---|---|
| comprou **só curso** (7283229 SGP / 7283335 Fábrica) → não ter plataforma é o **contrato** | decisão comercial, do Johnny |
| comprou a **plataforma** (7851642) e está sem entitlement → é **pagante trancado** | **defeito nosso, dono meu, não espera ninguém** |

Classe fechada como "todos por desenho" é exatamente onde o segundo caso se
esconde — e o manual manda desconfiar de `ignored` com `last_seen_at` recente.

### O split, medido (instrumento commitado, regra 25-B)

`_frank/ferramentas/2026-09-25_sgp_trancado_por_produto.cjs`

A régua do título reproduziu **55 alunos** — **o mesmo número do Vigia, por
código independente**. E o split:

```
classe 55 = 1 com compra de PLATAFORMA + 28 só CURSO + 26 sem compra NESTE e-mail
```

### O único "pagante de plataforma trancado" é a conta da própria casa

`jmo.usa.007@gmail.com`, **26,8d — o mais velho da classe**, com duas compras do
produto 7851642. Medido antes de agir, e **não é aluno**:

| campo | valor |
|---|---|
| `profiles.display_name` | **"Carolina Bezos"** (a persona da Carol) |
| `raw_event.subscriber` | **"Johnny Oliveira"** · plano **"Plano Founder"** |
| entitlement 7851642 | `status='canceled'`, `access_until` 09/09 12:00Z (vencido) |
| pagamentos | 3 recorrências **20 USD** (09/06, 09/07, 09/08), assinatura cancelada |
| créditos 0 | `perdao_negativo_onboarding` (+10.525, −10.525 → 0), nota: *"decisão do Johnny, 30/08/2026 … nenhum crédito positivo concedido"* |

Assinou, pagou 3 meses, **cancelou**, o acesso venceu e o saldo foi zerado pelo
próprio Johnny **por escrito**. É a **REGRA FINAL DE CRÉDITO de 20/08
funcionando**, não defeito.

> **Consequência:** a classe dos 55 **não esconde nenhum pagante de plataforma
> trancado. ZERO.** A metade tecnicamente verificável da objeção do Vigia foi
> testada e **não se sustenta**. O fechamento do `#505` está certo — agora por um
> motivo mais forte do que o que o fechou.

### Controle positivo, porque "zero" meu não vale sem ele

Antes de qualquer número o script exige que o classificador **enxergue** pagante
de plataforma conhecido: de **40** alunos com entitlement ativo de plataforma,
ele vê compra de plataforma em **25**. Se fosse **0** o script **aborta** (e
aborta mesmo — é `process.exit(3)`).

**Não arredondo 25/40 para cima.** O classificador não é cego, mas 25 de 40
significa que os baldes **negativos podem esconder** um comprador de plataforma
que comprou com **outro e-mail**. Por isso os 26 saem rotulados **"SEM COMPRA
NESTE E-MAIL"** e nunca "não pagou" (armadilhas #214/#218), e quem decidir
dinheiro sobre um negativo daqui confirma no `pagou_de_verdade.cjs` (Hotmart
viva) antes. **Não fui na Hotmart viva para os 55** — só para o `jmo`.

A lista de produtos de curso do script é conferida **contra o fonte**
(`PRODUTOS_DE_CURSO_PADRAO` em `acesso-regra.ts`) em tempo de execução, e ele
sai com erro se divergir. Conferido: **BATE**.

### Onde o defeito realmente está: no que a casa ESCREVEU

`rafaelzan@me.com` está no balde **só curso** — `7283229 = R$597`. Os dois
pagamentos dele (R$597 + R$297 / 7283335) são **produto de curso**, e nenhum é a
plataforma. E a casa escreveu hoje, duas vezes:

> 16:33Z — *"essa compra não liberou o seu acesso na plataforma, **POR UMA FALHA
> NOSSA**"*
> 17:27Z — *"**eu te aviso** neste mesmo e-mail assim que os **CRÉDITOS
> ENTRAREM**. **SE PASSAR DE AMANHÃ** sem notícia minha, responde aqui."*

Prometemos a um comprador de R$894 um crédito que a regra da casa decidiu não
dar, **com prazo de amanhã**. O defeito não está no código nem no `#505` —
**está na carta**.

### ⚠️ Correção de nota minha, da ronda das 18hZ

A minha própria nota no `#581` dizia: *"O que falta é CRÉDITO … **Não é decisão
do Johnny: é pipeline quebrado**"*. **Está errado, e o erro é meu.** Não há
pipeline quebrado no caso dele: o webhook fez exatamente o que foi mandado fazer
para produto de curso. Eu li *"zero entitlements"* como ausência defeituosa
**sem olhar qual produto gerou a compra** — o **mesmo erro de classe** que o
`#505` cometeu ao contar cabeças em vez de produtos.

> **Régua:** "não tem entitlement" não é defeito até se saber **o que a pessoa
> comprou**. Ausência de direito para quem não comprou o direito é o contrato,
> não bug.

### Por que NÃO escrevi ao aluno hoje, tendo prazo amanhã

Não seguro por comodidade. A única carta honesta que existe hoje depende de uma
decisão que **não é minha**: regra do Lucas de 31/08 (curso não dá plataforma)
× weekly do Johnny de 14/09 (SGP = 30 dias). Pelo índice, **ordem mais nova
vence** — mas a migration 115 **nunca foi aplicada** e o `trial-prazo.ts`
**segue sem consumidor fora dos testes** (reconferido hoje). As duas leituras
estão vivas ao mesmo tempo.

- Mantida a regra do Lucas → a carta certa é **correção + desculpa** pelo
  diagnóstico errado, e a plataforma é assinatura separada.
- Mantido o weekly de 14/09 → a promessa que já fizemos **está certa** e basta
  cumprir.

Escrever hoje sem a decisão seria a **terceira versão do mesmo fato em 24h para
o mesmo aluno**, e credibilidade com ele é a única coisa que ainda temos.
**O prazo que a casa deu é "amanhã" e não vence hoje.**

**E não vira parada permanente:** se a decisão não vier até amanhã, **a carta
sai mesmo assim** dizendo a verdade crua — o que medi, que o diagnóstico
anterior estava errado, que a regra do produto está sendo decidida pelo dono, e
que ele não perdeu nada do que comprou. Silêncio não é opção; foi o que fez a
Viviana explodir.

---

## O falso positivo da marca de percepção (medido, e por isso NÃO mexi no script)

O `#580` entrou na classe de percepção por conter, na última nota, a frase
literal **"O QUE PRECISA DE OLHO HUMANO"**. Lida no contexto, ela significa
*"isto precisa de uma DECISÃO de gente"* — **não** *"alguém precisa olhar um
artefato"*. Não há imagem, áudio nem vídeo para despachar; o artefato não
existe.

Apliquei a **opção 2** da ordem de 17/09 (declarar o bloqueio REAL com motivo
concreto e data): o passo que falta é a decisão comercial, escalada no grupo
nesta ronda, com prazo nomeado para amanhã.

**Não alterei o `percepcao_travada.cjs`.** O filtro dele já foi calibrado duas
vezes (17/09 e 21/09) e apertar a régua com base em **um** caso é o caminho
mais curto para ele deixar de ver um caso real — o erro caro aqui é o **falso
negativo**, não o falso positivo, porque falso negativo devolve a classe ao
silêncio de 16 dias que a ordem existe para quebrar. Fica registrado como
observação medida, não como conserto.

---

## O que gravei na fila

| cartão | ação | por quê |
|---|---|---|
| `#505` (`1e2cf1fe`) | **nota**, status **inalterado** (`ignored`) | responde a objeção do Vigia **com número**; o fechamento estava certo. Não reabri |
| `#581` (`3530f9cd`) | **nota**, status inalterado | o `product_code` do aluno + a correção da minha nota errada, para a carta de amanhã nascer em cima de fato |
| `#578` (`e1d3f53c`) | **ignored** — duplicata | mesmo aluno/queixa; caso vive no `#581` |
| `#580` (`7fd2f333`) | **ignored** — duplicata | idem; era o cartão da classe de percepção |

Os dois fechamentos são **duplicata, não "resolvido"** — está escrito assim na
`resolution_note`. O aluno **foi** respondido (uid 3478, 18:25Z, sem bounce) e o
caso segue **aberto** no `#581`. Fechar as duplicatas não é cosmético: **tratar
este caso em paralelo gera dano**, porque cada passe novo gera um link de
primeiro acesso e **invalida o anterior** — foi exatamente o que confundiu o
atendimento hoje.

Todas as escritas por `anotar_incidente.cjs --confirmar`, **conferidas na
releitura: 1 linha afetada cada**.

---

## Grupo (regra 7 — só fato consumado)

Uma mensagem, pelo `notify-grupo.sh` (ordem de canal de 31/08): a decisão que
**vence amanhã**, reduzida a **uma pergunta binária** com as duas saídas já
escritas e os 28 alunos contados; o "zero pagante de plataforma trancado"; os 2
duplicados fechados; e o tamanho da fila dele (18 cartões, 53 alunos, mais velho
24d). Sem log de terminal, sem bloco de código, sem progresso parcial.

A doutrina de 17/09 aplicada a DECISÃO manda **juntar em lote** em vez de
re-escalar um caso por ronda. Levei **um** caso com prazo, e **declaro** que não
triei os 18 nesta ronda — o lote segue devendo.

---

## Fila ao fim da ronda

**163 abertos** (de 165): −2 duplicatas. Percepção travada **1 → 0**.
`<3d` 38 → 36.

### Pendências nomeadas (paradas, não "em andamento")

1. 🔴 **A decisão de amanhã** — curso dá ou não dá plataforma. Destrava 28
   alunos nomeados **e** a carta do Rafael. Regra do Lucas 31/08 × weekly do
   Johnny 14/09; migration 115 nunca aplicada.
2. 🔴 **`#702cc916` — 24 dias**, decisão de produto. É o que destrava a cabeça
   da fila (`#52`, 37,0d, 22 alunos). Não é omissão da ronda.
3. **Fila de decisão do Johnny: 18 cartões, 53 alunos, mais velho 24d.** O lote
   não foi montado nesta ronda.
4. **Os 26 "sem compra neste e-mail"** do split: **não** estão provados como
   não-pagantes. Confirmar na Hotmart viva antes de qualquer decisão de dinheiro.
5. **`patch_cfde107d`** do Vigia esperando revisão. Não foi esta ronda.
6. **O quarto vazio** — 3 de 3 alunos que entraram hoje escreveram "não
   funciona" em 4–60 min. A porta abriu (fix do `#435`), mas o app não explica
   nada a quem tem 0 crédito. **Não abri cartão**: o que a tela deve dizer
   depende da decisão do item 1, e escrever a mensagem antes da regra seria
   refazer depois.
7. **141 recados `para_frank_*`**, o mais velho com 21,8d.
8. **77 cartas anteriores a 14/09** — segue sem decisão de escrituração.
9. **`sgp_fracassos` com 0 linhas** — indistinguível entre "sem falhas" e "não
   grava". Resolve-se na próxima falha real do SGP.
