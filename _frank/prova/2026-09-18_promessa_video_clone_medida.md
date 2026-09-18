# 18/09 — Video Clone: medido pela 10ª vez. Hoje o que quebrou foi o instrumento.

Mesmo roteiro chegou em **07, 08, 11, 12, 13, 14, 15, 16, 17 e hoje**. Remedi do
zero. Foi a decisão certa outra vez, e por um motivo que nenhuma ronda anterior
tinha encontrado: **a série histórica que o #404 ganhou em 15/09 nunca existiu. O
cron estava morto desde o minuto em que nasceu, e a ronda de ontem fechou pedindo
um delta que não tinha de onde sair.**

**Resultado: sucesso medido de verdade (32/32), mas NÃO escrevi aos sete, NÃO
declarei cura, e NÃO disse que a Renata pediu compensação. As quatro premissas do
roteiro continuam falsas — remedidas hoje, não herdadas.**

---

## 1. PASSO 1 — sucesso medido, com o instrumento auditado na mesma rodada

| medição (18/09 15:13Z) | valor |
|---|---|
| `ready` nas últimas 24h | **32** |
| desses, com **MP4 REAL no R2** (HeadObject um a um) | **32 / 32** |
| ausentes / sem caminho | **0 / 0** |
| `ready` nas últimas 6h | 10 |
| última entrega materializada | 18/09 **14:27:18Z** (48 min antes da medição) |
| `failed` em 16/09, 17/09, 18/09 | **0, 0, 0** |

> O roteiro diz: *"ZERO tentativas NÃO é prova de conserto: ausência de falha não
> é sucesso."* **De acordo, e não é o caso.** São 32 arquivos conferidos um a um.

### 1-A. Contraprova na mesma rodada (senão o 32/32 é eco, não medição)
O mesmo `HeadObject` apontado para as **86 linhas `failed` da base inteira** — as
que eu SEI que não entregaram:

> **86 alvos → 0 presentes** (85 ausentes, 1 sem `video_path`).

Verde no positivo, vermelho no negativo. **O instrumento distingue.**
Script: `_Bugs/2026-09-17_medir_video_clone.cjs` (as duas metades numa rodada só).

### 1-B. E o instrumento que o aluno NÃO consegue apagar
A tela deixa o aluno apagar a linha que falhou; o ledger e o contador do RunPod
não. Por isso eu não fecho em cima de `video_clones` sozinho:

| fonte | leitura |
|---|---|
| `credit_transactions` `ref_type='video_clone_refund'` | último estorno **15/09 21:21:14Z** → **65,9h sem estorno novo** |
| contador do endpoint `9get7wv7trn3wg` | `failed` **219 → 219** em 24h (**+0**), `completed` **3787 → 3821** (**+34**) |

---

## 2. O ACHADO DE HOJE: o cron do throttling nunca rodou uma vez sequer

Ontem a nota 16 do #404 fechou assim: *"gravei os contadores de propósito: **a
ronda de amanhã tem delta**"*. Fui buscar o delta e ele não estava lá.

- Entrada criada em 15/09 apontando pra **`/usr/bin/node`** — binário que **não
  existe nesta máquina** (node vive em `~/.nvm/versions/node/v22.22.3/bin/node`).
- `/tmp/throttling-cron.log`: uma única linha, repetida ~70 vezes —
  **`/bin/sh: 1: /usr/bin/node: not found`**.
- `_Bugs/throttling-runpod.log` tinha **3 amostras em 3 dias** (15/09 15:09 ×2 e
  18/09 01:04). **Todas gravadas na mão. Zero automáticas.**

O relatório de 15/09 vendeu isso como resolvido: *"consertei a falta de série:
cron de hora em hora, custo zero de token, só observa"*. **Observou nada durante
72h**, e duas rondas (16/09 e 17/09) escreveram em cima dessa premissa.

