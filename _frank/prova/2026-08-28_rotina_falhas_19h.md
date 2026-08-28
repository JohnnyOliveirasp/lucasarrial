# Rotina das Falhas — 28/08/2026, 19h40 UTC (Frank, dono da fila)

Abertura: `git checkout main && git pull --ff-only origin main` → já atualizado,
árvore limpa. Índice de ordens lido antes de tocar em qualquer coisa. Ordens
aplicadas nesta ronda: `2026-08-20_dono_da_fila_e_fila_zerada.md` (regra 14-A),
`2026-08-27_vigia_so_erro_de_sistema.md` (14-C), regra 8 de 21/08 (serial +
e-mail individual sem pedir permissão) e a regra 7 (só fato consumado no grupo).

Ronda anterior: 15h UTC. Vigia: 18h UTC.

---

## Placar

| | |
|---|---|
| Incidentes fora de `fixed`/`ignored` na abertura | 13 (9 sem contar `aguardando_aluno`) |
| Aluno para quem escrevi | **1** — José Ricardo (promessa da Fast sem dono) |
| Incidentes que anotei | **2** — `#15` (d3d8d1b2) e `#176` (e106d5c2) |
| Incidentes que fechei | **0** — e explico abaixo por que nenhum merecia |
| Crédito que toquei | **nenhum** |
| GPU/retreino que disparei | **nenhum** |
| Migration aplicada / PR mergeado / código na main | **nenhum** |

---

## 1. Antes da fila: o aluno que estava esperando uma promessa nossa

O Vigia registrou às 18h que o José Ricardo (`jrsolucoescorporativas@gmail.com`)
tinha respondido 17:36Z e estava sem dono. Apliquei o passo (1) do manual
— conferir o estado atual antes de agir — e **metade da escalação estava
vencida**: ele já tinha sido avisado do fix do HeyGen (uid 266, 16:07Z) e já
tinha sido respondido às 17:40Z (uid 275). Não refiz nada disso.

**O que sobrou é real e era a segunda promessa órfã do dia.** O e-mail das
17:40Z diz, com estas palavras: *"vou pedir pro responsável técnico te passar as
orientações exatas... A equipe te responde em breve por este mesmo e-mail com o
passo a passo."* Ninguém tinha essa tarefa. É a mesma classe que a ronda das 15h
levantou pro Johnny (a auto-resposta inventando trabalho operacional), agora na
**segunda ocorrência em um dia** — e a primeira só não virou silêncio porque uma
ronda pegou.

Escrevi as orientações e mandei ~19h55Z (bcc `suporte@`, ensaiado em `--dry-run`
com os acentos lidos na saída, endereço conferido contra `profiles` antes de
mandar — armadilha do Cláudio, endereço errado é entregue sem bounce).

O conteúdo **não é conselho genérico de internet**; saiu de ler o pipeline:
- mínimo real de 20 min (`voice-creator.tsx:11`), e ele já tem 33 → **não
  precisa gravar mais**, o que evita que ele grave 1h à toa;
- o sistema escolhe sozinho uma janela de 30s como referência
  (`REFERENCE_SECONDS=30`), com seleção anti-bordão e corte em fronteira de
  palavra → falar em frases inteiras aumenta os candidatos bons;
- o áudio passa por separação + VAD e o que não é fala limpa é descartado antes
  de contar como material útil → ruído **encolhe** os 33 min dele;
- tudo vira mono 16 kHz → **celular em sala silenciosa vence microfone bom em
  sala barulhenta**, e pedi que ele não use app de "melhorar voz", que altera o
  timbre antes de chegar aqui.

Separei explicitamente as duas queixas dele, porque elas não têm o mesmo grau de
certeza — e dizer o contrário seria vender peixe:
- **cadência:** tem endereço. A voz dele é de 24/08 e está sem
  `speech_rate_wps`; as gerações caem num cálculo aproximado a partir da
  referência, que tende a sair mais rápido que a fala real (caso Ellen: 2,83
  contra 1,7–2,2). Um treino novo hoje já nasce com a medida certa.
- **timbre:** **não prometi correção.** Timbre vem do material; o único conselho
  que assino é gravar no registro em que ele quer o clone, e manter a distância
  do microfone constante.

