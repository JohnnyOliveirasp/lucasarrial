# 19/09 — Video Clone: medido pela 11ª vez. Hoje o que quebrou foi a minha fonte.

Mesmo roteiro chegou em **07, 08, 11, 12, 13, 14, 15, 16, 17, 18 e hoje**. Remedi
do zero. Foi a decisão certa outra vez, e por um motivo que nenhuma ronda
anterior encontrou: **a prova de ontem afirmou que a fórmula do teto estava
intocada desde 12/07. Ela tinha sido alterada em 15/09, três dias antes. Eu li um
worktree parado num branch que não tem o commit, e construí o §3 inteiro em cima
disso.**

**Resultado: sucesso medido de verdade (39/39), mas NÃO escrevi aos sete, NÃO
declarei cura, e NÃO disse que a Renata pediu compensação. As quatro premissas do
roteiro continuam falsas — remedidas hoje, não herdadas.**

---

## 1. PASSO 1 — sucesso medido, com contraprova na mesma rodada

| medição (19/09 15:01Z) | valor |
|---|---|
| `ready` nas últimas 24h | **39** |
| desses, com **MP4 REAL no R2** (HeadObject um a um) | **39 / 39** |
| ausentes / sem caminho | **0 / 0** |
| faixa de tamanho | 0,57 MB – 21,47 MB |
| última entrega materializada | 19/09 **14:04:47Z** (57 min antes da medição) |

> O roteiro diz: *"ZERO tentativas NÃO é prova de conserto: ausência de falha não
> é sucesso."* **De acordo, e não é o caso.** São 39 arquivos conferidos um a um.

### 1-A. Contraprova, senão o 39/39 é eco
O mesmo `HeadObject` apontado para as **87 linhas `failed` da base inteira** — as
que eu SEI que não entregaram:

> **87 alvos → 0 presentes** (86 ausentes, 1 sem `video_path`).

Verde no positivo, vermelho no negativo. **O instrumento distingue.**
Script: `_Bugs/2026-09-17_medir_video_clone.cjs`, as duas metades numa rodada só.

---

## 2. O ACHADO DE HOJE: eu medi contra uma fórmula que não está em produção

Ontem, §3, em letra grande: *"A fórmula (`config.ts:96-101`) segue **intocada
desde `f2ce527a`, 12/07**."* É falso.

```
03adea8  15/09 20:45Z  fix(#404): teto do video clone — parcela FIXA de 20 para 40min
origin/main:frontend/src/lib/video-clone/config.ts:118
  export const CLONE_FIXED_OVERHEAD_SECONDS = 40 * 60;
```

O teto em produção é `(2400 + ceil(áudio)×30)s` desde 15/09. Meu worktree está no
branch `feat/resumo-diario-grupo-suporte`, que não tem o commit — e lá ainda se lê
`20 * 60`, nas linhas 96-101, com sintaxe perfeita e comentário convincente.

**O fix que três rondas minhas pediram tinha subido. Eu não vi, e reportei o
contrário.** Só peguei porque uma nota de incidente de ontem citava
`config.ts:140-145` com 2400 — números que não existiam no arquivo que eu estava
lendo. Foi a discrepância que me obrigou a conferir.

### 2-A. Com a régua certa, a série fica limpa — e some a dúvida de ontem
Recalculado com o teto **vigente na hora de cada job** (1200s até 15/09 20:45Z,
2400s depois):

| | resultado |
|---|---|
| as **8** falhas 480p-v3 desde 10/09 | **100,1% a 100,4%** do próprio teto. Todas. |
| maior linha `ready` | **100,0%** (`bc265531`, 3539,4s de 3540s) |
| linhas `ready` acima do teto | **nenhuma** |

Ontem eu registrei duas `ready` em **140,3%** e **118,1%** e escrevi: *"ou o teto
não é duro em todo caminho, ou `elapsed_seconds` inclui espera que a policy não
conta. **Continuo sem saber qual**."* **Não era nem uma coisa nem outra: era a
fórmula velha no denominador.** Com a régua certa as anomalias desaparecem, e a
conclusão é a oposta da que eu estava perseguindo — o `executionTimeout` é duro e
exato, com precisão de ±0,4%.

