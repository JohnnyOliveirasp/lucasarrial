# Ronda das falhas — 18/09 ~23h35Z a 19/09 ~00h10Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).
Ronda anterior: `2026-09-18_rotina_falhas_23h.md`.

**O achado da ronda: o cartão `#438` nunca teve grupo de controle, e agora tem.
Medido nos últimos 14 dias — quem recebeu o link da casa entra em 12,3%, quem
se cadastrou sozinho entra em 91,8%.** O conserto existe (PR #346), eu o revisei
e aprovo, e ele está **parado** — enquanto isso a classe fabrica ~14 alunos
travados por dia.

---

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado ANTES de tocar na fila, com os dois instrumentos independentes.

```
reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  670 lidas da pasta "Sent" = 593 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 0  → nada a fazer
  ✔ 670 = 670: nenhuma carta sumiu na classificação

enviados_x_tabela.cjs  (irmão de leitura, instrumento independente)
  VEREDITO: 0 carta depois do corte ficou fora da tabela — buraco PASSIVO
```

Cresceu 668 → **670** desde as 23hZ (uma delas é a carta do Iran, abaixo). O
registro local (#210) segue em **0**, como esperado: é gitignored e morre com o
worktree — é exatamente por isso que a reconciliação lê a **pasta**. As **77**
anteriores a 14/09 14:06:31Z seguem **sem decisão**, por desenho do `--corte`.

---

## Primeiro passo, que era ordem explícita da ronda anterior

*"Confira `last_sign_in_at` da Walsicleia PRIMEIRO."* Conferido, e ampliado pros
14: **todos os 14 seguem `last_sign_in_at` NULL**, a Walsicleia inclusive.

`porta_de_entrada_sgp.cjs --listar` rodado (controle positivo do próprio script:
105 pedidos `pronto`, **91 já entraram**, 14 fora). A lista é a mesma de ontem —
nenhum travado novo nesta janela, e nenhum dos 14 saiu.

**A Walsicleia ainda não leu a carta.** `ler_caixa.cjs --de` nela: a mensagem
mais recente dela é de **18/09 00:28Z**, anterior à carta de 22:48Z. O link dela
venceu às **23:48Z**. Não é fracasso do formato — é a janela de 1 hora, e está
registrado como risco aberto adiante.

---

## O incidente que peguei: `#438` — e o controle que ele nunca teve

Peguei este pela prioridade explícita da rotina (**aluno pagante travado vem
antes da limpeza da fila**) e porque é o cartão **vivo** da classe: 14 travados,
o mais velho há 11,9 dias.

### O grupo de comparação, medido agora (últimos 14 dias)

A conta que faltava não era "quantos dos carimbados entraram" — era **contra o
quê**. Separei as contas criadas na janela por **um único fato**: recebeu ou não
o link da casa (`recovery_sent_at` a menos de 60s do `created_at`).

| coorte | contas | entraram | taxa |
|---|---|---|---|
| **CARIMBADA na criação** (link da casa) | 227 | 28 | **12,3 %** |
| **sem carimbo** (cadastrou-se e pediu o reset) | 365 | 335 | **91,8 %** |

**7,5× de diferença, na mesma janela, na mesma plataforma.** As duas coortes se
distinguem por qual link a pessoa recebeu: a segunda recebe o e-mail do
**próprio Supabase** (outro formato, outro remetente — está no docstring do
`link_de_primeiro_acesso.cjs`), a primeira recebe o da casa.

Isto é o que transforma o **6,5 %** do título do cartão — que era um lado da
conta, de coorte antiga e com contador congelado — em **medição com controle**.

### O custo POR DIA, que é o número da decisão de merge

Contas carimbadas por dia → quantas entraram:

```
05/09 13→2 · 06 16→2 · 07 23→4 · 08 15→2 · 09 12→3 · 10 20→3 · 11 24→1
12/09 14→2 · 13 25→3 · 14 10→1 · 15 11→0 · 16 12→1 · 17 16→3 · 18 16→1
```

Média **~16 contas carimbadas por dia**; pela taxa medida, **~14 delas não
entram**. Não é estoque parado, é **vazão**: cada dia fora de produção fabrica
~14 alunos novos que não conseguem entrar.

---

## O conserto: PR #346 — revisado por mim, **não mergeado**

Branch `feat/link-de-acesso-token-hash`, aberto 18/09 23:01Z pelo `coder` a quem
a ronda anterior despachou (card `289860e3`, `completed`). **Li o diff inteiro**
— worker roda em modelo barato, a qualidade é minha. Julgamento:

- Módulo canônico novo `frontend/src/lib/auth/link-de-acesso.ts` monta o link
  do `hashed_token` na QUERY. **Não toca `auth/callback/route.ts`** — correto: o
  ramo `token_hash` de lá já funciona, o defeito é em quem **monta**.
- Achou **os 4 lugares** que mandavam `action_link` pro aluno, e entre eles o
  que este cartão aponta como **origem dos 536**: `lib/payments/sgp-boas-vindas-canal.ts`,
  que carimba o recovery no instante da criação da conta. Os outros três:
  `api/v1/admin/users/recovery-link/route.ts`,
  `_frank/ferramentas/2026-09-16_porta_de_entrada_sgp.cjs` e
  `_frank/rascunhos/2026-09-09_preparar_324.cjs`.
  **A ronda anterior escreveu "não medi quantos são". Agora está medido: são 4.**
- **9 testes novos** travam a regressão (token na QUERY, nada no fragmento,
  percent-encoding, `next` externo recusado). **Mutação declarada:** revertendo
  o helper pro formato `action_link`, **5 dos 9 reprovam**.
- Suite, mesma linha de comando nas duas pontas: baseline `origin/main`
  1403/1358/**2** falhas · branch 1412/1367/**2** falhas. As 2 são pré-existentes.
- **Mudança de comportamento que registro porque não é cosmética:** o endpoint
  de admin deixou de devolver o `action_link`, e passa a devolver **500** quando
  falta `hashed_token`, em vez de `200 {link:null}`. O único consumidor
  (`RecoveryLink` em `admin/usuarios`) lê `json.link` e não mudou de forma.

**NÃO MERGEEI.** Merge pra `main` é produção, e a **janela de merge dos PRs do
worker** é pergunta **herdada e sem resposta** do Johnny (está na seção "para o
Johnny decidir" da ronda de 23hZ, junto com `#338`, `#342`, `#343`, `#345`). O
README das ordens manda: *"na dúvida entre duas, pergunte; nunca escolha em
silêncio quando envolve dinheiro de aluno."* Escalei no grupo **com o número de
cima**, que é o que faltava pra decisão ser barata.

---

## Carta individual: `iran@ogr.com.br`, o mais velho da fila (regra 8)

Iran Ferreira de Moura. Conta criada **07/09 01:06Z**, pedido SGP `pronto`, foto
pronta 01:09Z e **voz pronta 01:11Z**. `last_sign_in_at` **NULL há 11,9 dias**.

**O que ninguém tinha juntado:** o `#298` dele já tinha **duas cartas** (16 e
17/09) assumindo a falha das fotos e entregando guia pras próximas — escritas
**para alguém que nunca conseguiu abrir a tela**. O cartão de insatisfação e o
cartão de acesso eram a mesma pessoa e ninguém cruzou.

Conferi `recovery_sent_at` **antes de gerar** (16/09 21:46Z — morto há ~2 dias):
**não apaguei link vivo de ninguém**. Gerei no formato `token_hash` com a
ferramenta já corrigida e mandei: **uid 2839** na pasta de enviados + linha em
`emails_enviados` (`origem=ronda-manual`, chave `acesso-link-token-hash`). As
três pernas conferidas pelo próprio envio.

A carta (a) assume a culpa da casa pelos 12 dias e diz que o link estava
**quebrado por desenho**; (b) traz o link testado; (c) diz que vale 1 hora e que
**basta responder "quero outro link"** — que é como ele deixa de depender de
acertar a janela; (d) diz que voz e fotos estão prontas desde 07/09.

**O que a carta NÃO promete, de propósito:** data pro acerto do saldo. Ele está
em **-10.525** pelo `#341` (débito indevido do onboarding do SGP; causa já
corrigida em produção, `fdcba70`/PR #228), e a devolução daquele cartão está em
**"congela e chama" pela regra 9-B** — os 157.875 cr passam do teto diário de
100.000 e a decisão é do Johnny. Escrevi que **não é dívida dele e não sai do
bolso dele**, sem data. **Não toquei em carteira nenhuma.**

---

## Percepção (ordem de 17/09)

`percepcao_travada.cjs`: **1 card**, parado há **0,5d** — `#450`. Conferido: é
**falso positivo do instrumento**, que casou pelo texto; a última nota do
próprio cartão já declara que não é caso de percepção. **Não há card parado por
falta de ver/ouvir/assistir nesta ronda.** (Era 13, com o mais velho em 16 dias,
quando a ordem foi escrita.)

---

## ⚠️ Risco que eu NÃO sei medir — escrito como risco, não como achado

O link vale **1 hora** e é mandado por e-mail **sem o aluno ter pedido**. Carta
que chega às 23h e é lida de manhã **nasce morta mesmo no formato certo**. A
Walsicleia é o caso vivo desta ronda.

**Não consigo separar esse efeito do defeito de formato** nos números acima,
porque até ontem toda coorte carimbada recebeu link quebrado — os dois fatores
estão confundidos. Fica a pergunta com o teste já definido: **se depois do merge
a taxa dos carimbados não subir dos ~12 %, a causa que sobra é a JANELA**, e o
desenho certo passa a ser link **sob demanda** (o aluno responde e recebe outro)
ou validade maior no primeiro acesso. A carta do Iran já usa essa mitigação.

---

## O que eu fiz (fatos consumados)

1. **Reconciliação dos envios** — 670 = 670, 0 escrituráveis, veredito passivo.
2. **Medi o controle do `#438`** — 12,3 % × 91,8 %, e a vazão de ~14/dia.
3. **Revisei o PR #346** linha a linha e registrei o parecer.
4. **Escrevi pro Iran** (uid 2839), o mais velho dos 14.
5. **Anotei 2 cartões** — `#438` (9→10 notas) e `#298` (4→5).
6. **Postei no grupo** — a carta + as duas decisões que dependem do Johnny.

## O que eu NÃO fiz

- **Não mergeei o PR #346.** Janela de merge é pergunta aberta ao Johnny.
- **Não mandei carta pros outros 12.** É massa; falta o "pode" (regra 8).
- **Não fechei cartão nenhum.** O `#438` segue `open` (13 de 14 travados, o
  conserto fora de produção) e o `#298` segue `aguardando_aluno`. Regra 14
  inteira.
- **Não toquei em crédito de ninguém**, não criei estorno, não mexi em carteira.
  A devolução do `#341` é do Johnny pela 9-B.
- **Não mexi em código do produto.**
- **Não afirmo que o Iran vai entrar.** A casa mandou, pela primeira vez, um
  link no formato que funciona. O desfecho se mede na próxima ronda.
- **Não li a caixa do suporte@ pra triagem.** A única leitura foi
  `--de walsicleia`, dirigida ao caso que a ronda anterior mandou conferir.
- **Não ouvi áudio e não vi vídeo** nesta ronda (não havia card de percepção).
- **Não li o diff** dos PRs `#338`/`#342`/`#343`/`#345`.

---

## Para quem pegar a próxima ronda

1. **`last_sign_in_at` do Iran e da Walsicleia.** Entraram → o formato novo está
   provado em aluno real, e não só na conta da casa. Não entraram e **nenhum dos
   dois respondeu** → o suspeito passa a ser a **janela de 1 hora**, não o formato.
2. **Se o Johnny liberar o merge do #346**, o teste que o valida é a coorte
   carimbada dos dias seguintes: ela tem que sair dos ~12 % em direção aos 91,8 %.
   **Meça por dia** — a consulta está na nota do `#438`.
3. **`porta_de_entrada_sgp.cjs --listar` toda ronda.** Nesta ronda não nasceu
   travado novo; foi a primeira janela assim.
4. **Cruze cartão de atendimento com acesso.** O Iran recebeu duas cartas sobre
   qualidade de foto enquanto não conseguia abrir a tela. Antes de responder
   qualquer queixa, confira se o aluno **consegue entrar**.
