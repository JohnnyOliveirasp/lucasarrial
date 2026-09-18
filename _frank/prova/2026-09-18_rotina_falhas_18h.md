# Ronda das falhas — 18/09, 17h40–18h00Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado antes de tocar na fila, com os dois instrumentos independentes:

```
2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  649 lidas da pasta "Sent" = 572 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 0  → nada a fazer
  ✔ 649 = 649, nenhuma carta sumiu na classificação

2026-09-18_enviados_x_tabela.cjs  (irmão de leitura)
  casadas por Message-ID: 572 · por destinatário+janela: 4
  VEREDITO: 0 carta depois do corte ficou fora da tabela
```

Os dois fecham em **0**. O ledger local segue inexistente nesta máquina (é
gitignored, some com o worktree) — que é exatamente por isso que a
reconciliação lê a **pasta remota** e não o ledger. As 77 anteriores a
14/09 14:06:31Z seguem **sem decisão**, por desenho do `--corte`.

## A classe de percepção (ordem de 17/09)

| momento | cards na classe | mais velho |
|---|---|---|
| fim da ronda de 17h | 13 | 17,0 dias (`#226`) |
| **esta ronda** | **13** | **17,0 dias** (`#226`, `702cc916`, fotoatleta) |

Não cresceu e não encolheu. O mais velho **continua sem se mover** — é o mesmo
`#226` da ronda anterior. A ressalva de 17h vale igual: a consulta é `ILIKE`
solto e é barulhenta, serve de rede e não de contagem.

## O `#471` foi fechado, e o erro era MEU

A ronda de 17h concluiu que esta casa não conseguia abrir tela nenhuma
localmente (`EvalError: Code generation from strings disallowed`, HTTP 500 em
qualquer rota, reproduzido até em `origin/main` puro) e abriu o `#471`
(`14fc0e22`) chamando isso de bloqueio **estrutural**.

Estava errado. Fechado às 17:26:57Z com a causa real: o QA subiu com
`npx next dev` (webpack); o script do repo é **`next dev --turbopack`**. Com
turbopack sobe limpo. **Não existe bloqueio estrutural de verificação visual
nesta casa** — existia um comando errado, repetido por mim.

Consequência boa: o PR #330 finalmente pôde ser verificado em navegador.

## PR #330 — primeira verificação visual de verdade, e ela pegou defeito

Card `d9803de2` (`qa`), worktree no tip exato (`141082aa`), `npm install` real
(symlink de `node_modules` entre worktrees o turbopack rejeita), login com a
conta da casa.

**Passou:** tela sem gravação limpa em desktop e mobile 390px; e o **cenário
exato do caso João Soares** (gravação só no servidor, IndexedDB vazio), via mock
de rede em `/api/v1/voice-clips`, **mostra a confirmação** — prova que a soma das
3 fontes e o portão `achou` estão ligados ao *render*, não só corretos em unidade.

**Não passou:** no mobile 390px, quando a confirmação aparece, o banner empurra o
`Continuar →` e ele fica **parcialmente coberto pelo widget "Ajuda"**
(`fixed`, `z-50`). Medido por `getBoundingClientRect`: Continuar
(top 791 / bottom 831 / right 366) × Ajuda (top 768 / bottom 824 / right 370),
sobreposição ~**108×33px** no canto da seta. Sem a gravação encontrada não
acontece: **é o próprio conserto deste PR que cria a colisão.**

Num PR que existe pra destravar 188 alunos, entregar o botão de avançar coberto
no celular troca um bloqueio por outro. **Merge retido.** Correção despachada na
própria branch (card `935df31f`), exigindo geometria antes/depois e ataque à
classe (conteúdo terminando embaixo do widget fixo), não só aos 33px. Veredito
completo comentado no PR (`issuecomment-5733991558`).

## O incidente que peguei: `#32` (`9119254c`) — 39,3 dias

Peguei por ser o mais velho com aluno que **ainda dispara** (last_seen hoje
09h17Z). O `d3d8d1b2` é mais velho (50d) mas foi pego nas rondas de 15, 16 e
17/09, está dormente desde 04/09 e as três concluíram que não há conserto;
pegá-lo pela quarta vez seria repetir ação medida como estéril.

**NÃO FECHEI.** Nada disto está em produção. O que esta ronda entrega é a
**causa**, que o Vigia havia registrado hoje às 16hZ como *sem dono*.

### A conta de hoje é 5, não 4

O `7115da78` (heitorcamargo7, 15:27Z) é da mesma causa: `returncode=1` e o
stderr traz `No space left on device (os error 28)` em
`save_checkpoint → save_file(lora_weights.safetensors)`. Chegou rotulado
"trainer failed". Dos 5 eventos, **4 têm Errno 28 comprovado por texto**; o
`8e5f9f88` ("System error.", stderr vazio) só tem a mesma *forma* dos de step 0
— **não conto como provado**.

### Quem enche o `/workspace`: três acumuladores, e a faxina não toca em nenhum

Varredura de **todas** as deleções do worker (`rmtree`/`unlink`/`purge_dir`
recursivo, fora de testes). A faxina (`worker_disk.py:46`, no `finally` do
`handler.py:92`) apaga só `/workspace/tmp/jobs` (sempre) e
`/workspace/tmp/inductor` + `/tmp/torchinductor_root` + `/tmp/gradio` (acima de
`DISK_ALERT_PERCENT=75`).