Retreino segue por conta da casa (não debita os 10.000). Saldo dele: 183.673.

## 2. O que eu quase reportei como bug grande — e não era

Vi `voices.tts_silence_ms` NULO em **934 de 935** vozes prontas, com o commit
`080dd74` ("a voz nasce com a PAUSA de quem gravou") de **21/08**, sete dias
atrás. Cheirava a fix mergeado que nunca funcionou, e casava bonito demais com a
fila de queixas de ritmo (`#176`, `#170`, `#156`, `#155`, `#133`).

**Fui ler quem escreve o campo antes de acusar, e estava errado.** Está
`finalize-training.ts:387-406`: foi **DESLIGADO em 24/08 por ordem do Johnny**
(caso Kessuly) — gravar pausa + crossfade 0 deixou a voz *"horrível, muito
pior"*, 93 vozes foram zeradas com backup, e o worker segue medindo
`reference_pause_ms` só como telemetria (`pacing_measured_not_applied`).

É exatamente o erro que a 14-C §3 descreve: acusar olhando o dado sem abrir o
código que escreve. Não abri chamado, não toquei em nada, e **banquei a lição na
memória** pra nenhuma ronda futura "consertar" isto.

## 3. Serial (regra 8): peguei o `#15` / `d3d8d1b2`

Escolha declarada, com a régua "o mais antigo com aluno afetado":

| candidato | idade | por que não / por que sim |
|---|---|---|
| `#11` | 38 d | travado em migration que é aval do Johnny; ronda anterior apurou que nenhum dos 3 está sem entrega |
| **`#15`** | **29 d** | **16 alunos, disparou HOJE às 18:16. É o que tem mais gente sofrendo** |
| `#120`, `#133` | — | bola com o Johnny (jurídico) e com a aluna (veredito de ouvido) |

### O achado: o instrumento foi construído, mergeado, e nunca foi ligado

A ordem de 20/08 manda, se o `#15` voltar, *"instrumentar o handler pra logar em
QUAL fase o chunk pendura"*. **Isso já foi feito** — commits `b9bc646` e
`1c72d77`, de 24/08, na main: heartbeat de fase do worker → `qa.fase_corrente`,
e o `error_message` passa a nomear a fase.

Só que ele nunca produziu um único dado:

| | |
|---|---|
| gerações criadas desde 24/08 | **566** |
| com o jsonb `qa` preenchido | **421** |
| com `qa->fase_corrente` | **0** |

Zero em 4 dias. A coluna funciona (421 escritas por outros caminhos) — quem não
escreve é a feature. O portão é `fase-telemetria.ts:17,26`: **sem a env
`FASE_TELEMETRIA_SECRET` a feature se desliga em silêncio** e o worker nem
recebe as chaves pra postar. A env está ausente do `frontend/.env.local`, que
pelo `deploy/README.md` é a fonte dos secrets de runtime.

**Limite honesto da prova:** não confirmei a env direto no servidor — o guard
bloqueou o ssh, e bloqueou certo (leitura de `.env` + canal de saída tem cara de
exfiltração). A prova que eu sustento é a de dados, `0/566`, que não depende de
ler env nenhuma e não tem outra leitura.

**O custo do silêncio, medido:** desde que a instrumentação entrou aconteceram
mais 3 estouros — `gusperandio2` 24/08 (483,0s), `brauliomarcos3` 24/08
(492,1s) e `viktoraraujo` **hoje 18:16** (491,6s). Os três gravaram
`error_message` cru, sem sufixo `[fase: ...]` e com `qa` nulo. Exatamente os 3
casos que o instrumento existia pra capturar passaram batido.

### De quebra, matei a dúvida do "é régua ou é hang"

A ordem de 20/08 dizia *"462 chars estourou 30 min quando o normal é ~2 min: é
hang, não régua"*. Confirmado e **reforçado** com os 19 estouros:

| chars | elapsed |
|---|---|
| **59** | estourou |
| **78** | **1.811,96 s (30 min)** |
| **79** | 492,13 s |

Texto de 59 caracteres são poucos segundos de fala. Se fosse régua, texto curto
nunca estourava. É pendura aleatória, e o assunto pode parar de ser rediscutido.

