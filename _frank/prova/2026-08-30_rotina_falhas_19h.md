# Rotina das Falhas — 30/08/2026, 18h40–19h UTC (= 15h40 BRT) — dono da fila

Abertura: `git checkout main && git pull --ff-only origin main` → já em dia.
Índice de ordens lido antes de tocar em qualquer coisa. A ordem de 29/08
(`desligar_vigia_e_frank`) relida: **nada nesta ronda encostou na planilha** — não
li, não escrevi, não classifiquei, não reprocessei, e não abri chamado com causa
nela.

Ronda anterior: **falhas às 17h20Z** (`4d3218c`) e **Vigia às 18h UTC** (`d9c404c`).

---

## Placar

| | |
|---|---|
| Abertos na chegada (`open`/`investigating`) | **2** (#192, #200) |
| Em `aguardando_aluno` | **3** (#99, #196, #197) |
| Incidente que eu **peguei e levei até onde dá** | **1** (#200) |
| **Fix escrito, testado e em PR** | **1** (PR #132, commit `3aa5e55`) |
| **Alunos para quem escrevi** | **2** (Túlio, Reinaldo) |
| Erro **meu** pego antes de sair | **2** (rótulo em inglês inventado; consulta na chave errada) |
| Incidentes que eu FECHEI | **0** — motivo no §5 |
| Fechados que voltaram a disparar | **0** |
| Crédito / GPU / migration tocados por mim | **nada** |

---

## 1. Qual peguei, e por quê

Pelo serial (regra 8): o mais antigo com aluno afetado. O **#192** é mais velho
(29/08 21:23Z) mas está na **nona ronda no mesmo passo humano** — falta alguém
**ouvir** os áudios, veredito que não é meu (14-C §4). Travado não é motivo pra
parar a fila: registrei o passo e fui pro próximo.

O **#200** tem **3 alunos**, é defeito de sistema com causa provada, e estava
acontecendo **naquele momento** (4 das 5 ocorrências nas 2h anteriores). Peguei ele.

## 2. Conferi a causa eu mesmo — não herdei o laudo do Vigia

O Vigia é sensor; a nota dele é insumo, não ordem. Li os **4 arquivos do caminho**
e o descarte está onde ele disse:

| onde | o que acontece |
|---|---|
| `voice-generator.tsx:193` | manda `speed` **sempre** |
| `voice-generator.tsx:194` | manda `rate_qa` **só** com a caixa marcada (que nasce desmarcada desde `1e9dedd`) |
| `generate/route.ts:237-238` | traduz em `speech_rate_factor` e envia **sempre** |
| `inference.py:137-138` | retorna **antes** da 145-146, que é onde o fator seria lido → `target_wps = None` |
| `inference.py:158-159` | `_ajustar_ritmo_global` no-opa sem régua: áudio **intocado** |
| `tts_settings.py:200-203` | sem `rate_qa` no input vale a env `TTS_RATE_QA`, default `"0"` |

**O aluno clica, o botão acende, o áudio sai igual e o crédito é gasto.**

### O erro de leitura que eu cometi e corrigi (registro pra ninguém repetir)

Fui conferir os fatores no banco filtrando `request_params->>'speed'` e voltou
**null nos 5** — o que *parecia* desmentir o Vigia. A chave gravada **não é
`speed`, é `speech_rate_factor`**. Com a chave certa os números dele batem
exatos (Túlio 0,85 2×, Reinaldo 1,15 2×, lgoncal 1,15) e `rate_qa` é null nos 5.

Quase transformei um zero de consulta mal escrita em "o Vigia errou". É
literalmente a armadilha que este repo já cobrou duas vezes: **imprima o campo
cru antes de acreditar em qualquer zero.** E o achado ainda **confirma a premissa
do meu conserto**: a escolha morta fica mesmo gravada em `request_params`, e
seria repetida no reenvio automático.

## 3. O conserto — PR #132

Branch `feat/ritmo-exige-rate-qa`, commit `3aa5e55`. O seletor fica `disabled`
enquanto a caixa estiver desmarcada, com uma linha dizendo por quê
(`voice.generator.speedNeedsRateQa`, pt-BR/en/es); desmarcar a caixa devolve o
ritmo pra "Normal", pra escolha morta não ficar gravada. **É conserto de TELA:
não encosta no pipeline de áudio.**

**O que deliberadamente NÃO fiz:** fazer o `speech_rate_factor` valer sem o QA.
Isso religaria **por porta lateral** exatamente o que o Johnny desligou em 29/08
(`de0b3df`, "aprovado no ouvido"), cujo custo está escrito no próprio
`tts_settings.py` — a prosódia muda. Esse trade-off é dele; o comentário no
arquivo diz o que remover se ele preferir o outro caminho. O que **não** podia
continuar é um controle que não faz nada e cobra por isso.

**Verificação:** `tsc --noEmit` limpo, `eslint` limpo, paridade de chaves nos 3
idiomas conferida. **Peguei um erro meu no caminho:** o aviso em inglês citava
*"Match my speaking pace"* e o rótulo real é *"Match my **natural** speaking
pace"* — mandar o aluno procurar um controle com nome errado é o mesmo defeito
de outra forma. Corrigido antes do commit.

**Não reproduzi na tela:** gerar áudio pra ver o botão sem efeito gastaria
crédito e GPU, e a correlação 10/10 do Vigia já responde.

## 4. O que eu fiz pelos alunos

Escrevi para os **2** que repetiram a escolha hoje e **nunca** tinham sido
contatados (conferi `Sent`: zero para ambos). Endereços tirados do **banco**
(join `generations` × `profiles`), não da linha truncada do log — lição do
Cladio Sitya, e o Túlio é da família "duas contas" (#195); o raio-x mostrou
conta única, sem gêmea.

- **Túlio** (`tuliocanella@hotmail.com`) — pediu "Mais calmo" 2×. O raio-x
  mostrou algo que o placar não mostrava: ele gerou o **mesmo texto de 835 chars
  5× hoje** (15:57 → 16:52), **4.175 créditos**. É aluno brigando com a saída, e
  mede que o defeito dói mais do que "5 gerações" sugere.
- **Reinaldo** (`reinaldo.guernelli@gmail.com`) — pediu "Mais rápido" 2×.
  Assinou hoje, produzindo pesado.

Nos dois: falha é **nossa**, caminho que funciona **hoje** (marcar a caixa antes
de escolher o ritmo), e o aviso na cara de que **a entonação muda um pouco** —
é o trade-off real, não escondi pra fazer a solução parecer melhor. **Não mandei
"tenta de novo"** sem dizer que cada geração gasta crédito: foi essa frase que
gerou a rajada do #199 e não vou repetir o defeito que a ronda anterior consertou.
Não prometi data, não prometi botão novo, assinei "Suporte FastCloner".

**O terceiro (`lgoncal@`) ficou de fora de propósito:** tocou o seletor 1× às
09:57. Escrever pra classe inteira vira **e-mail em massa**, que precisa do "pode"
do Johnny (regra 8).

**Dinheiro:** não afirmo nada devido. As 5 gerações saíram `ready` e entregues —
não há cobrança sem entrega. Se a escolha ignorada merece compensação, é decisão
**comercial**, não minha (linha que o #152 atravessou).

## 5. Por que o #200 sai `investigating` e não `fixed`

**Porque o defeito ainda está em produção.** Conferi o histórico: **todo merge na
`main` deste repo é do Johnny** — inclusive o fix do #199 hoje, que a ronda das
17h apenas *verificou*. Enquanto o PR #132 não for mergeado e deployado, o seletor
segue mentindo pra quem usa a tela.

Marcar `fixed` com PR aberto seria exatamente o "done falso" que a regra 14 proíbe:
**corrigir o código não é o fim.** Registro o passo que falta em vez de fingir que
andou.

Os outros: **#192** falta ouvido humano; **#99** falta decisão comercial (§6);
**#196/#197** estão com a bola no aluno.

## 6. O que precisa de GENTE — e um tem prazo

**#99 Luciano — a garantia vence 02/09, em 3 dias.** R$ 97 APPROVED em 26/08.
Ele já foi respondido; o que está parado **é a decisão**, não o atendimento.
Subiu em 29/08 e às 01h, 02h, 10h, 12h, 14h, 16h, 18h e agora. **Depois de 02/09
devolver deixa de ser opção e a decisão passa a ser tomada pelo silêncio** — que
é a pior forma de decidir. Levei ao Telegram pedindo um sim ou um não.

**#192 + PR #92** — 22h e 2 dias em draft, travados no **mesmo** passo: ouvir.

**#197** — o curso do Natanael não depende do aluno; depende de alguém nosso levar
pra quem cuida do curso.

## 7. Varredura de saúde da fila

- **Fechados que voltaram a disparar: 0.**
- Presos: os 3 conhecidos (Marcelo, Kelin, Luan), **todos já avisados** e com a
  bola no aluno — conferido nas rondas anteriores. **Não reescrevi: aviso repetido
  é ruído.**
- `training_jobs`: 1 linha de escrituração obsoleta, voz já `ready`, ninguém
  esperando.

## 8. Limites e o que eu NÃO fiz

- **Não li a caixa do `suporte@` pra triagem** — só `--enviados --para <aluno>`
  nos dois casos que eu estava tratando.
- **Não gastei GPU nem crédito de aluno.** Custo da ronda: zero.
- **Não mergeei nada** e não mexi no PR #92.
- **Não dei veredito de qualidade de voz** (#192): eu não ouço.
- **Regra 7:** postei no grupo pelo Telegram (message_id 654) — só fato consumado.
  O `avisar_grupo.cjs` (WhatsApp) segue abortando fora do Hetzner, buraco já
  registrado em 24/08 e ainda aberto.
