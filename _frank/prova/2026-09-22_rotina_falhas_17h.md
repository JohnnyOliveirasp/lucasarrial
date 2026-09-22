# Ronda das falhas — 22/09/2026, ~16h40–17h15Z

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou
reprocessado.

**Uma linha:** peguei a fila pela regra 8 e descobri que os **quatro cartões
mais velhos da casa não esperavam apuração — esperavam o Johnny**. Medi a
classe: **19 cartões, 60 alunos, o mais velho de 54 dias**. No caminho achei
que a **migration 111 saiu hoje às 15:13Z** e isso **fechou 2 cartões** e
**inverteu uma recomendação que eu mesmo tinha dado ao Johnny 5h antes**.

**Cartões fechados: 2 (`#446`, `#214`). Alunos escritos: 0 (os dois já tinham
sido respondidos, e explico por que não reescrevi). Fix em produção: 0 meu — o
que entrou foi a migration do Johnny. Dinheiro devolvido: 0 por mim.
Escritas em banco: 3 (nota+fechamento no `#446`, nota+fechamento no `#214`,
nota no `#341`). Posts no grupo: 1 (consolidado).**

---

## 0. Passos fixos

| passo | resultado |
|---|---|
| `git pull --ff-only` na main | atualizado, sem divergência |
| **Reconciliar envios da pasta** (#101) | 1029 lidas · 952 já tinham linha · **0 dentro da janela sem linha** · 77 fora do corte · fecha 1029 = 1029 |
| `2026-09-18_enviados_x_tabela.cjs` (independente) | veredito **0 carta depois do corte** fora da tabela — buraco PASSIVO |
| `percepcao_travada.cjs` (ordem 17/09) | controle positivo OK (#310) · 509 varridos · **0 travados em percepção** · mais velho 0d |
| `varredura_travados.cjs` | 1 preso · **105 abertos** · 36 aguardando aluno · 0 fechado sem retorno |
| `2026-09-19_idade_dos_abertos.cjs` | 105 abertos · **53 com 7d+** · 2 patches · 146 recados |

Nenhum `⚠️ <tabela>:` e nenhum "consulta FALHOU" — os zeros são **medidos**.

---

## 1. O achado da ronda: a cabeça da fila não está travada em apuração

Peguei a fila pela regra 8 (o mais antigo com aluno afetado) e li os quatro
primeiros **até o fim**, um a um. Os quatro pararam no mesmo tipo de passo:

| cartão | idade | o passo que falta |
|---|---|---|
| `#15` d3d8d1b2 | 54d | PR #404 aberto, esperando merge |
| `#214` ffbfdfc4 | 22d | migration 111 rodar |
| `#216` 8b8fc4c8 | 21d | mão humana no painel da Hotmart |
| `7ed72ad0` | 21d | 7.455 cr: estornar ou não |

Nenhum deles esperava medição. **Cada ronda anterior fez a parte dela, escreveu
"escalado ao grupo" e seguiu.** O que ninguém tinha medido é o TAMANHO disso —
e sem o tamanho, cada ronda re-escala UM caso, o Johnny recebe pedidos pingados
e o backlog parece "em andamento" quando está em fila de espera por ele.

É a doutrina da ordem de 17/09 (percepção não é desculpa pra parar) aplicada a
**decisão**: "esperando o Johnny" também não pode ser parada permanente e
invisível. A diferença é o desfecho — aqui não se despacha pro `olho`, junta-se
num **lote**.

Instrumento novo, **só leitura**, commitado:
`_frank/ferramentas/2026-09-22_esperando_johnny.cjs`.

### 1.1 Não reportei o número cru, porque ele é falso

A marca crua devolve **34 cartões**. Li 6 à mão e **2 eram falso positivo** —
`b0ddd483` só CITAVA "#214 e #226 estão em decisão do Johnny" para justificar a
escolha do cartão, e `dd1764e9` tem o próximo passo no coder. ~33% de inflação,
exatamente a doença que o `percepcao_travada.cjs` documenta (41 falsos onde
havia 1).

Então classifiquei os 34 com **duas leituras independentes** e cruzei:
concordância = conta; divergência = fica de fora, listado à parte. O número do
relatório é o **piso**, não o teto.

> **NÚMERO: 19 cartões parados em decisão do Johnny · 60 alunos distintos ·
> mais velho 54d.** (11 falsos positivos descartados, 4 contestados fora da
> conta; teto se os contestados valerem: 23.)

### 1.2 Defeito que eu mesmo introduzi na mesma ronda, medido e declarado

Ao anotar o `#341` (b633b18c) — cartão que **está** esperando o Johnny — minha
nota não repetia nenhuma marca, e **o cartão sumiu da varredura na hora**, sem
nada ter sido resolvido. Ler só a última nota tem esse preço: **quem anota,
esconde.** É a mesma doença do rótulo `aguardando_aluno`: o cartão não muda de
estado, só fica invisível.

Mitiguei somando as regras de alçada (9-A/9-B/9-C, "acima do teto") às marcas —
quem escreve uma nota dessas quase sempre cita a regra que o impede de agir.
**Não é cura:** se a próxima nota não citar nada, o cartão some de novo. A regra
está escrita no cabeçalho do script: *quem anotar cartão que segue parado no
Johnny, repita na nota o que falta, com essas palavras.*

O conserto valeu: as marcas novas trouxeram **6 cartões que o corte anterior não
via**. Li os 6 à mão — **3 eram reais**, e um deles é dos mais graves da lista
(`09a26f8b`, reembolso pedido com **CDC art. 49**, dormindo há 14 dias).

---

## 2. A migration 111 saiu hoje — e isso fechou 2 cartões

Descobri lendo o `scripts/111_estorno_zera_credito.sql` para confirmar que
estava pendente: o **cabeçalho** hoje começa com *"APLICADA EM 22/09/2026 (aval
do Johnny)"*. A linha *"🚨 ESTADO EM 15/09: NÃO APLICADA"* **continua no corpo
do arquivo, abaixo** — e foi ela que fez a minha própria nota das 11h46Z
escrever "falta a MIGRATION RODAR". **Quem ler esse arquivo de baixo pra cima
erra de novo: o estado vale no cabeçalho.**

**Não acreditei no cabeçalho** (DDL declarado não é DDL aplicado — a armadilha
de sempre, aqui invertida). Prova **positiva**, medida no banco:

| medição | resultado |
|---|---|
| `credit_transactions` de hoje, `ref_type='estorno'` | **10 lançamentos**, todos em `15:13:26.705Z`, soma **exata −1.456.335** |
| saldo depois | 8 em 0; 1 em −11.575 (extra já era negativo — a regra zera só `credits_subscription`, como previsto) |
| perfis da classe (`entitlements` refunded/chargeback) ainda com saldo | **0** — pegou a classe inteira |
| `payment_events` com `processed_at` NULL | **0** — os 6 eventos presos saíram |
| último erro `Could not find the function` | **21/09 17:18Z**; nenhum depois |

**Limite declarado:** 4 dos 16 entitlements refunded/chargeback estão **sem
`user_id`** e ficaram fora da conta de saldo. Não têm perfil pra zerar, mas não
os inspecionei um a um.

### 2.1 Inverto uma recomendação que eu dei hoje de manhã

Às 12h05Z eu recomendei ao Johnny, em ordem de risco: **(1) mergear o PR #323**
como ponte, (2) aplicar a 111, (3) decidir os 1.456.335 cr. Ele fez o (2) e o
(3) direto, **sem a ponte**.

O #323 existia para o webhook não quebrar **enquanto a função não existisse**. A
função existe. **Mergear agora não adiciona proteção e adiciona risco** — o
branch está 246 commits atrás da main e tocaria `route.ts`/`refund.ts` sem
necessidade. **Recomendação revisada: FECHAR o #323 sem merge**, como o próprio
cabeçalho da migration antecipou. Fechar PR é do Johnny; não fechei.

### 2.2 `#214` (ffbfdfc4) — item serial, levado até o fim e FECHADO

Era o mais antigo com aluno afetado depois do `#15` (que está no merge, passo
que não é meu). 22 dias.

O que era: aluna relatou ter pago 20,91 EUR e ver 0 créditos. Nunca foi compra
órfã — ela tem **duas contas**, pagou numa e reclamava da outra. Depois disso
**contestou** (PROTEST 01/09) e **foi reembolsada** (REFUNDED 07/09): o dinheiro
voltou pra ela e o acesso foi revogado no mesmo ato. Hoje a 111 zerou os 93.305
cr que restavam.

**Nada é devido a ela.** Foi respondida em 21/09 (Enviados uid 3125) sem
promessa de saldo — por isso o zeramento de hoje **não desfaz promessa nenhuma**.
**Não reescrevi:** a carta de 21/09 já dizia que o acesso acabou e a cobrança
voltou; avisá-la agora de que "zeramos os créditos que você já sabia que não
tinha mais" não lhe dá nada acionável.

**Encerro uma escalada que eu mesmo abri:** a nota de 21/09 22:44Z pedia ao
Johnny uma regra pra "estorno depois de ter pago". Aquela pergunta já estava
respondida desde 18/08 (commit 07767682) e foi executada hoje. **Retirei o
pedido** — um item a menos na mesa dele.

---

## 3. Saldo negativo: classe medida, anotada no cartão que já existe

A conta do `#214` terminou com saldo **total** negativo (−11.575). Fui ver se
era caso isolado. **Não é** — varrendo `profiles` inteiro, paginado:

- **31 perfis** com `credits_extra` negativo, soma **−288.772 cr**;
- **13** com saldo **TOTAL** negativo — não conseguem gerar nada, porque o portão
  é o crédito;
- os valores são **exatos demais**: 10 perfis em −11.575, o resto em −10.525.

O grupo dos −10.525 é o resíduo do onboarding do SGP e **já tem cartão**
(`#341` b633b18c, parado no teto da 9-B). O grupo dos −11.575 tem a **mesma
forma** e **não** aparece na contagem daquele cartão. **Não afirmo que é a mesma
causa** — não rastreei os lançamentos que produziram o −11.575. Fica a pergunta
medida, não a conclusão. Anotei lá; **não abri chamado novo** (checagem 1 da
ordem de 27/08).

⚠️ **`iran@ogr.com.br` está nessa lista** — é o aluno do `#298`, o caso que
originou a ordem de 17/09.

**Risco declarado:** saldo negativo não é cosmético. Se qualquer uma dessas
pessoas **voltar a pagar**, o crédito novo é comido pelo resíduo antes de virar
uso — ela paga e continua sem gerar. Não há sangria agora (contas free, sem
acesso); o dano aparece no instante em que o aluno volta a ser pagante.

---

## 4. Sinal novo que eu vi e NÃO transformei em chamado

`PURCHASE_CANCELED` gravando `externalId não casa com nenhum entitlement`
aparece **24x** nos últimos dias, concentrado em poucos compradores (um deles
sozinho tem **13 em ~40 min** em 21/09). **Todos com `processed_at` preenchido**
— não travam o webhook e não são a classe do `#446`. Não medi se é defeito nosso
ou cancelamento de assinatura que nunca virou entitlement. Registrado na nota do
`#446`; **não inventei urgência** e não achei cartão com essa assinatura.

---

## 5. O que eu NÃO fiz, e por quê

- **Não mergeei nem fechei PR nenhum** — é do Johnny.
- **Não mexi em crédito, saldo, acesso, plano ou assinatura.** Os 19 cartões da
  lista são, em maioria, dinheiro acima da minha alçada.
- **Não repinguei o `#506` isolado**: a ronda das 15h40 já tinha pingado **40
  minutos antes**. Entrou no lote consolidado, marcado com o relógio — repetir
  sozinho em 40 min seria ruído no canal.
- Não li a planilha (ordem de 29/08). Sem GPU, sem migration minha, sem retreino.
- **Não tratei os outros 100 abertos**: a regra 8 é serial de propósito.

---

## 6. Para a próxima ronda

0. **`#15`: PR #404 continua esperando merge.** Card "completed" não é produção.
   Ao fechar, some os curados por retry (`request_attempts > 1` em `ready`).
1. **`#506` (1a9e6133): se amanhecer 23/09 sem resposta, a janela dos TRÊS
   fechou.** Registre como fato, trate como exceção (família do `#207`). **Não
   invente prazo novo.** Os dois de 28/09 têm margem — não misture.
2. **Rode o `2026-09-22_esperando_johnny.cjs` toda ronda** e leve o lote **de
   uma vez**. Re-escalar um caso por ronda é o que produziu os 54 dias.
3. ⚠️ **Se você anotar um cartão que segue parado no Johnny, REPITA na sua nota
   o que falta** ("decisão do Johnny", "9-A", "aguardando merge"). Sem isso ele
   some da varredura — aconteceu comigo nesta ronda, no `#341`.
4. **Cartões `NÃO TRIADOS` na saída do script têm de ser lidos à mão.** Não
   conte como real sem ler; não descarte sem ler.
5. **O estado da `scripts/111` mora no CABEÇALHO.** O "NÃO APLICADA" de 15/09
   continua no corpo e já enganou a minha nota das 11h46Z.
6. **PR #323 deve ser FECHADO, não mergeado** (virou código morto em 22/09).
7. `emails_enviados` só cobre a partir de **14/09 14:06Z** — use a pasta
   Enviados para concluir "nunca escreveram". As **77 cartas** anteriores ao
   corte seguem sem decisão.
