# Rotina das Falhas — 27/08/2026, ronda das 14h UTC (Claude, dono da fila)

Método serial (regra 8, ordem de 21/08): um incidente por vez, até o fim.
Papéis (regra 14-A): o Vigia abre e anota; eu investigo, decido e fecho.

## Placar da fila no início

9 incidentes abertos · 6 aguardando aluno · 4 itens presos.
A fila **não** está zerada, ao contrário do que a ordem de 20/08 registrou.

## Escolha do incidente — e por que não fui pelo mais velho

O mais antigo com aluno afetado é o **#11 `9ac03612`** (trainer failed, aberto
21/07, 37 dias). **Não peguei**, e o motivo é que ele já está no fim do que dá
pra fazer sem o Johnny:

- o aluno da 3ª ocorrência (`franwd82`) foi atendido hoje de manhã — voz ready
  às 10:56Z, sem cobrança dupla, avisado pelo próprio produto;
- o fix de diagnóstico está em produção (PR #67, merge `c50b60c`);
- **o que trava é a migration `scripts/97`**, que não é puramente aditiva
  (estreita grant) e depende de aval do Johnny. Conferi no banco: as colunas
  `trainer_returncode` / `trainer_stderr` / `trainer_stdout` **não existem**.
  DDL commitado não é DDL aplicado.

Passo em que emperrou: **aguardando decisão do Johnny sobre a migration 97**,
e a próxima ocorrência pra gerar traceback. Levado a ele no Telegram.

Peguei então o caso com gente sofrendo agora, conforme "aluno esperando vem
antes da limpeza da fila".

---

## 1. #151 `f7600aba` — Zethe Castro (pagante, acesso vence 31/08)

**Situação:** pagou 24/08, acesso até 31/08, 60.958 créditos. Voz "Elizete S
Castro" ready, treinada 26/08. Ela diz que "ficou horrível" e pediu pra
excluir. Mandou 4 mensagens no chat hoje de manhã; o bot prometeu 3× que a
equipe fora avisada e **não existia chamado nenhum**. Buraco de canal, não
culpa dela.

### O que MEDI e descartei

| Hipótese | Veredito | Como medi |
|---|---|---|
| Arquivo corrompido / foto do Drive em `raw_audio_paths` | **descartado** | 7 itens, os 7 `.wav`, 2100s (35min). Zero pdf/jpeg. Passo da armadilha feito ANTES de olhar worker/ffmpeg |
| Referência cortada no meio da palavra (Katia/Negrini #124) | **descartado** | `conferir_transcript_referencia.cjs --curar` em simulação: "pontas batem — nada a curar" |
| Entrega instável | **descartado** | Mesmo texto de 925 chars gerado 2×: 2,463 vs 2,444 pal/s; 21 vs 23 pausas; mediana 441 vs 482ms. Praticamente idênticos |
| Ritmo "corrido" | **não sustentado** | 2,46 pal/s com 10,5s de silêncio em 73,4s. A Katia, que reclamou de corrido, media 3,205 pal/s |

Sobrou **timbre/semelhança**, que não se mede daqui.

### ⚠️ Erro meu, registrado porque foi por pouco

Vi `tts_silence_ms` NULO na voz dela, medi que **302 vozes ready desde 15/08
têm 0 com pacing**, e quase reportei "o fix 080dd74 nunca funcionou em
produção". **Estava errado.** Lendo `finalize-training.ts:380-400`, o pacing
foi **desligado de propósito em 24/08 por ordem do Johnny** (caso Kessuly:
pausa + crossfade 0 deixou a voz "horrível, muito pior"; 93 vozes zeradas). O
worker continua medindo e só loga `pacing_measured_not_applied`. **NULO é o
estado correto hoje.**

A mensagem errada não chegou a sair — o `notify.sh` que eu tentei usar não
existe neste repo e falhou. Foi sorte, não processo. Lição: ler o código antes
de acusar o banco. Terceira vez que esta base quase leva causa cravada errada.

### O que fiz

- **E-mail pra ela** (~13:55Z, bcc suporte@): desculpa pelo canal ter falhado,
  **pedido explícito pra NÃO excluir a voz** (apagar queima o material e o
  crédito do treino já gasto), o que já conferi, e a pergunta que destrava —
  o defeito é (a) timbre, (b) robótica, (c) pronúncia ou (d) ritmo, e em que
  segundo. Disse que não há cobrança dupla (conferido) e que **se a culpa for
  nossa o retreino é por conta da casa**.
- **Grupo da equipe**: pedi o A/B ouvindo o clone contra a gravação real dela,
  com as duas URLs assinadas. Enviado do servidor (a WAHA só escuta em
  127.0.0.1).
- Nota gravada no incidente, status `investigating`.

**Não prometi extensão de acesso** — não é decisão minha. Disse só que
registrei internamente.

**Falta pra fechar:** veredito de ouvido humano + a resposta dela.
⏰ **Se não houver desfecho até 30/08, isso sobe pro Johnny** — o acesso vence
31/08 e decidir prazo/reembolso é dele.

---

## 2. #65 `5c3f1f8b` — 3 pagantes sem voz → sobrou 1

Peguei porque estava 7 dias sem toque e era o maior grupo de gente esperando.
O passo 1 ("já resolveu sozinho?") pagou: **2 dos 3 se resolveram**.

- **Cláudio Sityá** — resolvido. Voz nova `7b60fd7a` **ready**, 2109s, 5
  arquivos, desde 22/08. Reenviou material limpo e treinou.
- **Ivanilde** — resolvido. Voz `4c2c4abc` **ready**, 1843s, updated 25/08. A
  previsão de 21/08 ("não tem conserto do nosso lado") foi **superada pelos
  fatos**: ela voltou e conseguiu.
- **Confirmação independente:** a varredura de hoje não lista mais nenhum dos
  dois no bloco "acesso vivo, com crédito e sem voz pronta". Lista o Marcelo.

- **Marcelo** — único que sobra, e **a causa mudou**. Voz `f6f82819` failed,
  47min, 1 arquivo, mas o `error_message` não é mais o genérico de 21/08:
  updated 25/08, agora diz **"tem mais de uma pessoa falando (gravação de
  entrevista)"**. A guarda de multi-locutor entrou em produção e diagnosticou o
  caso que estava cego. **Isso derruba o "é só refazer" de 21/08** — refazer
  com o mesmo arquivo bateria na mesma guarda. Crédito devolvido, 198.950, e
  acesso até 05/09.

**E-mail pra ele** (~14:05Z, bcc suporte@) com **dois caminhos**, porque eu
**não verifiquei o multi-locutor com instrumento próprio**: (1) se é mesmo
entrevista, gravar sozinho; (2) se é só ele falando e a nossa detecção errou,
responder **sem gravar nada**, que eu trato como bug nosso. Escrevi explícito
"não gaste 30 minutos gravando antes de me dizer isso".

⚠️ **Armadilha dos 20 minutos respeitada:** a mensagem do produto diz "mínimo
10min" e o portão real é `MIN_DURATION_SECONDS = 20*60`. Pedi **25 a 30
minutos**, com a folga explicada, em vez de repetir o número errado que o
faria ser recusado de novo achando que a culpa é dele.

**Não marquei `fixed`.** O Marcelo continua sem voz; 2 de 3 não é 3 de 3.
Ficou `aguardando_aluno`, com a data do e-mail anotada.

---

## Levado ao Johnny (Telegram, msg 483)

1. Zethe travada, com o prazo de 31/08 e o pedido de decisão se não fechar até 30/08.
2. O erro meu do pacing, registrado como erro.
3. **Migration 97 parada há 37 dias** — é o que impede o #11 de fechar.
4. Pergunta que é dele: o retreino idêntico do `franwd82` ter dado certo sugere
   **retentativa automática** em falha transitória. **Não implementei nem abri
   card** — gasta GPU por conta da casa e a ordem é clara.

## O que NÃO fiz

Não excluí voz, não retreinei ninguém, não gastei GPU, não estornei, não mexi
em acesso, assinatura ou crédito de ninguém, não apliquei migration, não
mergeei branch nenhuma, e não li a caixa do suporte@ pra triagem.

## Fila no fim da ronda

Nenhum incidente **fechado** nesta ronda, e isso é resposta honesta: os dois
que peguei dependem de resposta de terceiro (ouvido humano, aluno) e o mais
antigo depende de decisão do Johnny. O que mudou de verdade: **3 alunos que
estavam no escuro agora têm resposta**, e o #65 caiu de 3 travados para 1.
