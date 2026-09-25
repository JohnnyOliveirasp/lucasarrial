# Ronda das falhas — 25/09/2026, ~18hZ

**Método: serial (regra 8, ordem de 21/08).** Um incidente levado até o fim
antes de pegar qualquer outro. Este relatório cobre **um** cartão fechado, e
isso é a entrega inteira da ronda — não é ronda incompleta.

**Produção tocada: 1 merge** (PR #449). Zero GPU, zero migration, zero DDL,
zero crédito movido, zero carta nova a aluno, zero vítima nova.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

- **1307** cartas lidas da pasta `Sent`, 1307 com cabeçalho lido.
- **1230** já tinham linha. **0 escrituráveis** dentro da janela.
- 77 fora da janela (decisão do `--corte`, não defeito).
- Contagem fecha: **1307 = 1230 + 0 + 77 + 0**. Nenhuma carta sumiu na
  classificação.
- Registro local (#210) não existe nesta máquina — é *gitignored*, morre com o
  worktree. É o buraco que esta reconciliação compensa.

Instrumento independente (`2026-09-18_enviados_x_tabela.cjs`): **0 cartas**
depois do corte fora da tabela. Veredito dele: o buraco é **passivo**. Bate.

## Passo fixo 2 — estado da fila

`idade_incidentes.cjs`: **166 abertos** (open 15 · investigating 115 ·
aguardando_aluno 36). Idade: 30d+ **1** · 15–30d 37 · 7–15d 60 · 3–7d 30 ·
<3d 38. Patches do Vigia esperando: **1** (`patch_cfde107d`). Recados
`para_frank_*`: **140**.

---

## A escolha do serial, e por que não foi o mais velho

O mais velho da fila é o **`#52` / `37bacb68`** (37,0d, 36 ocorrências, 22
alunos). **Não o peguei como serial**, e o motivo é medido, não preguiça: o
passo seguinte dele não é meu. A causa é o portão de qualidade, que é o
**`#702cc916`** — parado em **decisão de produto do Johnny há 24 dias**
(falhar sem cobrar, derrubando ~35% das entregas × entregar avisando × manter
como está). Li o cartão para confirmar em vez de lembrar. Os remédios técnicos
desta família já foram **refutados três vezes** (reformatar o texto/chunker,
detector de lista longa, e a leitura "é truncamento"), e o preditor que sobrou
(`coverage_idioma_prob`) é monótono mas só existe em **15,7%** das gerações.
Nada disso anda sem a decisão. Ele segue `open` e a regra 14 continua inteira.

Peguei então **o de nota mais parada entre os abertos com carta já enviada**:
`#421` / `1fbdba8f`, **9,8 dias com UMA nota única**, nascido 15/09 — bug de
código, que a regra 9-B põe na minha mão sem depender de ninguém.

---

## O cartão: `#421` (`1fbdba8f`) — rota sem botão não conserta o atendente

> *"QUANDO UM PEDIDO DO SGP FALHA, NINGUÉM CONSEGUE REFAZER A ENTREGA: nem o
> aluno, nem o suporte, nem o admin — só um script rodado à mão por um agente."*

### O que faltava, e só isso

O conserto **já existia desde 15/09** (`5d409805`) e ficou **pela metade por
9,8 dias**. O próprio commit registrou o que faltava, em letras próprias:

> *"NAO INCLUI o botao na tela /admin/sgp: aquele arquivo esta sendo editado por
> outro agente agora. A rota fica pronta e a ligacao com a UI vai em cartao
> separado."*

**O cartão separado nunca veio.** Resultado: a queixa **literal** deste chamado
seguia **verdadeira para o suporte**. Rota verde, 20 testes, e **zero
consumidor** — a única porta era `curl` de quem tem acesso ao servidor, que é
exatamente a dependência que a rota nasceu para remover.

> **Corrigir o código não é o fim; o fim é o código ALCANÇÁVEL.** A ronda de
> 17hZ aprendeu que merge parado não é conserto. Este cartão ensina o degrau
> seguinte: **merge feito também não é conserto, se ninguém consegue chegar
> nele.** `tsc` verde, suite verde e deploy verde conviveram 9,8 dias com o
> defeito que o cartão descreve.

### Medido hoje, não herdado

| medição | resultado |
|---|---|
| `refazer` na tela `/admin/sgp` + componentes `admin/sgp` | **0 ocorrências** |
| consumidores da rota `POST /admin/sgp/[id]/refazer` em todo o `src` | **0** |
| branches do origin que mencionam `refazer` naquele arquivo | **0** |

O terceiro é a varredura de branch concorrente — a armadilha que esta casa já
produziu **6 vezes**. Aqui não há 7º stale: o trabalho estava **sem dono e sem
concorrente**.

### ⚠️ Erro meu no caminho, e vai como régua

A **primeira** varredura de concorrência acusou **~145 "concorrentes"** — quase
todo o origin. Era **falso**: `git diff main..branch -- <arquivo>` acusa
diferença quando o branch está apenas **ATRASADO** naquele arquivo, não quando
ele o modificou. A segunda versão (contra o `merge-base`) ainda devolveu 92,
porque branch que mergeou a main de volta também difere do merge-base.

Refeita **direto por conteúdo** (`git show origin/$b:<arquivo> | grep -i
refazer`), com **controle positivo** de que o instrumento vê mudança real
(`5d409805` tocou `refazer.ts` → detectado). Número que agiu: **0**.

> **Régua:** instrumento que acusa **145 de 145** não está medindo, está
> reclamando. É a irmã da regra do zero falso — um número que responde "todos"
> merece a mesma desconfiança que um que responde "nenhum".

### O que subiu (PR #449, merge `34abf18c`)

1. **`ofereceRefazerNaTela`** em `lib/sgp/refazer.ts` — a régua do que
   **MOSTRAR** mora ao lado da que decide a **RECUSA**, para que as duas metades
   da mesma pergunta não divirjam sem quebrar teste. Só `falhou` oferece; os
   outros estados têm recusa nomeada na rota e oferecer gastaria o clique do
   atendente num "não". `naoIniciou` vence sobre tudo (o `id` não é de
   `sgp_pedidos`; o clique daria 404).
2. **Botão no MESMO `<Td>` do "marcar erro", não coluna nova** — o aviso no
   próprio arquivo diz que a tabela já sai em ~1780px e que uma 15ª coluna
   empurraria "Atendimento" fora da viewport (reclamado **3×** pelo Lucas). E é
   o lugar certo por conteúdo: é a coluna do **ERRO**.
3. **A resposta da rota vira texto NA LINHA**, sucesso **e** recusa no mesmo
   lugar. O treino é assíncrono: sem confirmação escrita o atendente clica, nada
   muda na hora, e ele clica de novo — **que é como se queima GPU em dobro**. As
   recusas ("já treinando", "já pronta", "áudio curto") são **informação**, não
   erro de sistema; esconder o motivo foi o defeito que abriu o #420.

### Verificações, refeitas por mim (regra 14-B: `tsc` verde não é revisão)

- 🔴→🟢 **RED ANTES DE GREEN.** O teste que lê a **TELA** falhou contra a main
  de hoje (`not ok 8`) e passou depois da ligação. É **o teste que faltava em
  15/09**: um teste que só exercita a régua não vê rota sem consumidor — foi
  assim que 20/20 verde conviveu com o atendente sem saída.
- Suite `sgp` **inteira**: **350 tests / 350 pass / 0 fail / 0 skipped**. Li
  `# pass` **e** `# skipped`, nunca só o exit code (armadilha do #259).
- `tsc --noEmit` **exit 0** · `eslint` **exit 0** nos 3 arquivos.
- **Controle de mutação, 2 mortos:** tirar a trava do `naoIniciou` derruba o
  teste do 404; oferecer em `pronto` derruba o teste das recusas. Restaurado e
  reconferido **15/15**, `git diff` limpo.

### Em produção — as TRÊS pernas da regra 5-B, medidas no servidor

| perna | medição |
|---|---|
| **hash do fonte** | `md5` no Hetzner **IGUAL** ao da `origin/main` nos 2 arquivos (`4feea57f…` / `138444e0…`) |
| **BUILD_ID** | **NOVO** `kZQjsxPQTbLX64HBOPmcz`, mtime **18:17:08Z** (o anterior era `BubvJbGGcTpcxGfpFg-PN`, 17:45:25Z) |
| **pm2** | `aiverse` reiniciado **18:18:02Z**, restarts **48 → 55**, `online` |

Deploy run **36172281962 SUCCESS 18:18:07Z**. Conferi também o **CONTEÚDO do
fonte servido** (4 ocorrências de `ofereceRefazerNaTela` / `"Refazer entrega"`)
— **não** `grep` no bundle, que a própria regra 5-B classifica como falso
negativo.

### Aluno e dinheiro

`ricardoolito@gmail.com` está **servido** e **não há nada a devolver**,
conferido no banco hoje:

- voz `f58a158a` **`ready`** desde 15/09 22:53:07Z;
- carta *"Sua voz ficou pronta"* **entregue** (uid 2488, sem bounce);
- **ZERO débito de treino** — os únicos lançamentos dele são o grant de 100.000
  em 16/09 e o consumo **dele próprio** em 21/09 (−100 roteiro, −4240
  video_clone); saldo **95.660**, acesso até 16/10;
- e ele **VOLTOU** a usar a plataforma em 21/09, que é o indicador de dano que
  importa.

**Não escrevi carta nova**, de propósito: falar com ele agora sobre um botão
interno de admin seria ruído (regras 11 e 27), e o que lhe era devido ele já
recebeu.

### Fechamento

`#421` → **`fixed`**, `resolved_at` 2026-09-25T18:19:40Z, `resolved_commit`
`34abf18c`, `agent_notes` 1 → 2, `resolution_note` 0 → 1101 chars. Gravado via
`anotar_incidente.cjs --confirmar`, **conferido na releitura: 1 linha afetada**.

### ⚠️ O que eu NÃO estou dizendo

- **Não existe pedido em `falhou` agora** (406 pedidos: dados 110 · foto 115 ·
  pronto 146 · áudio 33 · revisão 2), então **o botão não aparece em tela hoje**.
  **Não vi o botão renderizado em produção e não afirmo que vi** — afirmo a régua
  testada, o fio testado contra o arquivo, a suite verde e o fonte servido
  conferido. Ele é a saída para a **próxima** falha: o defeito era latente e
  segue latente, agora **com porta**. Prova visual depende de um pedido em
  `falhou`, que não se fabrica em produção por capricho.
- **Fica aberto e não é deste cartão:** `sgp_fracassos` (migration 117, do mesmo
  conserto de 15/09) **existe** mas está com **0 linhas**, e a coluna `erro` está
  **NULL** nos 406 pedidos. Isso é consistente com *"nenhuma falha desde 16/09"*
  **e** com *"o livro-caixa não está gravando"* — os dois cenários produzem o
  mesmo zero, e **não consigo distinguir sem uma falha real**. Não afirmo nenhum
  dos dois. Quem pegar a próxima falha do SGP confere se nasceu linha em
  `sgp_fracassos`; se não nascer, o item 3 daquele conserto é que está mudo.

---

## Correção de números que duas rondas minhas publicaram

Gravada como nota no `#52` (`37bacb68`). Registro aqui com o mesmo peso do
merge, porque as notas erradas são **minhas** e a próxima ronda agiria em cima
delas.

### 1. O "vazamento de crédito" do Diego **não existe**

A ronda `qa_coverage` de **24/09** registrou, sobre a geração `1c761a52`:
*"estorna a **BEM-SUCEDIDA**"*, *"ficou **+1.944 a favor**, tendo recebido um
áudio de graça"*, *"é **vazamento de crédito** com trilha de auditoria errada"*.
A de **25/09** repetiu como *"anomalia a conferir"*.

**É falso**, e a prova está no próprio `qa` daquela geração:

```
coverage_medio 0,8376   contra   coverage_min 0,85   → ABAIXO do piso da casa
faltantes_total 18 · faltantes_amostra ["minha","maneira","de","me","comunicar"]
```

`1c761a52` **não é "a que deu certo"**: é a **entrega defeituosa** — a mesma que
a transcrição por `whisper-1` da nota 63 destrinchou palavra por palavra.
Julgar por `status='ready'` **ignorando o `qa`** foi o que produziu o erro, e é
exatamente a armadilha que o próprio `loop.py` documenta (*"leia estes campos
filtrando por `status='ready'`"* — ou seja, **`ready` não significa bom**).

O estorno de 23/09 12:31:46Z está **certo**, casado por `ref_id`, e foi **ato
deliberado** desta casa — a nota de fechamento do `#eac94e82` o registra
(*"ESTORNO de 1944 cr ao Diego… Decisão de devolver foi minha"*). Conferido hoje
pela ferramenta `2026-09-23_estornar_audio_entregue_com_defeito.cjs`, que relê o
ledger antes de gravar: **"JÁ ESTORNADO — não pago em dobro. Nada a fazer."**

> **Consequência prática:** **não** existe crédito a recuperar do Diego e **não**
> há bug de estorno para consertar. Quem for atrás do "vazamento" gasta a ronda
> perseguindo um número que nasceu de ler `status` em vez de `qa`. Os **dois**
> débitos dele têm estorno casado por `ref_id`.

### 2. "Perde o acesso em 3,9 dias" não é um precipício

As rondas de 24 e 25/09 trataram o `access_until` do Diego (29/09 12:00Z) como
prazo fatal. Isso **contraria o que a própria casa mediu em 22/09** e escreveu
no `03_ROTINA` (seção *"Pagou + tem saldo + `access_until` vencido NÃO é pagante
trancado"*): a entrada é **livre** e o portão de **gasto é SALDO**. Ele tem
**78.480 cr**.

> Em 29/09 ele **não** perde a capacidade de gerar. Continua valendo que é um
> pagante de primeiro dia sem o áudio que pediu — isso é grave por si —, mas o
> relógio não é o que as duas notas disseram, e tratar como precipício empurra
> para decisão apressada.

### 3. A promessa de 23/09 **foi cumprida** — e eu quase escrevi a 5ª carta

A nota de 23/09 deixou marcado: *"eu escrevi 'eu te retorno sobre isso' a
respeito dos 1.944 cr… se ele não decidir em 48h, escreva assim mesmo"*. Com
53h decorridas, fui escrever — e **li a pasta de enviados primeiro**. A carta
**uid 3255** (*"Seus 1.944 creditos voltaram — como prometi, com o resultado na
mao"*) saiu **23/09 12:37:06Z, sem bounce**, 43 minutos depois da que fez a
promessa.

**Não escrevi.** Seria a família do `b32af5ff` — quatro ordens de reenvio de uma
mensagem que já tinha entrado. A prescrição "se passar 48h, escreva" estava
certa como salvaguarda e **errada de fato**, e só a pasta de enviados sabia.

### Estado do Diego, medido hoje

Instrumento **commitado** (regra 25-B), não afirmação solta:
`_frank/ferramentas/2026-09-25_estado_vivo_diego.cjs` — só leitura, checa o
`error` de toda consulta e **aborta** se o perfil não resolver em 1 linha (ele
já me pegou um `elapsed_s` inexistente, devolvendo erro em vez de "0 gerações").

5 gerações na vida, **zero depois de 23/09 11:48Z** — parado há **54,2h**, não
voltou. Saldo 78.480. Teto diário da regra 9-B: **0 cr** devolvidos na casa
inteira hoje, folga total.

---

## Grupo (regra 7 — só fato consumado)

2 linhas postadas: o fix em produção com o PR, e o fechamento do cartão com o
"aluno servido, zero crédito devido". Nada de log de terminal, nada de progresso
parcial, nada de ronda vazia.

## Fila ao fim da ronda

**165 abertos** (de 166). 7–15d caiu **60 → 59**. O serial entrega um cartão
levado até o fim.

### Pendências nomeadas (paradas, não "em andamento")

1. 🔴 **`#702cc916` — decisão de produto do Johnny, 24 dias.** É o que destrava
   a cabeça da fila (`#52`, 37,0d, 22 alunos). Três opções, nenhuma minha:
   falhar sem cobrar (derruba ~35% das entregas) × entregar avisando × manter.
   **Enquanto não decidir, o mais velho da fila não anda** — e isso não é
   omissão da ronda.
2. **`patch_cfde107d`** do Vigia esperando revisão (upload de vídeo próprio no
   React). Não foi esta ronda.
3. **`sgp_fracassos` com 0 linhas** — indistinguível entre "sem falhas" e "não
   grava". Resolve-se na próxima falha real do SGP (§ acima).
4. **140 recados `para_frank_*`**, o mais velho com 21,8d.
5. **77 cartas anteriores a 14/09** — segue sem decisão de escrituração.
6. **Diego (`#52`)** — pagante de primeiro dia, 54,2h sem voltar, sem o áudio.
   Dinheiro pago, promessa cumprida, causa bloqueada no item 1.
