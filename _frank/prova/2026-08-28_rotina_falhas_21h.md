# Rotina das Falhas — 28/08/2026, ~21h UTC (dono da fila)

Abertura: `git checkout main && git pull --ff-only origin main` → já atualizado,
árvore limpa. Índice de ordens lido antes de tocar em qualquer coisa. Ordens
aplicadas: `2026-08-20_dono_da_fila_e_fila_zerada.md` (14-A e as armadilhas
medidas), `2026-08-27_vigia_so_erro_de_sistema.md` (14-C), regra 8 de 21/08
(serial + e-mail individual sem pedir permissão) e regra 7 (só fato consumado
no grupo).

Ronda anterior das falhas: 19h40 UTC. Vigia: 20h UTC.

---

## Placar

| | |
|---|---|
| Incidentes fora de `fixed`/`ignored` na abertura | 8 |
| Aluno para quem escrevi | **1** — Giovanna (`#133`) |
| Incidentes que abri | **1** — `#178` (a Fast inventando fato técnico) |
| Incidentes que anotei | **2** — `#133` e `#151` |
| Incidentes que fechei | **0** — nenhum estava resolvido; explico cada um |
| Crédito que toquei | **nenhum** |
| GPU/retreino que disparei | **nenhum** |
| Migration / PR mergeado / código na main | **nenhum** (só este log) |

---

## 1. A escolha do serial, declarada

Régua da regra 8: *o mais antigo com aluno afetado*. Percorri a fila por idade
e **conferi o estado atual antes de descartar** — o passo (1) do manual, que é
o caso mais comum:

| candidato | idade | por que não / por que sim |
|---|---|---|
| `#11` | 37,9 d | **Ninguém sofrendo.** Os 3 afetados foram apurados em 27/08 e nenhum está sem entrega; a migration 97 foi aplicada **hoje 18:05Z**, então a régua de fechamento (próxima ocorrência nasce com traceback) agora é cumprível. Não está travado — está esperando evidência. |
| `#15` | 29,3 d | Travado no Johnny desde a ronda das 19h40: falta `FASE_TELEMETRIA_SECRET` em produção e o merge do `feat/fase-telemetria-url-publica`. Nada meu a fazer. |
| `#120` | 4,4 d | Travado em decisão de reembolso do Johnny/Lucas. A aluna já foi respondida em 27/08 e o produto é do curso, que nosso `payment_events` não enxerga. |
| **`#133`** | **3,1 d** | **A bola era NOSSA e a aluna estava sem resposta há ~2h.** Escolhido. |

## 2. `#133` — a queixa já não era a do título

