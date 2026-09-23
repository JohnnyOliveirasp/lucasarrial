# Ronda das falhas — 23/09/2026 ~10h40–11h05Z (Frank, dono da fila)

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`). Postado.
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou reprocessado.

Serial pela regra 8. Não gastei GPU, não toquei em migration, não mexi em
crédito de ninguém, **não escrevi para aluno nenhum** (justificado no §6) e não
retirei dinheiro de ninguém.

**Uma linha:** levei a perna de código do **#469** (`b706b32e`) até produção — e
no caminho descobri que **eu mesmo tinha escrito um PR duplicado**, que a função
que decide esse dinheiro **não tinha um único teste**, e que uma promessa que a
casa faz ao aluno **é falsa**.

| fato | número |
|---|---|
| Cartões fechados | **0** (o #469 só falta a decisão do Johnny — §5) |
| PRs mergeados e **conferidos no ar** | **2** (#341, #411) |
| PRs meus fechados como duplicata | **1** (#398) |
| Branches stale apagados no origin | **1** |
| Guardas de regressão novas | **1** (5 testes, com controle negativo) |
| Mutantes rodados | **8** (4 na regra pura + 4 no controle negativo da guarda) |
| Chamados abertos por mim | **1** (**#527**) |
| Alunos escritos | **0** |
| Dinheiro movido por mim | **0** |
| GPU gasta | **0** |

---

## 0. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1084 lidas = 1007 já com linha + 77 fora da janela + **0 escrituráveis**. Contagem fecha (1084 = 1084). |
| `enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Buraco **PASSIVO**. |
| `percepcao_travada.cjs` | **0**. Controle positivo OK (#310), negativo OK (#518), 512 incidentes varridos. |
| `idade_incidentes.cjs` | **107 abertos** (era 108). 30d+: 4 · 15–30d: 17 · 7–15d: **40** · 3–7d: 33 · <3d: 13. |
| `esperando_johnny.cjs` | **17** parados em decisão do Johnny · mais velho **54d** · 54 alunos · 4 contestados · **2** não triados (era 1 — §7). |

A fila caiu 108 → 107, mas a faixa 7–15d subiu de 39 pra **40**: a fila segue
andando pra direita. Não vendo isso como vitória.

---

## 1. Por que este cartão

Regra 8: o mais antigo com aluno atrás. A cabeça da fila segue bloqueada em
decisão do Johnny, não em apuração minha. O mais antigo **não** bloqueado nele
era o `b706b32e` (#469) — 39 dias de `first_seen_at`, cartão de **dinheiro**,
com PR escrito e **parado**.

---

## 2. Achado 1 — havia DOIS PRs para o mesmo defeito, e o meu era o pior

Ao abrir a fila de PRs (são **50** abertos) encontrei dois títulos quase iguais:

| PR | branch | data |
|---|---|---|
| **#341** | `fix/estorno-treino-saldo-pendente` | 18/09 |
| **#398** | `fix/estorno-treino-**por**-saldo-pendente` | 22/09 |

Mesmo defeito, mesmos arquivos, branches diferindo por **uma palavra**.

**O #398 fui eu que escrevi**, na ronda de 22/09, sem ter visto que o #341 já
existia havia 4 dias. Trabalho duplicado por falha de conferência **minha**.
Registro como falha minha, não como coincidência: a ronda de 22/09 gastou o
turno inteiro reescrevendo um conserto que já estava pronto e parado.

Conferi um contra o outro antes de escolher. O **#341** é mais antigo **e**
estritamente mais amplo:

| | #341 | #398 |
|---|---|---|
| saldo em vez de existência | ✅ | ✅ |
| teto de uma tentativa por falha | ✅ | ✅ |
| remove `houveDebitoDeTreino` | ✅ | ✅ |
| **corrige o texto ao suporte** (dizia "10.000 devolvidos" fixo, mesmo quando voltou outro valor) | ✅ | ❌ |
| atualiza a doutrina em `falha-de-treino.ts` | ✅ | ❌ |
| invariante "estornar nunca CRIA saldo positivo" | ✅ | ❌ |

O texto ao suporte é o ponto que decide: era uma **segunda mentira** (da família
#290/#446) que o meu PR deixava viva.

**#398 fechado como duplicata e branch APAGADO no origin.** Conferi antes na
`origin/main` que tudo que ele fazia está lá: `houveDebitoDeTreino` não existe
mais, o teto está em `Math.min(devido, args.teto)`, e o crédito sai de
`amount: valorEstornado`. Apagar foi decisão consciente — deixá-lo seria a **7ª
mina** da família `feat/onedrive-401` / `fix/trava-foto-nova-8379549c`, e o diff
fica preservado no próprio PR fechado.

---

## 3. Não aceitei "MERGEABLE/CLEAN" como prova

`finalize-training.ts` **andou em 4 commits** na main desde a base do #341. É
exatamente o perfil das minas que o índice de ordens lista. O GitHub dizia
`MERGEABLE/CLEAN`, mas merge limpo é **texto**, não semântica.

Montei o merge num worktree e testei **o resultado**, não o branch:

    node --test (credits + voices) ......... 116/116
    npx tsc --noEmit ....................... exit 0

E **mutei a regra de dinheiro**, porque suíte verde não é revisão:

    devolve sempre o teto (o bug de volta) ....... 2 testes quebram
    sem a guarda de saldo >= 0 ................... 5 testes quebram
    sem teto (1ª falha limpa a dívida toda) ...... 1 teste quebra
    equipe passa a receber estorno ............... 1 teste quebra

4 mutantes, 4 pegos.

---

## 4. Achado 2 — a função que decide o dinheiro subiu SEM UM ÚNICO TESTE

A regra **pura** (`valorDoEstornoDeTreino`) está bem coberta. Mas quem lê o
extrato e decide o valor de verdade é **`saldoPendenteDoTreino`**, em
`service.ts`, e ela não tinha teste nenhum.

Medi em vez de supor. Troquei a perna do estorno de
`ref_type === "voice_train_refund"` para `kind === "training"` — **a armadilha
de 20/08**, a que quase pagou 13 alunos em dobro no `generation_refund`:

    node --test (credits + voices) ......... 116 pass / 0 fail
    npx tsc --noEmit ....................... exit 0

**O defeito de dinheiro voltava por outra porta e NADA acusava.** O próprio
`service.ts` avisa em caixa alta *"JAMAIS por `kind`"* — mas **comentário é
pedido, não guarda**.

Confirmação empírica no extrato real do Heitor: os **dois** estornos têm
`kind='extra_purchase'` (é o RPC `add_extra_credits` que carimba). Por `kind` a
perna do estorno **não acharia nenhum**, o saldo pareceria eternamente devedor,
e a casa voltaria a pagar o mesmo débito em toda falha.

**Guarda no ar: PR #411** (`9a1b41a7`). Textual, porque a função faz I/O no
Supabase e defeito de **filtro** não aparece em teste de tipo nem na regra pura
— mesma classe do defeito de **ordem** de 23/09 (teto do poll), que o `tsc`
também não viu.

Lição de 23/09 aplicada de propósito: a guarda irmã **nasceu com falso positivo**
por comparar no arquivo inteiro. Esta **recorta** a função antes de olhar, e um
teste confere que o recorte não vazou.

**Controle negativo** — 4 mutantes no `service.ts` real, a guarda reprovou cada
um, enquanto a suíte inteira seguia 116/116:

    perna do estorno por kind .................. 4 pass / 1 fail
    consulta deixa de trazer o estorno ......... 4 pass / 1 fail
    perna do débito afrouxada .................. 4 pass / 1 fail
    erro de consulta devolve crédito ........... 4 pass / 1 fail

Código certo **5/5** · suíte **121/121** · `tsc` 0 · `eslint` limpo.

### Prova de que está no ar (não é "mergeado", é **em produção**)

| PR | merge | md5 do fonte no Hetzner × `origin/main` |
|---|---|---|
| #341 | `c6e9ea81` | `service.ts` `fdf8db49…`, `onboarding-cobranca.ts` `6eb3b550…`, `finalize-training.ts` `c25d5ac5…` — **idênticos** |
| #411 | `9a1b41a7` | (só teste, não toca produção) |

Deploy `success` nos dois. `BUILD_ID` `kejxkHLCugcR4gpjqGFn4`.

### Prova contra as linhas REAIS de produção (não raciocínio)

Extrato do ref `600173a6`: −10.000 (14:43:26) · +10.000 (14:44:28) · +10.000
(15:31:18). Rodei a função **que está no ar** com essas linhas:

    saldo apurado do ref .......... +10.000  (a casa já devolveu a mais)
    3ª falha estornaria ...........       0
    após o 1º estorno (saldo 0) ...       0   <- o bug de 18/09 não acontece mais
    CONTRAPROVA 1ª falha (−10.000)   10.000   <- aluno legítimo CONTINUA recebendo

A contraprova importa: sem ela o conserto poderia só ter trocado o defeito de
lado. Crédito que deixa de voltar o aluno reclama; **crédito que sobra ninguém
reporta**.

### Varredura da classe, refeita hoje

Todo `ref_id` onde estornos > débitos, no banco inteiro: continuam **4**,
**nenhum novo desde 18/09**. Os 3 de agosto são classe **diferente** (estorno
sem débito nenhum), já coberta pela guarda de 09/09. Não abri chamado por eles
e não escrevi para os 3.

---

## 5. O que falta no #469, e por que eu não fiz

Heitor hoje: `credits_subscription` 63.155 · `credits_extra` **20.000** —
intactos, não gastou.

A casa criou 10.000 cr do nada por defeito **nosso**. Retirar crédito de aluno
**não é minha alçada**. Levei ao grupo com o número na mão. Cartão segue
`investigating` por **um** motivo só: falta a **decisão do Johnny**.

---

## 6. O que eu NÃO fiz, e por quê

- **Não escrevi pro aluno.** Ele está a **mais**, não em prejuízo. Escrever
  antes da decisão seria anunciar uma retirada que pode não acontecer.
- **Não retirei crédito** e não mexi na classe histórica de agosto.
- **Não consertei o #527** (§8): a regra 8 manda levar um cartão ao fim antes de
  pegar outro.
- **Não toquei no gatilho a montante** — o treino falhou 2× por **disco cheio**
  no worker (`#d0d9288d`, mesma assinatura do `#9119254c`, aberto desde 10/08;
  PRs **#338** e **#342** seguem **abertos**). O conserto de hoje impede o
  estorno duplo, **não** impede o treino falhar. Registro pra não parecer
  coberto.

---

## 7. Achado 3 — o instrumento estava escondendo um cartão de dinheiro

O `#469` esperava decisão do Johnny **desde 18/09** e **não aparecia** no
`esperando_johnny.cjs`. A contagem de 22/09 deu 17 e ele não estava entre eles.

Causa: o critério lê só a **última nota**, e a minha nota de 22/09 escreveu *"o
Johnny decidir"*, que não casa a marca `/decis[aã]o d[oe] johnny/`.

É a doença que o **próprio cabeçalho do instrumento** documenta como **"QUEM
ANOTA, ESCONDE"** — só que aqui ela pegou um cartão de **dinheiro**, e ninguém
tinha medido isso acontecendo num caso real.

**Medido, antes e depois.** Escrevi a nota de hoje com as palavras exatas
("DECISÃO DO JOHNNY") e reexecutei:

    antes .... invisível (não aparecia em bucket nenhum)
    depois ... aparece, em NÃO TRIADOS (1 -> 2)

O piso de 17 estava **subestimado em pelo menos 1**. O instrumento não está
quebrado — ele avisa que é assim; mas a mitigação ("quem anotar, repita as
palavras") depende de disciplina de quem escreve, e eu mesmo falhei nela há 4
dias. Fica registrado pra quem for melhorar o instrumento.

---

## 8. Achado 4 — cumpri a ressalva que eu mesmo deixei, e a promessa é FALSA

No log de 23/09 02h (§4-B) eu escrevi, ao mergear o #353, que **não tinha
provado** que a frase *"O suporte já foi avisado"* fosse verdadeira, e me
comprometi a conferir nesta ronda. Conferi. **É falsa.**

`images/route.ts:297` grava no card do aluno *"o estorno automático NÃO saiu. O
suporte já foi avisado e vai devolver seus créditos na mão"*. O que existe por
trás disso é **um `console.error`** (linha 284).

Como medi:

1. `grep` no repo por `images:delete` e `ESTORNO NÃO CONFIRMADO` — a string só
   aparece no próprio `route.ts`. **Nenhum consumidor.**
2. `crontab` do Hetzner: os 6 sweeps de 5 min (`clones`, `mail`, `orphans`,
   `social`, `winback`, `unanswered`) são todos dirigidos por **banco**. Nenhum
   lê stdout/journal da aplicação.
3. `grep` por `journalctl`/`pm2 logs` no servidor: só o script de limpeza de
   disco e o `bash_history`.

**Agravante:** não é infraestrutura faltando, é **chamada que nunca foi feita**.
O helper canônico `abrirChamadoReportado` (`lib/incidents/reportar.ts`) já é
usado em **6 lugares**, inclusive no `finalize-training.ts`, que faz exatamente
isto. Este caminho não chama.

É o caminho em que o dinheiro do aluno **não voltou**. Ele lê que o suporte
sabe, então não cobra. O suporte não sabe.

**Chamado #527 aberto** com a medição inteira. Não consertei hoje (regra 8), e
não afirmo que já aconteceu com alguém — o caminho é raro e não medi ocorrência
real. **O defeito é a promessa, não um caso.**

---

## 9. Fim de ronda

- Produção tocada: **2 merges**, conferidos por md5 no servidor.
- Grupo: postado (fato consumado, sem código, sem saída de terminal, sem dado
  pessoal além do primeiro nome).
- Nenhuma carta, nenhuma GPU, nenhum crédito, nenhuma migration.
- Log **na main**, que é onde registro fica visível pra próxima ronda.

### Pendências que eu deixo nomeadas (não são "em andamento", são paradas)

1. **#469** — só falta a **decisão do Johnny** sobre os 10.000 cr do Heitor.
2. **#527** — consertar a promessa (chamar `abrirChamadoReportado`) ou tirar a
   frase. **Preferir o chamado**: a frase está certa, falta torná-la verdadeira.
3. **Disco cheio no worker** — PRs **#338** e **#342** abertos; é o gatilho que
   faz o treino falhar em primeiro lugar.
4. **50 PRs abertos.** Este é o número que mais me incomoda hoje. Dois deles
   eram o mesmo conserto e ninguém tinha percebido em 4 dias. Não sei quantos
   outros pares existem — **não medi**, e não vou afirmar que são só esses.
