# Ronda das falhas — 07/09, ~14h40-15h40Z (11h40 BRT)

Frank, **dono da fila** (regra 14-A). Método serial da ordem de 21/08.

Repo sincronizado (`main`, `pull --ff-only`, já estava em dia) e `_frank/ordens/README.md`
lido antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado, aberto ou
reaberto (ordem de 29/08). Canal: ordem de 31/08 — aviso no **GRUPO**, nada no privado.
Turno 11h40 BRT, **dentro** da janela 08h–23h.

---

## 0. A ronda em uma linha

**Peguei o item nº 1 que a ronda anterior deixou marcado (Elane, #293), medi os 7 mp3 que
ninguém tinha medido — e a medição derrubou o nosso próprio diagnóstico: a aluna estava
certa, a causa é NOSSA na escolha da referência, e ela não fala devagar. Escrevi pra ela
assumindo o erro, com os números.**

## 1. Sozinho no quadro

`ps` traz só o meu PID (977961, de 14:40:23Z). As notas do Vigia das 12:16Z e 14:13Z são de
rondas encerradas. Não há segundo dono.

## 2. Por que peguei este e não a cabeça da fila

O serial manda o mais antigo com aluno afetado, mas a prioridade escrita manda **aluno
esperando antes da limpeza**. A Elane tinha promessa nossa de retorno correndo desde
11:38Z (~3h ao começar a ronda), depois de ter **refutado por escrito** o diagnóstico que o
nosso e-mail vendeu como "o motivo principal". A ronda das 14h já a tinha deixado como item
nº 1. Os quatro primeiros da fila (#15, #265, #254, #222) seguem presos em decisão do
Johnny — nada mudou neles nesta ronda.

## 3. O que eu medi (e o que caiu)

### 3.1 Os 7 anexos são das vozes DELA — não da voz de catálogo

Baixei os anexos dos uids 460 e 466 (`BODY.PEEK`, flags e fila da Fast intactas, conferido
na saída). São 7 arquivos, **6 únicos** — um veio repetido nos dois e-mails (md5
`8cb53604`). O nome `fastpost-voz-<epoch>.mp3` é o nome de **download do nosso próprio
gerador** (`voice-generator.tsx:242`), logo são entregas nossas, não gravações dela.

Casei os 6 com as gerações pela duração real (`ffprobe`; o mp3 acrescenta 0,02–0,05s de
padding):

| arquivo | dur | geração | voz |
|---|---|---|---|
| 10,880s (PCM/wav) | 10,88 | `e090f691` | amostra da **Elane ckis** |
| 6,384s | 6,354 | `9f78d027` | **Elane** |
| 5,520s | 5,493 | `e5e4e568` | **Elane** |
| 5,016s | 4,971 | `7d9a45af` | **Elane** |
| 7,728s | 7,704 | `f29881f0` | **Elane** |
| 5,784s | 5,754 | `c6c3bb63` | **Elane** |

**Nenhum é da voz de catálogo.** Isso prova documentalmente o que ela respondeu às 11:31Z e
derruba de vez o e-mail das 11:28Z que vendeu a "Juliana" como motivo principal.

### 3.2 A queixa tem lastro, medida na SAÍDA

`medir_pausas_da_entrega.cjs` (régua da saída, que é sobre o que ela reclama):

| geração | articulação (pal/s) |
|---|---|
| `f29881f0` | 2,309 |
| `e5e4e568` | 2,536 |
| `18463b63` | 2,606 |
| `9f78d027` | 2,739 |
| `7d9a45af` | 2,809 |
| `c6c3bb63` | 2,854 |
| `0f2a05ba` (voz de catálogo) | **3,364** |

Veredito da ferramenta: **RITMO DE FALA, não montagem**. Não é silêncio sobrando entre
frases.

### 3.3 A causa, e ela é nossa

A referência da voz "Elane" (`ref/auto.wav`, 28,24s) mede: articulação **2,067 pal/s**, **15
pausas** >=0,15s, **7,44s de silêncio (26% do áudio)**, maior pausa **1,69s**. O VoxCPM gera
em modo "continue este áudio" e copia ritmo e pausa da referência — o clone herdou
exatamente a fala arrastada e as pausas longas que ela relatou. E a referência é o trecho de
**leitura de telejornal**, que é um tema do nosso próprio gerador de roteiro
(`script-themes.ts:41`).

### 3.4 O achado que muda o caso: ELA NÃO FALA DEVAGAR

`medir_velocidade_voz.cjs` nos 20 brutos:

- **takes 000–007**: articulação quase toda **acima de 3**, chegando a **3,92**
- **takes 008–019**: caem para a faixa de **2**, mínimo **1,53**

É o cansaço normal de 28 min de gravação. A régua da voz (mediana de 60 janelas) deu **2,46**
puxada pela metade lenta. **A gravação dela tem material bom e rápido; a nossa escolha
automática ancorou no pedaço formal e cansado.** A culpa não é da gravação dela.

## 4. Defeito de CLASSE achado (não é só dela) — não tem card

`fabricar_referencia.cjs:196` usa **por construção o MAIOR arquivo bruto** (comentário no
código: "mais chance de fala contínua"), **sem olhar ritmo**. Para ela o maior é o take 011
(211s), um dos mais lentos (2,32/1,53/2,36). Consequência: para quem **desacelerou ao longo
da gravação**, a ferramenta estruturalmente só oferece candidatas do material lento — as 34
candidatas que ela gerou são todas do mesmo take e todas do conteúdo de telejornal.

Conserto sugerido: flag para escolher o arquivo, ou pontuar candidata por articulação.
**Registro aqui porque não abri card** — a ordem de 27/08 manda não multiplicar chamado
quando a classe já tem dono, e este achado nasce dentro do #293; quem for consertar começa
por aqui.

## 5. A trava do PR #151 funcionou

No ensaio (`--top 8`, **sem** `--confirmar`) a candidata #1 saiu com alucinação de cauda do
whisper ("Legendas pela comunidade Amara.org") e a trava de borda recusou:
*"FALHOU: borda do clipe não bate com a janela escolhida — corte errado, não aplique"*.
**Não apliquei nada.** A trava se comportou como projetada.

## 6. O que saiu pra aluna (fato consumado, não promessa)

E-mail nos **dois** endereços — Sent **uid 1245** (`elaneckis@`) e **uid 1246**
(`elaneyani@`), cópias **CONFIRMADAS** pelo próprio `enviar_email.cjs`.

Conteúdo: assumi o erro do diagnóstico anterior na primeira linha, mostrei que os 7 arquivos
são das vozes dela, dei os números, expliquei que a ancoragem é nossa e a gravação dela está
boa, e fui honesto sobre o prazo (a correção precisa ser à mão porque a ferramenta só olha a
gravação mais longa). Também desfiz a imprecisão de chamar voz de catálogo de "voz de outra
pessoa", que sugeria vazamento entre contas.

Paliativo passado com os rótulos **reais** da tela, conferidos no `pt-BR.json`: ligar
**"Ajustar ao meu ritmo de fala"** e só então **Ritmo → "Mais rápido"** (o botão fica
`disabled` sem a chave, `voice-generator.tsx:352`), e **"Pausa entre frases"** em
**"Natural"**. Apontei que na geração `18463b63` ela estava em `speech_rate_factor` 0,85
("Mais calmo"), que piora. **Disse na cara que a melhora tende a ser pequena** — não vendi
paliativo como cura.

### Correção de rota que eu fiz em mim mesmo

O rascunho comparava a articulação medida na SAÍDA dela (2,3–2,85) com a média 2,905, que é
da régua do TREINO. **Réguas diferentes.** Reescrevi antes de enviar: comparação da saída dela
contra a saída da voz de catálogo (mesma régua), e a régua do treino citada à parte e
rotulada. Não dava pra corrigir um e-mail impreciso com outro impreciso.

## 7. O que fica pendente COMIGO (não com ela)

Refazer a referência **à mão** a partir dos takes rápidos (000–007) e gerar **um** áudio de
teste **por conta da casa** pra ela ouvir antes de gastar crédito. Por isso **não** botei o
card em `aguardando_aluno`: a bola é minha. **Não prometi hora a ela.** Não fiz nesta ronda
porque cirurgia manual na voz de aluna pagante nos últimos passos de uma ronda é como se
erra — e a trava do §5 acabou de mostrar por quê.

## 8. O que eu NÃO fiz

Não apliquei referência nova, não retreinei, não gastei GPU, não mexi em crédito/acesso/
plano, não estornei, não apliquei migration, não mergeei PR, não abri branch e não escrevi
código. Ela tem **59.192 créditos** e acesso até **13/09**. A pergunta de estornar as gerações
ruins é a mesma dos **#226/#234** e continua sendo do Johnny — não decidi sozinho e **não
prometi estorno a ela**. Leitura da caixa foi só pra buscar os anexos do caso e conferir o que
já tinha sido dito — não é triagem.

Escritas da ronda: **2 e-mails**, **2 notas** (#293 e #289) e **1 arquivo no git**.

## 9. Fila: 41 não-fechados (sem mudança de placar)

`investigating` 29 · `aguardando_aluno` 12. O #293 saiu de `open` para `investigating` (era o
único `open`), então o total não mudou.

**Nada fechado voltou a disparar** nesta janela.

⚠️ Segue **sem explicação** a discrepância de `fixed` 199→198 registrada na ronda das 14h.
Não avancei nela e não invento causa.

## 10. Precisa de DECISÃO do Johnny (inalterado desde as 14h)

1. 🔴 **O "pode" dos 8 do #290** — pendente desde 04/09; 7 dos 8 nunca entraram, texto pronto.
2. 🔴 **`migration 82`** — destrava o #15 (39 dias, 18 afetados). A ordem de 19/08 não cobre a 82.
3. 🟡 **#254 / Diego** — relógio em 08/09 12:00Z. Sem pedido escrito, a recomendação é não mexer.
4. 🟡 **#265** — política de garantia parada; código já curado.
5. 🟡 **#226 / #234** — cobrar ou estornar as gerações reprovadas pelo nosso QA. **A Elane
   entra nessa conta**: a geração `18463b63` dela saiu com 2 chunks esgotados e 1 palavra
   faltante segundo o nosso próprio QA, e foi entregue e cobrada.
6. 🟡 **marcelopersonalthe32** — prazo de reembolso vence **11/09** (4 dias).
