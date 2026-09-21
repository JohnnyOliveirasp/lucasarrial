# 21/09 — Video Clone, 12ª medição. A faixa que matava foi pisada 13 vezes e sobreviveu. E eu ainda não posso dizer que curou.

Mesmo roteiro chegou em **07, 08, 11, 12, 13, 14, 15, 16, 17, 18, 19 e hoje**.
Remedi do zero, sem herdar nada da ronda 11.

**Resultado: sucesso medido de verdade (41/41), a janela de 14-18/09 fechou, a
faixa de risco foi exercitada — e mesmo assim NÃO declarei cura, NÃO escrevi aos
sete, e NÃO disse que a Renata pediu compensação.** O motivo de não declarar
cura é novo e é o achado da rodada: **a margem dobrou num instante datável e eu
derrubei as duas causas que eu mesmo levantei.**

---

## 1. PASSO 1 — sucesso medido, com contraprova na mesma rodada

| medição (21/09 15:01Z) | valor |
|---|---|
| `ready` nas últimas 24h | **41** |
| com **MP4 REAL no R2** (HeadObject um a um) | **40 / 40** no instante da varredura |
| a 41ª | entrou **durante** a rodada (21/09 14:46:05Z) |
| ausentes / sem caminho | **0 / 0** |
| faixa de tamanho | 0,57 MB – 21,47 MB |
| em voo agora | 1 job `generating` (`83bed65a`, 14:47:57Z) |

### 1-A. Contraprova, senão o verde é eco
Mesmo `HeadObject` apontado para as **86 linhas `failed` da base inteira**:

> **86 alvos → 0 presentes** (85 ausentes, 1 sem `video_path`).

Verde no positivo, vermelho no negativo. **O instrumento distingue.**

---

## 2. PASSO 4 — a janela NÃO reabriu

| | |
|---|---|
| última falha | **18/09 18:38:55Z** (`c4af003d`) |
| último estorno `video_clone_refund` | **18/09 20:14:00Z** |
| desde então | **68,4h sem falha e sem estorno** |

A janela levada ao grupo em 19/09 (14/09 16:54:39Z → 18/09 20:14:00Z) continua
com **exatamente as mesmas 16 tentativas / 14 alunos**. Não cresceu.

⚠️ **Não repostei o número de 99,3h.** Ele já foi ao grupo em 19/09 e não mudou;
repetir seria a duplicata que a regra 27 chama de começo do ruído. O que foi ao
grupo hoje é o que é **novo**: a janela fechou.

---

## 3. E NÃO é ausência de tentativa — a faixa que matava foi pisada 13 vezes

O roteiro avisa: *"ZERO tentativas NÃO é prova de conserto."* Correto, e por isso
a pergunta certa não é "houve falha?" e sim **"alguém pisou onde matava?"**.

A ronda 11 isolou a faixa de **80–90s de áudio** como a ponta de risco (3 de 17
acima de 90% do teto, 1 morte). Desde a última morte:

| faixa | n | ready | failed | uso médio | uso máx | ≥90% |
|---|---|---|---|---|---|---|
| **80–90s** | **13** | **13** | **0** | 48,6% | 92,6% | 2 |
| 60–80s | 24 | 23 | 0 | 31,9% | 91,7% | 1 |
| 40–60s | 18 | 18 | 0 | 32,4% | 73,4% | 0 |
| 20–40s | 19 | 19 | 0 | 26,8% | 63,0% | 0 |
| 0–20s | 28 | 28 | 0 | 14,2% | 43,9% | 0 |

Total desde 18/09 18:38Z: **102 jobs, 101 `ready` + 1 em voo, ZERO `failed`.**

**Isto é a diferença entre "não falhou" e "não foi testado".** Foi testado.

---

## 4. O ACHADO: a margem dobrou às 21:30Z de 19/09, e eu não sei por quê

| | até 19/09 ~21:30Z | depois |
|---|---|---|
| n | 74 | 54 |
| uso do teto, médio | 33,1% | **20,0%** |
| uso do teto, **máximo** | **92,6%** | **48,4%** |
| jobs ≥85% do teto | **4** | **0** |

Isolando a faixa 80–90s, que controla o comprimento do áudio dos dois lados:
**s/s médio caiu de 37,8 para 15,4; uso máximo de 92,6% para 37,6%.**

