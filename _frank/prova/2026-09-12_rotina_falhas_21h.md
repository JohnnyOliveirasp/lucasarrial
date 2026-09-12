# Ronda das falhas — 12/09/2026, 21hZ

Dono da fila: Frank (regra 14-A). Metodo serial (regra 8, ordem de 21/08).

## 0. ACHADO DE ENTRADA: esta ronda ja tinha comecado — e morreu sem log e sem commit

Ao abrir a fila encontrei, no `#335`, uma nota assinada **"FRANK, ronda das falhas
12/09 ~21hZ"**, gravada **20:52:10Z** — cerca de 4 minutos antes de eu comecar.
Ou seja: o item serial desta ronda **ja tinha sido levado ate o fim** por uma
execucao anterior que terminou sem escrever `_frank/prova/` e sem commitar.

Conferido: nao havia `2026-09-12_rotina_falhas_21h.md`, e a main estava em
`79bfff5` (vigia 20hZ), sem commit novo.

**Nao refiz o trabalho dela.** Refazer uma medicao de 9 imagens que ja estava
feita e gravada seria queimar a hora da ronda pra produzir a mesma conclusao.
O que eu fiz foi o que faltava: **conferir o que dava pra conferir barato,
pagar a divida do log e do commit, e seguir pro achado seguinte.**

