# Rotina das falhas — 01/09/2026, 13hZ

Caso único: **Marcelo** (`marcelopersonalthe32@gmail.com`, voz `f6f82819`).
Ordens lidas antes de tocar: índice `ordens/README.md`, `2026-08-29_desligar_vigia_e_frank.md`,
`2026-08-27_vigia_so_erro_de_sistema.md`.

## A premissa do briefing estava errada em dois pontos

O card dizia *"falhou em 10/08 com recusa de multi-locutor"* e *"nenhum e-mail
nosso"*. **Os dois estão errados**, e a correção muda o caso.

### 1. Não houve recusa de multi-locutor em 10/08

O que derrubou o treino foi **`[Errno 28] No space left on device`** —
`training_jobs` `76cdefc2`, `elapsed_seconds` 0, `started_at` null: morreu
**antes de treinar**. **Falha nossa, de infraestrutura.** Já estava medido na
ronda de 24/08 22h; classe **n=1 em toda a base**, só 10/08, não é bug vivo.

A guarda de multi-locutor (`lib/sgp/medir-audio.ts`, Whisper + Haiku) **nem
existia** em 10/08 — entrou depois, e vive no caminho do SGP. Ou seja: **não dá
pra perguntar se o detector errou, porque o detector não rodou.**

### 2. O achado das duas pessoas é verdadeiro — e não é falso positivo

Confirmado por **três instrumentos independentes**, nenhum deles o detector:

| instrumento | resultado |
|---|---|
| transcrição independente (24/08) | entrevista clínica, pergunta-e-resposta; quem mais fala é voz **feminina** |
| F0 por autocorrelação (25/08) | `ref/auto.wav` **IQR 152 Hz** vs **máx. 82 Hz** nas 60 vozes `ready` limpas; clone de resgate saiu **mulher** (197,5 Hz, 91,6% das janelas em faixa feminina) |
| escuta manual em 8 pontos (29/08) | homem perguntando, mulher respondendo, ~45/55 |

O `reference_transcript` gravado no banco fecha sozinho:
*"Amanda, deixa eu te pedir um favor. Tu tira uma foto de lá pra cá…"* — é
diálogo dirigido a uma terceira pessoa. Arquivo:
`000_Avaliac_a_o_e_reabilitac_a_o_apo_s_AVC_isque_mico__1_.mp3`, 47 min.

**Veto ao retreino com ESSE arquivo continua de pé** (regra 9-D: sem diarização
sai "clone de quem não existe"). Entregar o resgate teria entregue a voz da
entrevistadora.

### 3. Três e-mails, entregues, sem bounce

24/08, 27/08 e 29/08 23:50. O de 24/08 já saiu **com as duas réguas certas**
(20 min pro envio passar, 10 min de fala limpa pro treino).

Levantei a hipótese de que ele não estivesse **recebendo** — 3 e-mails e zero
resposta de quem pagou duas vezes é padrão de bounce. **Hipótese derrubada:**
`varrer_bounces.mjs --desde 20-Aug-2026` lista 5 alunos que não receberam
(epotentia, pc.sul157, luctec, tuliocanella, reinaldo.guernelli) e **Marcelo não
está entre eles**. Registro o negativo porque ele fecha a porta: o silêncio é
dele, não do canal.

## O defeito real que ninguém tinha visto — e que eu corrigi

O `error_message` que o Marcelo **vê no produto** foi reescrito em
**25/08 10:50:48** (`updated_at`), 15 dias depois da falha, e dizia:

> "O áudio enviado tem mais de uma pessoa falando (gravação de entrevista) […]"

Isso **atribui a falha de 10/08 ao áudio dele**, quando a falha foi **nossa**
(disco cheio). Um cliente pagante passou 22 dias com uma acusação errada na tela.
É exatamente o que a **regra 12** proíbe — e pior que "instabilidade momentânea",
porque joga a culpa no aluno.

**Corrigido no banco**, com as duas coisas separadas, as duas réguas e a
confirmação do crédito. Conferido **depois** de gravar: **1 linha afetada**,
reli o campo, `updated_at` 2026-09-01T14:04:43Z.

## O caminho de retentativa está sadio (conferido, não presumido)

- `error_message` **chega ao browser**: selecionado em `GET /api/v1/voices`
  (route.ts:149) e `GET /api/v1/voices/[id]` (route.ts:30).
- Renderizado por `VoiceErrorMessage` (`voice-status-panel.tsx:238-252`) na
  página de detalhe, com CTA **"Tentar de novo com mais áudio →"**.
- Voz `failed` **não bloqueia** criar outra: o POST só barra
  `uploading|validating|awaiting_training|training` (route.ts:79).
- **A armadilha dos 20 minutos foi fechada**: `MIN_TOTAL_SECONDS` (regua-audio.ts:27)
  e `MIN_DURATION_SECONDS` (voice-creator.tsx:18) são os dois `20*60`, e
  `minutosExibidos` arredonda pra baixo. Não reporto como aberta.

**Ressalva honesta:** na **lista** de vozes ele vê só o selo "Falhou"
(`variant="soft"`), sem motivo. O texto acionável só aparece **clicando na voz**.
Não é bug, mas é a explicação mais plausível pra "zero nova tentativa".

## Dinheiro: intacto, conferido por `ref_type`

+10.000 em 10/08 10:43, **`ref_type` = `voice_train_refund`** (nunca por `kind`,
que grava `extra_purchase` — armadilha da ordem de 20/08). Não estornei de novo.
Saldo 198.950. `pagou_de_verdade`: assinatura rec#2 R$97 (12/08) + avulsa
R$368,64 (27/07). `pagante_trancado`: **0 trancados**, e ele **não** está na
fronteira. Sem urgência de acesso — a que eu tinha hipotetizado **não se
confirmou** e fica registrada como descartada.

## Por que NÃO escrevi um 4º e-mail

O card mandava escrever. **Não escrevi, e a razão é que a base do pedido caiu:**
os 3 e-mails existem, foram entregues, e o de 24/08 já dizia tudo que um 4º
diria. O último foi há **3 dias**.

Repetir o pedido pela quarta vez em 3 dias é o ruído que a regra 27 descreve, e
a ronda das 11h de hoje já tinha decidido o mesmo pelo mesmo motivo. Procurei um
fato novo que justificasse contato — bounce, trava de acesso, régua errada,
retentativa bloqueada — e **os quatro deram negativo**. Sem fato novo, escrever
seria encenar trabalho.

**O que fica marcado:** seguindo o precedente que esta mesma rotina usou pro
Luciano (#99), o próximo contato é de **"a porta segue aberta"**, não de cobrança
— e a data é **05/09**, não hoje. Pagante que some em silêncio não é caso
resolvido; mas 3 dias depois do último e-mail ele não está em silêncio ainda.

## Estado final

Voz segue `failed` — **correto**, o arquivo é inservível e o veto é de conteúdo.
Aluno com crédito intacto, acesso ativo, caminho de retentativa funcionando e
agora com a mensagem certa na tela. **A bola é dele, e desta vez o que ele lê
está correto.**
