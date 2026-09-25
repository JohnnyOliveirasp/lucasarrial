# 24/09 — Relatório noturno

**Postado no grupo** (`notify-grupo.sh`), ordem de 31/08. Consolidado do dia
inteiro numa mensagem só; as rondas já postaram os fatos consumados (regra 7) e
não se repetem aqui.

Fechado às **25/09 ~01:10Z** (21:10 local). Medições feitas entre 01:00Z e
01:10Z, depois da ronda das 01hZ (`e997e43f`).

⚠️ **Fuso desta máquina: EDT (UTC−4).** O dia local 24/09 é
`2026-09-24T04:00Z → 2026-09-25T04:00Z`. Registro porque a primeira medição
desta noite usou a janela errada (UTC−3) e contou 11 fechamentos onde são 10 — o
11º é órfão de ontem, tratado no §1-A.

---

## 1. O que eu resolvi

### 1-A. 10 cartões fechados no dia — conferidos por `resolved_at` no banco

Foram **10** no dia local, contra **13** ontem. Mais **1 órfão**: o
`samuelanjos237` foi fechado às **23:30 local de 23/09**, depois que o relatório
de ontem já estava escrito — não entrou em relatório nenhum até agora. Somando,
**11 desde o último relatório**.

| fechado (local) | o que era |
|---|---|
| 09:05 | aluno queria remover b-roll de vídeos já editados — orientação |
| 09:30 | aluno queria usar imagem externa específica (avatar do Safer) |
| 09:58 | **o único varredor que acha "pagou e nunca criou conta" era cego pro SGP** (`orphan-outreach.ts:27,142`) |
| 10:26 | Marcelo Branquinho: inserir imagem específica no vídeo |
| 10:45 | **#469 — cada falha de treino da mesma voz gerava um estorno novo contra um único débito** |
| 13:50 | **#415 — a Fast continuava respondendo sozinha depois do caso ir pra um humano** |
| 14:51 | o nome digitado no wizard do SGP sobrescrevia o nome que a casa já tinha |
| 16:04 | bounce de bloqueio-destino: `diretoria@ollem.com.br` |
| 16:47 | geração de áudio com tempo de execução estourado |
| 17:49 | **a fila de decisão do Johnny ficava cega quando alguém anotava o cartão** |

### 1-B. O que mais importou: a fila de decisão dele estava mostrando metade

O fechamento das **17:49** é o que muda a leitura do dia inteiro. O retrofit das
17:48Z de ontem enterrou a marca que o instrumento usava pra reconhecer cartão
escalado: bastava **alguém anotar o cartão** pra ele sair da conta. A fila voltou
a ter número na ronda das 22hZ: **20 cartões, 60 alunos, mais velho parado há
23 dias**.

**E eu reproduzi o defeito por acidente, nesta medição.** Rodei o instrumento da
minha cópia local do repositório, que estava **30 commits atrasada**, e ele
devolveu **10 cartões parados e 29 alunos**. Exatamente metade. Só desconfiei
porque o log da ronda das 22hZ dizia 20 e eu tinha 10 na mão; puxei a versão de
`origin/main` do mesmo arquivo e ela devolveu os 20. Fica registrado como
armadilha própria: **ferramenta da ronda rodada de clone velho mente sem errar**
— não quebra, não avisa, devolve um número menor e plausível. Medido:

- `_frank/ferramentas/2026-09-22_esperando_johnny.cjs` no clone de 23/09 → **10 conferidos, 29 alunos, mais velho 23d**
- o mesmo arquivo em `origin/main` (+139 linhas, commit `03e8c85f`) → **20 conferidos, 60 alunos, mais velho 23d**

Os 10 que o clone velho escondia incluem `f1ada07e` (reembolso do Carlos R$194 +
Nassara, com **prazo em 28/09**), `09a26f8b` (reembolso por CDC art. 49, 16 dias
dormindo) e `702cc916` (entrega abaixo do piso de QA, que trava outros 23 alunos).

### 1-C. Dois defeitos de ledger e de canal, fechados com medição

- **#469** (10:45): a mesma voz falhando no treino gerava **um estorno novo por
  falha, todos contra um único débito**. O conserto estava em produção desde
  **18/09**, commitado 40 min depois do cartão nascer, e o cartão ficou aberto
  6 dias porque ninguém foi medir.
- **#415** (13:50): a trava que impede a Fast de responder depois do caso ir pra
  um humano **não alcançava 21 cartões vivos**. Medido, retrofitado e fechado.

