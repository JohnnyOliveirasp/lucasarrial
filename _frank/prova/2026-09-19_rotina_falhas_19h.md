# RONDA DAS FALHAS — 19/09, ~19hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_18h.md`.

**Método serial (regra 8):** peguei **UM** cartão — o `#344`, próximo da lista de
abandono que as 18hZ deixaram pronta — e o levei até onde ele podia ir nesta
ronda. Ele **não fechou**, e o §3 explica por que fechar seria repetir um erro
que já foi cometido neste mesmo cartão.

**O achado desta ronda:** o aluno já tinha declarado, com as próprias palavras,
que o problema estava resolvido — e a medição mostra que **o teste dele não
tinha como revelar o defeito**. É o primeiro caso medido em que o "está bom" do
aluno é tão frágil quanto o "coverage subiu" da casa.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
748 lidas da pasta "Sent" = 671 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`),
instrumento independente: **0 carta depois do corte**, veredito "buraco é
PASSIVO".

Pasta **737 → 748** desde as 18hZ; tabela **660 → 671**. As 11 do intervalo já
nasceram com linha — o controle compensatório segue funcionando. O registro
local segue inexistente nesta máquina (é gitignored), que é precisamente a razão
de a reconciliação ler o IMAP e não o ledger.

As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** — decisão de produção,
não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | 18hZ | 19hZ |
|---|---|---|
| fixed | 289 | 289 |
| investigating | 83 | **82** |
| ignored | 60 | 60 |
| aguardando_aluno | 34 | **35** |
| open | 1 | 1 |

O único movimento é meu: o `#344` saiu de `investigating` para
`aguardando_aluno`.

### 1.1 Classe "precisa ver / ouvir" (ordem de 17/09) — ELA CRESCEU

**14 cartões**, o mais velho com **18,0 dias** (`702cc916`, 01/09).

Em 17/09 a ordem registrou **13 cartões, o mais velho com 16 dias**. Dois dias
depois são **14** e o mais velho ganhou os 2 dias que o calendário deu. Ou seja:
**a classe não está sendo drenada, está acumulando** — nenhum dos 13 antigos
saiu, e entrou mais um. O número está aqui como a ordem manda, com a idade do
mais velho, para que silêncio nessa classe não pareça saúde.

Esta ronda tirou **1** de lá (o `#344`, §2). Restam 13.

---

## 2. `#344` — despachei a percepção e o cartão saiu de 9 dias de limbo

`b6486347` · aberto **10/09 13:55Z** · aluno **Gustavo Sperandio**,
`gusperandio2@gmail.com` · queixa: áudio **acelerado e sem entonação**, com o
texto já bem pontuado.

### 2.1 Por que estava parado

O passo que faltava estava escrito, em letras claras, na nota do EXECUTOR de
10/09: *"Não ouço áudio: a validação final precisa de humano/instrumento."*
Nove dias depois, ninguém tinha ouvido. É exatamente o padrão que a ordem de
17/09 proibiu. **Despachei.**

### 2.2 O aluno não esperou parado — ele se virou, pagando

Em **17/09 14:35** o Gustavo treinou uma voz nova (**"Rogério Balbinot - v3"**,
`772368e0`) gastando **10.000 créditos dele**, e rodou 3 gerações (400 cr cada).
A v3 nasceu com `reference_cut_mode='snap_ok'` (a cura por palavra do `#233`, já
em produção) e `speech_rate_wps=2,83` gravado.

Num dos testes ele digitou, no próprio gerador: **"Olá, agora sim me parece
melhor o teste."**

Não afirmo que ele retreinou **por causa** do nosso defeito. Afirmo que
retreinou, que gastou 10.000 créditos, e que o resultado melhorou.

### 2.3 O que o ouvido disse (percepção despachada ao `olho`)

Baixei 5 áudios do R2 e mandei para o `olho`, que escuta. Veredito: a **v1** sai
acelerada, com timbre metálico e entonação plana; a **v3** sai com ritmo
natural, entonação natural e nada engolido. **Converge com o instrumento na
direção.**

