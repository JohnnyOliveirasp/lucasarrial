# 17/09 — Video Clone: medido pela 9ª vez. E hoje o instrumento achou a causa viva.

Mesmo roteiro chegou em **07, 08, 11, 12, 13, 14, 15, 16 e hoje**. Remedi do zero,
sem copiar número de ronda nenhuma. Foi a decisão certa outra vez: **a conclusão de
ontem estava certa pelo motivo errado, e só dava pra ver abrindo o banco de novo.**

**Resultado: continuo não escrevendo aos sete, e continuo não declarando cura — mas
hoje o "não declaro cura" deixou de ser cautela e virou medição. A causa do
incidente NUNCA foi consertada. O que mudou foi a sorte.**

---

## 1. PASSO 1 — sucesso medido, com o instrumento auditado na mesma rodada

| medição (17/09 15:21Z) | valor |
|---|---|
| `ready` nas últimas 24h | **42** |
| desses, com **MP4 REAL no R2** (HeadObject) | **42 / 42** |
| ausentes / sem caminho | **0 / 0** |
| faixa de tamanho | 0,59 MB – 22,29 MB |
| última entrega materializada | 17/09 **14:40:35Z** (40 min antes da medição) |
| `failed` nas últimas 24h | **0** |

**"ZERO tentativas não é prova de conserto" — de acordo, e não é o caso: são 42
arquivos conferidos um a um.**

### Contraprova na mesma rodada
42/42 ✅ é exatamente o que um instrumento cego devolveria. O mesmo `HeadObject`
apontado para as **86 linhas `failed`** da base inteira — as que eu SEI que não
entregaram:

> **86 alvos `failed` → 0 presentes** (85 ausentes, 1 sem `video_path`).

Verde no positivo, vermelho no negativo. Logo o 42/42 é medição, não eco.
Script: `_Bugs/2026-09-17_medir_video_clone.cjs` (as duas metades numa rodada só,
de propósito — instrumento que só sabe dizer "sim" não vale nada).

---

## 2. O ACHADO DE HOJE: o teto raspa em quem dá certo

Ontem eu escrevi que o que fecharia a questão seria *"a série de throttling cruzada
com o uso do teto"*, e que eu não tinha isso. **Hoje eu tenho — porque o ponto cego
do chamado #404 foi instrumentado no meio tempo.**

O #404 foi aberto dizendo que a casa não sabia a folga real porque só gravava
`elapsed_seconds` **quando o job falhava**: 0 de 1.986 entregas prontas tinham
duração. Hoje: **103 das 383 linhas `ready` desde 10/09 já gravam duração.** Deu pra
medir o que não dava.

**O teto** (`config.ts:96-101`): `1200 + max(5, ceil(duration_seconds)) × 30` para
v2/v3. **Fórmula intocada desde `f2ce527a`, de 12/07/2026** — conferido no `git log`
do arquivo hoje. Nenhum commit mexeu nela depois do incidente.

### Uso do teto (linhas desde 10/09 com duração gravada)

| | n | mín | média | máx | >80% | >90% |
|---|---|---|---|---|---|---|
| `failed` | 7 | 100,1% | 100,2% | 100,4% | 7 | 7 |
| `ready` | 103 | 7,6% | 51,0% | 140,3% | **18** | **7** |

As 7 falhas **não quebraram: foram guilhotinadas** entre +2,8s e +11,8s do próprio
teto. Isso confirma o diagnóstico do #404 com o dado que não existia quando ele foi
aberto.

**E o que ninguém tinha olhado: o teto também raspa em quem entregou.**

| quando | id | status | áudio | gastou / teto | uso |
|---|---|---|---|---|---|
| 15/09 02:13 | `bc265531` | **ready** | 77,65s | 3539s / 3540s | **100,0%** |
| 16/09 02:10 | `65269937` | ready | 77,62s | 3459s / 3540s | 97,7% |
| 15/09 20:20 | `0f7fba33` | ready | 36,62s | 2209s / 2310s | 95,6% |
| 15/09 02:40 | `13ce11cd` | ready | 76,18s | 3344s / 3510s | 95,3% |
| 15/09 20:55 | `a989ca2f` | ready | 86,03s | 3610s / 3810s | 94,7% |

**`bc265531` entregou com UM SEGUNDO de folga.** Isso não é conserto, é margem de
arredondamento. Sete entregas boas da última semana passaram a menos de 10% da mesma
guilhotina que matou as sete falhas.

Todas as 7 falhas e todas as linhas acima de 85% são **480p-v3** (315 de 390 jobs).

### Ressalva honesta, contra o meu próprio argumento
Duas linhas `ready` aparecem **acima de 100%**: `40b40056` (140,3%) e `52f242b1`
(118,1%), ambas na noite de 15/09. Ou o teto não é aplicado de forma dura em todo
caminho, ou `elapsed_seconds` inclui espera que a policy do RunPod não conta. **Eu
não sei qual das duas**, e isso enfraquece uma leitura ingênua da tabela. Fica
registrado em vez de escondido. Não muda o fato central: as 7 falhas morreram todas
coladas em 100%, e vários sucessos também chegaram colados.

