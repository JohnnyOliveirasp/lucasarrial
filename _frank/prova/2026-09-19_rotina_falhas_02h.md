# Ronda das falhas — 19/09 ~01h40Z a ~02h05Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).
Ronda anterior: `2026-09-19_rotina_falhas_01h.md`.

**O achado da ronda: um conserto pronto estava parado há 2h por um bloqueio que
não era dele. Eu tinha herdado a leitura de que o PR #347 esperava a "janela de
merge" do Johnny. A janela trava o #338, que recicla GPU com aluno ao vivo. O
#347 é TypeScript de classificação — 4 arquivos, zero worker, zero DDL. Confundir
os dois deixou a classe reabrindo cartão com a cura escrita na gaveta.**

E no meio da verificação apareceu o que realmente importava: uma aluna que tinha
entrado no SGP havia uma hora, com a voz morta e uma promessa da casa sem
executor atrás.

---

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado ANTES de tocar na fila, com os dois instrumentos independentes.

```
reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  677 lidas da pasta "Sent" = 600 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 0  → nada a fazer
  ✔ 677 = 677: nenhuma carta sumiu na classificação

enviados_x_tabela.cjs  (irmão de leitura, instrumento independente)
  VEREDITO: 0 carta depois do corte ficou fora da tabela — buraco PASSIVO
```

