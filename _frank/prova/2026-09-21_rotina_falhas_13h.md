# Ronda das falhas — 21/09 ~13hZ

Ronda dentro da janela do turno (08h–23h BRT). Alvo serial: **#234 `f8587cef`**,
a palavra decapitada (18,9 dias).

**Nenhum incidente fechado, nenhum código em produção, nenhum aluno escrito.**
O que esta ronda produziu foi **medição**: pela primeira vez a régua deste
cartão foi confrontada com um ouvido, em teste cego **com controle positivo** —
e o resultado **argumenta contra gastar GPU**, além de responder a pergunta que
o #226 deixou escrita em 18/09.

Ordem de 29/08 respeitada: nada da planilha foi lido, escrito ou reprocessado.
Canal (ordem de 31/08): **não postei no grupo** — pela regra 7 só vai lá fato
consumado (incidente fechado, fix em produção, carta a aluno), e nenhum dos três
aconteceu. Medição é progresso, e progresso parcial no grupo é o ruído que mata
o canal. Vai no relatório da noite.

---

## 1. Passos fixos

**Reconciliação dos envios** (passo fixo desde 18/09):

| | |
|---|---|
| lidas da pasta `Sent` | 905 |
| já tinham linha | 828 |
| fora da janela (`--corte`) | 77 |
| **RECUSADAS (defeito)** | **0** |
| **escrituráveis dentro da janela** | **0** |

Fecha 905 = 905. As 77 anteriores a 14/09 14:06:31Z seguem sem decisão
(inalterado desde 18/09).

**Fila:** 93 abertos, 40 com 7d+ (igual à ronda das 11h45 — não fechei nada).
**Percepção (ordem de 17/09):** era **2**, ficou **1** — o #234 saiu da classe
porque o veredito voltou escrito. O que sobra é o #450, parado há 3,0d, e a nota
dele já diz que **não** é caso de percepção (falso positivo do casamento por
palavra); fica nomeado para quem pegar o cartão.

---

## 2. Antes de medir, achei o defeito do despacho de ontem

