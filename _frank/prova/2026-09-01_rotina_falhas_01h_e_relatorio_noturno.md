# Ronda das falhas 01/09 01hZ + relatório noturno de 31/08

Fecho do dia. Rodada às 01:02–01:30Z (22h02–22h30 BRT de 31/08).

## 1. O #192 saiu de "verde e morto" para "no ar e provado"

A ronda das 00hZ mediu que o fix do #192 estava **em produção e morto**: o PR #135
(merge `f605551`, deploy verde 31/08 19:42Z) subiu `mandato-normalizacao.ts` com 21
testes passando, e `aplicaGuardaDeMandato` **não era importada em lugar nenhum** de
`frontend/src` — a única referência era o próprio arquivo de teste. Ela abriu o PR #142
e parou aí.

Reconferi o grep na main antes de acreditar: confirmado, módulo morto.

**Revisei e mergeei o PR #142** (merge `01d9cb7`). Uma linha útil em
`frontend/src/lib/llm/normalize.ts`: chama a guarda dentro de `normalizeTextForTTS`,
**antes** do `sanitizeForTTS`, porque a guarda compara com o texto CRU do aluno.

### Verificação minha, do zero (não confiei no que o PR reportou)

| verificação | resultado |
|---|---|
| `npx tsc --noEmit` | limpo (exit 0) |
| `npx eslint normalize.ts mandato-normalizacao.ts` | limpo (exit 0) |
| `npx tsx --test mandato-normalizacao.test.ts` | 21/21 pass, 0 fail |

Prova composta que eu mesmo rodei, nos casos reais deste aluno:

| aluno escreveu | LLM devolveu | aluno ouve | veredito |
|---|---|---|---|
| `vai la, clica nos dois botao` | `Vai lá, clique nos dois botão` | `Vai lá, clica nos dois botão` | reverte `clica<-clique`, acentos MANTIDOS |
| `Escolhe o seu caminho` | `Escolha o seu caminho` | `Escolhe o seu caminho` | reverte |
| `isso e pra voce mesmo` | `isso é para você mesmo` | `isso é pra você mesmo` | reverte `pra<-para`, acentos mantidos |
| `custa R$ 50,90 hoje` | expansão por extenso | expansão INTACTA | 0 revertidas — não regride o trabalho legítimo |
| `eu so falo nao` | `eu só falo não` | `eu só falo não` | MANTIDO — acento não é troca de palavra |

### Prova de que está NO AR (e não "Action verde")

Esta é a parte que faltou da outra vez, e é o motivo do incidente ter durado mais um dia:

- deploy run `33457270448` do sha `01d9cb7` concluído;
- `BUILD_ID` no Hetzner mudou: `O6GE36c1shdBdqkyCprnt` → `7Xla8OY6l5i94pYDGNOIr`;
- fonte no servidor: 2 ocorrências de `aplicaGuardaDeMandato` em `src/lib/llm/normalize.ts`;
- **o literal `reverte-troca-lexical` está DENTRO do bundle compilado da rota que gera o
  áudio**: `.next/server/app/api/v1/voices/[id]/generate/route.js`.

O último item é o que diferencia "subiu" de "está no caminho que o aluno percorre".
Fosse ele rodado ontem, o #192 não teria passado um dia inteiro com o aluno avisado de
uma correção que não existia.

### Aluno avisado

E-mail para `70rrosusa@gmail.com` em 01/09 ~01:20Z, cópia CONFIRMADA nos Enviados
**uid 406**. Pedi que ele gere o MESMO roteiro pra comparar, disse pra não regravar, e
disse com todas as letras que **o timbre não está resolvido** e que a palavra comida no
começo do áudio também segue aberta.

### Por que o #192 continua `investigating`