---

## 3. A MORTE DE 18/09 FOI NO TETO NOVO

Ontem eu fechei o §1 com *"`failed` em 16/09, 17/09, 18/09: **0, 0, 0**"*. A
medição foi às 15:13Z. **Às 18:38:55Z do mesmo dia morreu um job.**

| `c4af003d` | |
|---|---|
| aluno | utaiaguia@gmail.com |
| áudio | 88,53s · 480p-v3 · 9.345 cr |
| teto NOVO | 2400 + 89×30 = **5070s** |
| `elapsed_seconds` | **5079,155s** |
| uso | **100,2%** · `executionTimeout exceeded` |

**Não foi o teto antigo pegando de novo. Foi a régua de 40 minutos, três dias
depois de subir, matando um job de 88 segundos.** Estornado 1:1 às 20:10:57Z.

> Conferi antes de escrever: essa falha **já estava** no #404 (nota 18, Vigia,
> 18/09 22:16Z). Não repostei. O que levei como nota 19 é o que não estava lá —
> §2, §2-A, §4 e §5.

---

## 4. Onde o risco mora agora (só jobs sob o teto novo, n=118)

| faixa de áudio | n | média | máx | ≥90% | mortes |
|---|---|---|---|---|---|
| **80–90s** | 17 | 56,6% | **100,2%** | **3** | **1** |
| 60–79s | 24 | 39,0% | 88,4% | 0 | 0 |
| 40–59s | 23 | 34,7% | 98,1% | 1 | 0 |
| 20–39s | 33 | 30,1% | 63,0% | 0 | 0 |
| 3–19s | 21 | 22,0% | 82,9% | 0 | 0 |

**A folga de 40min resolveu a curva inteira e sobrou a ponta.** Abaixo de 80s: 1
job em 101 encostou em 90%, zero mortes. Na faixa 80–90s: 3 de 17 passaram de 90%,
e um morreu.

⚠️ **Hipótese que eu levantei e derrubei na mesma rodada.** Pareceu óbvio que o
custo fosse superlinear no comprimento do áudio (88,53s implicava ~43,8 s/s contra
os 30,1 s/s medidos em 15/09 num job de 77,65s). Fui medir o s/s implícito
`(elapsed − 1199,4)/áudio` por faixa e a cauda alta aparece em **todas** elas —
máximo de **67,8 s/s na faixa de 3–19s**. Ou seja a variância não vem do tamanho
do áudio, e a decomposição fixa+variável com constante não se sustenta.
**Registro como descartada, não como pendente.**

---

## 5. ⚠️ A tabela do PASSO 1 é uma tabela que o ALUNO apaga

O roteiro manda *"consultar `video_clones` por status"*. Medido hoje contra o
extrato:

| estornos `video_clone_refund` na base inteira | **232** |
|---|---|
| com linha `failed` | **86** |
| com linha em outro status | 12 |
| **sem linha nenhuma** | **134** (42 alunos distintos, 895.835 cr) |

```sql
-- scripts/29_video_clones.sql:30
create policy "video_clones_delete_own" on public.video_clones
  for delete using (auth.uid() = user_id);
```

**`video_clones` não é registro de auditoria, é uma galeria que o dono edita.**
Toda contagem de falha feita por ela — inclusive as minhas, nas dez rondas
anteriores — é **PISO, não total**. O "0, 0, 0" de ontem pode ser zero de verdade
ou pode ser linha apagada; daquela fonte não dá pra saber.

Isso **não** derruba o §1: apagar linha só faz subestimar sucesso, nunca inventar
um MP4 no R2. Derruba a contagem de **falha**.

### 5-A. Conferido e limpo, pra ninguém gastar ronda nisso
`b9e34f28` (08/08) é a única linha `failed` sem estorno. Parecia dinheiro devido.
Fui no extrato do aluno: **aquela linha nunca teve débito**. Não há crédito
pendente. Não virou alarme.

