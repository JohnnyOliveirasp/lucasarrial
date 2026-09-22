# Ronda das falhas — 22/09/2026, ~18h40–19h40Z

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`).
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou
reprocessado.

**Uma linha:** o item serial me levou à tela de foto do SGP e o achado foi que
**o conserto de 15/09 parou de criar preso novo mas nunca foi buscar quem já
estava preso** — 4 pessoas com as fotos já aprovadas, paradas de 8 a 12 dias,
todas anteriores ao conserto. Escrevi para as 4. No caminho descobri **por que
elas não voltam sozinhas**: não existe caminho de volta para um pedido do SGP.

**Cartões fechados: 0** (e digo em cada caso por que não fechei).
**Alunos escritos: 5 cartas** (4 da classe + 1 correção minha).
**Fix em produção: 0.** **PR aberto e conferido por mim: 1 (#405).**
**Cartão novo: 1 (#524).** **Dinheiro devolvido: 0.**
**Escritas em banco: 3 notas (#403 ×2, #492) + 1 insert (#524).**
**Erro meu, medido e corrigido dentro da própria ronda: 1 carta errada.**

---

## 0. Passos fixos

| passo | resultado |
|---|---|
| `git pull --ff-only` na main | atualizado, sem divergência |
| **Reconciliar envios da pasta** (#101) | 1037 lidas · 960 já tinham linha · **0 dentro da janela sem linha** · 77 fora do corte · fecha 1037 = 1037 |
| `2026-09-18_enviados_x_tabela.cjs` (independente) | veredito **0 carta depois do corte** fora da tabela |
| `percepcao_travada.cjs` (ordem 17/09) | controle positivo OK (#310) · 509 varridos · **0 travados em percepção** |
| `2026-09-22_esperando_johnny.cjs` | **19 cartões · 60 alunos · mais velho 54d** (marca crua 34, 11 falsos, 4 contestados) |
| `varredura_travados.cjs` | 103 abertos · 36 aguardando aluno · 1 preso |

---

## 1. Por que o item serial não foi nenhum dos quatro primeiros

Peguei a fila pela regra 8 e li a cabeça **até encontrar algo que fosse meu**:

| cartão | idade | por que não é trabalho meu hoje |
|---|---|---|
| `#312` | 105d | 19 alunos, mas as **duas** pernas (grupo A e grupo B) estão em decisão do Johnny desde 15/09 |
| `#15` | 54d | espera **merge** do PR #404 |
| `#223` | 21d | aluna respondida 2×, entrega confirmada, **7,9d de silêncio dela** — é aguardando_aluno de verdade |
| `#469` | 40d | espera merge do PR #398 + decisão dos 10.000 cr |

⚠️ **Achado de instrumento: o `#312` NÃO aparece no `esperando_johnny.cjs`.**
É o cartão com **mais gente atrás** da fila inteira (19 alunos) e ele está
invisível na varredura que existe justamente para juntar o lote do Johnny. A
causa é a que a ronda das 17h já tinha nomeado no `#341`: **quem anota,
esconde**. A última nota do `#312` é o adendo sobre o PR #293; o estado real
("travado no #313" / "leva de 14 precisa do *pode*") está na nota **anterior**.
Lendo só `agent_notes -> -1`, o cartão some.
**Isto quer dizer que o número 19 do relatório é piso por dois motivos, não um:**
a inflação da marca (já conhecida) **e** o afundamento por nota nova (novo).

---

## 2. O item serial: `#403` (Elaine) — e a classe inteira que estava atrás dele

Escolhi o `#403` por ser o mais antigo com **aluno afetado e passo meu**: 7,9d
sem nota, aluna **sem login** (só existe em `sgp_pedidos`, não aparece em tela
de atendimento nenhuma).

### 2.1 O que trava ela, medido

Pedido `8cac710b`: status `foto`, **5 fotos todas `aprovada`**, `ciencia_foto`
**NULL**. `SGP_FOTOS_MIN = 4` — ela tem foto de sobra. Passando o estado por
`motivosBloqueioFoto()`, sobra **um** motivo: ciência 0 de 5. O botão cinza dela
é isso e nada mais.

### 2.2 O relógio prova que ela caiu do lado errado do conserto

`c08da4b9` ("o botão cinza agora diz o que falta") é de **15/09 02:17:26Z**.
A última ação dela é **14/09 22:19:36Z** — **~4 h antes de o conserto existir**.

