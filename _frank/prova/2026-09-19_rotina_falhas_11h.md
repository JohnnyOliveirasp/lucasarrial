# Ronda das falhas — 19/09 ~10h41Z a ~11h05Z

Dono da fila (14-A). Método serial da ordem de 21/08. Canal: grupo (ordem de 31/08).
Ronda anterior: `2026-09-19_rotina_falhas_02h.md`. Vigia no meio: `2026-09-19_vigia_10h.md`.

**O achado da ronda: a casa tinha uma regra que decidia de quem era a culpa
lendo o TEXTO do erro, e o texto é idêntico nos dois casos opostos. "Invalid
data found when processing input" descreve tanto o zip podre que o aluno subiu
quanto o pedaço que o nosso próprio worker corta e grava torto. Por causa disso
uma falha nossa foi arquivada como culpa da aluna, não abriu chamado nenhum, e
o produto mandou ela regravar 23 minutos de áudio que estavam perfeitos.**

---

## Passo fixo: reconciliar os envios (ordem de 18/09)

Rodado ANTES de tocar na fila, com os dois instrumentos independentes.

```
reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
  692 lidas da pasta "Sent" = 615 já tinham linha + 77 fora da janela + 0 recusadas
  DENTRO DA JANELA, escrituráveis: 0  → nada a fazer
  ✔ 692 = 692: nenhuma carta sumiu na classificação

enviados_x_tabela.cjs  (irmão de leitura, instrumento independente)
  VEREDITO: 0 carta depois do corte ficou fora da tabela — buraco PASSIVO
```

677 → **692** desde a ronda das 02hZ; as novas já nasceram com linha. As **77**
anteriores ao corte seguem **sem decisão**, por desenho do `--corte`.

---

## Placar da ronda