O Vigia tinha razão às 20h: o título fala da **voz**, e a voz **está resolvida
pela própria aluna** (19:32Z, uid 358: *"a minha voz está ok, porque migrei a
voz"*). O que estava vivo era **Vídeo Clone**: *"ficou mto artificial... queria
que fosse mais natural e parecido cmg"*.

### A hipótese que eu levantei e que a minha própria medição derrubou

O clone dela não sai de uma foto dela: sai de uma imagem do **Gerador**
(`image_path` → `/images/<id>/result.png`, `kie_model gpt-image-2-image-to-image`,
feita a partir de 6 fotos de WhatsApp dela de 12/08). Suspeitei que a imagem
gerada tivesse **se afastado do rosto dela** — o que explicaria "parecido cmg"
sem nenhum defeito de lip-sync.

Baixei do R2 a foto real de referência e as duas imagens geradas e **olhei as
três**. A semelhança está **boa** nas duas. **Hipótese refutada pela evidência
que eu mesmo fui buscar.** Registro porque ela quase virou e-mail — e um e-mail
dizendo "a imagem não ficou parecida" seria falso e ainda por cima ofensivo.

### A causa de verdade: enquadramento, e a correlação de 13 minutos

As duas gerações de hoje saem de fotos diferentes:

| geração | hora | dur. | tier | imagem de origem |
|---|---|---|---|---|
| `d43b650e` | 18:23Z | 58,22 s | Turbo | `3d014a44` — **sentada**, rosto grande no quadro |
| `1afcd3f7` | 19:19Z | 30,40 s | Turbo | `5d39b23d` — **corpo inteiro**, rosto pequeno |

As duas imagens têm 941×1672 e o vídeo sai 480×832 (`config.ts:47-62`), escala
~0,50. Medindo a altura do rosto por recorte: **~360 px** na sentada contra
**~190 px** na de corpo inteiro → no vídeo, **~180 px contra ~95 px**. O vídeo
da queixa tem **cerca de metade** da altura de rosto do outro, e lip-sync com
~95 px de rosto entrega boca e expressão grosseiras.

**Correlação forte:** ela escreveu 19:32Z, **13 minutos depois** de gerar
justamente o de rosto menor.

**Método declarado:** medição por recorte visual, **não** por detector de face.
Por isso escrevi "cerca de metade" e não cravei o pixel. E **não confirmei com
ela** qual dos dois a incomodou — no e-mail isso foi como suspeita, não fato.

### Não é bug (teste de bolso da 14-C)

O lip-sync anima uma foto parada e não inventa gesto — mesmo limite que o `#168`
mediu e fechou hoje. A escolha da foto é da aluna, e a tela oferece histórico do
Gerador **ou** upload (`clone-studio.tsx:4`). Sem defeito de código, sem chamado
por este pedaço.

### Dinheiro: conferido pela régua certa, nada a devolver

`credit_transactions` por **`ref_type`**, nunca por `kind` (armadilha de 20/08):
segue existindo **1 única** linha de estorno, `ref_type=generation_refund`,
`ref_id=incidente-c15ece48-testes-12-08`, +8.527 em 25/08. Sem estorno em dobro.
Os `video_clone` de hoje batem com o tier: 4.720/59 s e 2.480/31 s = **80 cr/s
exatos**, igual a `cloneCreditsCost` (`config.ts:81-84`). Cobrança **certa**.
Saldo 62.800, acesso até 19/09.

### O e-mail

20:47:55Z, endereço conferido contra `affected_emails` **e** `profiles` antes de
mandar (armadilha do Cláudio), bcc `suporte@`, ensaiado em `--dry-run` com os
acentos lidos na saída, e **conferido em Enviados depois** (uid 289).

Um detalhe que eu conferi em vez de supor: no `--dry-run` o corpo aparecia com
`&mdash;` literal. Fui ler o `enviar_email.cjs` — ele manda **`text/html` de
parte única** (linha 234), então a entidade renderiza como travessão no cliente
dela; o literal era só a raspagem de tags do `ler_caixa`. **Não havia defeito.**

Conteúdo: o limite do lip-sync dito com todas as letras; a causa do
enquadramento e a receita (foto do peito pra cima); e **uma** refação por conta
da casa **quando ela mandar a foto** — GPU só depois que ela pedir. Não prometi
que vai ficar natural.

**Não empurrei o Padrão 2.0.** Seria fazê-la gastar 31% a mais (105 contra
80 cr/s) em cima de palpite: os blurbs oficiais dizem que os dois tiers são
**o mesmo motor**, e nenhum é descrito como mais natural. Escrevi isso pra ela
nessas palavras.

## 3. Abri o `#178` — a Fast inventou fato técnico

Enviados uid 285, 19:35:11Z, texto cru: *"O Turbo costuma sair mais natural e
tem o melhor custo-benefício — se você usou o Padrão, vale tentar de novo com o
Turbo."* Dois defeitos:

1. **"mais natural" não existe em lugar nenhum.** `manual.ts:134` diz só *"Turbo
   é o melhor custo-benefício"* — claim de **preço**. Os blurbs de
   `config.ts:44-63` descrevem Padrão 2.0 como *repetível* e Turbo como *opção
   econômica **no mesmo motor***. A Fast pegou um claim de custo e o extrapolou
   para **qualidade**.
2. **Conselho por palpite:** ela já estava no Turbo. As **4** gerações dela são
   todas `480p-v2`. A Fast não consulta o tier usado e chuta.

Pelo teste da 14-C **é** erro de sistema: o `manual.ts` não carrega nada sobre
o limite do lip-sync nem sobre enquadramento — exatamente as duas perguntas que
alunos fazem sobre Vídeo Clone (`#168` foi gesto, `#133` foi "artificial"). Sem
esses fatos, a Fast preenche o buraco inventando, e vai reincidir.

As três checagens da 14-C, escritas na abertura: **(1)** não existe — o `#175`
é outro defeito (o número do preço) e está `fixed`, e o preço que ela citou hoje
(105/80) saiu **certo**, prova de que o PR #85 pegou; **(2)** não foi corrigido
— o único toque recente em `manual.ts` é o `0e0a796`, que mexeu só nos números,
e nenhum PR aberto toca no arquivo; **(3)** dinheiro conferido acima com
`ref_type` + `arquivo:linha` da cobrança — nada a estornar.

## 4. `#151` (Zethe): não peguei, mas deixei medido

Não era o serial desta ronda, mas **existe uma promessa nossa sem dono e ela
está esperando por ela**: Enviados uid 284, **19:15:11Z** — *"repassei tudo isso
pro responsável técnico... **ele vai refazer e te avisar quando tiver pronto**"*.
Não existe "ele". É a mesma classe que o Frank escalou às 15h50Z, e é ocorrência
**nova**, posterior às 4 que o Vigia contou às 16h.

Anotei no chamado o que a próxima ronda precisa pra não começar do zero: a
queixa dela é **degradação ao longo do áudio** (*"até a metade foi ótimo; do
meio para o final começou a disparar"*), que aponta chunking e **não** régua
global — e dá pra separar as duas hipóteses **sem GPU**, comparando 1ª e 2ª
metade com `medir_pausas_da_entrega.cjs`. O segundo sintoma ("Dra Elizete" →
"Elizete si") é do **normalizador**, e há 3 PRs dele mergeados hoje: conferir
antes de refazer, senão a terceira promessa queima igual.

## 5. Processo: o grupo continua mudo nesta máquina

`avisar_grupo.cjs --fato` falhou com `WAHA_API_URL/WAHA_API_KEY ausentes nesta
máquina` — **terceira ocorrência hoje** (Vigia 18h, ronda 19h40, esta). Os fatos
consumados **não chegaram ao grupo**. Não digo que avisei, porque não avisei.
Foi por Telegram (msg 566). Pela 14-C isto é **processo**: 1 linha aqui +
Telegram, sem chamado.

---

## Pro Johnny — o que é decisão dele

1. **Os 30.000 da Giovanna** (3 treinos de 12/08, **dois na mesma voz**) seguem
   pendentes há dias. Acima do meu teto de 20k/caso. É o **único** motivo do
   `#133` continuar aberto.
2. **O `#178` tem conserto barato:** três linhas no `manual.ts` (limite do
   lip-sync, enquadramento, e tirar a dica solta que pode ser lida como
   qualidade). Enquanto não entrar, a Fast reincide.
3. **A promessa fabricada bateu na Zethe às 19:15Z.** Continuo sem abrir chamado
   dessa classe sem o "pode" dele.

## O que eu NÃO fiz

- Não fechei nenhum incidente. **Nenhum estava resolvido** — e a ordem de 21/08
  é pra fechar mais, não pra fechar mais rápido do que resolve.
- Não gastei GPU, não disparei retreino, não cobrei nem devolvi crédito.
- Não apliquei migration, não mergeei PR, não commitei código (só este log).
- Não li a caixa do `suporte@` pra triagem; só os **enviados** das duas alunas
  que eu já estava tratando.

---

## Fim de ronda — conferência fixa

```
git fetch origin
git log --oneline origin/main..HEAD   → VAZIO
git rev-parse --abbrev-ref HEAD       → main
git status --short                    → limpo
```

Esta ronda produziu **um único artefato de git — este log — e ele vai direto na
`main`**, não em branch de feature. Era o risco de 19/08, quando um fix de aluno
ficou 9h invisível dentro de um `feat/`.

Lembrete que esta ronda reencontrou na prática, agora do lado bom: a migration
97 do `#11` foi **aplicada hoje**, e por isso aquele chamado saiu de "travado há
37 dias" para "esperando a próxima ocorrência". DDL commitado não é DDL
aplicado — e quando é aplicado, muda a régua de verdade.