> **A frase que resume a ronda:** conserto **para de criar preso novo**; ele
> **não volta** para buscar quem já estava preso. Ninguém tinha ido buscar.

### 2.3 O conserto está em produção — conferido no ar, com controle

Não aceitei "card completed" nem "está na main":

- **md5** dos 3 fontes (`passo-foto-pure.ts`, `step-foto-form.tsx`,
  `api/v1/sgp/foto/ciencia/route.ts`) no **Hetzner idênticos** aos de `origin/main`;
- prova de **comportamento**, contra produção:

| requisição | resposta | leitura |
|---|---|---|
| `POST /api/v1/sgp/foto/ciencia` | **400** | rota existe, recusa corpo vazio |
| `POST /api/v1/sgp/audio/ciencia` | **404** | não existe (é o #492) |
| `POST /api/v1/sgp/rota-que-nao-existe` | **404** | **controle**: 404 aqui é mesmo 404 |

### 2.4 A classe: 4 pessoas, e o número que eu me recusei a reportar

Varri `sgp_pedidos` em `foto` com **≥ 4 aprovadas** e ciência incompleta:

| pessoa | fotos aprovadas | parada | carta |
|---|---|---|---|
| Wellington `luzwellington@hotmail.com` | 6 | 12,2 d | uid **3208** |
| Julio Cesar `jcesaram@gmail.com` | 4 | 9,9 d | uid **3209** |
| Jussilene `jununes42@hotmail.com` | 4 | 9,0 d | uid **3210** (ver §3) |
| Elaine `elaineesthetician@gmail.com` | 5 | 7,9 d | uid **3211** |

**Todas anteriores ao `c08da4b9`.** As 4 cartas saíram individuais, com o número
**real** de fotos de cada uma, chave `sgp-foto-5-confirmacoes`, cópia
**confirmada** na pasta Enviados e linha em `emails_enviados`.

> ⚠️ **O número que NÃO vai pro relatório como vítima:** `status='foto'` tem
> **102** pedidos e **88** parados 2d+. A esmagadora maioria **nunca chegou a 4
> fotos aprovadas** — isso é abandono no meio do upload, outro assunto.
> Contar os 88 inflaria a classe em **20×**. O número honesto é **4**.

### 2.5 A ressalva que entrou na carta, e por que ela era obrigatória

O pedido do SGP é identificado **só** pelo cookie `sgp_sessao`
(`lib/sgp/sessao.ts`, 30 dias). **Não existe retomada por e-mail nem pelo código
de 6 dígitos:** `pedidoDaSessao()` ou acha a linha do cookie ou **cria uma nova
em branco**. Então "volta no link e termina" só é verdade **no mesmo navegador**.

A carta diz isso com todas as letras e oferece a saída ("se abrir em branco, não
refaça nada, me responde que eu localizo daqui"). Sem essa ressalva eu estaria
mandando a pessoa refazer tudo achando que a culpa era dela.

---

## 3. O erro que eu cometi nesta ronda, e o conserto dele

**Varri por LINHA e tratei cada linha como uma pessoa.** A Jussilene tem
**três** pedidos. Enquanto eu media, ela **refez o wizard inteiro hoje às
15:05Z** — 5 fotos novas aprovadas e as 5 confirmações marcadas. Minha carta
saiu **3,7 h depois disso**, mandando ela fazer o que ela já tinha feito.

Mandei **correção individual na hora** (uid **3213**): que ela já passou das
fotos, que é só clicar em Continuar, e que ter refeito o envio foi **defeito
nosso, não dela**.

Conferi as outras três **pessoa a pessoa** antes de deixar as cartas de pé:
Wellington tem **um** pedido só; Julio tem dois, mas o mais novo tem **zero**
foto e o bom continua sendo o velho; Elaine tem **um** só. **As 3 seguem
válidas.**

> **Regra que fica:** varredura de `sgp_pedidos` é **por pessoa** (agrupar por
> e-mail, olhar o pedido mais recente), **nunca por linha**. Por linha, o próprio
> ato de a pessoa se virar sozinha vira motivo para ela receber carta dizendo
> que está parada.

### 3.1 Outros dois erros meus, corrigidos na nota do `#403`

1. Escrevi *"este cartão nunca tinha sido tocado, zero nota"*. **Falso** — tinha
   2 notas e **a aluna já fora respondida em 14/09** (uid 2351). O verdadeiro é
   mais estreito: **7,9 d sem nota nova depois de uma resposta que não deu
   resultado**. Li `parado_h` (desde a última nota) e escrevi "desde a abertura".
   A carta de hoje portanto é **segunda tentativa**, e como tal está no prazo.
2. Usei **`avisado_em IS NULL`** como prova de "ninguém nunca falou com essa
   pessoa". **Não serve** — a própria Elaine foi respondida em 14/09 e o
   `avisado_em` dela **continua NULL**. A coluna não é escrita pelo caminho de
   carta manual. **Instrumento desqualificado para essa pergunta**; quem quiser
   saber se alguém foi contatado olha a pasta Enviados / `emails_enviados`.

---

## 4. Cartão novo `#524` — não existe caminho de volta para um pedido do SGP

O que a Jussilene fez à mão é uma **classe medida**, agrupando por e-mail:

- **324** pessoas, **373** linhas de pedido;
- **41** pessoas com **mais de um** pedido;
- **10** pessoas subiram **foto aprovada em dois pedidos diferentes** — ou seja,
  **refizeram trabalho de verdade** (`rafaelzan@me.com` tem **6** pedidos e foto
  em 3). Uma delas é o `ricardoolito@gmail.com`, que já é o aluno do **#421**.

**A honestidade do tamanho:** dos 10, **nove** terminaram em `pronto`/`revisao`.
O custo na maioria foi **retrabalho e atrito, não perda definitiva**. O dano
permanente cai em **quem não refaz** — e esses não aparecem nesta lista: aparecem
como pedido parado para sempre. Hoje são pelo menos os 3 da §2.4.

**Por que é viável consertar sem ferir a regra de 29/08** (*"a conta só nasce no
Confirmar e Enviar"*): os pedidos encalhados **têm `email_verificado_at`
preenchido** — a pessoa já provou o e-mail com o código de 6 dígitos. A
identidade verificada **já existe** no pedido órfão. Bastaria, na tela 1, ao
verificar um e-mail que já tem pedido em andamento, oferecer *"você já tem um
envio começado, quer continuar de onde parou?"*. **Não antecipa conta e não
afrouxa portão.**

**A decisão é de produto (é do Johnny); a medição é minha.** Não juntei nem
apaguei linha duplicada de ninguém.

### 4.1 O conserto já está escrito desde 12/09 — achado no passo fixo do fim

Conferindo branch presa (passo fixo de fim de ronda) achei
**`wip/sgp-retomada-por-email-NAO-MERGEAR`**, dois commits de 12/09, **sem PR**,
**618 inserções**, que é exatamente esta proposta: `api/v1/sgp/retomar/route.ts`,
`lib/sgp/retomada.ts` (+ **129 linhas de teste**), `lib/sgp/destino.ts` (+50),
e `+58` no próprio `lib/sgp/sessao.ts`.

**Medi a obsolescência em vez de supor, porque aqui o número assusta e engana.**
A main está **503 commits** à frente da base — que é a assinatura das branches
venenosas do README (`feat/onedrive-401`, `fix/trava-foto-nova-8379549c`). Mas a
pergunta certa não é quanto a main andou, e sim **quanto ela andou nos arquivos
que a branch toca**:

| arquivo | commits na main desde a base |
|---|---|
| `lib/sgp/sessao.ts` | **0** |
| `api/v1/sgp/codigo/route.ts` | **0** |
| `components/sgp/step-dados-form.tsx` | **0** |
| `api/v1/sgp/inicio/route.ts` | **1** (`d8ace93f`, #377/#261) |

E o `d8ace93f` troca a validação do **nome** no topo do handler — **não encosta
em sessão, cookie ou retomada**.

> **Conclusão honesta: esta branch NÃO é da família venenosa.** A superfície
> dela está praticamente intacta na main. **Isso não autoriza mergear** — ela
> nasceu marcada "NÃO MERGEAR SEM REVISÃO" pelo próprio autor, e eu **não li as
> 618 inserções nem rodei os testes dela**. O que eu medi é o **custo de
> retomá-la, que é baixo** — ao contrário do que "503 commits" faz parecer.

**O que isso muda:** a decisão do Johnny deixa de ser *"mandar construir uma
retomada"* (caro) e vira *"revisar e terminar uma que já existe, com 179 linhas
de teste junto"* (barato).

⚠️ **Por que foi abandonada eu não sei, e não vou inventar.** Sem PR, sem nota.
Quem retomar tem que assumir que existe um motivo não escrito.

---

## 5. `#492` — causa confirmada no ar, código despachado, PR conferido por mim

**A aluna do cartão se resolveu sozinha** (passo 1 da rotina, conferido antes de
tudo): `katarinadasilva98` está **`pronto`** desde **20/09 18:16Z**, com os 4
itens de ciência gravados e **2** áudios — ela gravou mais e passou, ~8 h depois
da abertura do cartão. Não escrevi pra ela: sairia lembrando de um problema que,
para ela, acabou. Mesma coisa com o `#455` (`consultornovoolhar14`, `pronto`).

**O defeito continua inteiro** — o 404 da §2.3 prova.

**Controle positivo vivo de que a receita funciona:** o pedido `b1700feb`
(criado **hoje**) está com `ciencia_foto` com os 5 itens **gravados** e
`ciencia_foto_at` **NULL** — é o rascunho persistido pelo endpoint de foto, para
uma pessoa real, hoje. Antes do `c08da4b9` isso era impossível. Ou seja: as duas
metades pedidas para a tela de áudio **não são desenho novo, são cópia de coisa
que já funciona em produção**.

Despachei ao `coder` (card `61369880`) → **PR #405**. **Não aceitei a entrega
pelo card**; refiz a medição em worktree limpo:

| o que | resultado |
|---|---|
| `node --test` em `passo-audio-pure.test.ts` | **16/16** |
| **mutante** (`totalFala < MIN` → `< 0`) | **derruba 4 de 16** — o teste morde |
| `tsc --noEmit` | **exit 0** |
| i18n | 3 idiomas, sem chave órfã |

O ponto que conferi com desconfiança, porque é onde a tela voltaria a mentir de
um jeito novo: o cliente usa **`somaFalaDistinta(aprovados)`**, a **mesma
função e o mesmo recorte** do portão do servidor (`audio/concluir/route.ts:32`).
Min e max preservados. E o wiring existe (`page.tsx` passa `cienciaInicial`) —
sem ele o endpoint gravaria e a tela continuaria nascendo vazia.

⚠️ **Não mergeei.** **Régua de fechamento do #492, para ninguém fechar cedo:** a
prova é `POST /api/v1/sgp/audio/ciencia` **deixar de devolver 404** — não o card
ficar "completed" nem o PR estar aberto.

**Não escrevi para os 6 da tela de áudio, e o motivo é substantivo:** ter áudio
aprovado **não** quer dizer estar a um clique do fim. O portão do áudio é **fala
acumulada ≥ 1200 s** descontando silêncio. Dizer a eles "é só marcar as
caixinhas" seria **mentira**. O que eles precisam é exatamente o conserto.

---

## 6. O que eu NÃO fiz

- **Não fechei cartão nenhum.** O `#403` fica `aguardando_aluno` porque **não
  consigo provar que ela está destravada**: se o cookie dela morreu, a carta só
  reduz o estrago. Marcar `fixed` seria afirmar desfecho não medido (regra 14).
  **Data:** se até **29/09** seguir em `foto` com ciência NULL e sem resposta, a
  próxima ronda faz a 2ª tentativa — ⚠️ mas **o WhatsApp dela (+5517814204031)
  já foi julgado formato inválido** na nota de 14/09; conferir antes de usar.
- **Não mergeei PR nenhum** (#405 incluso) e não fechei PR.
- **Não mexi** em crédito, saldo, acesso, plano, GPU ou migration.
- **Não juntei nem apaguei** pedido duplicado de ninguém (#524 é medição).
- **Não repeti o lote do `esperando_johnny`** no grupo: a ronda das 17h levou o
  consolidado há ~2 h e a lista não mudou. Repetir seria ruído. **O que mudou e
  vai junto é o achado do `#312` invisível** (§1).
- Não li a planilha (ordem de 29/08). Não toquei no não-lido da caixa.

---

## 7. Para a próxima ronda

1. **`#492` fecha pelo 404 virar 400**, não pelo PR. PR #405 esperando merge.
2. **`#524` é decisão de produto do Johnny** (retomada do pedido). A medição está
   pronta; não re-apure.
3. ⚠️ **`esperando_johnny.cjs` perde cartão quando a nota nova não repete a
   marca** — o `#312`, com **19 alunos**, está fora da conta hoje. O 19 é piso.
4. **Varredura de `sgp_pedidos` é POR PESSOA, nunca por linha** (§3).
5. **`avisado_em` não responde "já falaram com essa pessoa?"** (§3.1).
6. **`#403`: 29/09** é a data da 2ª tentativa, com a ressalva do WhatsApp.
7. As **77 cartas** anteriores a 14/09 14:06Z seguem sem decisão.
