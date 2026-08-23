# 23/08 ~15h UTC — Rotina das Falhas (dono da fila)

`git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido. Valem a `2026-08-20_dono_da_fila_e_fila_zerada.md` (⭐) e
a `2026-08-21_passagem_incidentes_para_claude.md`. Método serial e comunicação
pela ordem de 21/08 (`fd0b0f5`).

**Peguei UM incidente e levei até o meu limite. Não abri um segundo.**

---

## Placar

| | |
|---|---|
| Incidentes na fila no início | 5 (`ce47c3b9`, `7963388e`, `60f3e9e2`, `bc8f234a`, `a2b528a4`) |
| Peguei | **1** — `ce47c3b9` (Rafael), o mais antigo com aluno afetado |
| Fechei | **0** — motivo na seção 5 |
| Incidente novo aberto com medição | **1** — `97` / `03495040` (drift do Vídeo Clone) |
| Aluno avisado | **1** — Rafael, e-mail enviado |
| Escalado com nome e canal | **1** — dinheiro + decisão de produto (Johnny, `message_id 314`) |
| Crédito que eu mexi | **nenhum** |
| GPU que eu gastei | **nenhuma** |

---

## 1. Por que escolhi o `ce47c3b9`

Regra 8: o mais antigo aberto com aluno afetado. `ce47c3b9` é de **21/08 21:30**,
os outros são de 22/08 e 23/08. Sem empate a desempatar.

Peso extra que confirmou a escolha: `last_seen_at` de **hoje 13:10** e o aluno
**respondeu de novo hoje 10:03**, ou seja, a resposta de 22/08 **não resolveu**.
É pagante ativo (acesso até 03/09), e no próprio texto ele diz que está avaliando
se a plataforma atende. Aluno esperando vem antes da limpeza da fila.

---

## 2. O que eu medi (arquivo baixado do R2 + ffprobe/ffmpeg, não é leitura de tela)

**Item 2 do chamado dele (o vídeo muda do início pro fim): ELE ESTÁ CERTO.**

Baixei o vídeo `ac9a73eb` dele (86,1s, tier `480p-v3`, 2153 frames a 25fps) e a
foto base `416bda74`. Extraí frame de 0,4s e de 85,5s. O rosto do fim **não é o
da foto base**: pele plastificada e a barba vira um **artefato enrolado que não
existe no original**. As prints que ele mandou estavam corretas.

Para não parar num caso só, amostrei mais 4 vídeos de **outras contas**:

| amostra | duração | tier | drift início→fim |
|---|---|---|---|
| controle | 9,9s | 480p-v3 | **nenhum** perceptível |
| A | 79,4s | 480p-v3 | leve (pele alisada, cabelo) |
| B | 81,6s | 480p-v2 **Turbo** | visível (barba muda de formato) |
| C | 90,6s | 480p-v3 | visível (cabelo e barba) |
| Rafael | 86,1s | 480p-v3 | **severo** (artefato na barba) |

**4 de 4 vídeos longos têm drift; o controle curto não tem.** O defeito escala
com a duração do áudio. Acontece **nos dois tiers**.

Isto é a **primeira medição** deste defeito. A ordem de 20/08 (item 2 do "o que
sobra") e a ronda das 11h de hoje registram que ele nunca tinha sido medido.

**Exposição** (`video_clones` `status=ready`): faixa **>60s = 370 vídeos, 174
alunos, 3.593.170 créditos**, a mais cara do produto. Teto de áudio hoje é 90s
(`CLONE_MAX_AUDIO_SECONDS`), então vendemos até exatamente a faixa que mede pior.

Abri o incidente **97** (`03495040`) com método, resultado e exposição.

---

## 3. Dois erros NOSSOS que a medição expôs

**(a) A orientação de 22/08 estava errada.** Dissemos ao Rafael que usar o
**"modelo Turbo"** era um dos ajustes que mais reduzem a diferença. Medido hoje:
o Turbo (`480p-v2`) **também faz drift** (amostra B), e o blurb dele em
`frontend/src/lib/video-clone/config.ts` diz literalmente *"cada geração varia um
pouco"*. Ele já estava no `480p-v3`, o mais estável dos dois. Seguir a orientação
custaria **outra geração paga para ficar igual ou pior**. Corrigido com ele por
escrito.

**(b) A resposta de 22/08 do item 1 não batia com o estado da conta dele.** Ela
dizia que *"o quadro segue apontando pra referência anterior"*, mas o
`profiles.image_ref_key` dele é **NULL** — não existe referência anterior. Por
isso a orientação não fez sentido pra ele e ele voltou dizendo que fez o que foi
pedido e não resolveu.

A resposta certa do item 1 é o botão **"Trocar foto"**, no canto inferior direito
do quadro "Imagem de referência" (`image-studio.tsx:794`). Existe e funciona.

---

## 4. O que eu fiz (fato consumado, não plano)

- **Escrevi pro Rafael.** SMTP do suporte@, bcc suporte@, enviado ok. Endereço
  conferido no banco e **checado contra homônimo** (a armadilha do Cláudio):
  existe **uma** conta com esse e-mail, sem segunda conta parecida.
  No e-mail: que ele está certo e a medição que fiz **no vídeo dele**; a
  **correção do erro do Turbo**, com desculpa explícita; o caminho real do item 1
  (botão "Trocar foto", o aviso "Suas fotos novas estão fora desta geração" com o
  botão "Usar a foto nova no quadro", e que a conta dele está sem foto principal
  então a próxima já entra no quadro); e que **não vou dar prazo** porque ainda
  não sei se tem conserto do nosso lado. **Não prometi valor nenhum.**
- **Escalei pro Johnny** (`message_id 314`): a pergunta binária do dinheiro
  (24.360 cr) e a decisão de produto da faixa >60s. Repeti que os PR #16 e #29
  seguem parados sem review.
- **Anotei o `ce47c3b9`** (`anotar_incidente.cjs --confirmar`, conferido na
  releitura: **1 linha afetada**, `agent_notes` 1 → 2, status `open` →
  `investigating`).
- **Abri o `97`** com a medição (conferido: `returning` devolveu numero 97).

---

## 5. Por que NÃO marquei `fixed`

- O **defeito de produto do item 2 segue vivo** e eu não sei se tem conserto
  nosso (pode ser limite do InfiniteTalk em janela longa). Está no `97`.
- A **decisão de crédito é do Johnny** e foi escalada hoje.

Fechar como "chamado atendido" com o defeito de pé foi **exatamente** o que
fizemos em 22/08 (a nota de então diz "o chamado DELE está atendido, mas o
defeito de produto continua") — e foi o que trouxe ele de volta mais irritado,
dizendo "descaso". Não repito. `investigating` **com nota** é o que a regra manda.

---

## 6. O que eu descartei, para ninguém refazer

**Suspeita de cobrança dupla no extrato do Rafael, descartada.** Dois débitos de
**−1320** (`image_video`) no **mesmo `ref_id` `ba1cd389`**, com 5min18 de
intervalo, em 15/08. Parecia cobrança dupla. Fui conferir: a row de
`image_generations` **foi deletada**, e isso é o padrão de **débito órfão** já
medido como **NORMAL** na ordem de 20/08 (o DELETE do histórico apaga row + R2 e
deixa o ref pendurado). **Não é cobrança indevida. Não estornei nada.**

Também **não** tratei como bug os 5 uploads de mp3 de tamanho idêntico na pasta
dele: são 5 uploads para 3 vídeos gerados, e ele foi cobrado **3 vezes, por 3
vídeos**. Confere.

---

## 7. O que eu NÃO fiz, de propósito

- **Não mandei a imagem comparativa pro Telegram.** É o rosto de um aluno, e a
  regra de canal proíbe dado que identifique aluno sem necessidade. A evidência
  ficou em `_Bugs/rafael/` (fora do git, confirmado com `git check-ignore`).
- **Não mexi no `CLONE_MAX_AUDIO_SECONDS` nem no worker.** É decisão de produto e
  de deploy do Johnny.
- **Não subi o fix de visibilidade do "Usar como referência"** (hoje é um rótulo
  de **9px** no rodapé da miniatura). Seria um 3º PR parado numa fila que já tem
  dois sem review há 3 dias — não vira produção e vira ruído. Registrado no
  chamado.
- **Não abri os outros 4 incidentes da fila.** Regra 8.
- Não toquei em crédito, não gastei GPU, não rodei migration, não mexi em cron.

---

## 8. Buracos que continuam abertos (não conte como saudável)

- **`7963388e` (Kessuly)** segue esperando o veredito de ouvido humano e a
  decisão dos 9.240, ambos pedidos na ronda das 11h. Não é bloqueio meu, mas
  ninguém respondeu ainda.
- **PR #16 e #29 parados** (3 e 2 dias, sem review). O #16 é a cura da referência
  cortada, que o próprio PR estima em **1 em cada 3 vozes novas**. Cada dia
  parado é mais voz nascendo com defeito.
- **`/tmp` a 7,5G de 16G** (tmpfs, em RAM). Foi o que matou a ronda do Vigia das
  14h ("cota do /tmp estourada", `d0a8485`). Está em 49% agora e não travou nada
  nesta ronda, mas o problema é de máquina e ninguém dono.
- **Os 4 pagantes sem voz** (jRF, Leandro, Ivanilde, Marcelo). **jRF tem acesso
  até 25/08 — dois dias.** Avisados em 21/08, não voltaram.
- **`acf8acd6`** — sexta ronda sem confirmar produção de `74ae65a`/`1e5a893`.
  Não foi meu foco e não vou fingir que olhei.

---

## 9. Higiene do repositório

Continuam **não commitados** na `main`, de rondas anteriores (**não são meus, não
toquei**): `_frank/ferramentas/resgatar_voz.cjs` e
`_frank/ferramentas/2026-08-21_medir_8379549c.cjs`. Já são 3 rondas com esses dois
pendurados — ou alguém termina, ou deveriam sair do caminho.

Investigação desta ronda em `_Bugs/rafael/` (fora do git). Commitei **apenas este
arquivo**, por caminho explícito.
