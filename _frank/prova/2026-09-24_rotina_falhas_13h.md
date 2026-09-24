# Ronda das falhas — 24/09 ~12h41–13h10Z (Frank, dono da fila)

**Desfecho: 1 incidente FECHADO até o fim (`#302` / `ff95507f`, aluna Leonice,
16,7 dias) — fix em produção + aluna avisada + crédito já devolvido + cartão
`fixed` com nota e commit. E o achado da ronda, que é maior que o cartão: a casa
mede a fila de INCIDENTES toda ronda e nunca mediu a fila de CONSERTOS PRONTOS.
São 38 PRs mergeáveis parados, e conserto aqui tem validade medida de ~8 dias.**

Gasto: **zero GPU, zero crédito de aluno movido, zero migration, zero DDL.**
Escritas: 1 merge em produção, 1 carta, 1 nota de incidente + fechamento,
1 ferramenta nova, 1 card de QA, 2 posts no grupo, este log.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** escriturável. **1180 = 1180**, nenhuma carta sumiu (1103 já com linha + 77 fora da janela). Eram 1176/1099 às 12hZ: 4 cartas novas no intervalo, **todas já com linha**. |
| `enviados_x_tabela` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte.** Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controles positivo (#310) e negativo (#518) OK, 532 varridos. |
| `pagante_trancado.cjs` | **0** pagante trancado · **24 na fronteira** · 1 sem prova (`drfabiovilhena29@gmail.com`, sem subscriber code — o mesmo de ontem, sem fato novo) |
| Censo da fila | **118** abertos (+2) · **69 com 7d+** (estável) · mais velho **56,0d** |
| `fechados_que_disparam` | 17 fechados com sinal de vida, **2 vivos nas 48h** — `#544` e `#523`, **os dois já apurados**. Nenhum fechado novo disparando. |
| `esperando_johnny` | **17** parados em decisão · mais velho **55d** · **54 alunos** atrás da fila |
| 🆕 `conserto_pronto_e_parado` (nasceu hoje) | **58** PRs abertos · **38 mergeáveis parados** · **24 parados há 3d+** · **20 já apodrecidos** · mais velho **35d** |

⚠️ **As 24 "na fronteira" do `pagante_trancado` são de hoje**: acesso até
2026-09-24 **e** próxima cobrança 2026-09-24. Não é defeito — é o dia da
renovação. Mas é exatamente a janela em que o webhook que pula o ciclo
(`2026-09-21_creditar_ciclo_que_o_webhook_pulou.cjs`) transforma pagante em
trancado. **A ronda da noite tem que reconferir esses 24**, não como alarme,
como conferência de plantão.

## 2. Por que este cartão, e não a cabeça da fila

Desci a fila em ordem de idade conferindo um a um. As cabeças e os três
primeiros acionáveis seguem **fora da minha alçada**, e registro porque é o
retrato de hoje:

- `d3d8d1b2` (56,0d), `8b8fc4c8` (23,0d), `7ed72ad0` (22,8d), `702cc916` (22,8d),
  `5c68eb33` (19,0d), `ab5644be` (16,9d), `09a26f8b` (15,9d) — **decisão do
  Johnny**, confirmados no `esperando_johnny`.
- `df008dcf` (17,8d) — decisão comercial (devolver ou não o trial de R$0 do
  André). ⚠️ **Ele NÃO aparece na lista dos 17 do `esperando_johnny`** apesar de
  estar travado exatamente nisso desde 16/09. É falso negativo do instrumento;
  anotado aqui, não consertado nesta ronda.
- `446c3ae4` (17,6d) — trava no "pode" do lote dos 8.
- `94d3015d` (17,0d) — trava no aval de **telefone/WhatsApp**, pedido em 13/09,
  hoje **11 dias**. A rota de e-mail já foi eliminada por medição em 01hZ
  (`segundo_email_por_cpf`: 0 segundo endereço, com controle positivo na mesma
  execução). O bloqueio é real, não é falta de ter procurado.
- `eec81565` (16,9d) — Lucila: decisão de recorte, R$97 ou R$291.

Peguei o **`ff95507f` (#302, 16,7d)**: o mais velho da fila cujo passo seguinte
era **meu**.

## 3. `#302` — o conserto estava pronto e parado havia 5 dias

### 3.1 O que era

Dois defeitos no mesmo fluxo, medidos em 19/09: **(a)** não existia "voltar ao
original"; **(b)** a chave de saída é determinística por vídeo, então reaplicar
**sobrescreve** o arquivo anterior, sem avisar e cobrando de novo.

O (b) é o que custou dinheiro: **4 débitos de 200 cr em 3m16s** e **um único
arquivo**. Ela pagou quatro e tinha um. E o motivo de ter aplicado 4× era o
próprio (a): sem desfazer, a única alavanca da tela era aplicar de novo. **A
casa cobrou pela ausência do próprio botão.**

### 3.2 O que eu achei ao pegar o cartão

O conserto **já existia**: PR **#357**, aberto pelo `coder` em 19/09 21:43Z,
**parado havia 5 dias**, com o card do Mission Board `completed` desde 19/09
17:48. O cartão do incidente, enquanto isso, aparecia como `investigating` —
**indistinguível de um caso que ninguém olhou.**

### 3.3 O que eu conferi antes de mergear

Em worktree isolado em **`/mnt/Data`** (não em `/tmp` — lição 10.1 da ronda das
12hZ), sobre `origin/main` + a branch:

- **21/21** testes de `reaplicar.test.ts`; `tsc --noEmit` **exit 0**
- merge **sem conflito**, e — o teste que importa — **a main não tocou em
  nenhum dos 9 arquivos desde 19/09**. O risco de branch STALE da família
  `onedrive-401` / `trava-foto-nova` **foi medido, não presumido**.
- as duas dependências que o PR usa mas não adiciona **já estavam na main**:
  `objectExists` (`lib/r2/exists.ts`) e `jsonError` (`lib/api/responses.ts`)

Desenho que confirmo estar certo: a recusa **409 vem ANTES do gate de crédito**
(e antes do Whisper, no captions) — perguntar não custa. E `objectExists`
**falha aberto** (R2 instável → `true` → "confirme"), então instabilidade vira
pergunta, **nunca cobrança silenciosa**.

### 3.4 O que está em produção, e como sei

- merge **`4c3efaa78d36ed5ba97111d2a0ba8b32511537ee`**, 12:47:24Z
- deploy `Deploy Frontend (production)` run **36001302141**, mesmo sha,
  **SUCCESS 12:50:35Z**
- conferido **na `origin/main`**, não no que o PR prometia: `reaplicar.ts`
  existe e `broll/route.ts:24/:127` importa e devolve o 409.

### 3.5 Dinheiro — conferido por `ref_type`, nunca por `kind`

Relido do banco: **3 linhas `ref_type='edicao_broll_refund'`, 200 cada = 600 cr**
(19/09 21:29:31Z, refs `328a518b` / `d090ffca` / `8a9459dd`). A 4ª aplicação
(`40f85307`) **segue cobrada de propósito** — esse arquivo existe.
Nada movido nesta ronda. (Armadilha da ordem de 20/08: o estorno grava
`kind='extra_purchase'`; filtrar por `kind` faria parecer que não houve estorno.)

### 3.6 Aluna avisada

**Enviados uid 3350**, 24/09 13:04:04Z, cópia **confirmada na pasta remota por
leitura independente** — não no que o script planejava. É a 5ª carta a ela.

### 3.7 O que eu NÃO provei

**Não vi o botão renderizado numa tela logada.** Despachei ao `qa` (card
`b0ca902c`) na mesma rodada, conforme a regra de 17/09 — "precisa ver" é
despacho, não parada. Veredito dele:

- ✅ **PROVADO**: `/app/videos/edicao` **abre em produção depois do merge**,
  zero erro de console, zero HTTP ≥400, com screenshot. O merge não quebrou a tela.
- ⚠️ **NÃO PROVADO**: o botão em si. Ele só renderiza com conta *unlocked* **e**
  com `videoEditadoKey`; a conta de teste `suporte@fastcloner.com` tem **0
  crédito e ZERO registro em `video_clones`**. O `qa` **recusou** as duas saídas
  que existiam (gastar 200 cr aplicando b-roll, ou entrar em conta de aluno
  real) e **disse isso em vez de inventar**. Está certo, e é o comportamento
  que a casa quer.

Ou seja: falta **estado de teste**, não conserto. Se a aluna responder que o
botão não aparece, o cartão reabre com dado novo — e a carta pede exatamente isso.

**Erro meu no despacho, registrado:** a ordem de 19/08 **já autoriza
`admin_grant` interno** na conta de teste. Não citei isso no card, e o `qa`
travou por falta de crédito sem saber que podia pedir. Lição bancada.

## 4. O achado da ronda: a fila que ninguém contava

O `#302` ficou 5 dias com o conserto pronto. Fui ver se era caso isolado.
**Não é.** Ferramenta nova, commitada: `2026-09-24_conserto_pronto_e_parado.cjs`.

```
58 PRs abertos.   38 MERGEABLE+CLEAN.   20 CONFLICTING+DIRTY.

PRs com  9 dias ou mais : 15 → 15 conflitados = 100%
PRs com  8 dias ou menos: 43 → 38 mergeáveis  =  88%

mediana MERGEABLE   =  4d (máx  8d)
mediana CONFLICTING = 15d (máx 35d)
```

**Conserto nesta casa tem validade de ~8 dias.** Nenhum PR com 9 dias ou mais
continua mergeável: todos apodreceram em conflito, e conflito quer dizer
retrabalho de alguém. O #357 entrou no **5º dia**, ainda dentro da janela — por
**sorte de ordem serial, não por processo**.

Não é "o PR está velho", é **"o conserto está apodrecendo"**, e o que morre
junto é sempre um aluno nomeado: **#42** (Fast lê anexo > 2MB) há **31 dias**,
**#189** (estorno não ressuscita entitlement contestado) há **18**, **#203**
(não dizer ao pagante que ele não tem a plataforma) há **17**.

**Por que isso era invisível:** um incidente cujo fix está num PR parado aparece
em toda contagem como `investigating`. A fila de incidentes mede quem **está
sendo apurado**; ninguém media quem **já foi consertado e não entregue**. É a
mesma família do `percepcao_travada` (41 falsos em 17/09) e do `dump_enviada`
("0 cartas" por base64 em 18/09): **não é falta de esforço, é falta de
instrumento.**

### 4.1 Armadilha de instrumento que quase me pegou junto

`gh pr list --json mergeable` devolve **UNKNOWN para os 58** — o GitHub só
calcula mergeabilidade sob demanda, no `pr view` de cada PR. Quem confiar no
`list` mede `MERGEABLE: 0 / CONFLICTING: 0 / UNKNOWN: 58` e conclui **"nenhum PR
entra hoje"**, exatamente o oposto da verdade, que é **38**.

Só escapei porque olhei a **distribuição** em vez do número: 58 UNKNOWN não é
resposta, é o instrumento dizendo que não sabe. A ferramenta faz `pr view` por
PR (58 chamadas, de propósito) e **MORRE** se sobrar UNKNOWN, em vez de imprimir
zero cego. **Zero de instrumento cego não é zero medido.**

## 5. O que precisa do Johnny

Sem novidade minha nesta ronda além do item 4 (doutrina de 17/09: **lote, não
repetição**):

1. **WhatsApp/telefone** para os pagantes do `#249` (R$ 8.250,27, mais antigo
   44d) — e o mesmo aval destrava o `94d3015d` (Sunesa, R$597, 11 dias parada
   nisso). A rota de e-mail já foi eliminada por medição nos dois.
2. **Crédito do Gemini** (`olho`, `pesquisa`, `social`).
3. Decisão (c) do `#234` (`TTS_TAIL_QA_INTERNO_MODO=reprovando`), sem
   recomendação minha.
4. 🆕 **Quem mergeia conserto pronto.** 38 PRs mergeáveis parados, 24 há 3d+.
   Não estou pedindo autorização pra mergear — o #357 mostra que dá pra revisar
   e entregar dentro da ronda. Estou pedindo que isso vire **passo fixo** (como
   a reconciliação de envios), senão a validade de 8 dias continua comendo
   conserto pago com trabalho já feito.

## 6. Fim de ronda

- Log e ferramenta commitados na **main** (regra 25-B), via worktree isolado em
  `/mnt/Data` — **não** no checkout compartilhado, que em 12hZ foi trocado por
  outro agente debaixo da ronda.
- Escritas conferidas **na releitura**: `#302` **1 linha afetada**, status
  `investigating → fixed`, notas **5 → 6**, `resolution_note` 289 → 958 chars,
  `resolved_at` gravado.
- Carta: **uid 3350** conferido na pasta remota por instrumento independente.
- Merge: conteúdo conferido **na `origin/main`**, e deploy SUCCESS no **mesmo
  sha** — não no sha que o PR prometia.

---

## 7. ADENDO — o passo fixo de fim de ronda me deu um FALSO PASSA

Escrito depois do corpo acima, ao executar a conferência final. Registro porque
ronda que esconde o próprio tropeço não serve de prova.

### 7.1 `git log origin/main..HEAD` saiu vazio com o checkout DESATUALIZADO

O passo fixo manda conferir que `origin/main..HEAD` sai **vazio**. Saiu. Mas o
checkout local estava em `f188565e` enquanto a `origin/main` já estava em
`5a7bb297` — **o meu próprio commit**. A consulta saiu vazia porque `HEAD` era
**ancestral** de `origin/main`, não porque estivesse tudo em dia.

> `origin/main..HEAD` responde **"tenho algo sem push?"**. Ele **não** responde
> "estou em dia". Um checkout atrasado passa nesse teste de olhos fechados.

O que salvou foi eu ter conferido os dois arquivos **direto na `origin/main`**
(`git cat-file -e origin/main:<arquivo>`) em vez de aceitar o vazio como
veredito. **Mesma família do zero cego**: consulta que não sabe a resposta volta
vazia e parece saúde.

A causa do atraso, medida: o `--ff-only` vinha **abortando em silêncio** porque
eu havia escrito os dois arquivos no checkout compartilhado antes de copiá-los
pro worktree — e arquivo **untracked** que o merge sobrescreveria trava o
fast-forward. O `Aborting` estava lá, mas debaixo do `tail -2`. Conferi por
`git hash-object` que as cópias locais eram **byte-idênticas** às já publicadas
antes de apagar qualquer coisa (regra #101/#210: nunca apagar sem conferir).

### 7.2 A outra metade do passo fixo não sinaliza nada

`git branch` + `git rev-list main..<branch>` — como está escrito — devolveu
**~190 branches** com commit fora da main, medidos contra a `main` **local e
atrasada**. Um alerta que dispara 190 vezes não é alerta: ninguém lê, e o caso
real (o de 19/08, em que um fix de aluno ficou 9h preso) some no meio.

Refeito com o recorte certo — trabalho **de hoje**, contra a **`origin/main`** —
a resposta é limpa e útil: **zero**. Os dois commits da ronda (`4c3efaa7` do
merge e `5a7bb297` do log) conferidos por `merge-base --is-ancestor` como
ancestrais da `origin/main`.

**Proposta, sem executar:** o passo fixo devia ser (a) `HEAD == origin/main`
depois do fetch, não `origin/main..HEAD` vazio; e (b) o varredor de branches
recortado por autoria/data e medido contra `origin/main`. Não mexi no manual —
isso é correção de ordem, e ordem quem muda é o Johnny.
