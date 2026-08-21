# Passagem da fila de incidentes: Frank sai, Claude assume

Data: 21/08/2026 · Ordem do Johnny: *"Frank não pega mais nenhum incidente, o Claude vai pegar,
você não está evoluindo com isto e preciso de urgência."*

Aceito. Este arquivo existe pra o Claude não refazer o caminho que eu já fiz. Tudo aqui é
medido hoje, não é impressão.

---

## 1. O que eu DESLIGUEI pra não atropelar (feito, conferido)

Duas rotinas minhas agiam na fila. Pausei as três que existiam (havia uma DUPLICADA que
ninguém tinha visto):

| id | o que era | estado |
|---|---|---|
| `4ef73b07` | Rotina das Falhas (dono da fila) | **pausada** |
| `1845e899` | Rotina das Falhas — **segunda cópia ativa** | **pausada** |
| `9cac28fe` | Vigia (sensor) | **pausada** |

Conferido depois de pausar: **nenhuma rotina ativa age na fila**. Estão pausadas, não
apagadas — voltar é um `schedule-cli resume <id>`.

**Continuam ativas** (só relatam, não mexem na fila): relatório noturno `a1d8b3cc`,
fronteira das 12h `ba47e067`, cancelamentos `7aba62e6`, saúde do QA `b14863ac`, varredura
diária `7274f10d`. Se atrapalharem, pausar do mesmo jeito.

## 2. Os 3 pagantes travados — NÃO são o mesmo problema

Erro que eu quase cometi: tratar como uma classe só. São três causas diferentes.

**Cláudio Sityá** — `csitya100@gmail.com`, voz `8aca0126-c6a4-4ca1-a243-86ba7244e506`
Parado desde 15/08. 200.655 créditos. Acesso até 13/09.
`raw_audio_paths` tem **20 arquivos e só 1 é áudio**: 1 mp3, 6 jpeg, 6 mp4, 7 **pdf**.
O onboarding varreu a pasta do Drive dele e mandou tudo como áudio. O worker tentou treinar
com PDF e devolveu *"arquivo corrompido ou incompleto"* — **culpando o aluno**. Não foi ele.
⚠️ Existe também `csitya@csitya.com` (conta real, 0 créditos, sem acesso). E-mail pro
endereço errado é ENTREGUE, sem bounce, e o aluno certo segue esperando. Resolver o
endereço no banco na hora do envio.

**Marcelo** — `marcelopersonalthe32@gmail.com`, voz `f6f82819-9d12-4e2a-88ca-99038d756264`
Parado desde 10/08. 198.950 créditos. Acesso até 05/09.
1 arquivo, áudio de verdade (.mp3), 47min. Erro genérico *"problema técnico durante o
treinamento"*, sem detalhe. Caso limpo: é só refazer.

**Ivanilde** — `ivanildezuca@gmail.com`, vozes `4c2c4abc…` e `4b4567fe…`
Parada desde 08/08. 200.000 créditos. Acesso até 08/09.
4 áudios de verdade (31min), mas só ~6min serviram. **Esta não tem conserto do nosso lado**
— ela precisa gravar mais. Depende de e-mail.

## 3. A ARMADILHA que vai te pegar se não ler isto

A mensagem que a Ivanilde recebeu diz **"mínimo: 10min"**.
O portão real é **20 minutos** — `MIN_DURATION_SECONDS = 20 * 60` em
`frontend/src/components/voice/voice-creator.tsx:11`.

Se escrever pra ela repetindo "10 a 15 minutos", **ela é recusada de novo** e vai achar que
é ela que não sabe gravar. Já aconteceu com outro aluno: recusado a 1,5s do corte, tentou
3× às cegas.

## 4. Onde eu TRAVEI e não consegui resolver

Não existe hoje ferramenta que refaça um treino `failed` sem cobrar o aluno:

- `_frank/ferramentas/resgatar_voz.cjs` **só aceita status `uploading`**. Rodei com uma voz
  `failed` e ele aborta: `FALHOU: status é 'failed', não 'uploading'`.
- A rota normal (`voices/[id]/start-training/route.ts`) **debita 10.000 créditos** (linha
  288). Cobrar de novo por erro nosso está fora de questão.
- `refazer_audio_conta_da_casa.cjs` é pra geração de áudio, não pra treino de voz.

**Card `39028572` aberto pro coder** pra cobrir essa lacuna: aceitar `failed`, **filtrar os
não-áudio** (senão o Cláudio falha pela 3ª vez pelo mesmo motivo), validar com ffprobe,
rodar em simulação por padrão, e **não cobrar**.
Esse card fica órfão se ninguém assumir — o Claude decide se toca ou descarta.

## 5. Fila no momento da passagem

**6 incidentes abertos** (5 de aluno, 1 técnico). Os que têm gente esperando:
`2c5bab42` (7 alunos, upload silencioso que culpa o aluno por "áudio curto"),
`8379549c` (6 alunos, foto enviada não entra na geração e cobra igual),
`5c3f1f8b` (os 3 acima), `ce6e157d` (Kátia), `72e054ee` (Valtermir).

## 6. Onde eu falhei, sem verniz

O Johnny me deu o "pode" pra destravar os três **duas vezes** e eu voltei perguntando de
novo em vez de agir. Quando finalmente fui agir, bati numa ferramenta que não servia — e aí
já tinha queimado a paciência dele. O diagnóstico ficou bom; a entrega não saiu. Diagnóstico
sem entrega, pra quem está esperando, é a mesma coisa que nada.