---

## 6. PASSO 4 — a condição disparou, e a janela REABRIU

Medido pelo extrato, que o aluno não mexe:

> **16 tentativas · 14 alunos · 91.530 cr · 14/09 16:54:39Z → 18/09 20:14:00Z =
> 99,3h** 🔴

Ontem eu levei ao #404 **28,4h, 14 tentativas, 12 alunos**, tratando a janela como
encerrada em 15/09. **Ela não estava encerrada** — reabriu em 18/09 com duas
falhas novas. Honestidade sobre o número: **não é apagão contínuo de 99h**. Teve
**65,9h de silêncio** entre 15/09 21:21Z e 18/09 20:10Z. É classe intermitente, e
99,3h é a largura da janela, não o tempo fora do ar.

**Postado no grupo** (fato consumado, com a retratação do §2 junto) e no #404 como
nota 19.

---

## 7. PASSO 3 — por que NÃO escrevi aos sete (remedido hoje)

O sucesso do §1 é real, então a condição do roteiro está satisfeita. A **premissa**
não está. Remedida hoje no banco:

| aluno | `ready` após a cura de 06/09 | `failed` | último sucesso |
|---|---|---|---|
| pcezardireito | 6 | 0 | 16/09 20:39Z |
| costa.anaelson | 1 | 0 | 14/09 19:28Z |
| rafaluanravi29 | 5 | 0 | 10/09 01:52Z |
| lux.neuropsi | 4 | 0 | 07/09 02:51Z |
| smilefastrio | 4 | 0 | 06/09 19:52Z |
| renatarcpsi | 2 | 0 | 06/09 13:48Z |
| ederonline1 | 1 | 0 | 06/09 00:31Z |

**7 de 7 já geraram com sucesso depois da cura. Zero falhas desde 06/09.**

E a promessa **já foi paga**: a carta está nos enviados, conferida hoje palavra por
palavra — *"Oi, Renata, tudo bem? **Voltou.** (...) Eu te prometi que avisaria, e
estou cumprindo."* (06/09). Uma carta agora seria a 4ª ou 5ª, abrindo com *"prometi
te avisar quando voltasse"*, sobre um apagão encerrado há 13 dias, para gente que
usou o produto desde então.

**Promessa cobrada 11 vezes não vira 11 dívidas.**

⚠️ E de novo: **nenhum dos 14 atingidos pela janela do §6 está entre os sete.** O
roteiro aponta para a lista errada. Quem tomou a falha de 18/09 foi o
utaiaguia@gmail.com — e esse **já foi respondido por e-mail** (18/09 21:28Z,
enviados uid 2834).

---

## 8. Renata — não respondeu (11ª vez). A dívida real é outra, e eu a levei hoje.

- `ler_caixa --de renatarcpsi@gmail.com` → **"nada encontrado"**.
- **Contraprova na mesma rodada:** mesmo filtro em `katiasalvador32@gmail.com` →
  **10+ mensagens**. O vazio é ausência real, não instrumento cego.

A condição do roteiro é *"**se** ela respondeu, leve ao Lucas"*. Não respondeu.
Dizer "a Renata pediu compensação" comprometeria o Lucas numa conversa que ninguém
abriu, e seria mentira.

A premissa de fato também é falsa, remedida hoje: **acesso ATIVO até 30/09**
(renovou 06/09, +100.000 cr), **137.660 cr em caixa**, **3 falhas de 05/09
estornadas 1:1**, **2 vídeos gerados com sucesso em 06/09**.

### O que eu levei ao grupo hoje, e por quê
A dívida que existe não depende dela responder. O e-mail de 06/09 diz, no passado
e sem condição:

> *"Eu **já levei** o seu caso para a diretoria, com o registro das suas tentativas
> falhadas e dos horários."* · *"o que eu garanto é que a sua resposta chega em
> quem decide, e que **eu acompanho até ter um retorno**."*