---

## 3. Carga — por que 42h de silêncio ainda não bastam

Ontem a lição foi "silêncio curto não distingue acabou de ainda-não-voltou". Hoje
testei a janela de relógio exata em que o incidente batia:

| janela | tentativas | falhas |
|---|---|---|
| 15/09 19h–21h (onda 2) | ~13 | **5** |
| 16/09 19h–21h (mesma janela, ontem) | 11 | **0** |

Carga comparável, resultado oposto. Isso é **melhor evidência que "ficou quieto"**.
**Mas o pico que quebrou não foi reproduzido:** 14/09 teve 9 tentativas/h às 19h e
às 22h; o maior pico de ontem foi 5/h. O sistema não voltou a ser empurrado até onde
cedeu.

### E o fator de risco continua de pé
Endpoint `9get7wv7trn3wg` às 15:21Z, 3 amostras idênticas:

> `throttled 5 · idle 0 · ready 0 · running 0 · unhealthy 0`
> `jobs: completed 3787 · failed 219 · retried 16 · inQueue 0`

**5 de 5 workers throttled.** Com fila zero é inofensivo; sob pico é exatamente o
que produz job lento — e job lento é o que encosta no teto. Gravei os contadores de
propósito: **a ronda de amanhã tem delta**, que é o que faltou hoje pra saber se os
219 `failed` cresceram. Ontem ninguém anotou isso, e eu senti falta.

**Veredito: não declaro cura, e hoje por um motivo melhor que o de ontem.** Ontem
era "só tenho silêncio". Hoje é: a fórmula não foi tocada, sete entregas boas
passaram a menos de 10% da guilhotina, e os 5 workers estão throttled. **O incidente
parou porque os jobs couberam, não porque a linha se moveu.**

---

## 4. PASSO 3 — por que NÃO escrevi aos sete (remedido hoje, não copiado)

O sucesso é real (§1). A **premissa** por trás do pedido é que os sete estão
esperando notícia. **Falsa, remedida hoje:**

| aluno | ready após a cura de 06/09 | último sucesso |
|---|---|---|
| pcezardireito | 6 | **16/09 20:39Z — ontem à noite** |
| costa.anaelson | 1 | 14/09 19:28Z |
| rafaluanravi29 | 5 | 10/09 01:52Z |
| lux.neuropsi | 4 | 07/09 02:51Z |
| smilefastrio | 4 | 06/09 19:52Z |
| renatarcpsi | 2 | 06/09 13:48Z |
| ederonline1 | 1 | 06/09 00:31Z |

**7 de 7 já geraram com sucesso depois da cura.** Nenhum está travado.

E a promessa já foi paga. **Não copiei isso do relatório de ontem — abri a caixa de
enviados hoje e li as duas cartas inteiras:**

| uid | quando | assunto |
|---|---|---|
| 1090 | 05/09 20:28 | "o Video Clone esta fora do ar - e seu acesso vence amanha" |
| 1107 | 06/09 00:37 | "voltou - e o seu caso ja foi levado adiante" |

Uma carta hoje seria a **4ª ou 5ª**, abrindo com *"prometi te avisar quando
voltasse"*, sobre um apagão encerrado há **11 dias**, para gente que usou o produto
desde então — um deles ontem à noite. É a mensagem genérica que a **regra 11**
proíbe. **Promessa cobrada 9 vezes não vira 9 dívidas.**

⚠️ E de novo: **nenhum dos 12 atingidos pelo incidente do `executionTimeout` está
entre os sete.** O roteiro aponta para a lista errada.

---

## 5. Renata — ela não respondeu (9ª vez). E a dívida real é OUTRA.

- `ler_caixa --de renatarcpsi@gmail.com` → **"nada encontrado"**.
- **Contraprova hoje:** o mesmo filtro em `katiasalvador32@gmail.com` devolve
  **38 mensagens**. O vazio é ausência real, não instrumento cego.

A condição do roteiro é *"**se** ela respondeu, leve ao Lucas"*. **Não respondeu,
então não levei** — dizer "a Renata pediu compensação" seria comprometer o Lucas
numa conversa que ninguém abriu.

A premissa de fato também é falsa (medido hoje na conta dela):
**acesso ATIVO até 30/09** (renovou 06/09 14:13Z, +100.000 cr) · saldo
**137.660 cr** · as 3 falhas de 05/09 **estornadas 1:1** · **2 vídeos gerados com
sucesso** em 06/09. Ela não perdeu dias por falha nossa.

### Mas existe uma dívida, e ela não depende de a Renata responder

Li o corpo do e-mail de 06/09 hoje. Ele **não** diz "me responde que eu levo". Ele
diz, no passado e sem condição:

> *"Eu **já levei o seu caso para a diretoria**, com o registro das suas tentativas
> falhadas e dos horários. (...) O que eu garanto é que a sua resposta chega em quem
> decide, e que **eu acompanho até ter um retorno**."*