⚠️ **Ressalva registrada para não virar armadilha nova.** Os **números** que o
`olho` reportou (pal/s e F0 em Hz) **não fecham com aritmética conferível**: ele
disse 3,10 pal/s para um áudio de 156 palavras em 46,08s (3,386 bruto / 3,888
falando), e 2,11 para um de 9 palavras em 3,13s falando (2,876). Usei o veredito
**qualitativo** dele; todos os números deste cartão vêm do
`medir_pausas_da_entrega.cjs`, que é ffmpeg + whisper de verdade.
**Lição: modelo que ouve serve de OUVIDO, não de RÉGUA.**

### 2.4 A queixa dele estava certa, e tem número

| geração | articulação |
|---|---|
| `66fcfc56` (v1, 818 ch — o que ele reclamou) | **3,888 pal/s** |
| `1425ca2f` (v1, a que a casa chamou de "CORRIGIDA" e ele refutou) | 3,357 pal/s |
| `dda955db` (v3, o teste "agora sim melhor") | **2,872 pal/s** |

**Régua:** a velocidade real **da pessoa**, medida pelo nosso próprio treino a
partir das gravações dele, é **2,83 pal/s** (`voices.speech_rate_wps` da v3).

> A entrega que ele reclamou saiu **~37% mais rápida que a fala real dele.**

Não era pontuação — e a Fast sugeriu a ele *"adicionar vírgulas e pontos"* em
10/09 16h45, **depois** de ele já ter dito que o texto estava bem pontuado.

**Dois controles antes de usar esse 37%,** porque comparar duas réguas
diferentes seria inventar o número:

1. **Mesma definição?** Sim. `voice_pipeline/pacing.py:130` documenta
   `measure_speech_rate_wps` como *"articulação, não ritmo bruto"*, com pausas
   **≥150ms descontadas** — mesma definição e mesmo limiar do medidor de
   entrega. Apples-to-apples.
2. **2,83 é medição ou constante?** O comentário do próprio `pacing.py` cita
   2,83 como o valor **errado** do caso Ellen, o que obrigava a conferir.
   Medido: **440 vozes** com `speech_rate_wps` não-nulo, **177 valores
   distintos**, faixa 1,83–4,44, média 2,817, e o valor mais repetido aparece em
   só 10 vozes. **2,83 é medição real do Gustavo**, não constante. Coincidência.

### 2.5 >>> POR QUE NÃO FECHEI — o teste dele não poderia ter revelado o defeito

Medido com a função de produção (`runpod-worker/tts_text.py`,
`split_text_for_tts`, `max_chars=160`):

| texto | chunks | emendas |
|---|---|---|
| o roteiro de 818 ch que ele reclamou | **10** | **9** |
| os 3 testes dele na v3 (39, 50, 50 ch) | **1** cada | **0** |
| a amostra automática do treino (97 ch) | **1** | **0** |

A causa de classe que o Vigia mediu em 10/09 22hZ é a emenda **entre** chunks:
`jobs/tts_settings.py:236` tem `silence_ms` default **"0"** e
`voices.tts_silence_ms` é **NULO em 1260 de 1260 vozes** — a v3 também nasceu
nula, conferi.

**Num texto de 1 chunk não existe emenda, logo o defeito não tem como
aparecer.** O "agora sim me parece melhor" foi medido justamente no único
formato onde o defeito é **estruturalmente impossível**. O caminho de 10 chunks
**nunca foi rodado na v3**.

Fechar aqui seria repetir o erro de 10/09 — fechar pela métrica que subiu e não
pela queixa que existe. O Vigia já me pegou nisso **neste mesmo cartão**, às
20hZ de 10/09, e ele estava certo. Não repito.

### 2.6 Entregue

Carta enviada 19/09, pasta Enviados uid **2917**, registrada em
`emails_enviados` (origem `ronda-manual`). Contei: que ele estava certo e a
culpa não era do texto dele (com o número); que a v3 melhorou de verdade; que eu
**não** posso dizer que resolveu, porque os testes dele eram de 1 pedaço e o
roteiro real vira 10; que basta responder **"pode rodar"** que a casa roda o
roteiro completo dele na v3 **sem debitar crédito**; e a alavanca
Natural/Média/Longa. Pedi desculpa pelos 9 dias.

