# 22/09 — Relatório noturno

**Postado no grupo** (`notify-grupo.sh`), ordem de 31/08. Consolidado do dia
inteiro numa mensagem só; as rondas já postaram os fatos consumados (regra 7) e
não se repetem aqui.

Fechado às **23/09 ~01:40Z** (o dia 22/09 teve ronda até 01hZ do 23).

⚠️ **O relatório de 21/09 não existe.** Procurei por arquivo e por commit: o
último é o de 20/09 (`9efd74db`, 21/09 01:10Z). O dia 21/09 teve 16 rondas e
**nenhum consolidado**. Não é a primeira vez — 18/09 e 19/09 já tinham falhado
junto (descoberto em `89f98d5c`). Registro aqui porque silêncio não pode parecer
saúde, e a falha é minha.

---

## 1. O que eu resolvi

### 1-A. Três cartões fechados — conferidos por `resolved_at` no banco

| cartão | o que era | quando |
|---|---|---|
| **`66c5c55a`** | o código que zera crédito em estorno tinha subido **sem a migration** e quebrava o webhook da Hotmart | 16:54Z |
| **`ffbfdfc4`** | aluna pagou assinatura em 27/08 (20,91 EUR, comprovante Millennium) e o pagamento não aparecia | 16:55Z |
| **`88550a1f`** | e-mail não chegava num endereço que não existe (`ricongociosonline@`, letra trocada) — fechado `ignored` | 16:05Z |

O que mais importou é o **`66c5c55a`**, e ele merece o parágrafo: a **migration
111 foi aplicada hoje com o seu aval**, e com ela vieram **10 contas zeradas à
mão (1.456.335 cr)** e **6 eventos do webhook** que estavam presos desde que o
código subiu sozinho. Era a mesma pendência que segurava o `#214` e o `#446` —
dois cartões que pareciam assuntos diferentes e eram um só.

### 1-B. 34 cartas escritas à mão, para 18 alunos

Separadas do automático por `origem` (`ronda-manual` + `fast-resposta`); as
outras 64 do dia são código (boas-vindas, códigos do SGP, avisos de onboarding).
As que fecham assunto:

- **Filipe/Moysés** — achei a causa da cobrança (ele tinha **duas** assinaturas),
  cancelei e confirmei na fonte viva (`OVPDAWS5` → `CANCELLED_BY_SELLER`).
- **Bárbara** — "não cancele, está certo do jeito que está": ela ia cancelar por
  um erro de leitura nosso.
- **Wallana** — já tinha pago e estava parada achando que faltava pagamento.
- **Rodrigo Sirahata** — áudio falhou hoje, créditos já devolvidos antes da carta.
- **Valdemir** — vídeo olhado quadro a quadro, com a causa nomeada.
- **Walsicleia**, **Diego Vargas**, **Junqueira**, **Leandro**, **Simone**, **Luis**.

### 1-C. Dois números meus que não sobreviveram à conferência

1. **O detector de percepção ia reportar 1 onde o real é 0.** O quarto falso
   positivo da mesma família: a marca `ouvido humano` casou **dentro de** "**não
   pedi** ouvido humano". Com um só cartão na classe, um falso positivo é 100%
   do número. Consertado com anulador de negação **e controle negativo embutido**
   (se o `#518` voltar a contar, o script morre em vez de imprimir número).
   **31/31 testes passando**, eram 29.
2. **"A frota voltou" — estava errado.** Li `hasResult:true` em 7 operários e
   quase reportei a casa de pé. O `delegate-cli` imprime o turno como concluído
   e **só depois** erra com `Not logged in`. Eu media o campo errado.

E uma terceira que evitou estrago: ia executar o cancelamento do Moysés porque o
recado dizia "ação pendente" — **fui conferir antes de tocar em coisa
irreversível e já estava feito** desde 10:46Z. Não cancelei duas vezes.

### 1-D. O achado do fim da noite: uma pagante invisível há 16 dias

A varredura acusou "acesso vivo, com crédito e sem nenhuma voz pronta: 1". O
instrumento avisa que acesso vivo ≠ pagou, então fui conferir — e ela **pagou**:

```
HP0919870480   597 BRL    COMPLETE  05/09   Sistema de Geração Pronto
HP0846368115   47,94 GBP  COMPLETE  05/09   Fábrica de Conteúdo Invisível
```

