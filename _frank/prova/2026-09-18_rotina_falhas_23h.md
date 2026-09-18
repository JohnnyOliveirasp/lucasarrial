# Ronda das falhas — 18/09, ~22h40–23h05Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).
Ronda anterior: `2026-09-18_rotina_falhas_22h.md`. Vigia mais recente:
`2026-09-18_vigia_22h.md`.

**O achado da ronda: o link de acesso que a casa manda pro aluno está quebrado
por desenho, e eu provei o conserto em produção.** Não é hipótese nova — a nota
das 19h45Z já tinha desenhado o mecanismo e escrito *"precisa de teste real
antes"*. Esta ronda fez o teste real.

---

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado ANTES de tocar na fila, com os dois instrumentos independentes.

```
2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  668 lidas da pasta "Sent" = 591 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 0  → nada a fazer
  ✔ 668 = 668: nenhuma carta sumiu na classificação

2026-09-18_enviados_x_tabela.cjs  (irmão de leitura, instrumento independente)
  casadas por Message-ID: 591 · por destinatário+janela de 10min: 4
  VEREDITO: 0 carta depois do corte ficou fora da tabela — buraco PASSIVO
```

Cresceu 667 → **668** desde as 22hZ; a nova já nasceu com linha. O registro
local (#210) segue em **0** (é gitignored, morre com o worktree — é exatamente
por isso que a reconciliação lê a **pasta**). As **77** anteriores a 14/09
14:06:31Z seguem **sem decisão**, por desenho do `--corte`.

---

## O incidente que peguei: `#430` (Walsicleia) — e o `#438` que está por trás

Peguei este pela prioridade explícita da rotina (**aluno pagante travado vem
antes da limpeza da fila**): R$ 936,15 pagos em 21/08, conta criada 04/09,
`last_sign_in_at` **NULL** há 14,3 dias, 7 e-mails dela, 3 links mortos.

### Uma hipótese minha que eu matei ANTES de gastar a ronda nela

Li no cabeçalho do `link_de_primeiro_acesso.cjs` que o Safe Links do
Outlook/Hotmail faz *prefetch* e queima link de uso único, vi que ela é
`@hotmail.com`, e achei que tinha achado a causa. **Já estava refutado**, e a
nota das 19h45Z diz com todas as letras *"ninguém mais persiga o varredor"*:
`auth.sessions` dela = 0 e `auth.refresh_tokens` = 0, com controle positivo de
3.029 sessões na tabela. Se um varredor tivesse consumido o token, a verificação
teria criado sessão. Não criou. **Registro que quase repeti um caminho já
fechado, e que foi a nota do incidente que me segurou.**

### Quarto zero falso da casa, reconfirmado por instrumento próprio

Fui procurar evidência em `auth.audit_log_entries` e ela devolveu `[]` pra ela.
Antes de reportar, rodei o controle: **`count(*) = 0` na tabela inteira, sem
`min` nem `max` de `created_at`**. A tabela nunca teve uma linha. **Qualquer
pergunta de auth feita a ela devolve zero falso.** Bate com o que a nota das
19h45Z já tinha registrado; anoto de novo porque eu cheguei nela sozinho e quase
tratei o zero como medição.

### O defeito, medido lado a lado em produção

`recovery-link/route.ts:41` devolve `properties.action_link`, que aponta pro
`/auth/v1/verify` do Supabase. Esse endpoint responde **303 com a sessão no
FRAGMENTO** (`#access_token=...`). **Fragmento não viaja pro servidor**, e o
`auth/callback/route.ts` só lê `code`/`token_hash` da **QUERY** — então cai no
ramo final e joga o aluno em `/login?error=missing_code_or_token` **com o token
de uso único já queimado**.

| caminho | resultado medido |
|---|---|
| **[A]** `action_link` — o que a casa manda hoje | `303` → `/auth/callback?next=..#access_token=..` → `/login?error=missing_code_or_token` |
| **[B]** `token_hash` na QUERY — o proposto na nota das 19h45Z | `307` → **`/reset-password`** + `Set-Cookie sb-…-auth-token` ✅ |

O ramo [B] chama `verifyOtp({token_hash,type})` **no servidor**, que grava o
cookie do lado certo.

**Controle positivo:** rodei o [B] na conta da casa (`suporte@fastcloner.com`) e
o `last_sign_in_at` dela foi carimbado **2026-09-18T22:47:22Z**. Ou seja, este
formato **carimba `last_sign_in_at`** — que é exatamente o campo NULL nos 14
travados. Se algum deles tivesse recebido link bom e clicado, a gente veria.

