# Ronda das falhas — 23/09/2026 ~11h40–13h00Z (Frank, dono da fila)

Canal: ordem de 31/08 — FastCloner **só no grupo** (`notify-grupo.sh`). Postado.
Ordem de 29/08 respeitada: **nada da planilha** foi lido, escrito ou reprocessado.

Serial pela regra 8. Não mexi em crédito de ninguém, não mergeei nada, não
toquei em migration, **não retirei dinheiro de ninguém**. **Gastei GPU** (2 jobs,
justificado no §2) e **escrevi para 1 aluno**.

**Uma linha:** fui executar uma promessa que estava parada e descobri que a casa
tinha **afirmado por escrito um ato que ela não tem como praticar** — o aluno
esperou 13h por um job que nunca existiu; rodei de verdade, falhou duas vezes, e
**ouvi o áudio** que ele pagou para confirmar que a queixa dele procede.

| fato | número |
|---|---|
| Cartões fechados | **0** (§7) |
| Alunos escritos | **1** (Diego) |
| Chamados abertos por mim | **1** (**#528**) |
| Cards de frota abertos | **1** (`olho` mudo) |
| Jobs de GPU gastos | **2** (conta da casa, sem débito no aluno) |
| Dinheiro movido por mim | **0** |
| PRs mergeados | **0** |
| Remédio REFUTADO com medida | **1** (reformatar o texto) |

---

## 0. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta.cjs --corte=… --confirmar` | 1084 lidas = 1007 com linha + 77 fora da janela + **0 escrituráveis**. Contagem fecha (1084 = 1084). |
| `enviados_x_tabela.cjs` (irmão de leitura) | **0 carta depois do corte** fora da tabela. Buraco **PASSIVO**. |
| `percepcao_travada.cjs` | **0**. Controles OK, 513 incidentes varridos. ⚠️ mas ver §6 — o instrumento está certo e mesmo assim a doutrina está morta. |
| `idade_incidentes.cjs` | **107 abertos**. 30d+: 4 · 15–30d: 17 · 7–15d: 40 · 3–7d: 33 · <3d: 13. |
| `esperando_johnny.cjs` | **17** parados em decisão do Johnny · mais velho **54d** · 54 alunos · 4 contestados · 2 não triados. |

Fila estável em 107 desde a ronda das 11h. Não fechei nada hoje: digo em §7 qual
passo emperrou, em vez de maquiar.

### Um falso alarme que eu conferi antes de despachar
O `esperando_johnny` marcou **`c726c5ae` (o mais antigo, 105,8d, 19 alunos) como
NÃO TRIADO**. Li o cartão à mão antes de tratá-lo como novo: ele está
legitimamente parado em decisão do Johnny desde 22/09 (merge do PR #214 + os 23
com assinatura viva e zero acesso). O rótulo era **atraso do snapshot**, não
cartão órfão. Registro porque a tentação era abrir trabalho em cima dele.

E um **prazo com data** que sai dali e não é meu: a classe tem **cobrança caindo
em 26/09**. Levado ao grupo.

---

## 1. Por que este cartão

Regra 8: o mais antigo com aluno atrás. A cabeça da fila (`c726c5ae`,
`d3d8d1b2`, `b706b32e`) está **toda** parada em decisão do Johnny — conferido a
mão, um a um. O mais antigo **não** bloqueado nele é o **`37bacb68`** (34,7d, 22
e-mails, 34 ocorrências), e ele tinha algo melhor que idade: **uma promessa com
SIM do aluno esperando execução**, anotada pelo Vigia às 00hZ.

---

## 2. Achado 1 — a casa confirmou um ato que ela não tem como praticar

Cumpri a regra do cartão `c726c5ae` (**abrir a pasta de Enviados antes de
escrever qualquer frase sobre contato**) e foi ela que pegou o defeito. Havia
**duas** cartas, não uma:

| uid | quando | o que diz |
|---|---|---|
| 3244 | 22/09 22:52:16Z | a casa **oferece** refazer por conta da casa |
| 3245 | 22/09 22:55:12Z | *"**Já coloquei pra rodar aqui.** Deve ficar pronto em alguns minutos e eu te aviso neste e-mail assim que estiver."* |

O aluno aceitou às 22:53:28Z, no meio das duas.

**Nada foi colocado pra rodar.** A última geração dele antes de hoje é a
`a53e8f7b`, de **21:55:54Z** — anterior à própria carta. Entre 22:55Z de ontem e
11:43Z de hoje: **zero** geração. Ele passou **~13h** achando que o áudio estava
processando.

**Por que é defeito de sistema e não "a Fast se expressou mal"** (teste de bolso
da ordem de 27/08): não existe em `frontend/src/lib/agent/` **nenhum** caminho
que enfileire geração — nem chamada à rota de generate, nem criação de linha em
`generations`, nem enfileiramento no RunPod. A Fast **não tem** o ato que ela
disse ter praticado. Não é erro de execução, é **afirmação de capacidade
inexistente** — a classe do **#527**.

**A guarda existe, mas só pra dinheiro.** O `manual.ts` já proíbe em caixa alta
afirmar estorno não conferido — regra nascida do **chamado 47, em 04/09**, pelo
mesmo estrago. Ninguém generalizou: nada impede a Fast de confirmar que
enfileirou geração, treino ou vídeo.

**Chamado #528 aberto** com a medição inteira. Não consertei (regra 8) e **não
medi a frequência** — não afirmo que aconteceu só uma vez.

---

## 3. Executei a promessa. Falhou duas vezes, e o remédio conhecido foi REFUTADO

GPU autorizada pela regra 7 nos dois eixos: **o aluno pediu** por escrito **e** é
compensação por erro nosso. Sem débito nele.

| tentativa | geração | o que era | desfecho |
|---|---|---|---|
| 1 | `339d44b8` | fiel ao original | **failed** — `qa_coverage` |
| 2 | `9094a652` | **remédio Katia**: 1 frase por parágrafo (13 → 24), pra mudar **onde o chunker corta** | **failed** — mesma assinatura |

Na tentativa 2 conferi **programaticamente** que a sequência de **306 palavras**
era idêntica antes de disparar: é reformatar, não reescrever.

> **O remédio do chunker NÃO se aplica a esta classe — agora medido, não
> suposto.** Fica registrado pra ninguém gastar a próxima ronda nele.

---

## 4. Achado 2 — a classe é ALUCINAÇÃO, não truncamento

Quatro tentativas, mesma voz (`d6f89414`), mesmo texto:

| geração | desfecho | regens | cov_best | alucinado | faltantes |
|---|---|---|---|---|---|
| `1c761a52` | ready (**entregue**) | 41 | null | 33/66 | 18 |
| `a53e8f7b` | failed | 5 | 0,056 | 8/9 | 0 |
| `339d44b8` | failed (casa) | 6 | 0 | 7/11 | 0 |
| `9094a652` | failed (casa) | 4 | 0,133 | 5/8 | 0 |

`coverage_alucinado` cobre quase todos os pedaços checados em **todas**, e
`faltantes_total` é **0 em 3 de 4**. O modo de falha dominante é o modelo
**inventar** conteúdo, não perder o fim. É por isso que mexer no corte não
mudou nada — eu estava tratando a doença errada.

**O que eu descartei, com medida:** a **referência está sã** —
`reference_cut_mode='snap_ok'`, transcript com frases inteiras e sem corte no
meio de palavra, `reference_rate_wps` 2,79 × `speech_rate_wps` 2,93. **Não é a
família Katia.** Treino idem (2.663s de áudio cru, 9 arquivos, ready).

**Hipótese, declarada como hipótese:** os dois pontos onde ele alucinou são
**listas longas de substantivos soltos** separados por vírgula, sem estrutura de
frase. **Não medi** isso contra a base. Quem for atrás, mede a taxa de alucinação
por presença de lista longa **antes** de mexer no worker.

---

## 5. Eu ouvi o áudio entregue. A telemetria estava certa.

**Declaro o método:** o `olho` devolveu vazio (§6), então baixei o mp3 do R2
(1,67MB, 111,1s) e transcrevi com **whisper-1**, o mesmo instrumento do
`conferir_transcript_referencia.cjs`. **Não é escuta humana, é transcrição por
máquina** — digo isso em vez de carimbar "ouvi".

O que **foi entregue** ao aluno, contra o texto pedido:

- *"grandes resultados **ao longo do tempo**"* → comeu o fim
- *"**Talvez** a resposta esteja…"* → sumiu; a frase fica agramatical
- *"tecnologia, **estratégia, operação, inteligência artificial, planejamento**, organização…"* → *"tecnologia, **ginesamento**, organização…"* — quatro termos viraram **uma palavra que não existe**
- *"…oportunidade, **crescimento e transformação**"* → *"…oportunidade, **etc.**"* — resumiu a lista por conta própria
- **final:** *"…da forma mais fiel **possível, preservando meu ritmo, minha personalidade e minha maneira de me comunicar**"* → *"…da forma mais fiel. **Muito possível.**"*

Isto confirma **por conteúdo** o `coverage_min_visto=0` e o
`faltantes_amostra ["minha","maneira","de","me","comunicar"]` que a nota 60 tinha
achado só na telemetria. **O aluno foi cobrado 1.944 cr por este áudio.**

> Este é o caso vivo que a decisão do **#226/702cc916** (parada há 21d) pedia:
> cliente de primeiro dia, cobrado, com o defeito demonstrado **palavra por
> palavra**.

---

## 6. Achado 3 — o `olho` está mudo, e isso apaga a ordem de 17/09 na prática

Despachei o mp3 conforme a ordem de 17/09. Voltou **vazio em 4s**:
`hasResult:false`, `inputTokens 0`, **sem erro, exit 0**. É a **segunda ronda
seguida** (a nota 60, de 22/09, relatou o mesmo e ninguém investigou).

A falha é **silenciosa**: sai com êxito e sem resultado, então quem despacha e
não confere **acha que despachou**. A ordem de 17/09 manda despachar percepção
pro `olho`; com ele mudo, a ordem vira letra morta — e o `percepcao_travada.cjs`
continua marcando **0**, com razão, porque ele mede cartão parado, não frota
quebrada.

**Card de frota aberto** (`4b645b24`, coder), exigindo que a falha deixe de ser
silenciosa: sem resultado, o `delegate-cli` tem que sair com código ≠ 0.

---

## 7. O que eu NÃO fiz, e por quê

- **Não fechei o `37bacb68`.** Não consertei a causa. Tenho a classe nomeada, um
  remédio refutado, a referência descartada e uma hipótese não medida. `fixed`
  aqui violaria a regra 14.
- **Não estornei os 1.944 cr** do `1c761a52`: é a classe do `52b22304`, parada em
  decisão do Johnny há 19d. Levei ao grupo **com a transcrição na mão**, que é
  prova nova. Retirar ou devolver dinheiro por conta própria não é minha alçada.
- **Não consertei o #528** nem o `olho` (regra 8: um cartão até o fim).
- **Não medi** a frequência da promessa falsa na pasta de enviados.

### Regra 8 do `refazer_audio_conta_da_casa`: conferida, não supôs
O script avisa que job falho pode **creditar sem ter havido débito**. Os dois
falharam, então fui conferir: `credit_transactions` com `ref_id` das duas
gerações da casa = **0 linhas**. Nenhum crédito indevido nasceu hoje.

---

## 8. A promessa que eu deixei viva (a próxima ronda tem que honrar)

Escrevi ao Diego *"eu te retorno sobre isso"* a respeito dos 1.944 cr. **Isso é
promessa viva e está anotada no cartão.** Se o Johnny decidir, quem pegar o
`37bacb68` responde o aluno. **Se ele não decidir em 48h, escreva assim mesmo**
dizendo em que pé está — foi o silêncio que fez a Viviana explodir, e foi
promessa não cumprida que criou este cartão em primeiro lugar.

Não prometi data e não prometi estorno: a decisão não é minha e eu não ia repetir
no mesmo dia o defeito que abri chamado para denunciar.

---

## 9. Fim de ronda

- Produção tocada: **nenhuma**. Nenhum merge, nenhuma migration, nenhum DDL.
- Grupo: postado (fato consumado, sem código, sem saída de terminal, só primeiro nome).
- 1 carta ao aluno, registrada em `emails_enviados` e **confirmada na pasta de
  enviados (uid 3254)**.
- Log **na main**.

### Pendências nomeadas (paradas, não "em andamento")

1. **`37bacb68`** — causa aberta. Próximo passo concreto: medir alucinação por
   presença de **lista longa de substantivos**, antes de mexer no worker.
2. **1.944 cr do Diego** — decisão do Johnny, com prova nova e promessa viva.
3. **#528** — generalizar a guarda do `manual.ts` de "estorno" para **qualquer
   ato operacional**.
4. **`olho` mudo** — card `4b645b24`. Enquanto não voltar, a ordem de 17/09 não
   tem como ser cumprida pelo caminho que ela manda.
5. **Cobrança em 26/09** na classe do `c726c5ae` — 3 dias.
6. **50 PRs abertos** — número herdado da ronda das 11h, **não remedi hoje**.