O card `561e1685` (olho, 20/09 19hZ) ouviu 3 áudios do #234 e laudou "corte
audível nos 3". Conferi as 3 gerações antes de escrever o veredito no cartão:
`042b3e50`, `7f732abd` e `d091072f` são **todas de 01/09**, e a telemetria
`tail_interno_*` só nasceu em **02/09 17:08Z** (PR #153).

**Os 3 áudios ouvidos são anteriores ao instrumento.** Não existe veredito de
régua para eles, então o ouvido não podia concordar nem discordar de nada. O
laudo não está errado — ele só não responde a pergunta do cartão. Ouvir sem par
é anedota, não medição.

Registro porque era exatamente esse o propósito do despacho, e porque colar
aquele laudo no cartão como "confirmado" teria fabricado uma confirmação que não
existia.

---

## 3. O teste cego: a régua contra o ouvido

Ferramenta nova, versionada: `_frank/ferramentas/2026-09-21_par_cego_decapitada.cjs`.
Só leitura. Seleção determinística e espaçada (sem `Math.random`, pra ser
reproduzível), 15–70s, janela desde 12/09. O manifesto que vai ao ouvido **não
carrega classe, id nem contagem da régua** — conferido antes de despachar.

| rótulo | régua (entregue/n) | classe | ouvido | bate? |
|---|---|---|---|---|
| AUDIO_01 | 0/9 | LIMPA | SEM CORTE | sim |
| AUDIO_05 | 0/10 | LIMPA | SEM CORTE | sim |
| AUDIO_06 | 0/3 | LIMPA | SEM CORTE | sim |
| AUDIO_08 | 0/4 | LIMPA | SEM CORTE | sim |
| AUDIO_10 | 0/8 | LIMPA | SEM CORTE | sim |
| AUDIO_02 | **5/5** | REPROVADA | **CORTE (2)** | sim |
| AUDIO_03 | 1/10 | REPROVADA | SEM CORTE | **não** |
| AUDIO_04 | 1/4 | REPROVADA | SEM CORTE | **não** |
| AUDIO_07 | 1/4 | REPROVADA | SEM CORTE | **não** |
| AUDIO_09 | 1/9 | REPROVADA | SEM CORTE | **não** |

**Limpas: 5/5 confirmadas** — o ouvido não deu um alarme falso.
**Reprovadas: 1/5** — e a única confirmada é a que tinha **100%** das fronteiras
marcadas. As 4 perdidas têm **uma** fronteira marcada em 4 a 10.

---

## 4. Por que eu NÃO publiquei isso como "a régua infla"

Duas leituras cabiam na tabela:

- **(a)** a régua infla: marcar 1 fronteira em 10 é alarme falso;
- **(b)** o ouvido não pega um corte curto perdido em 50s de áudio.

Escrever (a) sem descartar (b) seria repetir exatamente o erro que a nota de
20/09 do #226 pegou em si mesma ("derrubo o rótulo que eu mesmo ia publicar").
E a diferença vale dinheiro: em (a), ligar o gate derruba entrega boa; em (b), o
número é real e o ouvido não serve de juiz.

---

## 5. O controle positivo — e ele derruba a (b)

Ferramenta: `_frank/ferramentas/2026-09-21_controle_positivo_decapitada.cjs`.
Peguei áudios que a régua **e** o ouvido já tinham dito limpo (duplamente
confirmados) e **fabriquei o defeito**: removi 90ms de fala imediatamente antes
de um silêncio interno, deixando a palavra cair seca — a anatomia que o laudo de
20/09 descreveu. Mandei cego, misturado com intactos, sem dizer quantos.

| rótulo | gabarito | ouvido | erro |
|---|---|---|---|
| TESTE_01 | ADULTERADO em 22,85s | CORTE ~22,8s | 50ms |
| TESTE_02 | INTACTO | SEM CORTE | — |
| TESTE_03 | ADULTERADO em 8,91s | CORTE ~8,9s | 10ms |
| TESTE_04 | INTACTO | SEM CORTE | — |
| TESTE_05 | ADULTERADO em 39,49s | CORTE ~39,5s | 10ms |

**3/3 adulterados achados com o segundo certo, 2/2 intactos preservados, 5/5.**
O ouvido tem sensibilidade a corte único de 90ms em áudio de 50s e não inventa
corte onde não há. **(b) está derrubado.**

### 5.1 O controle quase nasceu morto, e o script me avisou

Na primeira rodada ele produziu **0 adulterados** e disse "nenhum silêncio
interno utilizável" em áudio cheio de silêncio. Causa: o `silencedetect` escreve
no **stderr** e o ffmpeg com `-f null -` **sai com código 0** — quem espera
capturar pelo `catch` do `execFileSync` não recebe nada e acaba lendo stdout,
que é vazio.

O que salvou foi o script ter dito o que não conseguiu fazer em vez de seguir em
frente: um controle positivo com zero adulterado passaria como "o ouvido não
achou nada" e teria **invertido a conclusão desta ronda**. Corrigido para
`spawnSync` lendo `.stderr`, e a armadilha ficou escrita no cabeçalho da
ferramenta.

---

## 6. O que isso sustenta — e o que muda na decisão parada com o Johnny

Nas 4 gerações em que a régua marcou **uma** fronteira, um ouvido
comprovadamente sensível não achou palavra decapitada nenhuma. A leitura que
sobra: `tail_interno_entregue` marca **fronteira abrupta** (critério físico,
`release<=35ms` e `platô>-40dB`), que é **superconjunto** de "palavra perdeu
sílaba". **Ela mede algo real e rotula como outra coisa.**

**Consequência direta:** ligar `TTS_TAIL_QA_INTERNO_MODO=reprovando` gastaria GPU
regenerando áudio que, no ouvido, não tem defeito. **Minha recomendação mudou**
— não ligar o gate como está; antes, apertar o critério para separar "fronteira
abrupta" de "sílaba perdida", e o caminho é a 2ª prova por **palavra**
(`tail_interno_word_flagged`), hoje desligada.

Isto é a mesma doença que o #226 já tinha diagnosticado no *outro* contador:
lá o `exhausted_score>=100` não significa palavra comida porque o score **soma
eixos**; aqui o `tail_interno_entregue` não significa palavra comida porque o
critério é **físico e mais largo que o nome**. Os dois contadores prometem dano
audível no nome e entregam proxy na medida. Anotado nos dois cartões.

---

## 7. O defeito piorou — e o instrumento não mudou

Série por **fronteira** (régua justa: independe do tamanho do texto):

| janela | ruins/fronteiras | taxa |
|---|---|---|
| 03/09 – 11/09 | 312/2.702 | **11,5%** (a nota de 12/09 mediu 13,1% em janela quase igual) |
| 12/09 – 21/09 | 575/2.945 | **19,5%** |

Piores dias: 12/09 **25,0%**, 14/09 **27,9%**. Por geração, a fatia com ≥1
fronteira marcada passou de ~30–45% para 50–74%, e em vários dias a **maioria
dos alunos do dia** é atingida (18/26 em 14/09, 15/20 em 18/09).

**Confundidor descartado:** a régua não mudou. O último commit que mexeu na
medição da fronteira interna é `7c2dee56`, de **02/09**, anterior às duas
janelas. Entre 08/09 e 17/09 nada em `runpod-worker/tts_qa` toca nisto. Mix de
tamanho também não explica: fronteiras por geração subiram 14% (6,53 → 7,47)
contra +70% na taxa por fronteira.

⚠️ **Leitura cruzada obrigatória com a seção 6:** o que subiu é o número de
**fronteira abrupta**, e pelo teste cego boa parte disso pode não ser audível. As
duas coisas convivem — subiu o que a régua mede, e o que a régua mede vale menos
do que o nome dela promete. Quem citar "19,5% de áudio com palavra comida"
estará errando o rótulo.

---

## 8. Achado lateral medido e REFUTADO

Suspeitei que texto em outro idioma inflasse a régua — o #226 achou texto em
inglês no pipeline PT-BR, e a única reprovada confirmada do meu teste
(`34d8f31c`) está em **espanhol** com 5/5. Medi e **me refuto**: na janela desde
12/09, 5 gerações não-PT dão **17,1%** de fronteiras ruins contra **19,6%** das
PT. Idioma **não** é inflador sistemático desta régua.

Registro o negativo de propósito: hipótese morta por medição é hipótese que a
próxima ronda não precisa reabrir.

---

## 9. O que eu não fiz, de propósito

Não virei chave, não gastei GPU, não subi código, não mexi em crédito, não
escrevi para aluno, não fechei cartão. Custo da medição: download de 10 mp3 +
ffmpeg local + 2 rodadas de modelo que ouve. **Zero crédito de aluno, zero GPU.**

Status do #234 segue `investigating` (regra 14 — medi, não resolvi).

**Nomeado para quem pegar:** (i) gravar o **segundo** da fronteira reprovada na
telemetria — hoje ela guarda contador e não guarda posição, e sem isso não dá
para o ouvido conferir ponto a ponto; (ii) medir `tail_interno_word_flagged`
como candidata a régua de verdade; (iii) refazer o par cego com n maior antes de
qualquer decisão definitiva.

**Limites declarados:** n pequeno (10 no par cego, 5 no controle) — direcional,
não taxa da base. E o meu defeito fabricado é uma **emenda**, que pode ser mais
audível que o release rápido que a régua persegue: o controle prova que o ouvido
pega splice de 90ms, não que pegaria toda fronteira de release rápido. A (b)
está enfraquecida com folga, não aniquilada.

---

## 10. Passo fixo de fim de ronda

Registro e ferramentas vão **direto na `main`**. Código de produção nesta ronda:
**nenhum** — as duas ferramentas novas são instrumento de ronda, não código de
produto, e nenhuma escreve no banco, em produção ou no áudio de origem.

`git log --oneline origin/main..HEAD` conferido vazio após o push (saída abaixo,
na seção do commit).