671 → **677** desde a ronda das 01hZ; as 6 novas já nasceram com linha. Registro
local (#210) segue em **0**, como esperado (gitignored, morre com o worktree). As
**77** anteriores ao corte seguem **sem decisão**, por desenho do `--corte`.

---

## Placar da ronda

| medida | agora | ronda 01hZ | instrumento |
|---|---|---|---|
| itens presos | **0** | 0 | `varredura_travados.cjs` |
| chamados abertos | **90** | 91 | idem |
| aguardando aluno | **34** | 34 | idem |
| pagante trancado | **0** · 1 sem prova (`drfabiovilhena29@`) | 0 · 1 | `pagante_trancado.cjs` |
| percepção travada | **1** (falso positivo conhecido, `#450`) | 1 | `percepcao_travada.cjs` |
| porta do SGP | 106 `pronto` · 90 entraram · **15 fora** | 105 · 90 · 14 | `porta_de_entrada_sgp.cjs` |
| fechados nesta ronda | **1** (#11) | 0 | SQL `resolved_at` |

A porta do SGP subiu de 14 para 15 **por causa da minha própria ação**: a
Graziela saiu de "voz morta" e entrou em "voz pronta e sem porta". Está tratado
abaixo, mas registro o sinal como ele é — o número piorou, e piorou por um
motivo bom.

---

## O cartão que eu levei até o fim: `#11` (`9ac03612`) — FECHADO

Peguei pelo método serial: **o mais antigo aberto com aluno afetado** — 59 dias,
6 alunos, 9 ocorrências. A condição que a ronda das 23h32Z de 18/09 deixou
escrita (*"fica investigating: a causa é viva e não há conserto nosso em
produção"*) foi **cumprida nesta ronda**.

### O que reabriu, e por quê

Ocorrência 9 (Tati, job `c7a376e5`, 18/09 22:40:12Z): disco cheio **na língua do
torch**. `save_checkpoint` grava dois arquivos com dois gravadores —

| linha | arquivo | gravador | o que diz ao falhar |
|---|---|---|---|
| 777 | `lora_weights.safetensors` | safetensors (Rust) | `No space left on device (os error 28)` — errno limpo |
| 814 | `optimizer.pth` | `torch.save` (zip writer C++) | `PytorchStreamWriter failed writing file` — **engole o errno** |

`ehDiscoCheio()` ancorava nas duas marcas de ENOSPC. O traceback da Tati não tem
nenhuma das duas → `cause='bug'` → assinatura larga → reabriu o #11. **Vão de
ROTA, não de cegueira.**

### A correção de leitura que eu devo registrar

O PR #347 estava aberto e parado desde 23:39:58Z. Eu herdei a leitura de que ele
esperava a janela de merge. **Errado.** A janela trava o **#338** (checar espaço
antes de baixar o dataset), que *recicla o endpoint de GPU com aluno treinando ao
vivo* — bloqueio legítimo. O #347 é a mesma família do #308 (OOM) e do #335
(no-space), que rondas anteriores mergearam sem depender do Johnny.

### Não mergeei na palavra do PR

Worktree isolada (`/tmp/wt347`) + baseline em worktree separada (`/tmp/wt347base`,
`origin/main`):

- merge da main atual **limpo**; `tsc --noEmit` **exit 0**.
- suíte `incidents`+`voices`: **173 testes, 171 passam, 2 falham**.
  Baseline na `origin/main`: **155 / 153 / as MESMAS 2** (`entregar-marca`,
  `legado-simulacao` — morrem na compilação, pré-existente, nenhuma importa
  código deste PR). Líquido: **+18 testes, +18 passando, 0 falha nova.**
- **controle contra o stderr REAL de produção** (puxado do banco, não fixture):

| job | `origin/main` hoje | com o PR |
|---|---|---|
| `c7a376e5` (Tati) | `bug` / `training:bug:trainer failed` | `infra_disk` / `write-failed` |
| `7115da78` (Heitor) | `infra_disk` / `no-space` | `no-space` — **intacto** |
| `bbf4b050` (Alberto) | `infra_disk` / `no-space` | `no-space` — **intacto** |

  O errno **provado** continua ganhando do **inferido**: zero regressão na classe
  já coberta.
- **3 controles negativos** seguem `bug`: traceback genérico; traceback que só
  *cita* `/usr/local/cuda`; e `"write failed"` solto (o falso positivo perigoso).

### Em produção, pelas três provas da regra 5-B (merge `b5b08ccb`)

| prova | valor |
|---|---|
| md5 fonte servidor × `origin/main` | **idêntico** — `diagnostico-trainer` `5615908d…`, `classify` `e44a4e10…`, `finalize-training` `d8bd623e…` |
| `BUILD_ID` | `ofX3Wa5QR25oq1mSIL-4E`, mtime **01:47:48Z** (depois do merge, 01:45Z) |
| pm2 `aiverse` | online, restart **~01:50Z** (depois do build); Action `success` |

### O aluno da reabertura não está esperando ninguém

Tati se destravou sozinha em 59 min (remandou 23:39Z → ready 23:44Z → áudio
23:48Z → vídeo 23:53Z). Dinheiro casado **1:1 pelo `ref_id`** (`voice` −10.000 →
`voice_train_refund` +10.000), conferido **por `ref_type`, nunca por `kind`**.
**NÃO ESTORNAR DE NOVO.**

### O limite, dito na cara

Isto fecha a **terceira rota conhecida**, não a classe. Uma quarta causa de infra
que fale uma quarta língua cai de novo no guarda-chuva e reabre o cartão — é
artefato de assinatura compartilhada, não defeito voltando. **É o terceiro
detector em três dias.** Se vier um quarto, o desenho certo deixa de ser "mais um
detector" e passa a ser **o trainer carimbar a causa na origem**, em vez de a
casa adivinhar por texto de traceback. Fica escrito no cartão porque é a decisão
que a próxima ocorrência deve provocar.

As 9 ocorrências ficam onde estão, **sem migration de reassinatura**: 3 das 9 são
cegas para sempre (jobs purgados pela RunPod antes da mig 97) e reassinar seria
inventar causa.

---

## O que apareceu no meio, e que vinha antes da fila: Graziela

Conferindo se o #11 tinha tomado ocorrência nova, achei um treino **falhado às
00:42:26Z** que **não** era do #11 — e que tinha gente viva atrás.

`gtfinger@proton.me` (Graziela Terezinha Finger), pedido SGP `14a932a4`. Conta
criada **00:41:36Z**, voz criada 6 segundos depois: fluxo do SGP, conta feita
pela casa. O treino rodou até o **step 370** (loss convergindo) e morreu na linha
777 com **ENOSPC literal**. O material dela estava intacto: 10 áudios aprovados,
2090s — e o trainer rodou 370 steps em cima deles.

**A rota funcionou, e isso é o controle positivo do PR #335:** a ocorrência caiu
no `#470` (`training:infra_disk:no-space`) e **não** no guarda-chuva cego — o
contador do #11 ficou parado em 9.

**O que a tela dela prometia, e que não estava acontecendo.** `sgp_pedidos.erro`,
00:48:46Z: *"Abrimos um chamado e nossa equipe já está com ele. Você não precisa
fazer nada: o retreino é por nossa conta."* Nenhum retreino estava rodando — **1
único `training_job` na vida dela, o que morreu**. É o mesmo vão do Alberto em
17/09: estado `falhou` e promessa sem executor atrás.

### O que eu fiz, e o que o banco confirma DEPOIS de gravar

- **01:47:30Z** rearmei a voz `0a20e6d4` `failed` → `awaiting_training`
  (`2026-09-17_rearmar_voz_para_retreino.cjs`, **1 linha afetada**, conferida na
  releitura). As 4 travas passaram; forma A, marca ENOSPC em `trainer_stderr`.
- **01:47:50Z** disparei `dispararTreinoOnboarding(origem='sgp')` com
  `NEXT_PUBLIC_SITE_URL` de produção (o guard do webhook existe por causa do
  Alberto). Job `e07c1772-…-u1` / `training_job 145ef7ca`.
- **01:54:55Z** job **completed**, 423s, 500 steps. `voices.status=ready`,
  `reference_cut_mode=snap_ok`.
- **artefato conferido no R2, não só no banco** — a falha foi exatamente *no
  gravar*, então linha no banco não é prova: `lora.safetensors` **72.397.184
  bytes** (01:53:14Z), `ref/auto.wav` **746.318 bytes** (01:49:17Z), os 10 `.m4a`
  crus no lugar.
- Pedido SGP: `falhou` → **`pronto`**, `voz_pronta_em` 01:54:56Z, `erro=null`.
- E-mail automático de plataforma pronta: `onboarding_ready_email_at`
  **01:54:56.825Z**.

**DINHEIRO: ZERO.** `credit_transactions` por `ref_id` da voz = 0 linhas antes e
0 depois; o usuário inteiro tem 0 linhas. `origem='sgp'` não cobra. A casa pagou
a GPU duas vezes, a aluna não pagou nenhuma. Nada a estornar — e **não há estorno
automático a desfazer**, porque não houve débito (regra 8 das duras).

### O que sobrava depois da voz, e que eu tratei

Ela nunca entrou na plataforma (`last_sign_in_at` NULL) e entrou na lista da
porta como a **15ª**, com `recovery NUNCA`. Gerei link no formato **`token_hash`**
(o `action_link` quebrado **não** foi usado) e escrevi às **01:58Z** — três
pernas conferidas: **uid 2848** na pasta de enviados + linha em `emails_enviados`
(`origem=ronda-manual`) + entrega confirmada.

A carta segue o **desenho PULL** de 18/09: o link é secundário e o caminho
principal é *"responda com LINK e eu mando outro, a qualquer hora"* — porque a
medição de 19/09 00hZ diz **3,5 % de consumo no PUSH contra 44,4 % no PULL**.

---

## Percepção (ordem de 17/09)

`percepcao_travada.cjs`: **1 card**, `#450`, parado há 0,5 d — o mesmo **falso
positivo do instrumento** já declarado em duas rondas (casou pelo texto; a
própria última nota do cartão diz que não é caso de percepção). **Não há card
parado por falta de ver/ouvir/assistir nesta ronda.** (Era 13, com o mais velho
em 16 dias, quando a ordem foi escrita.)

---

## O que eu fiz (fatos consumados)

1. **Reconciliação dos envios** — 677 = 677, 0 escrituráveis, veredito passivo.
2. **Verifiquei e mergeei o PR #347** (`b5b08ccb`), com baseline, controle
   positivo contra stderr real e 3 controles negativos — e **provei o deploy**
   pelas três pernas da 5-B.
3. **Fechei o `#11`** com nota, `resolved_commit=b5b08ccb` e `resolved_at`.
4. **Entreguei a voz da Graziela** (rearme + retreino + artefato conferido no
   R2), pedido SGP `falhou` → `pronto`.
5. **Escrevi pra ela** (uid 2848), com link `token_hash` e caminho PULL.
6. **Anotei o `#470`** com a 3ª ocorrência medida até o fim.

## O que eu NÃO fiz

- **Não mergeei o PR #338.** Esse sim está travado de verdade: recicla o endpoint
  de GPU com aluno treinando ao vivo. É a **quinta** ocorrência de disco cheio
  com ele na gaveta.
- **Não investiguei por que o disco do worker enche.** Não tenho acesso ao volume
  da RunPod daqui. Dono: `#468` / `#470`. Declarado, não escondido.
- **Não afirmo que a Graziela vai entrar.** Mandei o primeiro link de formato
  correto da vida dela e um caminho que não depende da janela de 1 h. O desfecho
  se mede na próxima ronda.
- **Não li a caixa do suporte@ pra triagem.** A leitura foi dirigida (`--de
  edust`) ao caso que eu estava tratando.
- **Não toquei em crédito, carteira nem status de ninguém** além do rearme da voz.
- **Não fechei mais nenhum cartão.** Regra 14 inteira.

---

## ⚠️ Vão de instrumento que eu achei e NÃO consertei

`ler_caixa.cjs --de <aluno>` lê **só e-mail JÁ LIDO** (por desenho: não marcar
nada como lido, a fila é da Fast). Só que o desenho **PULL** que duas rondas
agora estão apostando pede exatamente o contrário: a resposta do aluno com a
palavra **LINK** chega **não-lida**, numa caixa que eu não posso triar.

Ou seja: **a resposta existe e eu não a enxergo até a Fast marcar como lida.** Não
é invisível, é *atrasada* — mas a promessa que eu escrevi pra Graziela e pro
Carlos Eduardo foi *"eu mando outro na hora"*, e "na hora" depende de um passo
que não é meu. Conferido nesta ronda: `--de edust` devolveu **"nada encontrado"**,
e isso **não prova** que ele não respondeu.

**Não abri cartão** porque não travou esta ronda e a fila tem 90 abertos. Fica
registrado aqui para quem for medir a taxa do PULL: **não leia "nada encontrado"
como "o aluno não respondeu"** — é o quinto zero falso da casa nesta semana, e o
instrumento avisa o limite dele no `--help`, não na saída.

---

## Para quem pegar a próxima ronda

1. **`last_sign_in_at` da `gtfinger@proton.me` e do `edust@live.com`.** São os
   dois únicos com carta de formato correto + desenho PULL. São o n=2 virando
   n=4 da única medição sem confundimento que a casa tem.
2. **Antes disso, veja se algum dos dois respondeu "LINK"** — e leia o vão de
   instrumento acima antes de concluir que não responderam.
3. **A janela de merge do #338 continua sendo pergunta ao Johnny.** Quinta
   ocorrência de disco cheio. Cada uma custa uma GPU paga duas vezes pela casa.
4. **Se aparecer uma QUARTA língua de falha de infra no trainer**, não escreva o
   quarto detector: é o sinal de que o desenho certo é o trainer carimbar a causa
   na origem. Está escrito no `#11`.
5. **`porta_de_entrada_sgp.cjs --listar` toda ronda.** Hoje 15; a 15ª é a
   Graziela, que entrou na lista por causa de uma entrega, não de uma falha nova.