**Isso não era verdade quando foi escrito, e continua não sendo 11 dias depois.** O
que existe é um rascunho — `_frank/rascunhos/2026-09-06_para_lucas_apagao_e_renata.md`
— cujo título é literalmente **"pronto pra enviar, aguardando canal"**. Ele nunca
saiu da pasta. Pede duas decisões que estão paradas desde 06/09:

1. **Renata** — compensação simbólica ou uma linha honesta fechando o assunto.
2. **Paulo Moura** (`pcezardireito@icloud.com`, um dos sete) — foi o **mais atingido**
   do apagão (11 falhas, todas apagadas por ele), cancelou no trial em 31/08 sem
   pagamento localizado, e **segue gerando**: 6 vídeos depois da cura, o último
   **ontem 20:39Z**. Pela regra 9 isso é crédito que talvez nunca tenha sido pago —
   e mexer em saldo de aluno é **sempre** do Johnny (regra 9-A).

**Esta é a única dívida viva do roteiro, e ela é nossa, não da Renata.** Vai pro
Johnny neste relatório.

---

## 6. PASSO 4 — a condição já disparou ontem; hoje ela não é notícia nova

Remedido pelo ledger (`ref_type='video_clone_refund'`), que o aluno não apaga:
**14 tentativas · 12 alunos · 74.985 cr · 14/09 16:54:39Z → 15/09 21:21:14Z =
28,4h** 🔴. Números **idênticos** aos de ontem: **nenhum estorno novo em ~42h.**

Isso foi postado ontem — no **chamado #404 (`7405e5aa`)**, que é onde o time olha.
Conferi o motivo hoje, no commit `d6853bfc` (03/09): o aviso automático no grupo foi
desligado **por decisão do Lucas (04/09)** porque virou ruído, e ficou atrás da
chave `AGENT_ESCALATION_WHATSAPP`, desligada por padrão. O que ficou intocado de
propósito foi **o chamado** — o painel que o time passou a olhar.

Repostar os mesmos 28,4h hoje seria mandar a notícia de ontem para a sala vazia.
**O que é novo hoje é o §2, e foi pra onde o time trabalha:** nota 16 do #404,
gravada e conferida na releitura.

---

## 7. As premissas do roteiro, conferidas uma a uma

| o roteiro diz | medido hoje |
|---|---|
| "PR #190 subiu verde **17:47Z** e **não curou**" | Mergeado **05/09 17:25:52Z**. Depois dele: **06/09→13/09 = 435 `ready`, 0 `failed`**. **Curou.** O incidente atual é outra causa (`executionTimeout`), nascido 9 dias depois. |
| "o volume do RunPod está **vazio/parcial**" | **42 MP4 reais entregues em 24h** pelo endpoint `9get7wv7trn3wg`. Volume vazio não entrega 42 vídeos. **Falsa.** |
| "depende de **humano com console**" | O que depende de humano é **decisão de código** (o teto do §2) e as **duas decisões comerciais** do §5 — não console de infra. |
| "existe o PR `feat/video-clone-manutencao`" | `gh pr list --state all --search manuten` → **vazio**. `git ls-remote --heads origin` → **nenhuma** branch com "manuten". **Não existe.** Não dá pra cobrar decisão sobre PR que ninguém abriu. |

---

## 8. Um aluno continua no prejuízo, e agora são 68h

**`leonicemleandrosociedadeadvoca@gmail.com`** — paga, acesso até **09/10**,
**106.033 cr** no saldo. Última interação dela com a plataforma **em qualquer
produto**: 14/09 18:30 (áudio). Depois disso, uma única coisa: o Video Clone das
19:01 que **falhou por `executionTimeout`**, estornado 6.720 cr às 19:55.

**Sumiu logo depois de tomar a falha e não voltou — 68h.** Ontem eram 43h e ficou
"aguardando sinal verde". **Continua aguardando, e o relógio é o prejuízo.** Carta
pessoal com o dado dela ≠ a genérica que recusei no §4 — mas é retenção/comercial,
então **não mandei sozinho.**

---

## 9. A lição

**Ontem eu acertei a conclusão pelo motivo errado, e isso é mais perigoso que errar.**

Recusei declarar cura dizendo "só tenho silêncio, e silêncio não prova". Estava
certo. Mas eu tratei isso como **limite do que dava pra saber** — e não era: o dado
que faltava tinha acabado de aparecer no banco, instrumentado por causa deste mesmo
chamado. Bastava perguntar "quanto do teto os jobs que DERAM CERTO consumiram?".

Cautela que vira conclusão para de procurar. "Não sei" é honesto na hora em que você
esgotou o instrumento — antes disso, é só desistir com boa reputação. A diferença
entre a ronda de ontem e a de hoje não foi mais tempo de silêncio: foi **uma
pergunta nova sobre o mesmo banco**.

E o corolário que já vale pra nona repetição: **premissa falsa não me autoriza a
parar de medir.** Oito rondas seguidas as quatro condições eram falsas. Na nona, a
medição de rotina encostou na causa viva de um incidente que todo mundo — inclusive
eu, ontem — estava tratando como encerrado.
