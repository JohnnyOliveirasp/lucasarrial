# Ronda das falhas — 31/08/2026, 18h30–19h00 UTC (Frank)

Método serial (regra 8, ordem de 21/08). Ordem de 29/08 respeitada: **nada da
planilha foi lido, escrito, classificado ou reprocessado**; nenhum incidente de
causa-planilha foi aberto, reaberto ou comentado. Canal: tudo no **grupo**
(`notify-grupo.sh`), conforme a ordem de 31/08. Nenhuma mensagem no privado.

## Placar

- Fila no início: **14 investigating + 2 aguardando_aluno**.
- Fila no fim: **13 investigating + 2 aguardando_aluno**.
- Fechados como `fixed`: **1** (#211, duplicata resolvida — o pedido do aluno
  foi cumprido).
- Alunos respondidos: **1** (#207 Márcio, assinante).
- Fix subido: **0**. Nenhum código novo — nada preso em branch.
- Hipótese herdada da ronda anterior que eu **derrubei antes de agir**: 1.

---

## O caso serial: a ronda anterior ia medir a coisa errada, e o suporte já tinha prometido de novo sem dono

Peguei o **#207** (Márcio Cunha, `contato@fotoatleta.com`) porque era o caso
mais antigo com aluno afetado em que **existia passo meu** — os mais velhos
(#99, #173, #196, #202, #205, #208, #209) estão todos travados em decisão que
não é minha, e #200/#201/#203/#210 travados em merge.

### O que a ronda das 18h deixou escrito, e por que não dava pra seguir

A nota anterior leu o `uid 387` e concluiu: ele escolheu *"soa robótico/lendo"*,
logo **retreinar não conserta**, e deixou o próximo passo com dono — *"baixar o
anexo, medir pelo `medir_pausas_da_entrega.cjs`, só então responder"*.

A conclusão sobre o retreino estava certa. **O próximo passo, não.** Ele
escreveu mais duas vezes depois daquele e-mail, e as duas estavam na caixa:

- **uid 388** (11h58, com os 2 vídeos anexados): *"OS DOIS, VIDEOS DA PRA
  PERCEBER QUE FOI CRIADO POR IA... DA PRA VER QUE **MINHA BOCA OU O MOVIMENTO**
  NAO DEMONSTRA UMA NATURALIDADE, ISSO QUE QUERO ARRUMAR."*
- **uid 391** (14h57): o link do Drive — que virou o **#211**.

A queixa não é o áudio. É o **Vídeo Clone**. `medir_pausas_da_entrega.cjs` mede
a saída de ÁUDIO: articulação e silêncio. Rodá-lo aqui teria medido, com todo
rigor, uma coisa que o aluno não reclamou. **É a lição da ronda das 18h de novo,
por outro caminho:** lá o método estava certo e o instrumento cego; aqui o
instrumento está certo e apontado pro alvo errado.

### E, no meio disso, a Fast prometeu outra vez sem dono

Às **18h00Z** (Enviados uid 391) o suporte escreveu a ele: *"Vou pedir pra
equipe dar uma olhada no que você mandou e te responder **sobre o retreino da
voz**."* Duas coisas erradas numa frase: ninguém era "a equipe" (modo (b) do
#153, o pecado original do #99), e a promessa era do **conserto errado** —
retreino ataca timbre, a parte que ele diz estar boa. Eu fui a equipe.

## O que eu medi, arquivo por arquivo

Baixei do R2 e **olhei**, não inferi do caminho.

| o que | medida |
|---|---|
| clone 0616360d (29/08) | 53,98s · 5.670 cr · tier `480p-v3` · `ready` |
| clone ce124091 (31/08) | 38,15s · 4.095 cr · tier `480p-v3` · `ready` |
| vídeo entregue (ffprobe) | 480×832 · h264 · 25fps · 977 frames · 39,08s |
| a foto usada nos dois | `images/1bc8ecd1.../result.png`, 1086×1448 |
| conta | assinante, compra ativa 29/08, +100.000 do ciclo, 75.267 cr |

**A foto já estava certa.** Abri: ele de frente, do peito pra cima, rosto
grande, nítido, olhando pra câmera, bem iluminado. Mandar refazer seria repetir
o erro **medido** no #99 — Luciano foi de ~190 pra ~240px de rosto (+26% de
pixel) e o resultado foi o mesmo, porque o teto é a **resolução**, não o
enquadramento.

**Zero falha técnica.** As duas gerações completaram. Não há estorno devido por
regra, nem nada quebrado pra consertar.

### A hipótese que eu levantei e matei antes de vender pro aluno

O `silencedetect` mostra o áudio calando em **38,130s** e o vídeo indo até
**39,080s**: **0,93s de cauda**. O #99 tinha *descartado* essa hipótese com
0,16s — e o descarte estava certo **pra aquele caso**: o resíduo depende da
parte fracionária da duração, porque o v3 usa `floor(seg)×25 + 25`
(`workflow.ts:69`). Luciano (36,84s) → 0,16s. Márcio (38,15s) → 0,93s, **5×
maior**.

Era uma conta bonita e eu quase parei nela. **Fui olhar os frames:** extraí a
faixa 37,6s–39,08s e a boca **não** fica batendo no silêncio — ela fecha e o
rosto para. É cauda parada, cosmética, e **não explica "o vídeo inteiro parece
IA"**. Não é a causa, e eu não a vendi pro aluno como sendo.

**E não abro chamado por isso**: a fórmula está comentada no código como réplica
byte a byte do fluxo validado pelo Johnny em 07/08, com ordem explícita de *"NÃO
mexer nas configurações"*. Fica como fato medido, sem card.

## A causa real já estava escrita no nosso próprio manual

`agent/manual.ts:187–220`: o Vídeo Clone **anima uma foto parada**, sai em
480×832, **não há opção maior** (720p retirado em 04/08), e os dois modos são o
**mesmo motor** — Turbo não é mais natural (mentira já medida no **#178**).

Ou seja: não existe ajuste meu que conserte, e não existe modo que ele não
tenha usado. O manual manda dizer isso *com todas as letras* e **escalar**,
porque o que oferecer a partir daí é da equipe.

## O que eu escrevi a ele (18h46Z, Enviados uid 392, sem bounce)

1. A voz está certa e **não vai ser retreinada** — e o porquê, escrito.
2. A foto dele já estava certa: **não refaça**.
3. Os dois rodaram no melhor modo; **não existe resolução maior**.
4. É o **teto do produto**, não defeito da conta dele.
5. O caminho que chega no nível que ele quer: **HeyGen conectado dentro da
   plataforma** — mesma resposta que o Johnny deu por escrito ao Luciano em
   27/08. Não é invenção minha: `lab/video-heygen` e `/api/v1/heygen/account`
   existem.
6. Gesto sem fala → **Imagens → Animar imagem**.

## O que eu NÃO fiz, de propósito

Não retreinei a voz, não disparei geração nova, não mandei trocar pra Turbo,
não pedi foto nova, não prometi data e **não decidi nada de dinheiro**.

## O #211

Duplicata do #207. Antes de tratar como duplicata, **conferi o que havia no
link** em vez de supor: o arquivo é *"Vídeo Clone 29082026 (1).mp4"* — o vídeo
que nós mesmos geramos (clone 0616360d). Não era material novo. Analisei o
**original** no nosso R2, que é a mesma peça sem o reencode do upload.
**Limite que eu registro:** não abri o Drive, e não digo que abri.

Fechei porque o pedido dele ali (analisar o que mandou) foi **cumprido**. Não
fechei o #207.

## O que fica na mesa, e não é meu

**Decisão comercial nova:** ele gastou **9.765 créditos** em duas gerações que
bateram num teto que a gente não contou **antes** dele gerar. Não houve falha
técnica, então não há estorno por regra. Eu disse a ele por escrito que levei a
questão pra equipe e que **escrevo de volta quando houver definição, mesmo que
demore**. Esse compromisso tem dono: a fila. Não fechar sem resposta.

## Por que não peguei os outros

- **#99 Luciano** — **prazo fecha AMANHÃ (01/09)**. 11 escalações sem resposta.
  Nada novo do meu lado; ele já sabe por escrito que pode pedir sozinho pela
  Hotmart. Repeti no grupo só o que mudou: é a véspera.
- **#173, #196, #202, #205, #208, #209** — travados na MESMA decisão de política
  (o que a compra do curso dá direito dentro do FastCloner). Uma resposta fecha
  seis.
- **#200, #201, #203, #210** — travados em merge (#132, #133, #134, #137).
- **#192** — precisa de ouvido humano; **#135** é decisão binária.
- **#197, #206** — `aguardando_aluno` legítimo, nenhum com 7d+ de silêncio.
- **`luanmarcal.com@gmail.com`** — segue não tocado (perímetro da ordem 29/08).
- **`marcelopersonalthe32@gmail.com`** — voz `failed` por multi-locutor; é a
  armadilha já medida, não peguei por falta de turno. Fica sinalizado.

## Fim de ronda

`git fetch origin` + `git log --oneline origin/main..HEAD` vazio, e
`git status --short` conferido **depois** do commit. Scripts de investigação em
`_Bugs/` (fora do git), como manda o README das ferramentas. Nenhum código novo
— nada preso em branch.

## Precisa de gente (nesta ordem)

1. **#99 Luciano — vence AMANHÃ.** Depois disso a decisão fica tomada pelo
   silêncio, contra um pagante que anunciou saída.
2. **UMA decisão, não seis: o que a compra do curso dá direito dentro do
   FastCloner.** Fecha #173, #196, #202, #205, #208, #209 e define o que dizer
   aos outros 366.
3. **PR #138** — enquanto não subir, a próxima ronda mede com o instrumento
   cego e pode negar crédito a cliente pagante de novo.
4. **#207 Márcio** — decisão comercial sobre os 9.765 créditos, com promessa
   escrita de retorno.
5. **Os 30 PRs abertos** — #132/#133/#134/#137 sozinhos destravam 4 incidentes.
