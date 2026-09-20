# Ronda das falhas — 20/09, ~13h20–14hZ (Frank)

Item serial: **#358 / `797b64aa`** (Marcio Paganatto, `mcpaganatto@gmail.com`)
— o aberto **mais parado com aluno nomeado**, 8,7 dias sem ninguém encostar.
Levado até o fim pela regra 8 e fechado como `fixed`. **O conserto existia há
6 dias e ninguém tinha voltado pra fechar** — o porquê está no §2, e é um
defeito de contabilidade da fila, não do produto.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — as duas mensagens foram pro **grupo**
(`notify-grupo.sh`). Nada no privado do Johnny.

## Placar

- Fila: **91 → 90 abertos**.
- Fechados `fixed`: **1** (#358), com nota de 5 parágrafos e `resolution_note`
  de 1.788 chars, `resolved_commit` gravado.
- Alunos respondidos: **1** (Marcio, Enviados **uid 3014**) — e desta vez a
  carta tinha motivo material, não placar (§4).
- Crédito devolvido: **0** — conferido que não havia nada a devolver (§3).
- Passo fixo dos envios: **845 lidas, 0 carta fora da tabela** depois do corte.
- Percepção travada: **2** pelo instrumento (mais velho parado há 2,0d) ·
  **16** pela consulta crua da ordem de 17/09 (mais velho **18,8d**, #226).
- Achado novo medido: **10 dos 90** abertos prometem "outro cartão" sem
  registrar qual — com a ressalva de que o instrumento **conta a mais** (§5).

---

## 0. Passos fixos, antes de qualquer coisa

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **845**
cartas lidas da pasta `Sent`, 768 já tinham linha, 77 fora da janela do corte,
**0 escrituráveis, 0 recusadas**. A contagem fecha (845 = 845).

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

(Ronda das 13h30: 839 lidas / 762 com linha. **+6 cartas, todas já com linha**
— e uma delas é a minha, o que serve de controle positivo do instrumento.)

As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão, como o README manda.

**Percepção travada**, os dois números, sem escolher o menor: instrumento **2**
(#450 e #473, os mesmos de ontem, ambos já lidos e nenhum deles despacho meu);
SQL cru da ordem de 17/09 **16**, mais velho **18,8d** (#226). O ponto cego do
`percepcao_travada.cjs` no `aguardando_aluno`, registrado nas rondas das 11h e
13h, **continua de pé e eu não o ataquei hoje**.

---

## 1. Por que este cartão

Critério da regra 8: **o mais antigo com aluno afetado**. Usei "há quanto tempo
ninguém encosta" (última nota) em vez de idade bruta, que é o que a ronda de
14/09 provou melhor — idade bruta põe no topo os cartões travados em decisão do
Johnny, que não são meus pra mover.

O topo absoluto da lista era o `68a66227` (11,1d parado), mas ele tem **0 aluno
nomeado**. O #358 é o primeiro **com gente sofrendo**: 8,7 dias parado, 1 aluno,
11 ocorrências. Foi ele.

---

## 2. O achado: o cartão esperava um cartão que nunca existiu

A nota de 11/09 fechava assim: *"Card aberto para as duas pernas que faltam."*
A ronda seguinte foi procurar esse card. **Ele não existe.**

O conserto das duas pernas é o commit **`44368524`** (14/09 23:02Z), e o título
dele diz **"(#358) (#241)"** — `#358` é **este** incidente, `#241` é o PR. Ou
seja: o trabalho **voltou pra cá**, foi entregue, e a nota nunca foi atualizada.
O cartão ficou aberto esperando notícia de si mesmo.

A armadilha aqui **não é o defeito, é a contabilidade**: cartão que delega pra
um "próximo card" sem gravar o número dele vira órfão, e o tempo de espera não
aparece em lugar nenhum. Foi o que produziu os 8,7 dias.

---

## 3. As conferências, todas desta ronda (nada herdado)

**As duas pernas, lidas em `origin/main` — não no meu worktree**, via
`git show origin/main:<arquivo>`:

1. **Teto de concorrência.** `app/api/v1/studio/[id]/route.ts:39` declara
   `TETO_SYNC_CENAS = 4`; a linha 146 usa `emLotes(pending, TETO_SYNC_CENAS, …)`
   no lugar do `Promise.all` sem teto que estava na 131. Módulo novo
   `lib/studio/lotes.ts`.
2. **Throttle não mata mais a cena.** Novo `lib/studio/throttle-cena.ts` expõe
   `deveAdiarPorThrottle()`, e `scenes.ts` o importa (linha 19) e o **chama nas
   linhas 310 e 362** — os dois `catch` que antes caíam direto em `failScene`.
   Janela de 30 min; passado o prazo volta o comportamento antigo, pra não criar
   cena zumbi (o defeito irmão `69f0aec5`, imagem presa 28 dias).

**Em produção, conferido por ancestralidade e não por "está na main":**
`git merge-base --is-ancestor 44368524 58d9013b` = **SIM**, e `58d9013b` é o sha
do último *Deploy Frontend (production)*, run **completed/success 20/09
12:59:04Z**. Isto é o passo que o manual manda fazer e que já deixou fix preso
em branch por 9h em 19/08.

**Testes: 8/8** em `throttle-cena.test.ts`, execução **minha** (`node --test`),
não número herdado de relatório. O teste importa a classe `KieRateLimitError`
de verdade e amarra o acoplamento por `name` — renomear a classe quebra o teste
em vez de a cena voltar a morrer em silêncio.

**Dinheiro: nada a devolver**, agora conferido duas vezes com 9 dias de
distância. Os 22 estornos de 11/09 (`ref_type='studio_scene_refund'` —
**nunca por `kind`**, que grava `extra_purchase`) somam 39.600. Hoje o aluno
tem `credits_extra` = **39.600 exatos, intocados**. 38 débitos − 22 estornos =
16 cenas líquidas = exatamente as 16 entregues.

**Aluno:** pagante ativo até 29/09, `last_seen` **20/09 13:42Z** — usando a
plataforma hoje. Varri `studio_scenes`: **zero falhas de cena depois de 11/09**
(só 11/09 com 32 failed/16 ready e 10/09 com 3/5; nada depois).

---

## 4. Por que escrevi pro aluno — e por que isso não é placar

Na ronda de 13h30 eu **não** escrevi pro Welrisson, de propósito, porque ele já
tinha sido respondido e já voltara a produzir. Aqui é o caso oposto, e a
diferença é material:

A carta de 11/09 pediu a ele, com todas as letras, que **gerasse em blocos
menores** até a segunda metade do conserto ficar pronta. Ela ficou pronta em
**14/09** e ninguém contou. Ele **não criou uma única cena desde 11/09** —
seguia operando sob um contorno que tinha deixado de existir há 6 dias. A casa
impôs uma limitação ao aluno e esqueceu de retirá-la.

Carta enviada 20/09, assunto *"O Vídeo Estúdio já aguenta o projeto inteiro de
novo"*, chave `studio-teto-concorrencia-no-ar`, cópia **CONFIRMADA em Enviados
uid 3014** — busca por Message-ID depois de gravar, não "APPEND respondeu OK".

---

## 5. Achado da ronda: quantos outros cartões prometem um cartão fantasma

Medido hoje: **10 dos 90** abertos têm a última nota prometendo/citando outro
cartão **sem registrar um identificador rastreável**.

**Ressalva honesta, e ela é grande:** o instrumento casa *citação*, não
*promessa*, então **conta a mais**. Li os dois mais parados e **os dois são
falso positivo**: o **#341** diz *"nenhuma das 6 tem card próprio além deste"*
e o **#410** diz *"NÃO abri cartão novo"* — negações, não órfãos. Então o teto
real é **8**, não 10, e nem esses 8 estão confirmados um a um. Reporto assim em
vez de anunciar 10 como se fosse medida limpa.

O que **está** confirmado é o caso concreto que esta ronda pagou: **1 cartão,
8,7 dias**, por exatamente esse mecanismo. A correção barata é de processo —
quem delegar, grava o número do destino na nota.

---

## 6. Frota

Não deleguei nesta ronda: o trabalho foi leitura de banco, leitura de
`origin/main` e decisão de fila, que é o meu pedaço. Os workers de assinatura
Claude seguem sem auth (`Not logged in`), como as rondas das 03h, 11h, 13h e
13h30 registraram — então **esta ronda também não teve revisão do `gerente`**.
Fica dito: as conferências do §3 foram minhas, sem segunda opinião. Não precisei
do `olho` porque não houve artefato pra ver.

---

## 7. O que eu NÃO fiz e o que NÃO estou afirmando

**O limite declarado que eu não fechei:** a nota de 11/09 registrou que ninguém
instrumentou a chamada pra contar concorrência **real** no instante do 429 — a
ligação poll → rajada é inferência de código somada a padrão medido. **Eu não
fechei esse buraco.** Fecho o cartão pelo efeito medido (teto no ar + falhas
cessaram + aluno produzindo), **não** por prova de telemetria. Se a classe
voltar a disparar, é por aí que se começa, e está escrito na nota do cartão.

**A ressalva 14-A que continua verdade:** as 22 cenas daquele projeto **não
voltam**. O aluno tem o crédito e foi avisado duas vezes de que precisa refazer,
com refação gratuita se falhar por culpa nossa. Fechei o defeito, não a perda
dele.

Não mexi em crédito, acesso, assinatura, plano, tier, preço nem entitlement.
Não tirei crédito de ninguém (9-A). Não gastei GPU. Não apliquei migration.
Não subi código — **esta ronda não tem PR, e não inventei um pra parecer
produtiva**. Não li e-mail não lido pra triagem. Não toquei nos cartões travados
em decisão do Johnny. **Nada da planilha** (ordem de 29/08).

---

## 8. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` conferido **vazio**
depois do commit deste log. Nenhum branch de feature criado nesta ronda.

**Um susto que valeu a conferência.** `git branch` mostra
`feat/358-perna2-teto-de-concorrencia`, e
`git rev-list --count main..feat/358-perna2-teto-de-concorrencia` devolve **1**
— exatamente o sintoma do fix preso em branch que custou 9h em 19/08. **Não
era.** O commit solto é `e0e0ccbb`, o **pré-squash** de `44368524`: os dois têm
o mesmo título, e `git diff main..<branch>` **restrito aos 5 arquivos do #358**
sai **vazio** — o conteúdo na main é idêntico. Fica registrado porque
`rev-list main..branch` **dá falso positivo em toda PR mergeada por squash**, e
esta base tem centenas de branches vivos: quem usar só a contagem vai "achar"
fix preso em dezenas deles. O teste que decide é o **diff dos arquivos**, não a
contagem de commits.

O commit que fechou o #358 foi verificado como **ancestral do sha em produção**
(`58d9013b`), que é a forma forte do teste.

Esta ronda escreveu: **1 cartão fechado** com o conserto verificado em
produção, **1 carta a aluno** que retira uma limitação que a casa tinha
esquecido de retirar, **1 mecanismo de órfão identificado e medido** (com a
folga do instrumento declarada), **2 mensagens no grupo** e este log.