### Consertado — e provado, não alegado
1. Caminho corrigido no `crontab` (backup em `/tmp/cron.bak`).
2. Script rodado na mão: `exit 0`, amostra gravada **15:15:19Z**.
3. **Esperei o cron disparar sozinho.** Disparou **15:17:02Z** e gravou a 5ª linha.

Passo 3 é o que separa "arrumei" de "arrumei e vi gravar". Sem ele eu estaria
repetindo exatamente o erro de 15/09 — declarar instrumento vivo sem ver sinal.

⚠️ A ironia que fica registrada: a ferramenta foi escrita **com o cuidado certo**
(aborta se faltar credencial, testado, exit 1, pra nunca devolver um "0 throttled"
tranquilizador). O cuidado estava dentro do script. **O que falhou foi a linha do
cron que deveria chamá-lo** — e ninguém conferiu se ela chamava.

---

## 3. O teto continua raspando, com linha nova de ONTEM À NOITE

Ontem: 7 linhas `ready` acima de 90% do teto desde 10/09. Hoje: **8.**

| quando | id | tier | áudio | gastou / teto | uso |
|---|---|---|---|---|---|
| **17/09 19:38Z** | **`1b0df6f9`** | 480p-v3 | 28,03s | **1912s / 2070s** | **92,4%** |
| 16/09 02:10Z | `65269937` | 480p-v3 | 77,62s | 3459s / 3540s | 97,7% |
| 15/09 02:13Z | `bc265531` | 480p-v3 | 77,65s | 3539s / 3540s | **100,0%** |

`1b0df6f9` nasceu **depois** da nota 16 de ontem (15:26Z). A fórmula
(`config.ts:96-101`) segue **intocada desde `f2ce527a`, 12/07**. Uso do teto por
grupo, desde 10/09:

| | n | mín | média | máx | >90% |
|---|---|---|---|---|---|
| `failed` (480p-v3) | 7 | 100,1% | 100,2% | 100,4% | 7 |
| `ready` (480p-v3) | 107 | 7,6% | 49,6% | 140,3% | **8** |
| `ready` (480p-v2) | 27 | 11,7% | 43,1% | 87,0% | **0** |

**A conclusão de ontem se confirma com dado que ontem não existia: o incidente
parou porque os jobs couberam, não porque a linha se moveu.** E o risco é 100%
concentrado em **480p-v3** — o v2 nunca passa de 87%.

⚠️ Ressalva que eu mantenho contra o meu próprio argumento: duas linhas `ready`
aparecem **acima de 100%** (`40b40056` 140,3%, `52f242b1` 118,1%). Ou o teto não é
duro em todo caminho, ou `elapsed_seconds` inclui espera que a policy não conta.
**Continuo sem saber qual**, e isso enfraquece uma leitura ingênua da tabela.

---

## 4. O fator de risco está ligado AGORA — e hoje com fila

| amostra | workers | fila |
|---|---|---|
| 17/09 15:21Z | throttled **5/5** | `inQueue 0` — inofensivo |
| 18/09 15:15Z | throttled **5/5** | **`inQueue 2`, running 0** |
| 18/09 15:17Z | throttled **5/5** | `inQueue 1`, inProgress 1 |

**Primeira vez que as duas metades aparecem na mesma amostra:** job esperando e
nenhum worker alocável. É exatamente a condição que alonga job e encosta no teto.
Não vou chamar isso de causa provada — ainda é correlação. Mas a partir de agora
ela tem série, pela primeira vez.

---

## 5. PASSO 3 — por que NÃO escrevi aos sete (remedido hoje)

O sucesso do §1 é real. A **premissa** do roteiro é que os sete estão esperando
notícia. **Falsa, remedida hoje no banco:**

| aluno | `ready` após a cura de 06/09 | último sucesso |
|---|---|---|
| pcezardireito | 6 | 16/09 20:39Z |
| costa.anaelson | 1 | 14/09 19:28Z |
| rafaluanravi29 | 5 | 10/09 01:52Z |
| lux.neuropsi | 4 | 07/09 02:51Z |
| smilefastrio | 4 | 06/09 19:52Z |
| renatarcpsi | 2 | 06/09 13:48Z |
| ederonline1 | 1 | 06/09 00:31Z |

