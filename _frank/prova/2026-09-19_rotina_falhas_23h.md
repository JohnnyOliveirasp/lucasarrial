# RONDA DAS FALHAS — 19/09, ~23hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_22h.md`.

**Método serial (regra 8):** peguei **UM** cartão — o `9119254c` / **#32**
(disco cheio no treino de voz, 40,6d) — e **levei até o fim**. Ele **FECHOU**.

> **O achado que resume a ronda:** o #32 estava aberto há 40 dias rastreando um
> defeito que, desde 18/09 16:02Z, **já é rastreado por outro cartão**. Os dois
> contavam o mesmo defeito vivo duas vezes na fila. Fechei o duplicado, deixei o
> vivo aberto, e **a causa física segue sem conserto em produção** — §3.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
768 lidas da pasta "Sent" = 691 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`): **0 carta
depois do corte**, veredito "buraco é PASSIVO".

Pasta **767 → 768** desde as 22hZ; tabela **690 → 691**. A carta do intervalo
nasceu com linha. As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** —
decisão de produção, não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | 22hZ | 23hZ |
|---|---|---|
| abertos | 82 | **81** |
| abertos 7d+ | 37* | **37** |
| percepção travada | — | **2** (mais velho parado há 1,4d) |

*a contagem de 7d+ era 38 quando esta ronda começou (o #32 completava 40d).
Aritmética fecha: 82 − 1 (#32 fechado) = **81** ✔, e 38 − 1 = **37** ✔.

**Classe de percepção (ordem de 17/09):** 2 cartões, e **nenhum é parada
indevida** — conferi os dois. O `#450` tem nota explícita dizendo que **não** é
caso de percepção (casou no filtro pelo texto). O `#473` aguarda a **aluna**
ouvir o áudio refeito, com instrução escrita de não escrever de novo antes
disso. Espera legítima, com dono, não silêncio.

---

## 2. O cartão que eu levei até o fim: `#32` — FECHADO POR CONSOLIDAÇÃO

`training:unknown:[errno #] no space left on device` · aberto **10/08** · 40,6d.

### 2.1 A assinatura dele morreu em 18/09, e eu provei isso

O merge **`c6b0cfb`** (PR #335, fechado no #468) deu ao disco cheio causa e
assinatura próprias — `training:infra_disk:no-space` — decididas pelo
**`trainer_stderr`** e não pelo texto do `error_message`.

Medido hoje na fonte: **6 treinos** têm ENOSPC comprovado **por texto**, de
10/08 10:39Z a **19/09 00:42Z**. Três trazem a marca no `error_message`; três
chegam rotulados `"trainer failed"`, com o Errno 28 **só no `trainer_stderr`**.
A classe está espalhada por **quatro** cartões: `#32` (3), `#465` (fixed, 2),
`#468` (fixed, o meta-cartão da fragmentação) e `#470` (3).

A última ocorrência (job `2c332ab9`) **caiu no #470**, e o `last_seen_at` do #32
ficou parado em 18/09 09:17Z. **Isso é o detector novo funcionando, não
ocorrência perdida** — conferi que o #470 registrou a mesma ocorrência e a
levou até o fim na ronda das 02hZ (aluna entregue, carta enviada, dinheiro zero).

### 2.2 Os dois alunos do cartão estão inteiros

- **marcelopersonalthe32** — falhou 10/08 10:39Z; voz `f6f82819` hoje `ready`.
  Débito −10.000 às 10:39:20 e estorno **`voice_train_refund`** +10.000 às
  10:43:26. Conferido **por `ref_type`, nunca por `kind`** (armadilha de 20/08).
- **derinsulanerjp** — falhou 18/09 09:17Z; retreino `97c7e0b5` completou
  10:48Z, voz `ac2d906f` `ready`. **Sem débito e sem estorno, e está certo**: é
  pedido **SGP `251b2b1e`**, entrega da casa.

Ninguém esperando, ninguém cobrado indevidamente, ninguém devendo.

### 2.3 Por que fechar, e o que o fecho NÃO diz

Fechei como `fixed` com `resolution_note` que abre dizendo, textualmente,
**"FECHADO POR CONSOLIDAÇÃO, NÃO POR CONSERTO"**. Manter os dois abertos contava
o mesmo defeito vivo duas vezes. O defeito **continua visível** — está no #470,
que ficou aberto e recebeu nota de referência cruzada apontando o fecho.

---

## 3. O que NÃO fecha: a causa física

Por que o `/workspace` do worker enche **não tem conserto em produção**. O
conserto existe escrito: **PR #342** (`feat/faxina-despejo-acumuladores`, a
cura — despejo dos 3 acumuladores que a faxina nunca toca) e **PR #338**
(mitigação — faxina na ENTRADA do job). Os dois seguem **abertos**.