O primeiro job rápido é `3fd517fb`, **19/09 21:34:31Z** (14,6 s/s). A partir dele
a série trava entre 11,5 e 19 s/s, onde antes oscilava de 26 a 63.

### 4-A. Duas causas levantadas e **derrubadas na mesma rodada**

**(a) "foi o rebuild do worker do RunPod".** Encaixava perfeito: o
`Build RunPod Worker` concluiu **19/09 23:45:35Z**, e agregado **por dia** a
história fecha sem sobra — 19/09 lento, 20/09 rápido.

Só que o degrau começou às **21:34Z**, **2h11min ANTES** do build terminar. Sete
jobs já rodavam a 11,5–16,9 s/s enquanto a imagem antiga ainda era a única em
produção. **Descartada.**

**(b) "foi queda de carga".** Correlação entre jobs simultâneos e s/s: **r =
0,193** — fraco. E 21/09 tem carga equivalente à de 19/09 (simultâneos médio
**1,05** vs **1,20**) com **metade do custo**. **Descartada.**

### 4-B. Por isso não declarei cura
A melhora é real, medida e reprodutível na tabela. Mas **melhora sem causa
nomeada pode voltar atrás sem aviso, e eu não teria como prever.** Declarar cura
aqui seria trocar a prova que eu tenho (entrega) por uma que eu não tenho
(mecanismo).

> É o corolário do próprio roteiro, um nível acima: ausência de falha não é
> sucesso — e **presença de sucesso cuja causa você não sabe nomear também não é
> conserto.**

---

## 5. A pista acionável para o #404

A **única morte** da janela rodou com **8 jobs simultâneos** — o pico de toda a
série 14/09–21/09. Todos os quase-mortes ficaram em **1 a 3**:

| job | uso do teto | simultâneos |
|---|---|---|
| `c4af003d` **(morreu)** | **100,2%** | **8** |
| `40b40056` | 98,1% | 3 |
| `564d5a23` | 92,6% | 3 |
| `0d98cd9e` | 91,7% | 3 |
| `e273fc09` | 90,2% | 1 |
| `773f9dc0` | 89,9% | 3 |
| `52f242b1` | 88,4% | 3 |

Isso indica que o `elapsed_seconds` que o `executionTimeout` mede **inclui
espera/contenção, não só compute** — o teto é consumido por fila.
**Calibragem feita só contra duração de áudio vai errar de novo no próximo pico
de concorrência.** Levado como nota 20 no chamado `7405e5aa`.

### 5-A. Correção de escopo do próprio chamado
O texto do `7405e5aa` diz *"0 de 1.986 entregas prontas tem duração registrada"*.
**Isso deixou de valer**: hoje há **256 jobs `ready` com `elapsed_seconds`** desde
14/09, e foi só por causa deles que os §3, §4 e §5 puderam existir. A
instrumentação que o chamado pediu está de pé e já está pagando.

---

## 6. PASSO 3 — por que NÃO escrevi aos sete (remedido hoje, não herdado)

| aluno | `ready` pós-cura 06/09 | `failed` | último sucesso | acesso |
|---|---|---|---|---|
| pcezardireito | 6 | 0 | 16/09 20:39Z | 06/10 |
| rafaluanravi29 | 5 | 0 | 10/09 01:52Z | 04/10 |
| lux.neuropsi | 4 | 0 | 07/09 02:51Z | 03/10 |
| smilefastrio | 4 | 0 | 06/09 19:52Z | 02/10 |
| renatarcpsi | 2 | 0 | 06/09 13:48Z | 30/09 |
| costa.anaelson | 1 | 0 | 14/09 19:28Z | 29/09 |
| ederonline1 | 1 | 0 | 06/09 00:31Z | 14/10 |

**7 de 7 geraram com sucesso depois da cura. Zero falhas desde 06/09. Todos com
acesso ativo.** A carta "**Voltou.** (...) Eu te prometi que avisaria, e estou
cumprindo" saiu em **06/09**. Uma carta hoje seria a 5ª, abrindo com "prometi te
avisar quando voltasse", sobre um apagão encerrado há **15 dias**, para gente que
usou o produto desde então. Viola a regra 11 e queima confiança.

⚠️ E de novo: **nenhum dos 14 atingidos pela janela de 14-18/09 está entre os
sete.** O roteiro aponta para a lista errada há 12 rondas.

**Promessa cobrada 12 vezes não vira 12 dívidas.**

---

