# Ronda das falhas — 12/09/2026 ~18h40–19h00Z (15h40 BRT)

Canal: ordem de **31/08** — tudo de FastCloner vai pro **grupo**, e só pro grupo
(`notify-grupo.sh`). Este arquivo é o log técnico da ronda, não mensagem pro Johnny.

Repo em `main`, `pull --ff-only` limpo. Li `_frank/ordens/README.md`, a ordem de
**27/08** (só erro de sistema vira chamado) e a de **29/08** (planilha desligada).
**Nada da planilha foi lido, escrito, classificado ou reprocessado.**

Fila na entrada: **80 abertos**, 9 aguardando aluno, 4 patches do Vigia sem tratar.
Fila na saída: **79 abertos**, 3 patches do Vigia.

---

## 1. Item serial: `#349` (`3dbd2bf0`) — **FECHADO**

Escolha pela regra 8. Os mais velhos seguem bloqueados por motivo com data, e eu
conferi em vez de herdar:

- **`#312`** (95,1d, 19 pagantes sem conta) — **não está travado, está esperando.**
  Reli as 12 notas: as 19 foram contatadas em 08/09 (Enviados uids 1345–1348 entre
  elas) e a segunda tentativa tem data marcada, **15/09**. Hoje é 12/09: não venceu.
  Regra 8 — "mandou o e-mail e anotou a data, o item saiu do seu colo".
- `#313`, `#15`, Katia, Luciano (19/09), Alana: bloqueio herdado das rondas
  anteriores, sem fato novo nesta.

Sobrou o `#349`. E ele **não precisava de investigação: precisava de fechamento.**

### 1-A. O que era

`ehRepetida` (`impressao-foto.ts`) usava dHash **8x8 = 64 bits** com
`DHASH_LIMITE = 5`. Em 64 bits as faixas se **sobrepõem** — mesma imagem re-salva
0..1, fotos DIFERENTES da mesma pessoa 1..4. Não existe limiar que separe: não era
o parâmetro, era a **resolução**. Depois de anexar 2 fotos, as 6 distintas
restantes do aluno batiam `<= 5` contra uma das duas e **todas** eram recusadas,
com mínimo de 4 (`SGP_FOTOS_MIN`). Um pagante (Igor Moraes, sessão `42454b04`)
ficou **~6h travado na tela 2**, e a mensagem ainda mandava "escolha outra, de um
ângulo diferente" — exatamente o que ele já estava fazendo.

### 1-B. Já estava consertado, por outro caminho

`dc3d941`, mergeado pelo **PR #243** (merge `243dc08`). Deploy
`Deploy Frontend (production)` **concluído `success` em 11/09 21:54Z** — conferido
por *run concluído*, nunca por PR verde nem por cartão "completed".

O que está no ar é **16x16 (256 bits) com `DHASH_LIMITE = 12`** — e o 12 **não** é
o número que este cartão tinha proposto. Foi remedido em 11/09 com **214 fotos de
40 pedidos reais (481 pares distintos × 642 re-salvas)**: 0/481 falso-positivo, par
distinto mais próximo a **23** (11 bits de folga), e ainda pega 83,8% das re-salvas.
A assimetria mandou no desenho: falso-**positivo** tranca pagante sem saída
(retentar não resolve), falso-**negativo** só deixa uma foto parecida entre as 6 —
e o `sha256` continua pegando reenvio byte a byte.

**Sem migration**, conferido no fonte: `sgp_dhash_distancia` já é genérica no
comprimento e `sgp_anexar_foto` recebe o limite por parâmetro, vindo do TS em
`anexar.ts:53`.

### 1-C. Prova que eu mesmo rodei (não herdada)

`node --test src/lib/sgp/anexar.test.ts` na main → **12/12 pass**, com **A5/A6/A7
batendo no banco de verdade**. Tripwires **B4** (limite abaixo da sentinela de 64)
e **B5** (o dHash é 16x16) verdes.

### 1-D. O aluno

Conferido **no banco antes de fechar**: `#345` e `#346` estão `fixed` desde 10/09
21:51/21:52Z — aluno destravado com as 4 fotos no pedido e **avisado por e-mail**
(Enviados uid 1671). **Não escrevi de novo**: seria rajada sobre assunto resolvido.

Fechado com `resolved_commit = dc3d941`, 1 linha afetada, conferida na releitura.

---

## 2. O achado da ronda: um PR duplicado que **regrediria a produção**

O **PR #234** (`feat/sgp-dhash-16x16`, aberto 10/09 22:02Z) atacava este mesmo
defeito por outro caminho e **continuava aberto**. Mergear hoje faria três
estragos, os três conferidos no diff:

1. **Rebaixaria `DHASH_LIMITE` de 12 para 3** — número tirado de **32 objetos de
   UMA sessão**, contra os **481 pares** da medição que está no ar.
2. **Quebraria os tripwires do `anexar.test.ts`.** O PR tira o literal
   `export const DHASH_LIMITE = N` do `impressao-foto.ts` e deixa re-export. O
   teste lê esse limite **do fonte por regex** (`/export const DHASH_LIMITE = (\d+)/`),
   porque o alias `@/` não resolve em `node --test` — sem o literal ele cai no
   `throw new Error("não achei DHASH_LIMITE em impressao-foto.ts")` e **derruba o
   arquivo de teste inteiro**, B4 e B5 junto.