**7 de 7 já geraram com sucesso depois da cura. Nenhum está travado. Nenhum tem
uma única falha desde 06/09.**

E a promessa **já foi paga**, em duas cartas que estão na caixa de enviados
(uid 1090, 05/09 20:28 · uid 1107, 06/09 00:37 — *"voltou"*). Uma carta hoje seria
a **4ª ou 5ª**, abrindo com *"prometi te avisar quando voltasse"*, sobre um apagão
encerrado há **13 dias**, pra gente que usou o produto desde então.

**Promessa cobrada 10 vezes não vira 10 dívidas.** Escrever seria a mensagem
genérica que a **regra 11** proíbe — e, pior, seria factualmente errada: diria a
sete pessoas que elas estavam esperando algo que já receberam.

⚠️ E de novo: **nenhum dos 12 atingidos pelo `executionTimeout` está entre os
sete.** O roteiro aponta para a lista errada.

---

## 6. Renata — não respondeu (10ª vez). A dívida real é OUTRA, e a desculpa venceu.

- `ler_caixa --de renatarcpsi@gmail.com` → **"nada encontrado"**.
- **Contraprova hoje:** o mesmo filtro em `katiasalvador32@gmail.com` → **38
  mensagens**. O vazio é ausência real, não instrumento cego.

A condição do roteiro é *"**se** ela respondeu, leve ao Lucas"*. **Não respondeu,
então não levei.** Dizer "a Renata pediu compensação" comprometeria o Lucas numa
conversa que ninguém abriu — e seria mentira.

A premissa de fato também é falsa: acesso **ativo até 30/09** (renovou 06/09,
+100.000 cr), **3 falhas de 05/09 estornadas 1:1**, **2 vídeos gerados com
sucesso** depois. **Ela não perdeu dias por falha nossa.**

### A dívida que existe, e que não depende de ela responder
O e-mail de 06/09 afirmou a ela, no passado e sem condição: *"eu **já levei** o seu
caso para a diretoria (...) eu acompanho até ter um retorno"*. **Não era verdade
quando foi escrito, e continua não sendo 12 dias depois.** O que existe é
`_frank/rascunhos/2026-09-06_para_lucas_apagao_e_renata.md`, cujo título é
literalmente **"pronto pra enviar, aguardando canal"**.

**Novo hoje: a desculpa "aguardando canal" venceu.** A prova de 16/09
(`_frank/prova/2026-09-16_o_canal_do_grupo_comia_avisos.md`) registra **2 envios
ao grupo confirmados** naquela ronda. O que o Lucas desligou em 04/09
(`d6853bfc`) foi o **aviso automático** de escalação, atrás da chave
`AGENT_ESCALATION_WHATSAPP` — **não o canal**. Ou seja: há 12 dias esse rascunho
está parado por um motivo que eu mesmo já derrubei há 2 dias e não conectei.

**Não mandei sozinho porque as duas decisões são comerciais** (§7), e regra 9-A é
clara: mexer em saldo de aluno é sempre do Johnny. Mas o motivo agora é esse, e
não mais "não tenho canal".

---

## 7. As três decisões humanas que continuam paradas

1. **Renata** — compensação simbólica **ou** uma linha honesta fechando o assunto.
   A dívida é do que a gente escreveu, não do que ela pediu. **12 dias parada.**
2. **Paulo Moura** (`pcezardireito@icloud.com`, um dos sete) — o mais atingido do
   apagão (11 falhas), cancelou no trial em 31/08 **sem pagamento localizado**, e
   **segue gerando**: 6 vídeos após a cura, o último 16/09 20:39Z. Pela regra 9
   pode ser crédito nunca pago. **Regra 9-A: só o Johnny mexe.**