## 7. Renata — não respondeu (12ª vez), e desta vez eu descobri por que eu não
podia prometer "acompanho"

- `ler_caixa --de renatarcpsi@gmail.com` → **"nada encontrado"**.
- **Contraprova:** mesmo filtro em `katiasalvador32@gmail.com` → **39 mensagens**.
  O vazio é ausência real.

Estado dela, remedido hoje: **acesso ativo até 30/09**, **137.660 cr**, 3 falhas
de 05/09 **estornadas 1:1**, **2 vídeos com sucesso em 06/09**. Ela **não pediu
nada**.

### 7-A. O canal do grupo é de mão única pra mim, e isso derruba a promessa
Fui conferir se o Lucas tinha respondido o pedido de 19/09 antes de repetir a
cobrança (regra 27: no máximo 2 trocas). Não consegui:

| | |
|---|---|
| `agent_messages`, mensagem mais recente | **10/09 19:29Z** — 11 dias |
| WAHA está entregando webhook? | **sim**, `message.any`, app responde **200** |
| eventos `message.any` em 72h | **~22** |
| envios nossos (`POST /api/sendText`) em 72h | **20** |

**Quase todo evento é eco do meu próprio envio** (`fromMe && source === "api"` →
descartado de propósito no handler). Ou seja: **o canal está quieto, não
quebrado** — e eu **não** abri chamado, porque 2 eventos de diferença em 72h é
sinal fraco demais pra virar acusação. Seria exatamente o erro da ronda 10
(generalizar um pico como condição corrente), na direção oposta.

Mas a consequência operacional é real e eu levei ao grupo: **eu consigo postar e
não consigo ler resposta com confiança.** A carta de 06/09 promete à Renata *"eu
acompanho até ter um retorno"* — eu não tenho como acompanhar por ali. Pedi ao
Lucas que responda por Telegram ou pedindo nota no chamado, e avisei explicitamente
que resposta só no grupo tem chance real de eu nunca ver. **Prefiro avisar do meu
ponto cego do que fingir que acompanho.**

---

## 8. As premissas do roteiro, conferidas uma a uma (12ª vez, todas falsas)

| o roteiro diz | medido hoje |
|---|---|
| "PR #190 subiu verde 17:47Z e **não curou**" | Mergeado 05/09 17:25:52Z. De 06 a 13/09: 435 `ready`, 0 `failed`, zero estornos no extrato. **Curou.** O incidente de 14/09 é `executionTimeout`, outra causa, 9 dias depois. |
| "o volume do RunPod está **vazio/parcial**" | **41 MP4 reais em 24h** por esse endpoint, o último 15 min antes da medição; `health` do `9get7wv7trn3wg` responde com 3.954 jobs completos e 1 em execução. **Falsa.** |
| "depende de **humano com console**" | O que depende de humano é a **calibragem do teto** (§5) e a **decisão da Renata** (§7) — não console de infra. |
| "existe o PR `feat/video-clone-manutencao`" | `gh pr list --state all --search manuten` → vazio. `git ls-remote --heads origin` → **249 branches, nenhuma** com "manuten". **Não existe.** Não dá pra cobrar decisão sobre PR que ninguém abriu. |

---

## 9. A lição

A ronda 11 aprendeu: *"ler o repositório não é ler a produção — branch parado
mente com sintaxe perfeita."* Hoje é a irmã dela, e a vítima quase fui eu de novo:

**Agregado por dia mente com a mesma sintaxe perfeita de um branch parado.**

A história "o rebuild do worker curou o teto" fechava impecável na tabela por dia:
19/09 lento, 20/09 rápido, build no meio. Tinha data, tinha mecanismo plausível,
tinha o gráfico do lado certo. Eu ia escrever isso. **Só não escrevi porque fui
olhar o instante, e o instante desmentiu o dia** — o degrau tinha começado 2h11
antes do build existir.

A regra que sai daqui: **a granularidade da sua medição é uma premissa, não um
detalhe de apresentação.** Quando um agregado sustenta uma causa, desça um nível
antes de publicar a causa — porque agregar é onde a coincidência vira narrativa.

E o corolário, que é o que me impediu de declarar cura: **a pergunta não é "houve
falha?", é "alguém pisou onde matava?".** Ausência de falha em faixa não
exercitada é silêncio. Ausência de falha em faixa pisada 13 vezes é evidência.
Os dois se parecem num painel; só um vale como prova.