**Hellen Grasso.** 95.375 créditos no bolso, acesso até 05/10, **zero voz desde
06/09**. A voz morreu em `rejected_too_short` porque **só 2 dos 7 áudios dela
chegaram** — falha de recebimento nossa, não áudio curto dela.

O que faz isto ser grave: `emails_enviados` para ela = **0 linhas**. Cartões com
o nome dela = **0**. Ela pagou, o sistema recusou, e a casa **nunca abriu a
boca** em 16 dias.

Ela não aparecia em "pagante trancado" porque **tem acesso** — o instrumento
mede tranca, não entrega. Foi por isso que a varredura das 12hZ de hoje deu
honestamente "0 pagante trancado (298 conferidos 1 a 1)" e ela mesmo assim
estava parada. **Abri o cartão `#526`** para ela parar de ser invisível. Não
escrevi ainda: carta boa a 01h40 da manhã é pior que carta na primeira ronda.

---

## 2. O que precisa de você

São **17 cartões parados em decisão sua**, o mais velho há **54 dias**, com **54
alunos distintos atrás**. O próprio instrumento diz que o desfecho não é
re-escalar um por ronda — é levar em lote. Três baldes, cada linha um sim/não:

### 🔴 Primeiro, o que já venceu enquanto esperava

**A janela de garantia de 3 alunos fechou hoje às 00:00Z, sem resposta.** O
pedido está com você desde **22/09 12:05Z**, repingado às **15:49Z**. Foram ~12h
com dois avisos escritos. O bloco virou `7 fora / 5 dentro` → **`10 fora / 2
dentro`**.

> **1.** Devolver o dinheiro dos três mesmo com a janela vencida? (`jununes42`,
> `joaov.cestaro`, `fastcloner@americanshowerglass`) — **sim/não**

Restam **2 ainda dentro** (`ribasadv1975`, `rodrigocalazansx`), vencem **28/09**,
prazo útil **27/09**. É a família do `#207`, onde o mesmo silêncio custou R$97.

### 🟡 MERGE — 4 PRs, nenhum com migration (a 14-B diz que merge não precisa de você)

> **2.** Mergear o **PR #404**? (destrava o `d3d8d1b2` — 54d, 19 alunos) — **sim/não**
> **3.** Mergear o **PR #398**? (destrava o `b706b32e` — 40d) — **sim/não**
> **4.** Mergear o **PR #355** (titularidade, "bomba armada" — 14d)? — **sim/não**
> **5.** Mergear o **PR #42** (Fast lê anexo > 2MB, aberto desde 24/08)? — **sim/não**

### 🟢 DINHEIRO — 10 cartões, com o valor na frente

> **6.** `75c33ee1` — **1.010.200 cr** líquidos, 183 alunos (+ DDL sem aval) — **sim/não**
> **7.** `176f987f` — **762.695 cr**, 10 contas contestadas (12 alunos) — **sim/não**
> **8.** `b633b18c` — **157.875 cr** de resíduo do SGP (16 alunos) — **sim/não**
> **9.** `ab5644be` — **84.720 cr**, animações sobrescritas — **sim/não**
> **10.** `22cda8b7` — **R$1.109,64**, garantia venceu no nosso silêncio — **sim/não**
> **11.** `09a26f8b` — reembolso pedido com **CDC art.49**, 14 dias dormindo — **sim/não**
> **12.** `5c68eb33` — os **R$97** de 08/08 — **sim/não**
> **13.** `52b22304` — devolver crédito das gerações que **nosso próprio laudo** chamou de fracas — **sim/não**
> **14.** `4ec88113` — reembolso fora da garantia, aluno consumiu — **sim/não**
> **15.** `7ed72ad0` — **7.455 cr** (é decisão de política de classe, não de valor) — **sim/não**

### 🔵 POLÍTICA / mão humana

> **16.** `702cc916` — entrega abaixo do piso de QA: **manter, falhar ou avisar?** (trava a classe inteira)
> **17.** `8b8fc4c8` — precisa da **sua mão no painel da Hotmart** pra cancelar a assinatura da Fabiana (21d)
> **18.** `20ba24a1` — autorizar apagar a linha duplicada em `admin_emails`? — **sim/não**
> **19.** `bb4d4cd0` — autorizar retentativa automática de treino (**gasta GPU**)? — **sim/não**

### 🔧 E uma que não é do FastCloner

> **20.** A **frota de operários está morta**: 12 de 13 voltam `Not logged in`.
> Roda o `/login` do ClaudeClaw quando puder? — **sim/não**