| medida | fim da ronda | vigia 10h15Z | instrumento |
|---|---|---|---|
| itens presos | **0** | 1 | `varredura_travados.cjs` |
| chamados abertos | **92** | 93 | idem |
| aguardando aluno | **34** | 34 | idem |
| pagante trancado | **0** · 1 sem prova (`drfabiovilhena29@`) | 0 · 1 | `pagante_trancado.cjs` |
| percepção travada | **1** (falso positivo conhecido, `#450`) | 1 | `percepcao_travada.cjs` |
| fechados nesta ronda | **1** (#475) | — | SQL `resolved_at` |

Aritmética fecha: 93 − 1 (#475 fechado) = **92** ✔. O "item preso" que saiu de 1
para 0 é a própria josiclareth — era ela a linha *"acesso vivo, com crédito e sem
nenhuma voz pronta"*.

---

## O cartão que eu levei até o fim: `#475` (`3f618766`) — FECHADO

Peguei este, e **não** o mais antigo da fila, pela cláusula de PRIORIDADE
("aluno esperando vem antes da limpeza da fila"): aluna com acesso ativo,
100.000 créditos, **5h sem voz**, e — o que pesou — um recado da casa mandando
ela refazer trabalho que estava certo. Os mais antigos (#216, #223, #229, #245,
17d) são queixas de qualidade, não gente bloqueada. **Registro o desvio do
serial estrito de propósito**, porque ele é uma escolha minha e não um descuido.

### O que o vigia deixou aberto, e que eu tinha de medir

A nota do `#475` dizia: *"não abri o código do worker, então não digo quem gerou
o `.wav`; hipótese alternativa viva que alguém precisa descartar medindo: um
take dela pode ter chegado truncado e quebrar só ao virar chunk"*. A armadilha
medida manda **listar os arquivos da voz primeiro** — e ir além: decodificar.

`listar_arquivos_da_voz.cjs` já dizia 9/9 áudio, 1369s, portão de 20min passa. Mas
ffprobe lê cabeçalho; ele **não** responde "isto decodifica até o último frame",
que é justamente o passo onde o worker morreu. Escrevi
`_frank/ferramentas/2026-09-19_periciar_takes_da_voz.cjs`.

```
[0..8] 9 arquivos · decode -err_detect explode
       bytes/segundo: média 16003 · fora de ±25%: 0  (CBR, nenhum destoa)
       picos: -1,66 a -2,47 dBFS · mudos: 0
       DECODE ATÉ O FIM: 9/9 limpos
```

### ⚠️ E aqui o instrumento quase me enganou — o achado que vale para a casa

"9/9 limpos" é saída uniforme demais, e o playbook U manda desconfiar de si
mesmo nessa hora. Desconfiei, e estava certo:

```
take real truncado a 900KB      → ffmpeg exit 0 · stderr "filesize and duration do not match"
take real com 4000 bytes de lixo→ ffmpeg exit 0 · stderr "Header missing" + "Invalid data found"
take real intacto               → ffmpeg exit 0 · stderr VAZIO
```

**`ffmpeg -err_detect explode` devolve exit 0 mesmo em arquivo que eu corrompi
de propósito.** Minha primeira versão classificava por `exit != 0` — uma regra
que **nunca dispararia**. O veredito "9/9 limpos" estava certo por sorte, não
por medição: era um **zero mentiroso** da família do playbook W, e teria
sustentado a conclusão oposta com a mesma cara de confiança.

O discriminador que funciona é **stderr não-vazio**. A ferramenta agora roda o
**próprio controle negativo a cada execução** — corrompe e trunca uma cópia de
um arquivo real do conjunto — e **`process.exit(2)` sem emitir veredito** se o
detector não acusar a cobaia. Instrumento que não prova que enxerga não mede
nada.

⚠️ **Isto é um vão do playbook U, não só do meu script.** Ele manda "erro no
`-err_detect explode` = MP3 corrompido" e **não diz como ler o erro**. Quem
seguir a receita ao pé da letra pelo exit code recebe "está tudo limpo" sempre.

### A causa, medida

Com o material dela provado bom, o arquivo citado no erro é nosso:

| pasta | dono |
|---|---|
| `/workspace/jobs/<voz>/raw/` | upload do aluno |
| `/workspace/jobs/<voz>/dataset/` | chunk que **nós** cortamos |

São os **2 únicos jobs da história da tabela** com essa frase, e dizem coisas
opostas:

| job | data | arquivo | de quem é | duração |
|---|---|---|---|---|
| `1815ad70` | 14/08 | `raw/000_000_onboarding_*.zip` | **do aluno** | 5,2s |
| `ab066e99` | 19/09 | `dataset/voice_0032.wav` | **nosso** | 120,4s |

`isCorruptFile()` decide por texto, então tratava os dois igual → `user_dataset`
→ `falhaEhNossa()` false → **nenhum chamado** + mensagem "reenvie o arquivo".

Endpoint inocente (playbook U): o `-e2` dela teve `completed` às 03:20Z e às
09:36Z. Não foi queda global.

### O conserto, e o que eu NÃO afirmo

PR **#348**, merge **`da5c3abc`**. Quem decide passa a ser a **pasta**, não a
frase. Controle contra os textos REAIS de produção:

| caso | baseline `origin/main` | com o PR |
|---|---|---|
| `ab066e99` dataset NOSSO | `user_dataset:corrupt` | **`bug:dataset-chunk-invalido`** |
| `1815ad70` raw do aluno | `user_dataset:corrupt` | **INTACTO** |
| `moov atom` seco | `user_dataset:corrupt` | **INTACTO** |
| `trainer failed` (#11) | `bug:trainer failed` | **INTACTO** |

Suíte `incidents`+`voices`: **191 / 177 passam / 0 falham / 14 skip**. Baseline
`origin/main`: **185 / 171 / 0 / os MESMOS 14**. Líquido **+6 testes, +6
passando, 0 falha nova**. `tsc --noEmit` exit 0. Teste de **mutação** nos dois
lados, nos dois arquivos.

**Causa `bug` e não `infra_*`, de propósito:** com n=1 eu **não sei** o mecanismo
que produziu o wav inválido (disco? escrita curta? take na fronteira do corte?).
Chamar de disco cheio seria **herdar a causa do incidente vizinho** — a
armadilha que o playbook U proíbe, e que já cravou causa errada duas vezes aqui.
Está escrito no cartão que a próxima ocorrência investiga **o preparo do dataset
no worker**, não a classificação, que agora está certa.

### Em produção, pelas três provas da regra 5-B

| prova | valor |
|---|---|
| md5 fonte servidor × local | **idêntico** — `classify.ts` `dd4eee82…`, `finalize-training.ts` `0109b417…` |
| `BUILD_ID` | `WWNUFDIavSz44diqsgzgW`, mtime **11:01:33Z** (merge 11:00:11Z) |
| pm2 `aiverse` + `aiverse-render` | online, restart **11:02:33Z** (depois do build); Action `success` |

### A aluna, entregue

- **10:52:14Z** rearmei a voz `05a57533` `failed` → `awaiting_training`
  (**1 linha afetada**, conferida na releitura).
- **10:52:21Z** disparei `dispararTreinoOnboarding(origem='sgp')` com
  `NEXT_PUBLIC_SITE_URL` de produção. Job `2b662940`.
- **10:57:30Z** **completed**, 500 steps, 308s. `voices.status=ready`,
  `reference_cut_mode=snap_ok`.
- **artefato conferido no R2, não só no banco** — a falha original foi *no
  gravar*, então linha no banco não é prova: `lora.safetensors` **72.397.184
  bytes** (10:57:09Z), `ref/auto.wav` **844.878 bytes** (10:53:16Z), os 9 `.mp3`
  crus no lugar.
- **A prova que fecha o caso:** o treino rodou com **as MESMAS 9 gravações**,
  sem trocar nada. Ela nunca precisou regravar.

**DINHEIRO: ZERO.** 2 linhas por `ref_id` (`voice` −10.000 → `voice_train_refund`
+10.000), conferido **por `ref_type`, nunca por `kind`**. Saldo **100.000**
intacto. `origem='sgp'` não cobra: a casa pagou a GPU duas vezes, ela não pagou
nenhuma. **NÃO ESTORNAR DE NOVO.**

- **11:0xZ** escrevi pra ela (uid **2865** na pasta de enviados + linha em
  `emails_enviados`, `origem=ronda-manual`), corrigindo a carta que culpou o
  arquivo dela. Ela já tinha logado (04:28Z), então não era caso de link.

### Uma correção de rótulo que eu devo ao registro

O título do cartão diz **"ALUNA PAGANTE"**. **Não é.** `pagou_de_verdade.cjs`
devolve *sem pagamento neste e-mail*; o `payment_events` dela é
`PURCHASE_APPROVED` com **`value = 0`**, oferta **"Plano Founder"**. Ela tem
acesso ativo até 26/09 e 100.000 créditos, mas **não há pagamento provado**.

Não muda **nada** da conduta — a falha era nossa e a entrega era devida de
qualquer forma — mas o rótulo errado é exatamente o tipo de coisa que vira
"medida" em ronda futura. Fica corrigido aqui.

---

## Percepção (ordem de 17/09)

`percepcao_travada.cjs`: **1 card**, `#450`, o mesmo **falso positivo do
instrumento** já declarado em três rondas (casou pelo texto; a própria nota do
cartão diz que não é caso de percepção). **Nenhum card parado por falta de
ver/ouvir/assistir.** (Era 13, com o mais velho em 16 dias, quando a ordem foi
escrita.)

---

## A medição que a ronda anterior pediu (item 1 da passagem)

Os dois únicos alunos com carta de formato correto + desenho PULL:

| aluno | `last_sign_in_at` | leitura |
|---|---|---|
| `gtfinger@proton.me` (Graziela) | **2026-09-19 01:58:56Z** | **ENTROU** — a carta saiu 01:58Z; entrou em menos de 1 min |
| `edust@live.com` | **null** | fora há 10 dias |

**É o primeiro ponto POSITIVO do teste de acesso.** Contra os dois negativos já
registrados (Iran 12,4d, Walsicleia 7,6d), o placar do link `token_hash` + PULL
vai a **1 entrou / 3 não**. Ainda é n pequeno — mas a Graziela entrou **no
minuto** em que recebeu, o que é o sinal mais forte que a casa tem de que o
formato do link era o problema, e não o interesse do aluno.

⚠️ E o vão de instrumento da ronda das 02hZ **continua de pé**: `ler_caixa.cjs
--de <aluno>` só lê e-mail **já lido**, então "nada encontrado" **não prova** que
o aluno não respondeu.

---

## O que eu fiz (fatos consumados)

1. **Reconciliação dos envios** — 692 = 692, 0 escrituráveis, veredito passivo.
2. **Pericei os 9 takes da josiclareth** e **consertei o próprio instrumento**
   antes de acreditar nele (controle negativo embutido).
3. **Mergeei o PR #348** (`da5c3abc`) com baseline, controle contra texto real de
   produção e teste de mutação — e **provei o deploy** pelas 3 pernas da 5-B.
4. **Fechei o `#475`** com nota, `resolved_commit=da5c3abc` e `resolved_at`.
5. **Entreguei a voz da Josi** (rearme + retreino + artefato conferido no R2).
6. **Escrevi pra ela** (uid 2865) corrigindo a acusação.
7. **Postei os 3 fatos no grupo** (regra 7).

## O que eu NÃO fiz

- **Não investiguei por que o worker gerou um chunk inválido.** Não tenho acesso
  ao volume da RunPod daqui e n=1 não sustenta mecanismo. Declarado, não
  escondido — e está escrito no cartão de quem pegar a próxima ocorrência.
- **Não mergeei o PR #338.** Segue travado de verdade: recicla o endpoint de GPU
  com aluno treinando ao vivo. É a **sexta** ocorrência de disco cheio na gaveta.
- **Não abri os outros 32 PRs.** O mais velho fez 26 dias (vigia 10hZ).
- **Não respondi a Katia** (§1.1 do vigia 10hZ). É decisão do Johnny: contradiz a
  carta que a casa mandou ontem. **Sem resposta desde 07:03Z** — e o `qa` da
  própria geração dá razão a ela (`rate_flagged` 9/11, esticado a 0,866,
  `exhausted`, entregue assim mesmo).
- **Não li a caixa do suporte@ pra triagem.**
- **Não toquei em crédito, carteira nem status de ninguém** além do rearme.
- **Não fechei mais nenhum cartão.** Regra 14 inteira: 92 abertos é o número
  honesto.

---

## Para quem pegar a próxima ronda

1. **A Katia continua sem resposta**, e é o único ponto que muda o que alguém
   **escreve** hoje. A medição já está feita e dá razão a ela; falta a decisão
   do Johnny porque contradiz a carta de ontem.
2. **Se aparecer uma 2ª ocorrência de `bug:dataset-chunk-invalido`**, ela agora
   **soma no mesmo cartão** (assinatura constante) e o dono investiga **o preparo
   do dataset no worker** — não a classificação.
3. **A janela de merge do #338 continua sendo pergunta ao Johnny.** Sexta
   ocorrência de disco cheio; cada uma custa uma GPU paga duas vezes pela casa.
4. **O placar do PULL virou 1 entrou / 3 não** e a Graziela entrou em menos de
   1 min. Vale continuar medindo antes de mudar o desenho de novo.
5. **Desconfie de exit code em ferramenta de mídia.** `ffmpeg` sai 0 em arquivo
   corrompido. Se você escrever um detector novo, dê a ele um controle negativo
   na própria execução — foi o que separou "medido" de "sortudo" nesta ronda.