### ⚠️ O falso NEGATIVO que eu mesmo produzi, e que quase virou o relatório

Meu **primeiro** teste deu `[B] = "Email link is invalid or has expired"`, e eu
estava a um passo de publicar que **o conserto proposto não funciona** — o que
teria matado a saída certa e mandado a próxima ronda pro caminho errado.

Era artefato meu: os dois caminhos **dividiram o mesmo token**, o [A] rodou
primeiro e queimou, e o [B] herdou o cadáver. Refeito **isolado, com token
fresco em cada caminho**, o [B] passa. Fica escrito porque o erro não é de
digitação: é a mesma família do zero falso — **medir com o instrumento
contaminado e acreditar no resultado porque ele era plausível**.

---

## O que eu fiz (fatos consumados)

**1. Consertei a ferramenta da casa.**
`_frank/ferramentas/2026-09-18_link_de_primeiro_acesso.cjs` agora emite o link
no formato `token_hash`; o `action_link` passou a sair só como **referência de
diagnóstico**, com a medição inteira no docstring. Motivo de ser aqui e agora:
enquanto o produto não é corrigido, **qualquer ronda que gerar link vai gerar o
formato que funciona** — em vez de repetir o erro por ignorância.

**2. Escrevi pra Walsicleia** (regra 8: carta individual, sobre caso que estou
tratando, é minha decisão). **uid 2837** na pasta de enviados + linha em
`emails_enviados` (`origem=ronda-manual`, chave `acesso-link-token-hash`). As
três pernas conferidas.

Antes de gerar, **conferi `recovery_sent_at`** como a nota anterior mandou: o
link dela era de 18/09 18:55:54Z e vencia ~19:55Z — **morto há ~3h**. Não apaguei
link vivo de ninguém.

A carta (a) assume a culpa da casa pelas duas semanas, sem enfeite; (b) traz o
link testado; (c) avisa que vale 1 hora e que **basta responder "quero outro
link"** que a casa manda outro na hora — que é como ela deixa de depender de
acertar a janela; (d) diz que a voz dela está pronta desde 11/09.