3. Está **65 commits atrás e divergido**, com base no arquivo velho de 8x8.

Mesma classe dos stale já registrados no `ordens/README` (`feat/onedrive-401`,
`feat/fix-image-upload-retry`, os dois da cura de referência): PR que conserta um
defeito **já consertado por outro caminho** e, ao mergear, derruba o que está no ar.

**Fechei o PR #234** com o porquê escrito nele. Branch `feat/sgp-dhash-16x16` fica
para descarte no origin.

**O que sobreviveu da ideia e vale portar um dia:** o módulo puro testável e o
**controle de não-tautologia** do teste (medir o par com o algoritmo ANTIGO e
exigir que o antigo tenha barrado — se alguém reverter pra 8x8, o teste falha de
verdade, não por acaso). Se portar, manter `DHASH_LIMITE = 12` e o literal no
`impressao-foto.ts`.

### 2-A. A lição, que é sobre processo e não sobre dHash

O Vigia **já tinha visto** o duplicado e escrito em `b5f2dd4` (11/09 22hZ):
*"#349 ja consertado na main com PR #234 duplicado aberto"*. Ficou **21h** assim.
**Ver não é tratar.** O sensor fez o dele; o dono da fila é quem fecha. Registrado
porque a fila tem 37 PRs abertos e este não é o único candidato a stale.

---

## 3. Marcelo — o alarme da varredura que **não** é abandono

O bloco "ACESSO VIVO, COM CRÉDITO E SEM NENHUMA VOZ PRONTA" apontou
`marcelopersonalthe32@gmail.com` (33 dias, 298.950 cr). **Fui conferir em Enviados
antes de escrever qualquer frase sobre contato** — a armadilha que este mesmo
repositório já registrou três vezes no `#312`.

**Não é vítima esquecida.** Ele tem uma sequência longa de e-mails nossos, pediu
saída em 09/09, teve o pedido registrado com a data certa (dentro da garantia da
cobrança de 05/09) e escalado como urgente. **Não escrevi pra ele**: seria mais uma
mensagem sobre assunto que já está com gente.

**Fica registrado como dívida de dinheiro, não minha de investigação:** o
entitlement dele segue `active` com `access_until 2026-10-05`. Se o reembolso e o
encerramento não forem executados por quem decide, **ele é cobrado de novo em
05/10**. Não mexi: não autorizo devolução nem cancelo assinatura por conta própria.

**Defeito de instrumento, de novo:** o alarme olha `voices` + créditos +
`access_until` e não sabe distinguir "abandonado pela casa" de "já resolvido, à
espera de decisão humana". É a mesma cegueira anotada na nota de 11/09 12hZ do
`#312` (lá era `sgp_pedidos`). **Não abri chamado** — ordem de 27/08, não tenho
ocorrência de sistema, e a classe já está anotada.

---

## 4. O que eu fiz, em uma lista

1. **Fechei o `#349`** (`fixed`, `resolved_commit dc3d941`), com o que era, o que
   está no ar, a prova que rodei e a conferência de que o aluno já foi avisado.
2. **Fechei o PR #234**, duplicado e regressivo, com os 3 motivos medidos no diff.
3. Rodei `anexar.test.ts` na main: **12/12**, incluindo os testes que batem no banco.
4. **Apaguei o patch `patch_3dbd2bf0`** do `agent_state`: era a mesma proposta
   superada (limite 3), e o próprio Vigia tinha escrito *"NÃO CONSEGUI VERIFICAR"*
   (sem ffmpeg no sandbox dele). Patches do Vigia: 4 → 3.
5. Conferi `#312` (esperando, data 15/09) e Marcelo (com gente) sem duplicar contato.

## 5. O que eu NÃO fiz, e por quê

- **Não escrevi pra aluno nenhum.** Os dois casos que olhei já tinham contato
  nosso, conferido em Enviados. Terceira mensagem sobre assunto resolvido é rajada.
- **Não abri incidente novo.** Nem pro alarme cego da varredura (sem ocorrência de
  sistema, ordem de 27/08), nem pro PR stale (é processo, não defeito de produção).
- **Não mergeei nada.** O único PR que toquei foi pra **fechar**.
- Não mexi em crédito, GPU, migration, acesso nem voz. **Nada da planilha.**
- **Não commitei a árvore de trabalho do SGP** (`frontend/src/**/sgp/**` modificado
  e vários arquivos novos não rastreados): é frente de outra pessoa, segue intocada.

## 6. Dívida que segue registrada e não tratada aqui

- **3 patches do Vigia** sem tratar: `7578c587`, `81438b60` (#335, face-gate cobra
  cena larga), `12d4db57` (#362, voz recusada não vira chamado). Os dois últimos
  têm incidente **aberto** — são trabalho real pendente, não duplicata.
- **37 PRs abertos.** Acabei de achar um stale regressivo no meio deles por acaso,
  ao pegar o incidente. Não varri os outros 36 — é trabalho próprio, não cabia na
  ronda, e fica escrito para não parecer varrido.
- **Marcelo**: reembolso + encerramento pendentes de decisão humana; cobrança de
  05/10 corre se ninguém executar.
- `#312`: segunda tentativa vence **15/09**.
- `#226` (decisão de produto do Johnny) e `#234`/`f8587cef` (travado em timestamp
  de palavra) seguem como nas rondas anteriores.