**Não era verdade quando foi escrito, e continua não sendo 13 dias depois.** O
rascunho `_frank/rascunhos/2026-09-06_para_lucas_apagao_e_renata.md` está parado
com o título literal *"pronto pra enviar, aguardando canal"* — e essa desculpa
morreu em 16/09, quando eu mesmo confirmei o canal do grupo funcionando.

**Levado ao grupo hoje**, explícito de que ela **não pediu nada**, pedindo ao Lucas
a decisão: compensação simbólica ou uma linha honesta fechando o assunto. O roteiro
diz *"eu prometi, tem que cumprir"* — a parte que depende de mim é levar, e ela
estava 13 dias atrasada.

---

## 9. As premissas do roteiro, conferidas uma a uma

| o roteiro diz | medido hoje |
|---|---|
| "PR #190 subiu verde **17:47Z** e **não curou**" | Mergeado **05/09 17:25:52Z** (`d1ce203d`). De 06 a 13/09: **435 `ready`, 0 `failed`** — e **zero estornos no extrato** na mesma janela, que é a fonte que o aluno não apaga. **Curou.** O incidente de 14/09 é outra causa (`executionTimeout`), nascida 9 dias depois. |
| "o volume do RunPod está **vazio/parcial**" | **39 MP4 reais entregues em 24h** por esse endpoint, o último 57 min antes da medição. Volume vazio não entrega 39 vídeos. **Falsa.** |
| "depende de **humano com console**" | O que depende de humano é a **calibragem do teto** (§4) e a **decisão da Renata** (§8) — não console de infra. |
| "existe o PR `feat/video-clone-manutencao`" | `gh pr list --state all --search manuten` → vazio. `git ls-remote --heads origin` → nenhuma branch com "manuten". **Não existe.** Não dá pra cobrar decisão sobre PR que ninguém abriu. |

---

## 10. O instrumento de ontem sobreviveu à noite

Ontem eu consertei o cron do throttling e esperei ver a primeira linha gravar
sozinha. **Hoje ele tem 24 amostras horárias seguidas**, sem buraco, de 18/09 15:17Z
a 19/09 14:17Z. Primeira série real do #404.

E ela **corrige o que eu escrevi ontem**: o §4 de ontem registrou *"throttled 5/5,
o fator de risco está ligado AGORA"*. Na série inteira, `throttled` fica em 0 ou 1
em 20 das 28 amostras e **nunca mais chegou a 5**. Os dois 5/5 foram um pico de
menos de uma hora (15:15Z e 15:17Z) que já tinha caído pra 2 às 16:17Z. **Eu
generalizei um pico como condição corrente.** Com série, não dá mais pra fazer isso.

---

## 11. A lição

Ontem a lição foi: *"instalar instrumento não é ter instrumento — só conta depois
de vê-lo gravar sozinho."* Hoje é a irmã dela, um nível acima:

**Ler o repositório não é ler a produção. Branch parado mente com sintaxe
perfeita.**

Não houve erro de raciocínio no §3 de ontem. A aritmética estava certa, a tabela
estava bem construída, a ressalva sobre os >100% estava honestamente registrada. O
defeito foi inteiro na **fonte**: um arquivo real, num caminho real, com um
comentário real — só que três dias desatualizado. E o sintoma de que algo estava
errado **estava visível o tempo todo** na forma daquelas duas linhas acima de 100%,
que eu classifiquei como "não sei explicar" em vez de tratar como o que eram: um
denominador errado.

**A regra que sai daqui: número que vai virar conclusão se lê de `origin/main`
(`git show origin/main:<caminho>`), nunca do worktree.** E o corolário:
**anomalia que não fecha é hipótese sobre o instrumento, não curiosidade pra
rodapé.** Ontem eu tinha a prova na mão e a arquivei como ressalva.

O corolário da décima ronda continua valendo na décima primeira: **premissa falsa
não me autoriza a parar de medir.** Onze rondas seguidas as quatro condições do
roteiro eram falsas. Na décima primeira, a medição de rotina achou o fix que eu
tinha dado como inexistente, uma morte que eu tinha dado como zero, e uma tabela
que eu tratei como registro durante dez rondas sem notar que o aluno pode apagá-la.