Nunca são apagados, por ninguém:

| # | o quê | por que sobra |
|---|---|---|
| (a) | `/workspace/jobs/<voice_id>/` — raw + vocals + norm + dataset + **lora_runs** (checkpoints) | único `rmtree` é `jobs/train.py:121`, dentro de `_limpar_area()`, que `run()` chama **antes** do treino e só pra **própria** `voice_id`. `run()` não tem `finally` e todos os `return` saem direto: a área fica no disco. Uma por voz **treinada** naquele worker quente. |
| (b) | `/workspace/loras/<hash>_<arquivo>` | `inference_setup.py:22` → `downloads.py:20`, cache por hash de URL com *"se já existe, reusa"* de propósito, sem despejo. Uma por voz **gerada**. |
| (c) | `/workspace/loras/..._tail<N>.wav` | cópia acolchoada da referência (`_acolchoar_cauda`), no mesmo diretório de cache, também sem despejo. |

Crescimento **monotônico** num disco de 50GB. A faxina recupera temporário e
cache; (a), (b) e (c) nunca voltam. O piso sobe até o primeiro job não caber —
que é a forma observada: **13 dias limpos e depois 5 falhas em 18h**. Acúmulo,
não azar.

### Hipótese minha que está REFUTADA (pra ninguém perseguir depois)

Levantei que `disk_percent()` mediria o mount errado, porque lê `/`
(`worker_disk.py:14`) e as falhas são em `/workspace`. **Não é isso:** o template
grava `volumeInGb: 0` e `containerDiskInGb: 50`
(`.github/workflows/runpod-worker.yml:116`) — não existe volume de rede e
`/workspace` é diretório do mesmo overlay. A régua mede o disco certo.
Descartada.

### O que isso diz do PR #338

O #338 move a faxina pra **entrada** do job e declara que reusa a **mesma**
`faxina()` e o mesmo `DISK_ALERT_PERCENT`. Ele ganha folga limpando temporário e
cache antes de o aluno entrar — e de fato salva as mortes de step 0 — mas **não
recupera (a), (b) nem (c)**. É mitigação real, não a cura: com o piso subindo, o
`resolvido=false` que ele próprio passa a logar tende a virar o caso normal.
**Mergear o #338 não fecha este cartão.**

### Dinheiro: conferido, e o defeito que achei já tem dono

Conferido por `ref_type`, **nunca** por `kind` (armadilha de 20/08).

- `taischw1`: −10.000 às 12:59:31 e estorno `voice_train_refund` +10.000 às
  13:00:10. Correto.
- `heitorcamargo7`, voz `600173a6`: **um** débito (−10.000 às 14:43:26) e **dois**
  estornos (+10.000 às 14:44:28 e +10.000 às 15:31:18), mais o treino `d8612a89`
  que entregou às 15:32 **sem débito**. São **10.000 créditos criados do nada,
  contra a casa**.

**Não abri cartão:** o **PR #341** (aberto hoje 16:38Z) é exatamente este defeito,
cita esta mesma voz, e registra que os 10.000 do Heitor são retirada a decidir
pelo Johnny, já escalada. Minha medição foi independente e reproduziu o caso
idêntico — vale como **confirmação de terceiro**, não como achado novo.

### Aluno: nenhum parado agora

As 5 vozes envolvidas estão `ready` (`ac2d906f`, `0bf47f6a`, `6d926ecc`,
`600173a6`, `cc1a8329`). Todos se salvaram retentando e os débitos dos treinos
que falharam foram estornados. Por isso este cartão **não virou urgência de
aluno** — o que sobra é a causa.

### Despachado

Card `e0248a2c` (`coder`): despejo dos três acumuladores reusando a faxina, com
requisito duro de **nunca apagar a área do job em execução**, despejo por
idade/LRU parando quando voltar abaixo do limite, log honesto de
`resolvido=false`, e teste de mutação. Branch + PR base main.

**Não será mergeado por mim:** merge no worker recicla o endpoint de GPU em
produção (`workersMax 0 → N`), com aluno treinando ao vivo. Janela é decisão do
Johnny — **pedida nesta ronda**, junto com a do #338.

## Fila

| status | antes | depois |
|---|---|---|
| open | 3 | 3 |
| investigating | 90 | 90 |
| fixed | 275 | 275 |
| aguardando_aluno | 31 | 31 |

**Fila não se moveu, e isso é a resposta honesta desta ronda.** Não fechei nada
por decreto: o `#32` tem causa nomeada e conserto despachado, mas conserto
despachado não é conserto em produção (regra 14). O que esta ronda produziu foi
uma causa de 39 dias que estava sem dono, uma verificação visual que a casa
achava impossível, e um defeito novo pego antes de chegar no aluno.

## Decisão que está com o Johnny

**Janela pra mergear os dois PRs do worker** (#338 mitigação de entrada +
`e0248a2c` despejo). Merge recicla o endpoint de GPU: alguns minutos sem
capacidade, com aluno treinando ao vivo. Caminho alternativo que o #338 recomenda:
push na `dev`, que aponta o endpoint isolado `fast_cloner_TESTE_dev`
(`workersMax` 0, nenhum aluno cai lá).