Achado lateral: o teto caiu de ~30 min (23/08) para ~8 min (24/08 em diante —
483/491/492 s), via `inferenceExecutionTimeoutMs` (`generate/route.ts:273`).
Apertar o teto **não cura hang**: troca 30 min de espera por 8 min de espera.

### Dinheiro deste chamado: conferido e limpo

32 gerações `failed` em 10 dias. **Toda a que teve débito teve exatamente 1
estorno**, conferido por `ref_type='generation_refund'` — **nunca por `kind`**,
que é a armadilha que quase pagou em dobro pra 13 alunos. As 4 com estorno 0 têm
débito 0 (nada a devolver). Sem estorno faltando, sem estorno em dobro.
**Nenhum aluno com crédito preso neste chamado.**

### Por que NÃO marquei `fixed`, e em que passo travei

O hang continua acontecendo — o último foi **hoje às 18:16** — e a causa raiz
segue desconhecida. O que eu descobri foi **por que ela continua desconhecida**.
Marcar `fixed` aqui seria exatamente a regra 14 sendo quebrada.

`investigating` com a nota inteira gravada (47 notas, 1 linha afetada, conferida
na releitura). **Travei em:** (a) definir `FASE_TELEMETRIA_SECRET` no `.env.local`
de produção e recarregar o pm2, e (b) avaliar o merge do branch
`feat/fase-telemetria-url-publica`, cujo commit `8f2a428` (de hoje, *"a fase
desligada AVISA em vez de ficar muda"*) existe justamente porque a feature
desligada não reclama. **As duas são do Johnny** — mexer em secret de produção e
mergear não são minha alçada. Escalado no Telegram nesta ronda, não deixei pro
relatório.

## 4. Nota de passagem no `#176` (Victor)

Não investiguei a fundo (estava no `#15` pela regra serial), mas o Victor tomou
**dois** problemas hoje e quem responder precisa saber dos dois: a queixa de
qualidade às 18:08 **e** o timeout das 18:16. Anotei: dinheiro OK (débito 400,
1 estorno por `ref_type`), e o detalhe que evita causa errada — a voz dele foi
treinada **hoje às 18:02 e já nasceu com** `speech_rate_wps = 2.26` (só 15 das
935 vozes têm o campo). Ou seja, a queixa é sobre uma voz que **já tem** o
conserto do `#165`; pendurar a causa no `#165` sem medir seria errado.

## 5. Processo: o canal do grupo continua morto nesta máquina

`avisar_grupo.cjs` falhou com `WAHA_API_URL/WAHA_API_KEY ausentes nesta máquina`
— **a mesma falha que o Vigia pegou às 18h**, agora confirmada em segunda
ocorrência com outro agente. Consequência: os fatos consumados desta ronda **não
chegaram ao grupo**. Não fico com a impressão de que avisei; não avisei.
Mandei por Telegram (msgs 558 e 559) pra não sumir. Pela 14-C isto é
**processo**: 1 linha aqui + Telegram, sem chamado.

---

## Pro Johnny — o que é decisão sua

1. **`FASE_TELEMETRIA_SECRET` em produção.** É o desbloqueio mais barato da fila:
   sem ele, o `#15` continua cego e cada novo timeout perde a evidência na hora.
2. **A Fast fabricou promessa operacional pela 2ª vez hoje** (*"o responsável
   técnico te passa as orientações"*). A ronda das 15h já te levou a classe e
   pediu recorte; hoje ela reincidiu. Continuo sem abrir chamado sem teu aval.
3. **O merge segue sendo o gargalo**: 21+ PRs abertos, e agora um deles é
   literalmente o que faz a instrumentação parar de mentir por omissão.

## O que eu NÃO fiz

- Não fechei nenhum incidente. Nenhum estava resolvido — e a ordem de 21/08 é
  pra fechar **mais**, não pra fechar mais rápido do que resolve.
- Não gastei GPU, não disparei retreino, não cobrei nem devolvi crédito.
- Não apliquei migration, não mergeei PR, não commitei código (só este log).
- Não li a caixa do suporte@ pra triagem; só conferi os **enviados** de um aluno
  específico que eu já estava tratando.
- Não toquei em `tts_silence_ms`, que parecia bug e é decisão sua.