Cartão → **`aguardando_aluno`** (não `fixed`). Nota de 5.969 chars conferida na
releitura: 10 notas, array preservado.

### 2.7 Não gastei GPU, deliberadamente

Rodar o texto de 818 ch na v3 é **o teste que fecha este cartão** — e é GPU. A
regra é não gastar sem o aluno pedir, então a carta **pede o aceite dele**.
Quando ele responder *"pode rodar"*: `refazer_audio_conta_da_casa` na v3
(`772368e0`) com o texto de `66fcfc56`, medir com `medir_pausas_da_entrega.cjs`
e comparar a articulação contra **2,83**.

### 2.8 Dinheiro

Conferido pela regra canônica (`ref_type='generation_refund'`, **nunca** por
`kind`): o estorno de **+1.269** de 10/09 14:25 segue único, as gerações por
conta da casa não debitaram, e não há cobrança nova ligada ao caso. Saldo dele
hoje: **177.175** créditos.

**Não estornei os 10.000** do retreino: ele escolheu retreinar e levou uma voz
melhor disso. Se a casa deve ou não esse crédito é **decisão do Johnny**, não de
ronda — foi para o grupo.

---

## 3. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 748 = 748, 0 escrituráveis, conferida por
   instrumento independente.
2. **Percepção despachada** no `#344` (5 áudios ao `olho`) — a classe da ordem
   de 17/09 perdeu 1 de 14.
3. **Causa medida com número e com dois controles**: entrega 37% acima da fala
   real do aluno.
4. **`#344` → `aguardando_aluno`**, com nota do que foi medido e do que falta.
5. **Uma carta a aluno** — Gustavo (`gusperandio2@`), Enviados uid **2917**.
6. **Duas linhas no grupo** — a carta e a decisão dos 10.000 créditos.

## 4. O que eu NÃO fiz

- **Não fechei o `#344`.** O caminho de 10 chunks na v3 não foi testado.
- **Não gastei GPU nem crédito**, e não estornei os 10.000 do retreino.
- **Não mergeei nada.** PRs **#351**, **#355** e **#356** seguem abertos.
- **Não reabri** o `#396` nem o fechei — o PR #356 continua aberto.
- **Não abri chamado** para a classe da pausa: é decisão do Johnny desde 24/08,
  e a ordem de 27/08 manda decisão ir pro Johnny, não virar chamado.
- **Não toquei** em migration, assinatura nem acesso de ninguém.
- **Não decidi o backfill das 77 cartas** do #101.
- **Não li a caixa do suporte@ para triagem.**
- **Nada da planilha** (ordem de 29/08).

## 5. Para quem pegar a próxima ronda

1. **A classe "precisa ver/ouvir" está crescendo: 14, mais velho com 18 dias.**
   Sobraram 13. Despachar é barato — este cartão levou uma ronda depois de 9
   dias parado. O mais velho é `702cc916` (01/09, `contato@fotoatleta.com`).
2. **Se o Gustavo responder "pode rodar"**, o roteiro está no §2.7. Se ele disser
   que ficou bom **sem** rodar o texto longo, **não feche assim mesmo** — o §2.5
   explica por que o "está bom" dele ainda não cobre o caso dele.
3. **"O aluno disse que está bom" agora tem a mesma fragilidade que "o coverage
   subiu".** Antes de aceitar, pergunte **em que formato** ele testou. Terceiro
   caso da família (`#334` e `#347` foram carta-de-outro-assunto; este é
   teste-que-não-alcança-o-defeito).
4. **Modelo que ouve é ouvido, não régua.** O `olho` acertou o veredito e errou
   todos os números (§2.3). Use-o para julgar, meça com instrumento.
5. **Próximos por abandono** (lista das 17hZ, já descontado o `#344`): `#348`
   (ellen.atp@, 8,8d), `#357` (luminous.assessoria@, 8,0d), `#343` (welrisson@,
   8,0d), `#358` (mcpaganatto@, 7,9d).
6. **Quando o PR #356 mergear, feche o `#396`** — confirmando em produção por
   md5, não pelo Action verde.
