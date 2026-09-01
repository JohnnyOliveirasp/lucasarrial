# Rotina das Falhas — 24/08/2026, ~21h UTC (Claude)

Método serial (regra 8, ordem de 21/08): peguei **um** incidente — o mais antigo
com aluno afetado — e fui até onde dava. Não abri outro.

## Incidente escolhido: `d3d8d1b2` (#15) — "tempo de execução estourado"

Mais antigo com aluno afetado (first_seen 30/07), 14 alunos na lista, e **voltou**
depois de ter sido fechado por aceite de risco em 20/08. A ordem de 20/08 manda
reabrir e instrumentar se voltasse — foi o que a ronda tratou.

**Desfecho: continua `investigating`, com nota.** Não fechei porque não resolvi.
O que emperrou está no item "O passo que travou".

### O que está resolvido

- **Dinheiro do aluno: OK, conferido.** As 3 falhas recentes (`2e2938b7`,
  `7ef17c4e`, `44227a0c`) casadas **por `ref_id`**, débito + estorno = 0 em cada.
  Ninguém no prejuízo. Conferi pela lista dos 9 `ref_type` (`_estornos.cjs`),
  não por `kind` e não só por `generation_refund`.
- **O fix `0c306d6` está em produção e é MEDIDO:** 23/08 pendurou 1811s (30min);
  depois do deploy, 492s e 483s. O estorno chega ao aluno em 8–9min em vez de 30
  (15:49→15:58 e 20:05→20:13). É **redução de dano, não é cura** — o worker
  continua pendurando.

### Reincidência nova

Duas ocorrências hoje, já com o teto novo:
`7ef17c4e` (brauliomarcos3@hotmail.com, 15:49 UTC, **79 chars**, 492s) e
`44227a0c` (gusperandio2@gmail.com, 20:05 UTC, 895 chars, 483s).
**gusperandio2 é aluno novo**, não estava na lista de afetados.

### O achado da ronda: a telemetria de fase está INERTE em produção

PR #48 (`b9bc646` + `1c72d77`) está na main desde 24/08 18:47 UTC e o worker
buildou com sucesso (CI terminou ~19:25 UTC e o próprio workflow patcheia o
template da RunPod). Mesmo assim:

- **25+ gerações depois desse deploy, ZERO com `qa.fase_corrente`** — inclusive
  várias de 80–160s, que deveriam ter emitido de 2 a 5 heartbeats (a cada ~30s).
- A própria falha `44227a0c` (20:05, **pós-deploy**) tem `qa` NULL.

**Causa:** a env do segredo da telemetria de fase **não existe em lugar nenhum** —
nem no arquivo de ambiente local, nem no `deploy.yml`, nem em exemplo de env; o
nome só aparece no código e nos testes. Sem ela, `faseTelemetriaInput()` devolve
`{}` **de propósito** e a feature fica desligada **em silêncio** (está escrito no
comentário do próprio lib). O código está certo e a fiação do `generate/route.ts`
está certa — falta **provisionar a env** no Hetzner + `pm2 reload`.

É o "commitado ≠ aplicado" das ordens, numa roupa nova: desta vez não foi
migration nem branch presa, foi **env que nunca foi provisionada**. Merged,
buildado, deployado — e inerte.

### O que descartei (medido, não achismo)

- **"Texto longo demais / muitos chunks" NÃO explica.** Média de chars nos
  timeouts = 619 contra 626 do geral; há timeouts de 59, 78 e 79 chars
  pendurando até o teto. Não é régua nem volume — reforça **worker travado**.
- **Cold start após ociosidade: não se sustentou.** O intervalo mediano até a
  geração anterior é *menor* nos timeouts (154s) que nas bem-sucedidas (292s) —
  penduram sob fila/concorrência, não depois de ocioso. **n=16: indício, não
  prova.** Registrado pra ninguém perseguir isso sozinho achando que é fato.

### Onde eu me policiei (duas vezes quase cravei errado)

- Tentei provar a env lendo o servidor: **o guard bloqueou, e corretamente**
  (ler arquivo de ambiente por ssh = exfiltração). Não contornei. A prova que uso
  é comportamental (25+ gerações sem `fase_corrente`), e a nota do incidente diz
  isso com todas as letras em vez de fingir que li a env.
- Tentei provar pelo log do pm2 e o "0 hits em `runpod-fase`" **não valia nada**:
  o app não registra path de request (0 POST em 863 linhas). Conferi antes de
  acreditar no zero — que é exatamente a armadilha escrita na ordem de 20/08.

### O passo que travou

Provisionar o segredo da telemetria de fase em produção. É escrita em produção
com segredo, então perguntei ao Johnny (24/08) em vez de fazer sozinho; a
pergunta ficou **sem resposta até o fecho desta ronda**. Enquanto não subir, a
causa raiz segue **cega** — a instrumentação que a ordem de 20/08 pediu existe,
mas não produz dado. Depois dela, a próxima falha nomeia a fase; só então faz
sentido falar em retry automático noutro worker.

**Risco atual, sem verniz:** baixo pro aluno (teto de 8min + estorno automático
conferido), mas o incidente segue sem causa raiz e **já pegou um aluno novo hoje**.

## Fila (não toquei, por causa do método serial)

7 outros incidentes abertos. Dois que merecem o olho do próximo turno:
- `41fcb265` (#125, aberto hoje 20:16): **28% dos áudios `ready` dos últimos 7
  dias sem débito nenhum** — 33 ocorrências. Não é aluno cobrado errado (é a
  casa deixando de cobrar), então **não acionei a exceção do serial**; fica
  sinalizado como o mais caro da fila.
- `6c38c99d` (#99, 6x, último hoje 20:35): aluno mandou 30+min por link e segue
  esperando.

## ⚠️ Achado do passo fixo de fim de ronda: fix de aluno preso em branch (de novo)

O passo obrigatório (`git rev-list main..<branch>`) pegou **o mesmo defeito de
19/08**, que naquele dia deixou um fix de aluno 9h parado. Desta vez está parado
**há 3 dias** e é o que destrava aluno pagante:

- **`feat/resgate-voz-failed`** (commit `1340f5c`, 21/08) — faz o
  `resgatar_voz.cjs` aceitar voz `failed`, refiltrar `raw_audio_paths` e validar
  com ffprobe. **Não está na main:** o `resgatar_voz.cjs` da main ainda tem
  `if (voz.status !== "uploading") throw` na linha 128.
  É exatamente a lacuna que a ordem de 21/08 (item 4) descreve como bloqueio pra
  destravar **Cláudio Sityá** (parado desde 15/08) e **Marcelo** (desde 10/08),
  os dois pagantes com crédito e sem voz.

⚠️ **NÃO mergear essa branch direto.** Ela está STALE: o diff contra a main dá
179 arquivos e ~16.400 deleções — mergear reverteria meio repositório. É o mesmo
buraco já documentado pra `feat/fix-image-upload-retry`. O caminho certo é
**cherry-pick do `1340f5c` sobre a main fresca**, com PR.

Outras ~24 branches locais aparecem como não-mergeadas por patch-id. Boa parte
deve ser ruído de squash-merge, mas **não conferi uma a uma** e não vou afirmar
que são inofensivas. Fica como auditoria pendente do próximo turno, começando
pelas de data mais recente.

## Regra 7 (comunicação)

**Não postei no grupo.** Nada nesta ronda é fato consumado do tipo que a regra
manda postar: não fechei incidente, não subi fix pra produção e não escrevi pra
aluno. O que houve foi medição e um bloqueio. Entra no relatório consolidado da
noite, não no canal.
