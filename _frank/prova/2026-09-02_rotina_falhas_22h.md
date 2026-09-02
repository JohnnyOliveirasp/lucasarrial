# Rotina das falhas — 02/09/2026, ~21:48Z

Ordens lidas antes de tocar em qualquer coisa: índice `ordens/README.md`, canal de 31/08 (tudo do
FastCloner vai no **grupo**), `2026-08-29_desligar_vigia_e_frank.md` (planilha desativada) e
`2026-08-20_dono_da_fila_e_fila_zerada.md`. Método serial (regra 8, 21/08).

## Placar

| | entrada | saída |
|---|---|---|
| abertos (`open`+`investigating`) | **6** | **7** |
| aguardando aluno | 10 | 10 |

**A fila SOBE de 6 para 7 e isso é a entrega da ronda, não o fracasso dela.** Não fechei nenhum
incidente. Peguei o `#237`, provei que ele é irrespondível, e no caminho achei um **bug real e
grave em produção** que ninguém tinha visto — abri como `#238`. Fechar `#237` como `ignored` teria
baixado o placar e escondido as duas coisas.

## Ordem serial — por que o `#237`

Era o próximo pela nota das 21hZ, e continua sendo o certo pela regra 8. Reordenando por quem está
com a bola: `#47` (Katia) e os 10 `aguardando_aluno` estão com o aluno; `#234` (609 gerações) foi
trabalhado às 20h e concluiu que não dá para fechar; `#232` é defeito de processo interno sem aluno
sofrendo; `#235`/`#223` (Alana) foram fechados/tratados às 21h e **ela respondeu bem** (uid 428,
20:55Z: *"Dia 07 te chamo aqui e vc me diz no q já avançaram. Por hora, vou dar um tempo nisso"*) —
a bola está com ela, por escolha dela, com data marcada.

---

## §1 — `#237`: matei a pista falsa que a ronda anterior ia herdar

A nota do Executor no card dizia, com todas as letras: *"só temos o user id do signature:
`20a69a24-4c14-48cc-a2cc-6558fbda7bd8`"*. **Isso está errado**, e a próxima ronda ia caçar um
fantasma a partir dali.

O `signature` deste chamado não carrega id de aluno nenhum. Em
`frontend/src/app/api/v1/admin/incidents/route.ts:71` o campo é montado como
`` signature: `reported:${randomUUID()}` `` — **um uuid sorteado na hora do insert**. Ele
identifica ninguém, por construção.

**Conferido, não deduzido** — o uuid não existe em lugar nenhum:

| onde procurei | linhas |
|---|---|
| `profiles` (id) | 0 |
| `auth.users` (id) | 0 |
| `help_messages` (id e user_id) | 0 |
| `agent_chats` (id e profile_id) | 0 |
| `voices` / `generations` / `onboarding_runs` / `sgp_pedidos` (user_id) | 0 |

Reforço independente: dos **2 únicos** incidentes com `signature` começando em `reported:` na base,
nenhum casa com `profile` — e o outro (`#90`) tem até slug de texto
(`reported:promessa_voz_kessuly`), o que confirma que o campo é livre e não é chave de aluno.

**De onde ele veio de verdade:** formulário manual da aba Falhas do admin. O e-mail do aluno é
campo **opcional** (`route.ts:74`, `affected_emails: email ? [email] : []`) e quem preencheu deixou
em branco; `attachment_path` é `null`, então não veio print nem áudio. O `reported_by =
suporte@lucasarrial.com` é o e-mail do **admin logado** (`g.auth.email`, `route.ts:76`), não o do
aluno.

**Onde mais procurei e não achei:** a caixa do `suporte@` não tem nada às 20:38Z (uid 427 é 20:07Z
e uid 428 é 20:55Z, ambos da Alana, outro caso); `help_messages` entre 19:30 e 21:30Z só tem a
conversa do user `27c49318` sobre drift de rosto; `agent_chats` (WhatsApp) não tem **nenhuma**
conversa entre 18:00 e 21:30Z.

**Conclusão honesta:** o chamado é irrespondível com o que existe no sistema. Quem sabe quem é o
aluno é a **pessoa que digitou o formulário às 20:38Z**. Perguntei no grupo. Não inventei
destinatário, não chutei aluno parecido, não fechei.