### 1-D. Números de atendimento e de dinheiro

- **91 cartas** para **35 pessoas**; **37 à mão** (25 `ronda-manual` +
  12 `fast-resposta`), 54 por código (42 avisos de onboarding, 11 códigos do SGP,
  1 boas-vindas). Ontem: 78 / 32 / 27.
- **3.230 cr estornados** em 4 casos (`studio_audio` 550, `generation` 400,
  `image` 960, `video_clip` 1.320).
- **3.700.000 cr** creditados por compra aprovada (37 grants de 100.000).
- **0 pagante trancado**, 283 contas conferidas uma a uma. 1 sem prova
  (`drfabiovilhena29@gmail.com`, sem subscriber code no payload).

---

## 2. O que precisa de você

Três perguntas, todas sim/não.

> **1.** Posso te mandar o lote de 20 decisões **quebrado em 3 mensagens** (uma
> de dinheiro, uma de merge/código, uma de produto/preço), pra você responder
> bloco por bloco? — **sim/não**

O lote inteiro foi ao grupo às 20hZ de ontem e **segue sem uma resposta**. São
**60 alunos distintos** atrás dele e o mais velho está parado há **23 dias**. A
doutrina de 17/09 proíbe eu re-escalar um caso por ronda, então não reenvio as 20
aqui — mas uma mensagem com 20 itens é difícil de responder no acostamento, e
três de sete talvez não.

> **2.** Recarregar o crédito do provedor dos 3 operários do Gemini (`olho`,
> `pesquisa`, `social`)? — **sim/não**

Mesma pergunta de ontem, **ainda sem resposta e ainda de pé**: testei agora, o
`olho` voltou vazio em 4s com 0 token de saída. São os **únicos 3 de 13 que
enxergam vídeo e ouvem áudio**, e há cartão de realismo de Vídeo Clone esperando
alguém **assistir** um render.

> **3.** Aplicar a migration 96? — **sim/não**

Cartão `da5b049e`, aberto hoje 20:48Z: as **4 colunas de telemetria do treino
não existem no banco**. Migration é aval seu (regra do `06`), então está parada.

**Fora disso, nada precisa de você.**

---

## 3. O que subiu pra produção

**BUILD_ID no servidor: `EOYoz_V-SjPUvjNiUfUzY`**, com mtime **24/09 23:52:37Z**.
Conferido por SSH no Hetzner, não por Action verde.

**5 PRs mergeados no dia** (contra 16 ontem): **#357** (edição: voltar ao
original + confirmação antes de sobrescrever o que o aluno pagou), **#214**
(caminho próprio do SGP no varredor de órfãos), **#404** (#15: watchdog de
heartbeat congelado), **#355** (#314: o e-mail da compra deixa de trocar o dono
de um entitlement) e **#307** (fila do SGP entregue-mas-não-iniciou).

Prova de deploy pelas três coisas da regra 5-B, não por `grep` no bundle:

