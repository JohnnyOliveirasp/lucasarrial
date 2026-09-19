# Ronda das falhas — 19/09 ~00h15Z a ~01h00Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).
Ronda anterior: `2026-09-19_rotina_falhas_00h.md`.

**O achado da ronda: a aposta da ronda anterior voltou NEGATIVA — nem o Iran nem
a Walsicleia entraram — e eu achei o instrumento que faltava pra saber por quê.
O estado do `auth.users.recovery_token` diz se o link foi consumido. Nos dois
casos ele está INTACTO: o link de formato correto nunca foi aberto.**

E escrevo junto o confundimento que impede esse instrumento de fechar a questão
hoje, porque ele fecha **depois** do merge do #346 e é isso que o torna útil.

---

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado ANTES de tocar na fila, com os dois instrumentos independentes.

```
reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  671 lidas da pasta "Sent" = 594 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 0  → nada a fazer
  ✔ 671 = 671: nenhuma carta sumiu na classificação

enviados_x_tabela.cjs  (irmão de leitura, instrumento independente)
  VEREDITO: 0 carta depois do corte ficou fora da tabela — buraco PASSIVO
```

670 → **671** desde as 00hZ. Registro local (#210) segue em **0**, como esperado
(gitignored, morre com o worktree — é por isso que a reconciliação lê a pasta).
As **77** anteriores ao corte seguem **sem decisão**, por desenho do `--corte`.

---

## Primeiro passo, que era ordem explícita da ronda anterior

*"`last_sign_in_at` do Iran e da Walsicleia."* Conferido, e a resposta é a ruim:

| aluno | carta (formato correto) | link vencia | `last_sign_in_at` | respondeu? |
|---|---|---|---|---|
| `iran@ogr.com.br` | 18/09 23:43Z | ~00:43Z | **NULL** (12,0 d) | não (para em 07/09) |
| `walsicleia_kaka@hotmail.com` | 18/09 22:48Z | ~23:48Z | **NULL** (14,4 d) | não (para em 18/09 00:28Z) |

As duas condições da regra de desempate que a ronda anterior escreveu estão
satisfeitas: **não entraram e nenhum dos dois respondeu.**

`porta_de_entrada_sgp.cjs --listar`: 105 pedidos `pronto`, **91 já entraram**,
**14 fora** — mesma lista, ninguém novo travou nesta janela, ninguém saiu.

---

## O instrumento novo: o token diz se o link foi aberto

`auth.users.recovery_token` guarda o token; quando o servidor **verifica**, o
campo é limpo. Isso transforma "o aluno abriu?" em uma coluna.

**Controle positivo primeiro, porque zero que concorda com a expectativa é
exatamente onde esta casa erra.** Peguei 12 contas com `last_sign_in_at` dentro
de 2h do `recovery_sent_at` (isto é: usaram o link). **7 estão com o campo
zerado** — o campo é limpo no consumo, o instrumento enxerga.

⚠️ **As outras 5 entraram com token `pkce_` INTACTO.** Token `pkce_` **não** é
limpo no uso. Quem medir sem filtrar colhe **zero falso** — é o quinto da casa
nesta semana. Filtre `recovery_token not like 'pkce_%'`, sempre.

Com o instrumento validado: **Iran e Walsicleia têm token intacto, 56 chars,
não-pkce.** Os links de formato correto que saíram ontem **nunca foram
consumidos**. Somado às `auth.sessions = 0` medidas em 18/09 19h45Z, são
**quatro links para a Walsicleia e zero aberturas**.

### A população, últimos 14 dias, já sem os `pkce_`

| coorte | contas | token consumido | entraram |
|---|---|---|---|
| **PUSH** (recovery carimbado a <60s da criação) | 227 | **8 (3,5 %)** | 28 |
| **PULL** (o aluno pediu o reset) | 27 | **12 (44,4 %)** | 13 |

**12,7× de diferença no consumo.**

### ⛔ O confundimento, que eu me recuso a lavar

O `action_link` quebrado **não consome o token nem quando o aluno clica**: a
sessão volta no fragmento, o servidor nunca vê o token. Então o gap de 3,5 % ×
44,4 % é **exatamente o que o defeito de formato já previa sozinho**. Ele **não
prova** a hipótese da janela de 1h.

Os únicos dois pontos **sem** confundimento são as duas cartas de formato
correto — Iran e Walsicleia, **2 de 2 não consumidas**. `n = 2` não decide nada.
A pergunta continua aberta, de propósito.

### O ganho prático: isto valida o merge do PR #346

Depois do merge, o link do PUSH passa a ter formato correto, e aí o consumo do
token vira instrumento **válido**. Pela primeira vez dá pra separar as duas
coisas que três rondas não separaram:

- token **CONSUMIDO** e sem login → o aluno **abriu e quebrou depois** (defeito que sobrou)
- token **INTACTO** e sem login → o aluno **não abriu a tempo** (a **janela** é a causa)

**Meça isso na coorte carimbada pós-merge, não só o login.** Se vier
majoritariamente intacto, mais formato não resolve e o desenho certo passa a ser
link sob demanda ou validade maior.

---

## Correção na lista dos 14 travados

Dois **já entraram por outra conta**, casados por **mesmo WhatsApp** (não por
nome parecido):

```
annagalaggi.adv@outlook.com.br -> carolina.topic@hotmail.com        entrou 14/09 01:42Z
rafaelzan@me.com               -> rafaelzanmedicdental@gmail.com    entrou 15/09 19:18Z
```

São **12 realmente fora**, não 14. Não mandem carta de desculpa pra quem já está
dentro. A Walsicleia é o oposto: **3 contas, nenhuma entrou.**

### Hipótese minha que eu mesmo derrubei

Suspeitei que as contas duplicadas escondessem **dinheiro preso** em conta
trancada. Medido: dos **199** PUSH que nunca entraram, só **6** têm conta irmã
que entrou — e **nos 6 o crédito e o acesso estão na conta que a pessoa usa**.
Não há saldo preso ali. Corrigindo a taxa **por pessoa** em vez de por conta, o
`#438` vai de 12,3 % pra **15,0 %** — **não salva a coorte**, o gap contra os
91,8 % sobrevive. O achado do cartão continua de pé depois de levar pancada.

---

## Carta individual: `edust@live.com` (regra 8)

Carlos Eduardo Silveira Leite. Conta criada 09/09 22:41Z, **9,1 dias**. É o mais
velho dos travados que **nunca tinha recebido link de formato correto** — o de
16/09 21:54Z era o `action_link` quebrado, e o token dele segue intacto desde
então. **Pagante** por assinatura (`pagou_de_verdade`: PURCHASE_APPROVED). Voz
"Minha Voz" `status=ready` desde 10/09 03:01Z e `image_ref_key` presente.
**Nunca escreveu pro suporte** — é calado, que é a classe que estourou na
Viviana.

Conferi `recovery_sent_at` **antes de gerar** (16/09 21:54Z, morto há 2 dias):
**não apaguei link vivo de ninguém.** Três pernas conferidas: **uid 2844** na
pasta de enviados + linha em `emails_enviados` (`origem=ronda-manual`,
`bounce_em` null) + `message_id <frank-1789778835934-3at97jhjy84@fastcloner.com>`,
enviada 00:47:18Z.

**A carta muda de desenho, de propósito.** O link deixa de ser o herói e o
caminho **principal** vira **pull**: *"responde esta mensagem com a palavra LINK
e eu mando outro, a qualquer hora, quantas vezes precisar"*. É a única mitigação
que não depende de o aluno acertar a janela de 1 hora — e é o comportamento da
coorte que funciona.

**O que a carta não promete:** crédito. Ele está em **-10.525** (classe do
`#341`). A carta diz que **não é dívida dele e não sai do bolso dele**, sem data.

---

## Iran: uma pista que eu registrei como pista, não como fato

Existem três contas com nome de Iran Moura:

```
iranfmoura@icloud.com  17/08 12:56Z  ENTROU 17/08 13:02Z   0 cr, sem acesso
iranfmoura@gmail.com   04/09 16:34Z  ENTROU 07/09 02:56Z   0 cr, sem acesso
iran@ogr.com.br        07/09 01:06Z  NUNCA entrou          -10.525 cr, SGP pronto
```

O login do gmail é **1h50 depois** de a casa criar a conta do SGP. A leitura que
isso sugere é que ele recebeu o link quebrado, não entrou, e caiu numa conta
antiga **vazia** — ou seja, estaria **dentro** da plataforma vendo nada, com a
voz e as fotos do outro lado da porta.

⚠️ **Isto é inferência por nome e cronologia, não prova.** O `whatsapp` está
NULL nas duas contas `iranfmoura`, então não há casamento forte como houve na
Anna e no Rafael. **Não tratei como fato, não unifiquei nada e não escrevi pro
gmail dele** — mandar dado de uma conta pro e-mail de outra vaza dado de aluno
se eu estiver errado. Quem for confirmar: peça a ele, na resposta, com qual
e-mail ele costuma entrar.

---

## Percepção (ordem de 17/09)

`percepcao_travada.cjs`: **1 card**, parado há **0,5 d** — `#450`. É o mesmo
**falso positivo do instrumento** já declarado na ronda anterior (casou pelo
texto; a própria última nota do cartão diz que não é caso de percepção). **Não
há card parado por falta de ver/ouvir/assistir nesta ronda.** (Era 13, com o
mais velho em 16 dias, quando a ordem foi escrita.)

---

## O que eu fiz (fatos consumados)

1. **Reconciliação dos envios** — 671 = 671, 0 escrituráveis, veredito passivo.
2. **Medi o desfecho da aposta anterior**: Iran e Walsicleia **não entraram** e
   não responderam.
3. **Validei um instrumento novo** (consumo do `recovery_token`) com controle
   positivo, e documentei o **zero falso do `pkce_`**.
4. **Medi PUSH × PULL** (3,5 % × 44,4 %) e **escrevi o confundimento** que
   impede de concluir hoje.
5. **Corrigi a lista dos 14** — 2 já estão dentro por outra conta (mesmo
   WhatsApp). São 12.
6. **Derrubei minha própria hipótese** de dinheiro preso em conta duplicada.
7. **Escrevi pro Carlos Eduardo** (uid 2844), o mais velho sem link bom.
8. **Anotei 3 cartões** — `#438` (11→12 notas), `#1a37605a` (12→13), `#298` (5→6).

## O que eu NÃO fiz

- **Não mergeei o PR #346.** Janela de merge segue sendo pergunta aberta ao Johnny.
- **Não mandei uma quinta carta com link pra Walsicleia.** Quatro links, zero
  aberturas: mais um é repetir o que a medição já diz que falha. O que destrava
  é canal sem clique (WhatsApp `5592992549958`), escalado em 18/09 19hZ e
  19h45Z, **ainda sem resposta**, re-escalado agora.
- **Não mandei carta pros outros 11.** É massa; falta o "pode" (regra 8).
- **Não fechei cartão nenhum.** Regra 14 inteira.
- **Não toquei em crédito, carteira nem status de ninguém.**
- **Não mexi em código do produto.**
- **Não afirmo que o Carlos Eduardo vai entrar.** A casa mandou, pela primeira
  vez pra ele, um link no formato que funciona, e um caminho que não depende da
  janela. O desfecho se mede na próxima ronda.
- **Não li a caixa do suporte@ pra triagem.** As leituras foram dirigidas
  (`--de iran`, `--de walsicleia`, `--de edust`) aos casos que eu estava tratando.
- **Não ouvi áudio e não vi vídeo** (não havia card de percepção real).
- **Não li o diff** dos PRs `#338`/`#342`/`#343`/`#345`.

---

## Para quem pegar a próxima ronda

1. **`last_sign_in_at` do `edust@live.com`.** E antes de qualquer coisa, **veja
   se ele respondeu "LINK"** — se respondeu, mande outro na hora, é uma linha de
   comando, e é o teste do desenho pull.
2. **Se o Johnny liberar o merge do #346**, a validação mudou: meça **consumo do
   token** na coorte carimbada pós-merge, não só login. Consumido-sem-login e
   intacto-sem-login são causas diferentes, e agora dá pra separar. Filtre
   `pkce_` fora.
3. **`porta_de_entrada_sgp.cjs --listar` toda ronda.** Hoje: 14 na lista, mas
   **12 realmente fora** (Anna e Rafael já entraram por outra conta).
4. **Antes de mandar carta de acesso, cheque conta irmã por WhatSapp.** Dois dos
   14 já estavam dentro. Carta de desculpa pra quem já entrou queima confiança à
   toa.
5. **A decisão da Walsicleia não é técnica.** R$ 936,15 pagos em avulsas, plan
   free, saldo 0. Mesmo entrando, cai em conta vazia. É alçada do Johnny
   (`#173`, `#290`/`#434`) e está parada desde 16/09.
