# Ronda das falhas — 21/09 ~11h45Z

Ronda dentro da janela do turno (08h–23h BRT). Alvo serial: **#15 `d3d8d1b2`**,
o incidente **mais antigo da fila** (nasceu 30/07, 53 dias).

**Fechei 1 incidente (#15, `fixed`) e escrevi para 1 aluno que a casa tinha
esquecido.** Nenhum código foi para produção nesta ronda.

Ordem de 29/08 respeitada: nada da planilha foi lido, escrito ou reprocessado.
Canal: os dois fatos consumados saíram **no grupo** (`notify-grupo.sh`), nada no
privado.

---

## 1. Passos fixos

**Reconciliação dos envios** (passo fixo desde 18/09):

| | |
|---|---|
| lidas da pasta `Sent` | 901 |
| já tinham linha | 824 |
| fora da janela (`--corte`) | 77 |
| **RECUSADAS (defeito)** | **0** |
| **escrituráveis dentro da janela** | **0** |

Fecha 901 = 901. Instrumento independente (`enviados_x_tabela.cjs`): **0 carta
depois do corte** sem linha, veredito **PASSIVO**. As 77 anteriores a 14/09
14:06:31Z continuam sem decisão (inalterado desde 18/09).

**Fila:** 93 abertos (nota: o `idade_dos_abertos` conta 93; a contagem da ronda
das 11hZ dizia 96 — a diferença são os fechamentos desde então). 40 com 7d+.

---

## 2. #15 — o mais antigo da fila. Estava fechado na prática e ninguém tinha fechado

O cartão estava `investigating` com uma nota de 28/08 dizendo *"FECHADO com
prova"*. Ou seja: **o trabalho tinha sido feito e o cartão ficou aberto.** Ele
reincidiu 2 vezes em 04/09 (17 → 19 ocorrências) e desde então ninguém voltou.

### 2.1 A instrumentação que a ordem de 20/08 pediu EXISTE, e eu li o resultado

A ordem de 20/08 dizia: *"se VOLTAR, reabra e instrumente o handler pra logar em
QUAL fase o chunk pendura (download da ref? whisper do QA? geração?)"*.

Isso foi feito em 28/08 (PR #91) e **eu não precisei instrumentar nada — precisei
LER**. Das 19 gerações com `executionTimeout`, as 2 de 04/09 são as únicas
posteriores ao PR, e uma delas gravou a fase:

```
a07e9278  fase = {"fase":"inference.chunk.generate","job_type":"inference","running_s":4.9}
86254b30  fase = {"fase":"(sem fase instrumentada)","running_s":null}
```

**Resposta parcial à pergunta de 20/08:** na amostra que capturou, pendura na
**geração do chunk** — não no download da referência, não no whisper do QA.
Uma amostra de duas. Não é causa raiz.

### 2.2 Prova de que o fix está no ar — dado de produção, não leitura de repo

O manual avisa que *"DDL commitado não é DDL aplicado"* e que *"card completed
não significa em produção"*. Então não conferi o repo: conferi o **banco**.

- `request_attempts = 2` nas duas ocorrências de 04/09 → o retry automático do
  **PR #89 rodou**, e a **migration 99 está APLICADA** (li a coluna).
- `qa.fase_corrente` preenchido → a telemetria do **PR #91 rodou**.

Código que roda e grava no banco de produção é a forma mais forte de prova
disponível. Não dependi de nenhuma nota.

### 2.3 Controle do zero — a armadilha que eu mesmo pisei hoje de manhã

Às 11hZ eu transformei "a fonte não existia" em "não aconteceu". Não repeti:
antes de afirmar que a falha parou, medi o **volume**.

| janela | gerações | timeouts |
|---|---|---|
| 07/08 → 24/08 | 1.814 | 9 |
| 24/08 → 04/09 | 974 | 3 |
| **05/09 → 21/09** | **1.206** | **0** |

16 dias limpos com volume saudável. Antes reincidia ~2x/semana. **O zero é
real**, não é ausência de tráfego.

### 2.4 Aluno: 2/2 estornados, 2/2 de volta gerando

Conferido por `ref_type='generation_refund'` — **nunca por `kind`**, que grava
`extra_purchase` e engana (armadilha medida que quase pagou 13 alunos em dobro):

| aluno | estorno | quando | gerações depois |
|---|---|---|---|
| debbie994 | +1.307 | 20:56Z (20min) | 7, todas `ready` |
| renanjuste.business | +749 | 21:04Z (17min) | 13, todas `ready` |

**Ninguém ficou travado e ninguém perdeu dinheiro.**

---

## 3. O defeito lateral que eu achei no caminho — e que era o único dano vivo

As duas vítimas falharam **na mesma noite, com 11 minutos de diferença**. Fui
conferir se tinham sido avisadas.

**As tabelas de aviso não podiam responder isso**, e essa é a lição da ronda
anterior aplicada na prática: `avisos_enviados` e `emails_enviados` nascem em
**2026-09-14T14:06**. Para um caso de **04/09**, zero nelas é **zero CEGO**.

A fonte que cobre 04/09 é a pasta **`Sent`** do IMAP, que é remota e sobrevive a
checkout. Escrevi a ferramenta que faltava para perguntar isso direito:

`_frank/ferramentas/2026-09-21_cartas_para_o_aluno.cjs` — busca por destinatário
na pasta remota, só `EXAMINE` (nunca `SELECT`, não toca flag, a Fast não
"consome" a carta), tripwire recusando verbo de escrita do IMAP, e o texto de
saída **declara o alcance do veredito** (não cobre WhatsApp, chat do app nem
outra pasta), para o zero dela não virar a próxima armadilha.

Resultado:

| aluno | carta na época |
|---|---|
| debbie994 | **uid 1041**, 04/09 23:11Z — *"Seu audio de hoje falhou por um limite nosso - e voce nao foi cobrada"* |
| renanjuste.business | **nenhuma** |

**O aviso dessa classe é MANUAL e falhou 1 de 2 vezes.** Não abri cartão novo:
a classe parou de disparar há 16 dias e não há vítima nova — cartão sem vítima
é fila que cresce sem ninguém sofrendo. Fica anotado aqui e na `resolution_note`.

### 3.1 Escrevi para o Renan (regra 8 — carta individual, decido sozinho)

Assunto: *"Seu audio de 4 de setembro falhou por um limite nosso - e os creditos
voltaram"*. Chave `d3d8d1b2-timeout-renan`, bcc `suporte@`, **cópia CONFIRMADA na
pasta de enviados, uid 3070**, registrada em `emails_enviados`.

Liderei pelo erro: a primeira coisa na carta é o reconhecimento de que a outra
pessoa daquela noite foi avisada e ele não. Confirmei os 749 créditos de volta,
expliquei que não foi o texto nem a voz dele, e **não prometi certeza que não
tenho** — escrevi que a causa de fundo ainda não foi inteiramente nomeada.

### 3.2 Uma imprecisão que eu decidi NÃO corrigir

A carta da debbie994 atribuiu a falha a *"texto acima de 1.200 caracteres"* e
ensinou a dividir o texto em partes. Isso **contradiz a medição do próprio
cartão** (24/08: 78 chars ficou 1.812s, sem correlação com tamanho) — quem
escreveu generalizou do caso dela, que tinha 1.307 chars.

Não reescrevi: o conselho é inofensivo, ela está gerando normalmente desde
então, e o defeito está extinto. Uma carta hoje dizendo *"aquilo que te
explicamos há 17 dias estava impreciso"* confunde mais do que corrige.
**Decisão consciente, registrada para não parecer descuido.**

---

## 4. Por que `fixed` e não `ignored` — e o que NÃO está resolvido

`fixed` porque houve conserto real, no ar, provado no banco, com a reincidência
extinta e o aluno coberto. Não é o caso (4) de erro do usuário.

Mas a regra 14 continua inteira, então o que **não** foi feito está escrito na
`resolution_note` como condição de reabertura:

> **A causa de fundo do hang segue sem nome.** A telemetria pegou a fase em 1 de
> 2 amostras e a observação de dias que a ordem de 20/08 pedia nunca aconteceu,
> porque o defeito parou antes. Se reincidir: leia `qa.fase_corrente` da geração
> nova **antes** de qualquer hipótese; o próximo passo é watchdog por chunk.

Fechar isto como "causa raiz resolvida" seria exatamente o `done` falso que o
manual proíbe. **Está fechado porque parou de machucar, não porque foi
entendido** — e o cartão diz isso com todas as letras.

---

## 5. O que eu errei nesta ronda

**Escrevi um script com segredo e canal de saída fora do repositório** (`/tmp`)
para consultar o IMAP, e o guard do FrankClaw barrou, corretamente. O reflexo
certo já estava na casa: ferramenta que fala com o IMAP **mora em
`_frank/ferramentas/`**, versionada, com o cabeçalho explicando por que existe.
Refiz do jeito certo e a ferramenta ficou — que é justamente o que faltava para
a próxima ronda não repetir a pergunta.

**Errei também um parágrafo da carta na primeira escrita** (embaralhei o horário
do estorno: escrevi "17h04 do dia seguinte" onde era "18h04 do mesmo dia"). Peguei
no `--dry-run` e corrigi antes de enviar. É exatamente para isso que o ensaio
existe — e-mail não tem desfazer.

---

## 6. Passo fixo de fim de ronda

Conferência de branch preso na seção de commit. **Código de produção nesta
ronda: nenhum.** O que vai para a `main` é este registro + a ferramenta nova de
leitura (`2026-09-21_cartas_para_o_aluno.cjs`), que é instrumento de ronda, não
código de produto.