1. **hash do fonte bate.** Último commit que toca `frontend/src` é `cf2d3ea3`
   (#307, 19:50 local). `md5sum` no servidor × `git show cf2d3ea3:`:
   - `src/lib/sgp/conclusao-sweep.ts` → `f8c15d03ab14fbeb5557bb6bfd3832d4` nos dois
   - `src/lib/sgp/painel.ts` → `0c2f9fb9ffeff325a1d2d0bfb40acab0` nos dois
2. **BUILD_ID novo**, mtime `23:52:37Z`, posterior ao commit (`22:50Z`).
3. **pm2 reiniciou depois do build**: `aiverse` subiu `23:53:35Z`, 58s depois do
   BUILD_ID. Build sem restart seria código que ninguém executa.

**Tudo que entrou hoje está no ar.**

---

## 4. Estado geral

```
Fila            123 abertos (era 116 no fim de 23/09) · idade média 9,6 d (era 9,4)
                + 35 aguardando_aluno (era 31; fora da conta, por desenho)
Faixas          30d+: 2 · 15–30d: 27 (era 23) · 7–15d: 45 (era 43)
                3–7d: 27 (era 32) · <3d: 22 (era 16)
Mais velhos     0e04bd97 58d · 37bacb68 36d · 719c9af6 24d (9 alunos)
                8b8fc4c8 24d · 7ed72ad0 23d · 702cc916 23d (23 alunos)
Parados em você 20 conferidos · teto 23 · mais velho 23d · 60 alunos distintos
                (era 15 pelo script / 20 à mão · 52 alunos)
Varredura       1 item preso (era 3) — escrituração de training_job, ninguém esperando
Pagantes        0 trancados (283 conferidos 1 a 1) · 1 sem prova
Sem entrega     hellengrasso 18d com 95.375 cr — carta saiu 23/09, espera dela é de 2d
Cartões         21 novos no dia · 10 fechados (+1 órfão de 23/09)
Cartas          91 e-mails · 37 à mão · 35 pessoas distintas
Estornos        3.230 cr em 4 casos
PRs             65 abertos · 5 mergeados hoje
Produção        BUILD_ID EOYoz_V-SjPUvjNiUfUzY (24/09 23:52:37Z)
Recados         133 na fila (era 116) — defeito #541 piorando, +17 no dia
Patches Vigia   2 chaves esperando (patch_cfde107d, patches_parados)
Frota           3 de 13 operários fora — os 3 do Gemini, testado agora
```

**O que mudou e é bom:** a varredura de presos caiu de **3 para 1**, e o que
sobrou é escrituração sem ninguém esperando. Os pagantes trancados seguem em
**0** pelo segundo dia. A fila de decisão **voltou a ter número real** — o defeito
que a escondia foi nomeado e fechado hoje.

**O que mudou e não é bom, e é a mesma leitura de ontem e de 22/09:** a fila subiu
de **116 para 123** (21 entraram, 10 saíram), o `aguardando_aluno` de **31 para
35**, e a faixa de **7–15 dias engordou de 43 para 45** pelo terceiro dia
seguido. Os merges caíram de **16 para 5**. A fila anda pra direita porque **a
cabeça dela não sai**, e a cabeça espera decisão sua. Fechar 10 não inverteu isso.

**Os recados pararam de só empilhar, começaram a acelerar:** 116 → 133 em um dia
(+17). É o defeito **#541** (recado `para_frank_*` não sai de `agent_state` quando
o cartão fecha) e ele agora cresce mais rápido do que a ronda consome.

**A pessoa que eu não deixaria passar:** a **Walsicleia** (`walsicleia_kaka@`,
R$936 pagos, 34 dias, 8º contato) está há **49,7 h sem uma linha nossa** — a
última carta saiu 22/09 23:27Z. **Não escrevi pra ela nesta passagem** e o motivo
está gravado na nota 10 do cartão `f8a71e43`: a decisão de fundo (destravar acesso
de quem pagou OUTRO produto) é o cartão `1a37605a`, parado na sua fila há 8 dias,
e o canal de carta da ronda tem defeito aberto **de hoje** (#559: carta sem
`In-Reply-To` chega fora da thread e o aluno lê como silêncio). Deixei ordem
escrita no cartão pra próxima ronda escrever pra ela **antes** de qualquer
apuração nova, na thread, mesmo sem o desfecho do acesso.

---

## 5. O que eu não fiz

Não devolvi dinheiro nenhum (9-A é seu). Não mergeei nada. Não gastei GPU. Não
mudei preço. **Não rodei a migration 96** nem DDL nenhum. Não mexi em produção
fora do fluxo normal. Não escrevi para os 90 do SGP. Não li, escrevi nem
reprocessei nada da planilha (ordem de 29/08). **Não escrevi para a Walsicleia**
(§4, com o motivo). **Não apliquei os 2 patches do Vigia** que estão na fila
(`patch_cfde107d`) — leitura e revisão de patch é trabalho de ronda, não de
fechamento de dia, e eles ficam pra primeira ronda de 25/09; registro aqui pra
que a espera deles seja visível e não vire silêncio.

**Um erro meu, registrado porque erro meu vai no relatório:** medi o dia inteiro
uma vez com a janela de fuso errada (UTC−3 em vez de EDT/UTC−4) e com o
instrumento da fila vindo de um clone 30 commits atrasado. Os dois números saíram
**plausíveis e menores** (11 fechamentos em vez de 10, 10 decisões paradas em vez
de 20). Nenhum foi ao grupo: refiz as duas medições antes de escrever. O que
sobrou disso foi o achado do §1-B.

A única escrita de dados que fiz foi a **nota 10 do cartão `f8a71e43`**
(concatenada via `anotar_incidente.cjs`, array preservado, conferida na
releitura), e está descrita no §4.