### O defeito de sistema que isso expõe

O form do admin aceita reporte de aluno **sem e-mail e sem anexo**, e o que ele grava no lugar
(o signature aleatório) **tem cara de id de aluno** — foi exatamente o que induziu o erro da nota
anterior. Enquanto o campo for opcional e sem aviso, a fila recebe chamado-fantasma que queima uma
ronda cada vez que alguém pega. Deixei como objeção anotada no `#237`; se reincidir, vira chamado
próprio. Não abri agora para não inflar a fila com uma ocorrência só.

---

## §2 — `#238`: o SGP perde foto e áudio do aluno em silêncio

Em vez de parar no "não dá para identificar", fui atrás da hipótese que o próprio relato sugere
(*"enviei fotos e áudios e não aparece nada na plataforma"* = fluxo **SGP**, que substituiu a
planilha e está vivo em produção). Achei um bug real.

**A causa, lida no código:** lost-update clássico. `api/v1/sgp/foto/route.ts` **lê** `pedido.fotos`
(linhas 28-31), **aguarda** `impressaoDaFoto()` + `createPresignedGet()` + `julgarFoto()` (chamada
de visão, segundos) e **só então** grava `atualizarSessao({fotos: atuais.concat(foto)})` na linha
56. O `atualizarSessao()` (`lib/sgp/sessao.ts`) é um `.update()` cego: sem merge, sem lock, sem
versão. E o cliente sobe em **paralelo** — `step-foto-form.tsx`:
`for (const f of cortada) void enviarUma(f)`, sem `await`.

Logo N fotos escolhidas de uma vez = N requests que leem o **mesmo** array e gravam cada uma o seu
próprio array de 1 item. **Sobra 1. As outras somem sem erro nenhum na tela.**
`api/v1/sgp/audio/route.ts` tem o mesmo padrão com janela ainda maior (`maxDuration=300`).

**Caso e controle, medidos em produção — mesmo código, resultado oposto:**

| | sessão | como subiu | R2 | no banco |
|---|---|---|---|---|
| **caso** | `3e2a184d` (31/08) | rajada **paralela**: 6 objetos em **350 ms** | **16** objetos | **1** |
| **controle** | `9aa88367` (29/08) | **uma a uma**, 5 a 30 s de intervalo | 6 objetos | **4** + 2 recusadas como repetidas |

O sobrevivente do caso é `3f13186f_IMG_4736.jpeg` (14:07:01.329), da **última** rajada —
*last-write-wins* literal. Bônus que fecha o diagnóstico: a aluna repetiu a **mesma** foto
(IMG_4736) em 3 rajadas e **nunca** foi barrada por "foto repetida", porque cada request leu um
array vazio — ou seja, sob concorrência o `ehRepetida()` também para de funcionar. No controle, as
2 repetidas **foram** corretamente recusadas. É a concorrência, e só ela, que explica a diferença.

Card do conserto: **`7d7665ef`** (coder). O conserto exige **append atômico no banco**
(`fotos = coalesce(fotos,'[]'::jsonb) || $1::jsonb` ou RPC com lock), não re-leitura em JS;
serializar o cliente é defesa em profundidade, não substituto.

### Ressalvas que eu faço questão de deixar escritas

- **Não estou afirmando que o `#238` é a causa do `#237`.** Sem saber quem é o aluno, ligar os dois
  seria chute. Registro a hipótese, não o veredito.
- **n = 2.** Medi os 2 únicos pedidos SGP que existem na tabela. Sei que o defeito é **certo por
  construção** sob upload paralelo (que é o comportamento padrão de quem seleciona várias fotos no
  celular), mas **não sei a frequência real em campo** e não vou dizer "X alunos afetados".
- **Não medi** se algum pedido já concluído subiu para a plataforma com menos fotos do que o aluno
  mandou. Com 2 pedidos não se aplica hoje; vira obrigatório quando o SGP crescer.

---

## §3 — A aluna afetada: por que NÃO escrevi hoje

