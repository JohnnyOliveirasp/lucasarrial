# Ronda das falhas — 20/09, ~14h20–15hZ (Frank)

Item serial: **#367 / `89473013`** (Alexandre Akira Kumagai,
`alexandre@novaconexao.com`) — o aberto **mais parado com aluno nomeado**, 7,8
dias sem ninguém encostar. Levado até o fim pela regra 8 e fechado como
`fixed`.

**O achado da ronda é a causa da parada, e ela desmente a conclusão da ronda
das 14h:** o cartão delegou para dois destinos e **gravou os números
corretamente** — e mesmo assim virou órfão, porque o Mission Board **apaga o
destino em 7 dias por desenho**. Detalhe no §2.

Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito, classificado
ou reprocessado. Canal: ordem de 31/08 — mensagens no **grupo**
(`notify-grupo.sh`). Nada no privado do Johnny.

## Placar

- Fila: **90 → 88 abertos** (1 fechado `fixed`, 1 movido para `aguardando_aluno`).
- Fechados `fixed`: **1** (#367), `resolution_note` de 1.150 chars, 4 notas.
- Alunos respondidos: **0** — e isto é decisão, não omissão (§5).
- Crédito devolvido: **0** — não havia nada a devolver (§5).
- Passo fixo dos envios: **848 lidas, 0 carta fora da tabela** depois do corte.
- Percepção travada: **1** pelo instrumento (era 2) · **15** pela consulta crua
  da ordem de 17/09 (era 16), mais velho **18,9d** (`702cc916`).
- Cartões abertos: **3** (`a76c032d`, `89d3655e` para o `coder`; `d1689453`
  para o `olho`, já concluído).

---

## 0. Passos fixos, antes de qualquer coisa

**Reconciliar os envios** (`--corte=2026-09-14T14:06:31Z --confirmar`): **848**
cartas lidas da pasta `Sent`, 771 já tinham linha, 77 fora da janela do corte,
**0 escrituráveis, 0 recusadas**. A contagem fecha (848 = 848).

O instrumento independente (`2026-09-18_enviados_x_tabela.cjs`) dá o veredito
**"0 carta depois do corte"**. Buraco segue **passivo**.

(Ronda das 14h: 845 lidas / 768 com linha. **+3 cartas, todas já com linha.**)

As **77 anteriores a 14/09 14:06:31Z** seguem sem decisão, como o README manda.

**Percepção travada**, os dois números, sem escolher o menor: instrumento **1**,
SQL cru **15**. Os dois caíram em 1 porque eu tratei o #473 (§6) — não porque a
classe melhorou sozinha.

---

## 1. Por que este cartão

Critério da regra 8: **o mais antigo com aluno afetado**, medido por "há quanto
tempo ninguém encosta" (última nota), que é a prática que a ronda de 14/09
firmou — idade bruta põe no topo os cartões travados em decisão do Johnny.

O topo da lista com aluno nomeado era o **#367**, 7,8d parado. O segundo era o
`86de22c6` (Simone, 7,7d) — **li e descartei de propósito**: ele está travado em
(a) decisão de devolução, que por ordem permanente do Lucas é da equipe da Liz,
e (b) acesso a uma conta que a nossa API não enxerga (os R$ 975,40 entraram
fora do nosso checkout). A aluna já foi respondida com a verdade em 12/09 e os
comprovantes dela já foram abertos e conferidos. É **bloqueio declarado e
legítimo**, não parada minha. Mexer ali seria fingir movimento.

---

## 2. O achado: o destino existia, foi gravado, e o sistema apagou

A nota de 12/09 do #367 fez tudo certo pelo padrão que a ronda das 14h propôs:
delegou e **gravou os números** — `d046544e` (medição) e `7cf9d897`
(instrumentação), mais `77354ee2` (quem entregou a medição das 50 vozes).

**Os três não existem.** Varri os 483 incidentes: não são incidentes. São
cartões do **Mission Board** — e o board apaga:

```
cleanupOldMissionTasks  (FrankClaw/src/db.ts:2504)
  DELETE FROM mission_tasks
   WHERE status IN ('completed','cancelled','failed') AND completed_at < cutoff
  olderThanDays = 7
chamado em src/index.ts:164-165, no boot e a cada 24h
```

Conferido no banco: `mission_tasks` tem **180 linhas** e a mais antiga é de
**13/09 13:21Z** — janela de exatamente **7,0 dias**. Os três cartões são de
12/09: um dia fora.

**Isto corrige o achado da ronda das 14h.** Aquela ronda mediu "10 dos 90
abertos prometem outro cartão sem registrar qual" e concluiu que a correção é
de processo: *quem delegar, grava o número do destino*. O #367 prova que **isso
não basta** — aqui o número foi gravado e evaporou junto com o destino. O que
sobrevive é o que estiver escrito **dentro do incidente**. A ronda de 12/09 já
tinha intuído isso ("achado que só vive em cartão do Mission Board ninguém lê
na ronda seguinte") e copiou o achado pra dentro do cartão; foi essa cópia que
salvou o contexto e permitiu fechar hoje.

Cartão **`a76c032d`** aberto pro `coder`, pedindo proposta (não conserto
direto): parar de apagar o que ainda é referenciado, e preservar o `result`
antes de apagar a linha.

---

## 3. A instrumentação que o cartão pediu foi entregue

`voices.reference_cut_mode` **existe no banco de produção** — conferida na
lista de colunas da tabela, não em DDL commitado (a armadilha do manual). O
worker escreve em `jobs/train.py:238`; as constantes estão em
`voice_pipeline/reference.py:233-239`; e há teste exigindo os **quatro** modos
distintos (`test_reference_word_snap.py:480`).

**Cobertura**, medida hoje em vozes `ready` não-stock:

| | |
|---|---|
| criadas depois do instrumento (13/09 09:59Z) | **154** |
| com modo | **96** |
| NULL | **58** |

Por dia (com / SEM): `13/09 1/13 · 14/09 1/37 · 15/09 16/7 · 16/09 17/0 ·
17/09 17/0 · 18/09 22/0 · 19/09 17/1 · 20/09 6/0`.

**57 dos 58 NULL caem em 13–15/09**: é a **rampa do deploy**. De 16/09 em
diante a cobertura é 100%, com uma única exceção (§4).

**ERRO MEU, DECLARADO.** Minha primeira leitura foi *"NULL vai até 19/09 e modo
vai até 20/09, logo há dois caminhos de gravação convivendo"*. **Estava
errada.** Quebrar por dia desmontou a hipótese. Registro porque o número cru
(58 NULL, mais recente 19/09) sustentava confortavelmente a conclusão errada, e
eu ia escrevendo nessa direção.

---

## 4. O que o instrumento mede — e a prova de que ele não está travado

Distribuição dos 97 modos gravados: **`{"snap_ok": 97}`**. Zero
`snap_unavailable`, zero `time_retry`, zero `fallback`.

O defeito do cartão era *"não registram qual caminho a voz tomou"*. Hoje
registram, e o que registram é o caminho bom em 97 de 97.

**97/97 num valor só é exatamente o que um instrumento quebrado também
mostraria**, então fui procurar a refutação. Ela existe: a única voz `ready` sem
modo depois da rampa é `d1ff6f1a` (19/09, `mireconect@gmail.com`), e o motivo é
material — o `reference_transcript` dela é **nulo**, e sem transcript não há
snap, então o modo sai `None`. Isso é precisamente o que
`test_train_smoke.py:290-294` **exige** ("tem que sair None, NUNCA um palpite
tipo snap_ok"). O campo **assume outro valor em produção quando deve**.

Voz chegando a `ready` com referência nula é defeito por si só, e não é deste
cartão: **`89d3655e`** aberto pro `coder`. A aluna é **pagante (pro) e o acesso
dela vence 24/09** — está escrito no cartão que, se a resposta for "degrada", eu
preciso saber hoje. **Não escrevi pra ela**: ainda não provei que o transcript
nulo estraga a geração, e as 2 gerações que ela tem são o *preview* pós-treino
(campos de referência nulos, texto canônico), que não servem de prova pra
nenhum dos dois lados.

---

## 5. O aluno nomeado: não há dano, e isso foi medido

`alexandre@novaconexao.com`, voz `d1793844`, treinada 12/09 — a que o título
chama de *"1 confirmado"*.

- **Transcript gravado:** frase **completa**, terminando `"do primeiro
  emprego."` — ponto final, não corte no meio.
- **Áudio** `ref/auto.wav` baixado do R2 nesta ronda: 780.238 bytes, 24,380s,
  `pcm_s16le` 16 kHz.
- **Meu instrumento** (ffmpeg `astats`), **com controle negativo** — silêncio
  puro devolve `-inf`, então o detector enxerga (a armadilha do playbook W:
  instrumento que não prova que vê não mede nada):

```
arquivo inteiro   Peak -8,70 dBFS · RMS -25,74 dB · Flat factor 0,000
últimos 500 ms    RMS -29,16
últimos 300 ms    RMS -38,16
últimos 150 ms    RMS -51,18
```

  Decaimento limpo de ~25 dB até quase silêncio. Corte no meio da palavra
  mantém energia alta até a última amostra; este não mantém.
- **Ouvido independente** (`olho`, despacho da ordem de 17/09, cartão
  `d1689453`): *"emprego"* articulada inteira de 23,40s a 24,12s, ~360 ms de
  decaimento natural até < -50 dB, sem corte seco e sem estalo.

Os dois instrumentos convergem, e **um deles não é opinião de agente** — foi
essa a lição da nota do Vigia de 19/09, que pegou o `olho` errando a contagem
de amostras clipadas.

**Gerações do Alexandre: ZERO**, em qualquer voz. Pagante (pro, acesso até
12/10) e ativo (`last_seen` 19/09). Nunca gerou nada: não houve entrega ruim.

**Não escrevi pra ele, de propósito.** Ele **nunca reclamou** — o cartão nasceu
de leitura de código do Vigia, não de queixa — e a medição diz que a voz está
boa. Carta aqui seria avisar um aluno de um problema que ele não tem. Isto é a
mesma distinção que a ronda das 13h30 aplicou ao Welrisson.

---

## 6. O #473 (Katia): o despacho de percepção já tinha sido cumprido

O `percepcao_travada.cjs` apontou o #473 como travado em percepção, com nota de
**hoje 14hZ** do Vigia pedindo *"alguém OUVIR a gravação dela"*.

**Já tinha sido ouvido — 27 horas antes.** Em 19/09 11:32Z a casa baixou a
gravação, mandou pro `olho`, conferiu com `ffmpeg astats`, **refutou** o estalo
com instrumento (gravação dela Peak +2,83 dBFS clipa; original nosso -0,60 dBFS
Flat factor 0 não clipa), **aceitou** a queixa de ritmo, **refez a geração por
conta da casa** (`b34d72f7`), **estornou** 400 créditos (conferido por
`ref_type` casado com `ref_id`, saldo 176.420 → 176.820) e **escreveu pra ela**
(Enviados uid 2866).

A nota de hoje re-relata como pendente uma caixa que já tinha sido respondida.
**Não é erro do Vigia** — ele lê a caixa, não o histórico do cartão, e por
desenho anota sem decidir (14-A). Mas o efeito é gastar o despacho de percepção
duas vezes no mesmo caso.

Mudei o status para **`aguardando_aluno`**, que é o que ele é desde 19/09: o
cartão espera **a Katia ouvir o refeito e responder**, e isso é espera de aluno,
não falta de ouvido humano. Isso tira o falso positivo do instrumento de
percepção e protege o cartão de ser fechado como `fixed` sem ela responder.

Mantive explicitamente o que a nota de 19/09 decidiu e **não revoguei**:
ninguém retreina a referência por causa do fator 0,866, porque **220 das 272**
entregas da casa caem na mesma faixa — o número dela é o número da casa, e isso
é decisão de produto do Johnny.

**Erro meu nesta gravação, corrigido no próprio cartão:** passei a nota inline
com uma palavra entre crases e o shell a interpretou como comando
(`olho: command not found`), engolindo a palavra **sem erro e sem aviso**. Reli,
achei, e anexei nota de correção. Fica a armadilha registrada: nota com crase
vai por arquivo (`--nota "$(cat …)"`), porque a saída de `$(cat)` não é
reinterpretada — foi por isso que as notas do #367 saíram íntegras (conferido:
6 ocorrências dos termos com crase sobreviveram).

---

## 7. Frota

Usei o `olho` (§5) — despacho de percepção da ordem de 17/09, com o veredito
conferido contra instrumento meu antes de eu acreditar nele.

Os cartões `a76c032d` e `89d3655e` foram despachados pro `coder` e estavam
**`running`** no fechamento desta ronda. **Não esperei o resultado** e **não
estou afirmando nada sobre o que eles vão entregar** — quando entregarem, passam
pelo `gerente` como manda o fluxo.

---

## 8. O que eu NÃO fiz e o que NÃO estou afirmando

- **Não provei** que os três escapes silenciosos nunca mais disparam. Provei que
  agora **deixam rastro** quando dispararem. 97/97 são **5 dias** de produção.
- **Não auditei** os *"24 suspeitos pós-PR#16"* do título um a um. São
  anteriores ao instrumento, e reticência não é prova: das 50 vozes medidas
  contra o áudio em 12/09, **22 estavam OK**. Não curo por palpite.
- **Não abri** o código do gate `_cobertura_do_previsto`. A contenção
  unidirecional levantada em 12/09 segue de pé e é de **outro** cartão; fechar o
  #367 não a resolve.
- **Não provei** que `reference_transcript` nulo degrada a geração da Miriam —
  por isso não escrevi pra ela.
- Não mexi em crédito, acesso, assinatura, plano, tier, preço nem entitlement.
  Não tirei crédito de ninguém (9-A). Não gastei GPU. Não apliquei migration.
  **Não subi código — esta ronda não tem PR**, e não inventei um pra parecer
  produtiva. Não li e-mail não lido pra triagem. Não toquei nos cartões travados
  em decisão do Johnny. **Nada da planilha** (ordem de 29/08).

---

## 9. Fim de ronda

`git fetch origin && git log --oneline origin/main..HEAD` conferido **vazio**
depois do commit deste log. Nenhum branch de feature criado nesta ronda — o
trabalho foi leitura de banco, leitura de código, medição de áudio e decisão de
fila.

Vale repetir o que a ronda das 14h mediu e que **continua valendo**:
`git rev-list --count main..<branch>` **dá falso positivo em toda PR mergeada
por squash**. O teste que decide é o **diff dos arquivos**, não a contagem de
commits.

Esta ronda escreveu: **1 cartão fechado** com a entrega verificada em produção e
o aluno medido como não-afetado, **1 cartão devolvido ao estado honesto**
(#473), **a causa real do órfão identificada com arquivo:linha** — corrigindo a
conclusão da ronda anterior — **1 defeito novo achado pelo próprio instrumento**
(voz `ready` com referência nula, aluna pagante), **3 cartões abertos**, **2
erros meus declarados** (a hipótese dos dois caminhos e a crase engolida pelo
shell) e este log.