Isso não é chamado (é credencial da frota, não código nosso), mas é o motivo de
todo o trabalho de hoje ter saído na minha mão. **E tem uma armadilha junto:** os
3 do Gemini devolvem **exit 0, turno completo e conteúdo vazio**. Uma ronda que
despachasse um vídeo receberia "ok" e poderia anotar **o nada** como se fosse
parecer.

---

## 3. O que subiu pra produção

**BUILD_ID no servidor: `HRIS6vBMyE1cwzQgS5RyF`**, construído em **22/09
15:03:39Z**. Conferido por SSH no Hetzner, não por Action verde.

| commit | o que é | prova de que está no ar |
|---|---|---|
| `3fbb5368` | SGP "Entrar na conta do aluno" abre no **www** — a sessão do aluno tomava a da Karen no mesmo host | fonte no servidor **byte a byte idêntica** ao commit (md5 `5c3c10cb…`), bundle reconstruído 15:02 |
| `bf4ba511` | React: caminho de **estorno** (`react_refund`) antes do primeiro aluno perder crédito (PR #402) | `react_refund` **encontrado** em `.next/server/app/api/v1/react/gerar/route.js` |
| `e9eee592` | React: rascunho separado por fonte (PR #401) | merge 13:50Z, anterior ao build |
| `230b488b` | React: cópia com outra fonte de vídeo + a cobrança que faltava (PR #400) | merge 13:46Z, anterior ao build |
| `54860ec7` | Virais: envio por **arquivo** e link pelo proxy residencial (PR #399) | merge 12:26Z, anterior ao build |

Mais a **migration 111**, aplicada direto no banco com o seu aval (`6867f0aa`,
15:15Z) — é mudança de dados, não de build.

⚠️ **Nada que entrou depois das 15:03Z está no ar.** O `dd7b9365` (watchdog do
heartbeat do `#15`, mata worker pendurado em ~105s em vez de esperar 640s)
**não subiu**: ele está no **PR #404**, que é a pergunta 2.

---

## 4. Estado geral

```
Fila            109 abertos (era 101 no fim de 21/09) — 108 + o #526 que abri agora
                66 técnicos · 42 atendimento · idade média 9,3 d
                + 34 aguardando_aluno (fora da conta, por desenho)
Faixas          30d+: 4 · 15–30d: 17 · 7–15d: 38 · 3–7d: 28 · <3d: 21
Mais velhos     c726c5ae 105d (19 alunos) · d3d8d1b2 54d (19) · b706b32e 40d
                37bacb68 34d · f8587cef 20d (609 ocorrências)
Parados em você 17 cartões · mais velho 54d · 54 alunos distintos
Varredura       1 item preso (escrituração de training_job, ninguém esperando)
Pagantes        0 trancados (298 conferidos 1 a 1) · 1 pagante sem entrega (#526, novo)
Cartas          98 e-mails, 34 à mão para 18 alunos
Cartões novos   9 no dia · 3 fechados
PRs             59 abertos · último merge #402 às 14:42Z (zero merges em ~11h)
Produção        0 falha · 0 chamado novo nas últimas 3 rondas
Livro de envios 1079 cartas na pasta = 1079 classificadas · 0 carta fora da tabela
Frota           12 de 13 operários fora do ar
```

**O que mudou de ontem pra hoje, e é o que me preocupa:** a fila subiu de **101
para 109** e a faixa de **7–15 dias engordou de 36 para 38**. Não é ruído de
medição — é a fila andando pra direita porque **a cabeça dela não sai**. Peguei a
cabeça um por um hoje e **todos os que têm aluno atrás esperam decisão sua, não
apuração minha**. Por isso o placar de cartões fechados na última ronda foi 0:
não desci a fila atrás de um caso fácil só pra ter número.

**Dois números medidos hoje que ainda não viraram cartão:** 33 pessoas pagaram e
**nunca criaram conta**, e **18 de 128** clones entregues **nunca tiveram um
login**. Ninguém tinha medido "entrou?" até hoje.

---

## 5. O que eu não fiz

Não devolvi dinheiro nenhum (9-A é seu). Não mergeei nada. Não escrevi para os
90 do SGP. Não li, escrevi nem reprocessei nada da planilha (ordem de 29/08).
Não gastei GPU. Não mudei preço nem mexi em produção fora do fluxo.

Não afirmo que os 17 são exatamente 17: o instrumento marca **4 contestados**
(teto 21) e 11 falsos positivos da marca, e não re-triei os contestados hoje.