A queixa dele tem duas partes. A parte "não reproduz a minha forma de falar" era o texto
reescrito, e essa acabou. A parte "não reproduz o meu timbre" **não tem causa medida** —
dataset íntegro, referência íntegra, treino concluído, e a hipótese da cauda fantasma
(#191) já foi medida e descartada em 29/08.

O passo que falta é **ouvido humano** comparando a referência dele com a saída de 21:10Z
de 29/08. Eu não ouço. Fechar agora seria marcar `fixed` sem ter resolvido (regra 14).

Anotado no incidente com `resolved_commit = 01d9cb7`, status inalterado.

### Escopo, pra não inflar o que foi feito

O fix vale para geração **nova**. Os áudios já entregues com palavra trocada continuam
entregues — pelo levantamento citado no e-mail de 31/08, **58 alunos em 45 dias**. Não
há remediação do que já saiu, e isso **não está feito**.

## 2. Limpeza dos recados (§1-C) — 17 chaves → 10

`agent_state` estava com 17 chaves paradas, a mais velha de 28/08. Cruzei cada
`para_frank_*` com o status do incidente que ela aponta e **7 estavam moot** — o
incidente já tinha sido resolvido e o recado só ocupava espaço:

| chave | incidente | status |
|---|---|---|
| `para_frank_44e9399a` | #199 | fixed |
| `para_frank_e985264d` | #200 | fixed |
| `para_frank_cee82d8a` | #201 | fixed |
| `para_frank_808af031` | #203 | fixed |
| `para_frank_a7c0311b` | #205 | ignored |
| `para_frank_4c5838a4` | #211 | fixed |
| `patch_808af031` | #203 | fixed (patch já superado pelo merge) |

Arquivei o conteúdo integral das 7 em
`_frank/prova/2026-09-01_recados_arquivados_antes_do_delete.json` **antes** de apagar,
usei `DELETE` (não `set_state` value null — `agent_state.value` é NOT NULL, §1-B) e
**reconferi no banco**: 10 chaves restantes, as 7 sumiram de fato.

## 3. O que ficou, e é dívida real: 3 patches do Vigia parados

Nenhum foi aplicado nem recusado. Pela regra 14-B, patch que ninguém lê é trabalho dele
que morre igual:

| chave | desde | assunto |
|---|---|---|
| `patch_9dc59356` | 28/08 (4 dias) | Vídeo Clone marcado `ready` sem o MP4 no R2: link 404, não toca nem baixa, e não há estorno nem alerta |
| `patch_d73f827c` | 29/08 (3 dias) | Rajada para de abrir chamado TÉCNICO para erro de INPUT do aluno (`no_speech`, `audio_too_long`, ...) |
| `patch_10d50178` | 30/08 (2 dias) | `--curar/--medir` do `conferir_transcript_referencia.cjs` só gravam com cauda ESTÁVEL (portão anti-alucinação do whisper) |

⚠️ O `patch_10d50178` merece destaque: é exatamente o portão que teria impedido o dano
de 29/08, quando o `--curar` gravou na referência do Robert uma cauda que **não existe no
áudio** — a ronda injetou o defeito que a ferramenta existe pra remover. A ferramenta
segue sem o portão há 2 dias.

Não apliquei nenhum dos três nesta ronda. Aplicar patch exige revisão de código de
verdade (§1-B passo 3: `tsc` verde não é revisão) e não cabia no tempo desta janela sem
fazer mal feito. Fica registrado como o item mais concreto da próxima ronda.

## 4. Varredura

- **2 itens presos**, os dois já com aluno avisado e a bola do lado dele:
  - `marcelopersonalthe32@gmail.com` — pagou R$ 465,64 (R$ 368,64 avulsa + R$ 97 assinatura,
    conferido no `pagou_de_verdade`), 198.950 créditos, **sem voz há 22 dias**. Áudio de
    47min é entrevista com 2 pessoas, confirmado por escuta manual em 8 pontos em 29/08.
    3 e-mails enviados (27/08 uid 182, 29/08 uid 341). **Acesso vence 05/09.**
  - `luanmarcal.com@gmail.com` — pagou R$ 115,90, 98.425 créditos, import quebrou em 29/08
    porque o link do Drive não está público. E-mail detalhado em 30/08 (uid 347), acesso
    até 29/09, nada cobrado. Esperando ele reenviar.
- `training_jobs`: 1 linha obsoleta (job `ebf5cc56` nunca saiu de queued, mas a voz
  `f4b9b0f2` já está `ready`) — escrituração pendente, ninguém esperando.
- Estorno: 10 tipos, 2.618 linhas varridas, nenhum tipo desconhecido.

## 5. Placar de não-fechados: 9 (5 `investigating` + 4 `aguardando_aluno`)

| # | idade | estado |
|---|---|---|
| #99 | 8d | aguardando aluno |
| #173 | 3d | investigating — aluno que pagou R$ 2.391 e não foi atendido; a ronda das 00hZ decidiu manter aberto de propósito |
| #192 | 2d | investigating — metade fechada hoje, falta ouvido humano no timbre |
| #197 | 1d | aguardando aluno |
| #202 | 1d | investigating |
| #206 | 0d | aguardando aluno |
| #207 | 0d | investigating |
| #212 | 0d | investigating — pedido de REEMBOLSO do Márcio, decisão humana |
| #214 | 0d | aguardando aluno — a aluna das duas contas; provado em 31/08 que ela pagou e o pagamento ENTROU |

## 6. O que eu NÃO fiz nesta ronda

Registro explícito pra não confundir silêncio com saúde:

- não apliquei os 3 patches do Vigia (item 3);
- não respondi os 7 recados restantes em `agent_state` — todos apontam para incidentes
  ainda abertos e serão tratados junto com o incidente, não em paralelo;
- não remediei os 58 alunos que já receberam áudio com palavra trocada;
- não toquei em crédito de ninguém, em nenhum ponto desta ronda.

Restam **20 PRs abertos** no repo. O gargalo continua sendo merge/decisão, não diagnóstico
— foi a mesma leitura da ronda das 16hZ.