E a terceira vez em tres dias que uma ronda entrega o trabalho e perde o
registro — a das 17hZ de hoje abriu com exatamente esta linha ("a ronda anterior
nao commitou o proprio log") e a das 20hZ pagou 11 rondas de main nao-commitada.

## 1. O item serial do 21hZ: `#335` / `patch_81438b60` — REFUTADO POR MEDICAO

O patch do Vigia que punha um piso de tamanho de rosto no `face-gate` do Video
Clone (parado ha ~60h, reconferido "verde" a cada 12h) foi **refutado**, nao
mergeado. O motivo, na nota 5 do proprio cartao: rodando `checkFrontalFace`
patcheado no caminho de producao contra 9 imagens, **nenhuma pontuou abaixo de
35** — o piso default do patch e 25, entao ele seria **NO-OP nos 7 clones
cobrados que originaram o cartao**; cena larga real (19-20%) e recorte correto
(44%) pontuaram **os dois 45**, e a mesma imagem variou +-10 entre passadas.

### O que EU conferi nesta ronda, e nao herdei

1. **O defeito continua de pe em producao.** Li
   `frontend/src/lib/video-clone/face-gate.ts` na main `79bfff5`: a decisao
   segue sendo `if (parsed.frontal === true && parsed.mouth_visible === true)
   return { ok: true }` — nenhuma condicao de tamanho. Ultimo commit a tocar o
   arquivo: `97fa8cc` (#131). Nada foi mergeado as escondidas.
2. **A refutacao esta gravada nos DOIS lugares duraveis**, que e o que impede o
   desperdicio de reconferir o patch pra sempre: nota no incidente e
   `agent_state.patch_81438b60` com `OBSOLETO: REFUTADO POR MEDICAO — NAO
   APLIQUE COMO ESTA`, mais `pista_que_sobra` (pedir coordenadas separa neste
   punhado, mas com ruido maior que o vao e n=2 na classe de cima).
3. **`#335` segue `investigating`**, que e o certo pela regra 14: o patch foi
   recusado, o defeito nao foi resolvido. Nao virou `fixed` falso.

### O que eu NAO reverifiquei, e digo com todas as letras

Nao rebaixei as 9 imagens do R2 nem rerodei a chamada de visao. **Estou aceitando
a medicao de 20:52Z sem replica-la.** O que me deixa confortavel em aceita-la e
que ela vai contra o resultado comodo — a saida barata era mergear um patch verde
e anunciar conserto — e que a conclusao dela e verificavel na direcao que importa:
o defeito segue no fonte, conferido por mim acima. Se alguem precisar do numero
pra decidir dinheiro, **remeça**; nao me apoie nesta linha.

## 2. O ACHADO DESTA RONDA: 320 linhas de trabalho que nao existiam em commit nenhum

A ronda das 20hZ fechou dizendo **"Arvore da main: limpa"** e registrou ter
preservado o WIP de SGP no commit `76c01ca`, branch
`wip/sgp-retomada-por-email-NAO-MERGEAR`. Medido agora:

| O que eu medi | Resultado |
|---|---|
| `git status` da main | **4 arquivos nao-rastreados**: `lib/sgp/destino.ts`, `destino.test.ts`, `retomada.ts`, `retomada.test.ts` |
| `git log --all -- <cada um dos 4>` | **vazio**. Nenhum commit, em nenhuma branch, local ou remota |
| conteudo de `76c01ca` | 10 arquivos — os 10 **modificados**. Nenhum dos 4 **novos** |
| `mtime` dos 4 | `19:49:41Z`, identico ao nanossegundo nos quatro — **2 minutos antes** do log das 20hZ afirmar arvore limpa |
| tamanho | 320 linhas, **179 delas de teste** |

**O que isso significa, sem dramatizar:** a preservacao das 20hZ pegou o que
estava *modificado* e deixou de fora o que estava *novo*. Trabalho real —
`retomada.ts` assina link de retomada por HMAC pro caso `welrisson@` (que esta na
fila de recados), `destino.ts` fecha o laco da tela 1 que mandava o aluno
preencher tudo de novo — existia **so na arvore de trabalho de uma maquina**, a
um `git clean` de sumir sem deixar rastro.

**Nao e acusacao de descuido, e uma armadilha de ferramenta:** estagiar mudanca
pega arquivo rastreado; arquivo novo so entra se alguem nomear. Quem olhou o
`git diff` viu limpo e estava certo — o que nao aparece ali e justamente o que
se perde.

### O que eu fiz

Preservei os 4 numa **worktree separada**, sem encostar na arvore da main:
commit **`8b1e1d5`** na `wip/sgp-retomada-por-email-NAO-MERGEAR`, **pushado**.
Os arquivos continuam tambem na arvore da main, do jeito que estavam — **nao
removi nada de ninguem**.

Rodei os testes orfaos antes de escrever esta linha (forma em glob, que e a que
funciona neste Node): `destino.test.ts` **6/6**, `retomada.test.ts` **12/12**.
Verdes. Isso diz que o trabalho esta coerente consigo mesmo — **nao** diz que
esta certo nem revisado.

### O que eu NAO afirmo

- **Nao mergeei e nao proponho mergear.** Segue valendo o motivo do `76c01ca`:
  nada disto foi revisado por ninguem, e a rota `/api/v1/sgp/retomar` que o
  `retomada.ts` monta **nao existe na main**.
- **Main NAO esta quebrada, e eu conferi antes de escrever que estava tudo bem.**
  Nenhum arquivo rastreado importa esses modulos. O unico vinculo e um
  **comentario**, `lib/sgp/codigo.ts:29`, que cita `lib/sgp/retomada.ts` como se
  existisse no repo — e `codigo.ts` esta em producao desde 19:46Z de hoje. E
  defeito de documentacao, nao de build. **Nao abri cartao** (ordem de 27/08:
  sem erro de sistema acontecido, nao se abre chamado).
- Nao sei de quem e a frente nem por que os 4 nasceram fora do commit. Registro
  o que esta medido, nao a intencao.

## 3. CORRECAO DE NUMERO: a divida de "3 patches do Vigia" e de UM

As rondas das 18hZ, 19hZ e a varredura vem repetindo "3 patches do Vigia sem
tratar". Fui ler o `agent_state` em vez de copiar a contagem:

| Patch | Estado real |
|---|---|
| `patch_7578c587` (mojibake) | **OBSOLETO desde 10/09 00:30Z** — superado na main pelo `#320` (`mail-charset.ts`, merge `857986c`). Marcado pelo proprio Vigia |
| `patch_81438b60` (face-gate) | **REFUTADO hoje** (secao 1). Nao espera revisao |
| `patch_12d4db57` (#362) | **VIVO. Unico trabalho real parado** |

Fila de patch real: **1, nao 3**. Numero inflado faz a divida parecer maior e
mais vaga do que e — e foi assim que o face-gate ficou 60h sendo "reconferido"
em vez de decidido.

**O que sobra tem pagante esperando** e por isso e o proximo item, nomeado:
`patch_12d4db57` / `#362` — voz recusada por envio perdido (falha nossa) morre
num log que ninguem le, sem abrir chamado. Caso concreto no diagnostico:
**Hellen (hellengrasso@gmail.com)**, pagante de 05/09, voz rejeitada 06/09 20:26Z
com 2 de 7 arquivos, **~6 dias parada** com ~95 mil creditos.

**Nao comecei essa revisao nesta ronda de proposito.** Revisao 14-B com pagante
no meio nao se comeca a 10 minutos do fim da hora — meia revisao e pior que
nenhuma, e a regra 8 manda levar UM ate o fim, nao abrir dois.

## 4. Estado da fila e os velhos que eu NAO peguei (com o motivo de cada um)

`varredura_travados.cjs`: **77 abertos**, 10 aguardando aluno, 1 item preso, 0
fechado sem retorno humano. Lista de estorno em dia (13/13, 3160 linhas, nada por
classificar).

Pela regra 8 o item e "o mais antigo com aluno afetado". Conferi os cinco mais
velhos um a um antes de concluir que o item desta hora era outro:

| Cartao | Idade | Por que nao e acionavel por mim agora |
|---|---|---|
| `#313` `2d0509b4` | 95,2d | Item (b) em producao desde 11/09. Sobra o item **(a)**: honrar ou revogar 15 vitalicios — **decisao comercial do Johnny/Lucas**, nao minha (14-A). Escalada em 08/09 e 11/09 |
| `#15` `d3d8d1b2` | 44,3d | Travado em **criterio de fechamento** (30 dias limpos ou ocorrencia nova com a regua nova), escrito no proprio cartao |
| `#47` `ce6e157d` | 24,4d | Queixa residual **sem causa medida**; a unica alavanca (repor `tts_silence_ms=466` na voz dela) e **julgamento de ouvido humano** e contraria ordem vigente do dono. Aluna ja respondida em 10/09 (uid 1641) |
| `#52` `37bacb68` | 24,1d | Criterio de fechamento documentado na nota 49 do cartao |
| `6c38c99d` | 20,2d | Luciano — decisao pedida em **24/08 (19 dias)**; proxima cobranca de R$ 97 em **19/09** |

Quatro dos cinco mais velhos da fila estao parados esperando **decisao humana**,
nao investigacao. Isso nao e fila entupida por dificuldade tecnica; e fila
entupida por decisao. Vai como uma linha pro Johnny (secao 6), nao como cartao.

## 5. O que eu NAO fiz, e por que

- **Nao fechei nenhum cartao.** Nada foi resolvido nesta ronda; regra 14 inteira.
- **Nao mergeei nada** e nao subi nada pra producao. O unico push foi para uma
  branch `wip/*-NAO-MERGEAR`.
- **Nao escrevi pra aluno nenhum.** Nenhum dos casos que toquei tinha aluno
  esperando resposta minha nesta hora.
- **Nao postei no grupo.** Pela regra 7 o grupo recebe **fato consumado** —
  incidente fechado, fix em producao, aluno respondido. Nada disso aconteceu
  aqui. Ronda que posta "estou trabalhando" e o ruido que mata o canal.
- Nao mexi em credito, GPU, acesso, voz, assinatura nem migration. **Nada da
  planilha.**
- **Nao removi os 4 arquivos da arvore da main.** Na duvida nao se retira nada.

## 6. Divida que segue registrada — e o que vai pro Johnny

**Pro Johnny, por Telegram (classe decisao/processo da ordem de 27/08, sem cartao):**
1. `#313` — a decisao comercial (honrar x revogar 15 vitalicios) esta parada ha
   **4 dias**, terceira cobranca. Enquanto nao decidir, o cartao mais antigo da
   fila nao pode fechar.
2. A quase-perda das 320 linhas, porque e processo e vai se repetir sozinho.

**Segue em aberto, nao tratado aqui:**
- `patch_12d4db57` / `#362` (Hellen, ~6 dias) — **proximo item serial**.
- 37 PRs abertos, nao varridos (registrado pela ronda das 19hZ e nao feito).
- Marcelo: reembolso/encerramento pendentes de decisao humana; cobranca de 05/10.
- `#312`: segunda tentativa vence **15/09**.
- `#226` (decisao de produto do Johnny) e `#234` (travado em timestamp de
  palavra) seguem como nas rondas anteriores.
- 64 recados em `para_frank_*`, o mais velho com **11,1 dias**.

## Fechamento

- Item serial do 21hZ: `#335` — patch **refutado**, nao mergeado, cartao segue
  `investigating`. Defeito em producao **confirmado por mim** no fonte.
- Achado desta ronda: 320 linhas em nenhum commit → preservadas em `8b1e1d5`.
- Contagem corrigida: fila de patch do Vigia e **1**, nao 3.
- Fila: **77 abertos** (sem mudanca — nada fechou, e isso esta dito, nao maquiado).
- Arvore da main: os 4 arquivos **seguem soltos de proposito**, agora com copia
  segura no remoto.