**Não mergeei nenhum dos dois**: merge no worker recicla o endpoint de GPU em
produção, e isso é **janela do Johnny**, não decisão de ronda.

**Fato novo que justificou repetir o pedido** (critério de 16 e 17/09 — repetir
só com fato novo): a ocorrência de 19/09 00:42Z atingiu uma **entrega SGP da
própria casa** (pedido `14a932a4`, Graziela), não um retreino de aluno. O
defeito deixou de ser só risco pro aluno e passou a **atrasar o produto que a
casa entrega**. 13 dias limpos (04–16/09) viraram 6 ocorrências.

---

## 4. Achado lateral, medido e NÃO explicado — contra a CASA

Os dois retreinos que **completaram** pro `marcelopersonalthe32` (`08a1322b`
25/08 e `e602ecd7` 15/09) **não têm débito nenhum**: varri a janela inteira das
duas datas, **zero linha** em `credit_transactions`. Ele **não é equipe/admin**
(§5). São **20.000 créditos entregues sem cobrar**.

**Não abri cartão novo**: é a **mesma forma** do caso `heitorcamargo7` medido em
18/09 ("o treino que entregou sem débito nenhum"), que já tem dono no **PR #341**.
Registro como confirmação independente e **declaro que não descobri o mecanismo**.

---

## 5. >>> ERRO MEU, corrigido ANTES de virar conclusão

Medi a allowlist lendo variáveis que eu **supus** — `ADMIN_EMAILS`,
`ALLOWLIST_EMAILS` — e **quase fechei o §4 em cima disso**. A variável real é
**`COMP_ACCESS_EMAILS`** (`access-window.ts:84`).

O veredito final deu igual, **mas por sorte**: era um **zero de instrumento
cego**, a **mesma família** do erro de coluna (`notes` × `agent_notes`) que a
ronda das 22hZ escreveu contra si mesma — e a segunda repetição da família em
24h. Refiz chamando a **função de produção** (`bypassesBilling()` por jiti, com
alias `@`), com **controle positivo** (admin real do env → `true`) e **negativo**
(endereço inventado → `false`), e só então afirmei.

> **Regra que fica:** nome de variável e de coluna se confere **na fonte** antes
> de o número virar conclusão. Vale pra `select` e vale pra `process.env`.

---

## 6. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 768 = 768, 0 escrituráveis, conferida por
   instrumento independente.
2. **#32 FECHADO** por consolidação, com nota e `resolution_note` que dizem
   explicitamente que a causa **não** está corrigida. `resolved_at` conferido na
   releitura (1 linha afetada).
3. **Nota de referência cruzada no #470**, pra história do #32 não ficar órfã.
4. **Classe remedida**: 6 ocorrências ENOSPC por texto, espalhadas por 4 cartões.
5. **Errata contra mim** (§5) gravada antes de a medição virar acusação.
6. **Dois fatos postados no grupo** (regra 7): o fecho e o pedido de janela com
   o fato novo.

## 7. O que eu NÃO fiz

- **Não consertei o disco.** A causa física segue viva no #470.
- **Não mergeei o #342 nem o #338** — janela de GPU é do Johnny.
- **Não abri cartão** pro achado do §4 (já tem dono no PR #341).
- **Não estornei nada**, não mexi em crédito, acesso ou assinatura de ninguém.
- **Não escrevi pra nenhum aluno** — nenhum dos envolvidos está esperando.
- **Não gastei GPU**, não apliquei migration, não abri PR.
- **Não li a caixa do suporte@ para triagem.**
- **Nada da planilha** (ordem de 29/08).

## 8. Para quem pegar a próxima ronda

1. **A classe do disco agora é o `#470`, não o #32.** Não reabra o #32: ele está
   fechado por consolidação e a nota explica. O que falta é **janela de merge**.
2. **`COMP_ACCESS_EMAILS`** é a variável da allowlist (§5). Não confie em
   `ADMIN_EMAILS` pra decidir se alguém é cobrado.
3. **O §4 (20.000 créditos sem débito) não tem mecanismo explicado.** Se o
   PR #341 for mergeado, vale remedir o caso do Marcelo pra ver se some.
4. **Os dois cartões de percepção estão com dono e com motivo escrito** — não
   conte como parada.

---

## 9. Passo fixo de fim de ronda — o git

Registrado abaixo, depois de rodar: o log vai **direto na `main`**, sem branch de
feature (regra do registro). **Nenhum código de produto foi tocado nesta ronda**
— logo não há PR a abrir nem fix preso em branch.