**O que a carta NÃO promete, de propósito:** ela está `plan='free'` com **saldo
0** (zero linhas em `credit_transactions`). Se entrar hoje, acha a voz pronta e
não gera nada. O que a compra avulsa libera é **decisão comercial do Johnny**
(armadilha #173, assunto #290/#434). Prometer crédito seria fabricar a próxima
decepção.

**3. Anotei os dois cartões** (`#438` 8→9 notas, `#430` 11→12), com a medição e
com os dois erros meus escritos.

**4. Despachei o conserto do produto** pro `coder` (card `289860e3`): montar o
link com `hashed_token` no `recovery-link/route.ts` **e procurar os outros
lugares que mandam `action_link` pro aluno** — o caminho que carimba recovery no
instante da criação é o suspeito principal e é a causa dos 536. Mandei junto a
armadilha do token compartilhado, pra ele não repetir meu falso negativo.
Branch `feat/` + PR com base `main`, como manda a casa.

---

## O tamanho real do problema: são 14 travados, não 10 — e a classe está crescendo

`porta_de_entrada_sgp.cjs --listar` é o comando que o **próprio fechamento do
`#435`** deixou escrito em 16/09 (*"quem sumir da lista, entrou"*). **Ninguém
rodou por 2 dias.** Rodei.

Controle positivo do script: 105 pedidos `pronto`, **90 já entraram**, 14 fora.

| aluno | pronto há | recovery |
|---|---|---|
| iran@ogr.com.br | 11,9d | 16/09 21:46Z |
| edust@live.com | 8,8d | 16/09 21:54Z |
| soleideritter@gmail.com | 7,9d | 16/09 21:54Z |
| rafaelzan@me.com | 7,2d | 16/09 21:54Z |
| **walsicleia_kaka@hotmail.com** | 7,1d | **18/09 22:5xZ (esta ronda)** |
| annagalaggi.adv@outlook.com.br | 4,9d | 16/09 21:54Z |
| januario@caffaroadvogados.com.br | 4,3d | 16/09 21:55Z |
| asbertoni@hotmail.com | 2,2d | 16/09 21:46Z |
| dacostavenicia@gmail.com | 2,1d | 16/09 21:55Z |
| luisrocha@mattosrochaadvogados.com.br | 1,2d | **NUNCA** |
| almaraujo13@gmail.com | 1,0d | **NUNCA** |
| derinsulanerjp@gmail.com | 0,5d | 18/09 00:39Z |
| odontologiaabiliocardoso@gmail.com | 0,3d | 18/09 16:36Z |
| irleygurgel@gmail.com | **0,1d** | 18/09 21:14Z |

**Cinco nasceram DEPOIS do fechamento do `#435`**, o mais novo ~1h30 antes desta
ronda. A classe não está quieta: está produzindo vítima nova.

**Dos 10 do `#435`, NOVE seguem com `last_sign_in_at` NULL** dois dias depois de
"servidos". O único que entrou (`bruno_aurelio@msn.com`, 17/09 13:05Z) é
justamente o que tem `recovery_sent_at` **NULL** — **não usou link da casa**.
Nove cartas com link, zero entradas. Isso é o que transforma o mecanismo de
hipótese em causa.

**O `#435` não mentiu** — e isso importa registrar. O fechamento dele diz
explicitamente *"NÃO afirma que os 10 já entraram"* e deixou o comando de
conferência. A falha não foi a nota; foi **ninguém rodar o passo que ela pediu,
porque o cartão estava fechado**. É a família do `8d370ef5`: classe fechada que
segue disparando. Por isso **não reabri o `#435`** (a afirmação dele era estreita
e verdadeira) e levei a medição pro `#438`, que é o cartão **vivo** da classe.

**O contador do `#438` está congelado**, igual ao `#404` do vigia:
`occurrences=536` e `last_seen_at=2026-09-16T21:57Z`. Quem olhar a idade dele vê
cartão morto. Não abri o código do detector, então **não chamo o contador de
defeituoso** — afirmo o observável: a classe cresceu e o cartão não registrou.

---

## ⚠️ PARA O JOHNNY DECIDIR

1. **Carta pros outros 13 travados.** É envio em **massa**, e a regra 8 exige o
   teu "pode". São **pagantes**, o mais velho está há **11,9 dias**, e agora
   existe um link que comprovadamente funciona. **Só falta a tua palavra.**
2. **Entitlement da Walsicleia (e provavelmente dos outros 13).** Ela pagou
   R$ 936,15 e está `free` com saldo **0**. Destravar o acesso entrega ela numa
   plataforma onde não consegue gerar nada. É o assunto `#290/#434` e é
   **decisão comercial**, não de ronda.
3. **Herdadas, sem resposta:** a janela de merge dos PRs do worker (`#338`,
   `#342` — cujo próprio título diz "NÃO MERGEAR" —, `#343`, e agora `#345`), e
   os **270.000 cr** dos 27 pedidos do SGP.

---

## O que eu NÃO fiz

- **Não mandei carta pros outros 13.** É massa; falta o "pode" (regra 8).
- **Não fechei cartão nenhum.** O `#430` segue `aguardando_aluno` (**ela não
  entrou**: `last_sign_in_at` NULL às 22h55Z) e o `#438` segue `open` (13 de 14
  travados, e o conserto do produto não está em produção). Regra 14 inteira.
- **Não reabri o `#435`** — a afirmação dele era estreita e verdadeira.
- **Não toquei em crédito de ninguém** e não criei estorno.
- **Não mexi no `auth/callback/route.ts`.** O ramo `token_hash` já funciona; o
  defeito é em quem **monta** o link.
- **Não mexi no código do produto** — o conserto foi despachado, vai por PR.
- **Não apliquei o conserto nos outros lugares** que possivelmente mandam
  `action_link` (o carimbo na criação da conta). Está no card do `coder` como
  busca, não como fato: **não medi quantos são.**
- **Não li o diff dos PRs** `#338`/`#342`/`#343`/`#345`.
- **Não li a caixa do suporte@ pra triagem** (a Fast marca como lido).
- **Não afirmo que a Walsicleia vai entrar.** A casa fez a parte dela por um
  caminho novo e testado. O desfecho se mede na próxima ronda.
- **Não ouvi áudio e não vi vídeo** nesta ronda.

---

## Para quem pegar a próxima ronda

1. **Confira `last_sign_in_at` da Walsicleia PRIMEIRO.** Entrou → o caso de
   acesso acabou, sobra o entitlement. Não entrou e ela pediu outro link → mande
   outro (a ferramenta já emite o formato certo) e aí sim o problema não é mais
   o formato: vale reescalar o canal WhatsApp.
2. **Rode `porta_de_entrada_sgp.cjs --listar` toda ronda.** Foi ele que revelou
   que eram 14 e não 10. Ficou 2 dias sem rodar porque o cartão estava fechado.
3. **Se o Johnny liberar a massa**, a carta da Walsicleia (`/tmp/carta_walsicleia.html`,
   mas reescreva os trechos pessoais) é o modelo — com link gerado **na hora do
   envio**, um por aluno, e conferindo `recovery_sent_at` antes de cada um.
