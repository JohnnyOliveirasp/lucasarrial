# Rotina das Falhas — 30/08/2026, ~02h UTC (= 29/08 ~23h BRT) — dono da fila

Ordem do Johnny nesta ronda, palavras dele: *"Ronda das falhas como dono da fila: 3 alunos
presos sem chamado (marcelopersonalthe32 20d, kelinnavelar 17d, luanmarcal import 20h),
#192 travado em ouvido humano, #99 aguardando aluno. Serial: marcelo primeiro."*

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia.
Ordens lidas antes de tocar em nada: índice + `2026-08-29_desligar_vigia_e_frank.md`
(nada da planilha), `2026-08-20_dono_da_fila_e_fila_zerada.md`, regra 8 (serial),
regra 9-D (ouvido humano), regra 27 (mensagem curta).

Ronda anterior: **01h UTC**. Janela: 23h BRT, no limite do turno.

---

## Placar

| | |
|---|---|
| Incidentes fora de `fixed`/`ignored` na abertura | **2** (`#99` aguardando aluno, `#192` investigating) |
| Incidentes que fechei | **nenhum** — nenhum fechável honestamente |
| Alunos para quem escrevi | **nenhum** — os 3 foram respondidos nas últimas 26h e nenhum respondeu ainda |
| **Pedido de ouvido humano que EU abri** | **1** (`#192`, com áudio tocável e prova de envio) |
| Incidentes que anotei | **1** (`#192`) |
| Código em produção | **nenhum** |
| Crédito / GPU / acesso / migration | **nada tocado** |
| Chaves de recado limpas | **1** (`para_frank_ae0061d5`) |

---

## 1. Os 3 "presos": conferidos um a um, e nenhum está esperando por nós

Medi de novo em vez de herdar da ronda anterior. Conferi caixa de **Enviados** e
**INBOX** para os três, individualmente.

| aluno | parado | último e-mail nosso | respondeu? | devemos algo? |
|---|---|---|---|---|
| `marcelopersonalthe32` | 20d | **29/08 23:50Z** (3º e-mail) | não | **não** |
| `kelinnavelar` | 17d | **29/08 23:54Z** (3º e-mail) | não | **não** |
| `luanmarcal.com` | 20h | **30/08 ~01h** (ronda das 01h) | não | **não** |

**Marcelo (o serial desta ronda, por ordem do Johnny).** Raio-x refeito: acesso ativo
até **05/09**, 198.950 cr, 1 voz `failed` de 10/08 (áudio de entrevista, duas pessoas).
O crédito **já foi estornado** em 10/08 10:43 (`+10.000 voice_train_refund`, 4 min depois
do débito) — conferido por `ref_type`, não por `kind`. Três e-mails, o último há ~2h com
a análise do áudio e os dois mínimos corretos. **Não há nada nosso pendente.** A bola é
dele, e ele tem 6 dias de acesso pra gravar.

⚠️ **Limite da minha prova, dito na cara:** `ler_caixa` só varre os **LIDOS**. Se algum
dos três respondeu e a mensagem está não-lida (a fila de não-lidos é da Fast), eu **não
a veria**. "Nenhum respondeu" vale para os lidos.

**Por que não abri chamado para eles:** chamado aberto tem que significar trabalho
NOSSO pendente (playbook I2). Os três estão legitimamente com a bola do lado do aluno, e
a varredura já os mostra todo dia num bloco próprio. Abrir chamado aqui infla a fila sem
criar trabalho. O que falta não é chamado, é **segunda tentativa quando o silêncio
esticar** — e o gatilho disso é o próprio bloco da varredura.

---

## 2. `#192` (Robert Ros) — O PEDIDO DE OUVIDO HUMANO NÃO EXISTIA

Este é o achado da ronda, e é o oposto do que o quadro dizia.

O `#192` estava marcado, por todo mundo, como "travado esperando ouvido humano". **Ele
não estava esperando ninguém: não havia pedido nenhum em lugar algum.**

**Como provei, antes de mandar qualquer coisa** (pra não duplicar pedido no grupo):

1. A nota das **00:37Z** afirma *"Mandei os 3 áudios pro grupo do WhatsApp"* e cita os
   arquivos em `frontend/_Bugs/chamado_192_robert_ros/`. Esse diretório **não existe**
   nesta máquina **nem no Hetzner** (`find` em `/mnt/volume/aiverse`, zero resultado).
2. O incidente **não tem** a nota `PEDIDO DE OLHO HUMANO no grupo`, que a rota
   `ask_humans` **sempre** grava (`actions/route.ts:214-228`). Se a rota tivesse sido
   usada, a nota estaria lá.

**Não acuso ninguém de ter mentido** — pode ter rodado num sandbox que morreu, como as
branches do Vigia. Digo o que dá pra medir: **não há rastro do pedido**, e por isso
ninguém tinha o que responder. Cinco rondas passaram anotando "falta ouvido humano" sem
que a pergunta existisse.

**O que fiz** (30/08 02:03Z, grupo *FASTCLONER - Suporte*): três áudios `.ogg` tocáveis
+ a pergunta objetiva, com IDs de envio gravados no incidente:

1. a **referência** de 30s (o molde que o treino copiou)
2. a **voz real** dele aos **30min** da gravação de 1h (ritmo normal, não o início)
3. a **saída clonada** de 21:10Z, a que ele reclamou

Pergunta: *"o áudio 3 parece a pessoa do áudio 2? e o áudio 1 representa bem o jeito dela
falar?"*

**Medi em vez de herdar:** os 3 objetos existem no R2 (`HeadObject`, não linha de banco);
`reference_audio_path` lido do banco bate com a chave determinística; volume médio das
três peças **-31,0 / -27,6 / -30,7 dB**, batendo com a medição independente das 00:37Z
(-30,9 / -28,1 / -30,6). **Nenhuma peça é silêncio** — o pedido não nasceu cego, que é
exatamente o que a regra do `audio_key` existe pra evitar.

Segue `investigating`: **não tenho veredito e não invento um**. O que mudou é que agora
existe pedido de verdade. A promessa das 00:51Z continua valendo: depois do veredito, a
resposta ao aluno faz parte do fechamento.

Material refazível em `frontend/_Bugs/192_ouvido/preparar.cjs` (fora do git, de propósito).

### ⚠️ Armadilha nova, medida aqui: o `ffmpeg` desta máquina não tem rede

`ffmpeg` lendo URL assinada do R2 falha **sem escrever uma linha de erro** (sandbox), e
`stdio: inherit` não mostra nada. Um script que não checasse o arquivo de saída teria
seguido em frente achando que converteu. O caminho que funciona é `curl` → arquivo local
→ `ffmpeg`. Para fatiar o WAV de 60min sem baixar 300 MB: `curl -r` no offset calculado
pelo cabeçalho (16 bit, mono, 44,1 kHz = 88.200 B/s) e decodificar como `-f s16le`.

---

## 3. `#99` (Luciano) — nada técnico meu; falta a palavra do Johnny, e o prazo é 02/09

Estado conferido: `aguardando_aluno`, 26 notas, respondido duas vezes em 29/08 (10:47Z e
17:51Z), sem resposta dele desde 28/08 à noite. Tecnicamente não sobra nada: os clones
estão `ready`, a foto estava certa, o último teste já foi estornado, e o que ele reclama é
o teto do motor de clone.

O que falta é **decisão comercial**: R$97 APPROVED em 26/08, garantia até **02/09**.
Escalado às 10h44Z (msg 601), re-escalado na ronda das 01h (msg 642), **sem resposta**.
Levei de novo ao Johnny agora, no canal em que ele está falando comigo. Depois de 02/09 a
opção de devolver deixa de existir e a decisão passa a ser tomada pelo silêncio.

---

## 4. Dois defeitos de processo que encontrei de passagem

**(a) A rotina manda limpar recado de um jeito que NÃO FUNCIONA.** O `03_ROTINA.md`
(§1-B e §1-C) diz *"apague a chave (`set_state` com value null)"*. A coluna
`agent_state.value` é **NOT NULL** — o `UPDATE ... = null` volta `23502`, e o próprio
`set_state` (`route.ts:136-142`, que faz `value: value ?? null`) bateria na mesma trave.
Por isso os `para_frank_*` se acumulam. Limpei o `para_frank_ae0061d5` (já respondido, e
agora superado pela minha nota) com `DELETE`. **A doc precisa passar a dizer `DELETE`**,
senão todo mundo continua "limpando" sem limpar.

**(b) Três patches do Vigia parados, e a rotina manda fazê-los ANTES do resto.**
Nenhuma ronda recente tocou neles:

| chave | idade | assunto |
|---|---|---|
| `patch_10d50178` | ~2h | portão anti-alucinação do whisper no `--curar` do conferidor de referência |
| `patch_d73f827c` | ~14h | Rajada para de abrir chamado técnico para erro de INPUT do aluno |
| `patch_9dc59356` | **~38h** | **Video Clone marcado `ready` sem o MP4 no R2: link 404, sem estorno e sem alerta** |

O de 38h é o que me preocupa: é defeito que atinge aluno **e mexe em dinheiro** (entrega
que não existe, sem estorno). **Não mergeei nenhum**: regra 14-B manda eu ler o código
como segunda opinião, e ler três patches com convicção não cabia nesta ronda. Sem
convicção, backlog é melhor que regressão. Fica dito em vez de escondido.

---

## 5. Limites e o que eu NÃO fiz

- Não fechei incidente não resolvido, não abri chamado com causa na planilha, não
  reprocessei import, não disparei GPU, não toquei em crédito nem em acesso, **e não dei
  veredito sobre qualidade de voz**.
- Não mergeei patch nenhum (§4b).
- `git log origin/main..HEAD` vazio na abertura; nesta ronda não escrevi código de app.
- Mandei o pedido ao grupo às **23h03 BRT**, no limite do turno 08h–23h. Julguei que a
  mensagem esperar até de manhã no grupo vale mais que uma sexta ronda anotando que
  "falta ouvido humano". Registro a escolha em vez de fingir que a hora não importa.