3. **Leonice** (`leonicemleandrosociedadeadvoca@gmail.com`) — paga, acesso até
   09/10, **106.033 cr** parados. Última interação em **qualquer** produto:
   14/09 19:01, que foi o Video Clone que morreu por `executionTimeout`
   (estornado 6.720 cr às 19:55). **Sumiu logo depois de tomar a falha:
   92h** (ontem 68h, anteontem 43h). Carta pessoal com o dado dela ≠ a genérica
   que recusei no §5 — mas é retenção/comercial, então **não mandei sozinho**.

---

## 8. PASSO 4 — a condição disparou, e já foi entregue ontem

Remedido pelo ledger: **14 tentativas · 12 alunos · 74.985 cr · 14/09 16:54:39Z →
15/09 21:21:14Z = 28,4h** 🔴. Cruzou as 24h do roteiro.

**Números idênticos aos de ontem** — nenhum estorno novo em 65,9h. Isso foi ao
**chamado #404**, onde o time trabalha, e eu **confirmei hoje que a nota existe**
(nota 16 de 16, gravada 17/09 15:26:34Z) em vez de acreditar no relatório de
ontem. Repostar os mesmos 28,4h seria mandar notícia velha.

**O que é novo hoje** (o cron morto, a linha de 92,4%, a fila com 5/5 throttled)
foi **pro #404 como nota 17**, gravada e conferida na releitura.

---

## 9. As premissas do roteiro, conferidas uma a uma

| o roteiro diz | medido hoje |
|---|---|
| "PR #190 subiu verde **17:47Z** e **não curou**" | Mergeado **05/09 17:25:52Z** (`d1ce203d`). Depois dele: 06→13/09 = **435 `ready`, 0 `failed`**. **Curou.** O incidente de 14/09 é outra causa (`executionTimeout`), nascida 9 dias depois. |
| "o volume do RunPod está **vazio/parcial**" | **32 MP4 reais entregues em 24h** por esse endpoint, o último 48 min antes da medição. Volume vazio não entrega 32 vídeos. **Falsa.** |
| "depende de **humano com console**" | O que depende de humano é **decisão de código** (o teto, §3) e as **três decisões comerciais** do §7 — não console de infra. |
| "existe o PR `feat/video-clone-manutencao`" | `gh pr list --state all --search manuten` → **vazio**. `git ls-remote --heads origin` → **nenhuma** branch com "manuten". **Não existe.** Não dá pra cobrar decisão sobre PR que ninguém abriu. |

---

## 10. A lição

**A ronda de ontem terminou com um pedido pro futuro — "amanhã tem delta" — e não
conferiu se o mecanismo que produziria esse delta estava de pé.**

Isso é uma classe de erro diferente das nove rondas anteriores. Antes o risco era
*responder de memória*. Hoje o risco era mais fino: **confiar num instrumento que
eu mesmo instalei e declarei funcionando, três dias atrás, sem nunca ter visto ele
produzir uma linha sozinho.** O relatório de 15/09 escreveu "consertei a falta de
série". O `_comum.cjs` deste projeto inteiro existe por causa de erros assim, e o
`03_ROTINA.md` já avisa em letra grande: **"cron que morre é silencioso"**. Morreu
silencioso na minha frente por 72h.

**A regra que sai daqui: instalar instrumento não é ter instrumento. Só conta
depois de vê-lo gravar sozinho, uma vez, com você olhando.** Foi por isso que hoje
eu não parei no `crontab` corrigido — esperei os 2 minutos até o `:17` e conferi a
linha nova. Custou 2 minutos e é a única parte do §2 que eu posso chamar de
provada.

E o corolário que já vale pra décima repetição: **premissa falsa não me autoriza a
parar de medir.** Nove rondas seguidas as quatro condições do roteiro eram falsas.
Na décima, a medição de rotina encontrou um instrumento morto que três relatórios
— inclusive dois meus — tratavam como vivo.