`wallanadaphiny@icloud.com`, conferido por mim: conta desde 10/08, **sem acesso**, **0 créditos**,
**nenhuma compra**. Recebeu material do onboarding pela planilha em 28/08 e teve o saldo negativo
perdoado em 30/08 (decisão do Johnny). Ou seja: **não há crédito preso e não há cobrança indevida.**

Ela **não está esperando resposta nossa** — nunca escreveu para o suporte, só abandonou o
formulário às 14:07:05 de 31/08 e não voltou. Não há silêncio nosso a reparar aqui.

**O conserto não está em produção.** Chamá-la de volta agora para reenviar as fotos a faria perder
o material de novo, pelo mesmo motivo. É exatamente a lição que esta ronda já pagou caro no caso da
Alana: às 17hZ o atendimento mandou "tente de novo" com o defeito aberto, e a aluna desistiu. Não
repito. Deixei escrito no `#238` **quando** escrever (depois do `7d7665ef` na main, conferido em
produção) para quem pegar não ter que decidir de novo.

---

## §4 — Estado do conserto do Gravador (3ª ronda seguida fora de produção)

Conferido por mim, não pelo card: **PR #154 segue OPEN**, `mergeable=UNKNOWN`, **zero reviews**,
`statusCheckRollup` vazio. `git log main..origin/feat/gravador-nao-perde-audio` devolve os **dois**
commits (`16bd72e`, `993632f`): fora da main, fora de produção.

**Não mergeei** — segue valendo o motivo das 18hZ e das 21hZ: toca o gravador de **todos** os
alunos, e o repositório tem histórico de branch stale derrubando fix em produção (`onedrive-401`,
`fix-image-upload-retry`, os 2 da cura de referência). Subi ao grupo pela 3ª vez.

## §5 — O que eu NÃO fiz, de propósito

- **Não fechei o `#237`.** `ignored` esconderia que a origem do defeito é o próprio formulário.
- **Não escrevi para a Wallana** (motivo no §3), nem para a Alana (a bola é dela, com data: dia 07).
- **Não mergeei o #154** nem abri PR do `#238` — quem escreve o código é o card `7d7665ef`.
- **Não toquei** em crédito, GPU, migration nem status de compra. Nenhum e-mail saiu nesta ronda.
- **Não abri chamado** para o form do admin aceitar reporte sem e-mail (1 ocorrência; virou objeção
  anotada no `#237`).
- **Não atuei** sobre `luanmarcal.com@gmail.com`, que a varredura acusa com import quebrado em
  29/08 por arquivo não público no **Drive**: é onboarding antigo/planilha, e a ordem de 29/08 me
  proíbe de ler, classificar, avisar ou reprocessar. Registro e não toco.

## Registro de rotina

- Incidente **`#238`** (`46283bd2`) criado: `investigating`, categoria `tecnico`, signature
  `sgp:lost-update-foto-audio-concorrente`, `affected_emails` com 1 aluna, descrição de 1.564
  chars — **conferido na releitura**.
- `anotar_incidente`: `#237` (`92b1cc85`) notas **1 → 2**, status inalterado, **1 linha afetada**.
  `#238` (`46283bd2`) notas **0 → 1**, **1 linha afetada**. Ambos conferidos na releitura.
- Card criado: `7d7665ef` (coder). **Card criado ≠ conserto em produção.**
- **Nenhum e-mail** enviado nesta ronda (nem individual, nem em massa).
- Nada da **planilha** foi lido, escrito, classificado, avisado ou reprocessado (ordem 29/08).
- Nenhuma GPU, nenhum crédito, nenhuma migration, nenhum merge.
- Leitura da caixa foi por caso específico (`--ultimos`), não triagem, e é `EXAMINE`/`BODY.PEEK`:
  flags e fila de não-lidos intactas.
- Script de investigação `_Bugs/listar_sgp_r2.cjs` (leitura pura do R2) fica **fora do git**, como
  manda o README das ferramentas.
- Grupo: postado com `notify-grupo.sh`. **Nada foi para o privado do Johnny** (ordem 31/08).
- `_frank/ferramentas/assinatura_em_dobro.cjs` segue **untracked** — não é meu e não é desta ronda.
  **6ª ronda seguida** registrando em vez de commitar trabalho de outro agente em silêncio.
