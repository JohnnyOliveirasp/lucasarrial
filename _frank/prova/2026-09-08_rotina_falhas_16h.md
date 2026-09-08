# Ronda das falhas — 08/09/2026, ~15h20–15h50Z (Frank, dono da fila)

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: **grupo** (ordem de 31/08).

**Card levado adiante:** `#234` (`f8587cef`) — palavra decapitada no meio do
áudio entregue.
**Estado no fim:** incidente **continua `investigating`** de propósito; 1 lead
antigo **refutado**, 3 colunas declaradas mortas, 1 lead novo aberto com o
contraexemplo junto; nota 27 gravada e relida. Zero GPU, zero whisper, zero
crédito, zero e-mail.

---

## 0. A ronda em uma linha

**Confirmei que o conserto do `#226` chegou em produção, mas só 1 entrega
aconteceu depois dele — então não medi nada e disse isso em vez de inventar
número — e ataquei o `#234` pelo lado de graça: matei o lead que quatro rondas
vinham namorando e eliminei tudo o que restava de gravado nas vozes.**

---

## 1. O item que a ronda anterior deixou: FECHADO (mas sem medição)

A ronda das 15h pediu duas coisas.

### 1.1 O build fechou e a imagem está no ar — sim

O merge do PR #176 (`c1db335`) teve o build **`cancelled`**, o que sozinho
pareceria "o conserto não subiu". Não é isso. A `concurrency` do
`runpod-worker.yml` (`cancel-in-progress: true`) mata o run anterior quando
chega push novo na mesma ref — e o merge do PR #213 (`2adb080`) entrou **2
minutos depois**, em cima do `c1db335`. Quem construiu foi o run do `2adb080`,
que **contém o #176 como ancestral**.

Run `34240571817`, `success` em 34m46s. Saída real do passo de deploy:

```
template -> ghcr.io/johnnyoliveirasp/lucasarrial-runpod:2adb080
reciclando workers (0 -> 7)
deploy RunPod ok: ghcr.io/johnnyoliveirasp/lucasarrial-runpod:2adb080
VOX B: reciclando workers (0 -> 4)
deploy VOX B ok: ghcr.io/johnnyoliveirasp/lucasarrial-runpod:2adb080
```

Os **dois** endpoints (A `2jcta960kzc2m4`, B `0qd28qwo9ptcp4`) apontam para a
imagem nova e os workers foram reciclados às **15:21–15:22Z**.

### 1.2 Recontar as entregas abaixo do piso — NÃO DEU, e o motivo importa

O deploy fechou 15:22Z. Desde então, até 15:41Z, aconteceu **1 (uma) entrega**,
com cobertura 1,0.

**Uma entrega não mede nada.** O item 2 da lista da ronda anterior fica
**pendente por falta de volume**, não por falta de trabalho. Escrever "os gates
1 e 2 zeraram" em cima de n=1 seria exatamente o tipo de frase que este
caderno existe pra impedir.

Entregas de hoje por hora, pra dar a escala do que se pode esperar:

| hora (Z) | entregas | abaixo do piso 0,65 | pior |
|---|---|---|---|
| 00 | 4 | 0 | 0,938 |
| 01 | 2 | **2** | **0,0** |
| 03–12 | 7 | 0 | 0,769 |
| 14 | 11 | **2** | 0,435 |
| 15 (pós-deploy) | **1** | 0 | 1,0 |

**Para a próxima ronda:** a comparação honesta precisa de algumas dezenas de
entregas pós-`2adb080`. Pelo ritmo de hoje (~30/dia), isso é a ronda da noite
ou a de amanhã, não a próxima.

---

## 2. Triagem de aluno esperando, ANTES da fila

A varredura acusou 3 alunos com acesso vivo, crédito e nenhuma voz pronta, mais
1 com import quebrado. Regra: aluno esperando vem antes da limpeza da fila.
Conferi um a um e **nenhum precisa de ação minha** — registro pra próxima ronda
não gastar o tempo de novo:

| aluno | estado | veredito |
|---|---|---|
| `tania-araujo` | voz `9c145745` em `awaiting_training` há 4d, 30min de áudio, 200k créditos | **já avisada 2×** — conferido no Enviados, uid 1071 (05/09) e uid 1158 (06/09). A régua da casa (`ETAPAS_DIAS = [3, 14]`) é no máximo 2 lembretes e parar. |
| `marcelopersonalthe32` | voz `failed` de 10/08, 29 dias | **estornado e avisado**: `-10000` às 10:39 e `+10000 voice_train_refund` às 10:43 de 10/08. Crédito intacto, não retentou. |
| `luanmarcal.com` | import quebrou 29/08, 0 vozes, 10 dias | **avisado 2×**, incluindo a carta longa de 30/08 (uid 347) que explica o link fechado do Drive e pede resposta com o arquivo. Bola com ele. |
| `hellengrasso` | `rejected_too_short` há 2d | mensagem na conta explica (5 de 7 arquivos não chegaram). Classe do `#72`. |

**Não escrevi pra ninguém e não iniciei treino por conta própria.** Os dois
e-mails da Tânia oferecem, por escrito, iniciar o treino por ela se ela
responder — ela não respondeu, e disparar treino sem pedido gasta GPU e 10k
créditos sem o aluno pedir, o que a ordem proíbe.

### 2.1 Um detalhe que confirma o `#290` e não muda nada nele

O e-mail de 04/09 do `luanmarcal` (uid 624) carrega o parágrafo
*"NÃO inclui a assinatura da plataforma FastCloner"* — e ele tem acesso ativo
até 29/09 e 98.425 créditos. É o defeito do `#290`, e ele já está registrado
lá (nota 8 confirma `luanmarcal`, 04/09 04:13Z, **antes** do fix `0b672b2` de
07/09 01:52Z — não é regressão). O `#290` segue travado em duas coisas que não
são minhas: o **"pode" do Johnny** pro lote dos 7 (regra 8: e-mail em massa
precisa de aval) e a comprovação do ramo corretivo, que só vem quando um
assinante pagante comprar o SGP. Não reabri, não redecidi.

---

## 3. Por que o `#234`, e não outro

Ordenei os abertos por `created_at` e fui de cima pra baixo:

- **`#15`** (30/07) — travado: espera a próxima falha com a imagem nova e a
  migration 82 aguarda aval. Registrado desde 08/09 02hZ.
- **`#222`** (01/09) — travado em decisão do Johnny, medido em 06/09.
- **`#226`** (01/09) — travado por **falta de volume** (item 1.2 acima).
- **`#290`** (06/09) — travado no aval do Johnny (item 2.1 acima).
- **`#234`** (02/09) — **o único com passo livre já escrito**, no item 9 da
  nota 26: comparar os dois polos de taxa pelo que **já está gravado**, sem
  medir áudio (três medições de áudio já deram "não").

---

## 4. O que eu fiz no `#234` — e o que caiu

Régua de sempre: `release_ms <= 35 && plato_db > -40`, fronteiras internas =
todas menos a última. **99 vozes** com ≥30 fronteiras internas, 6.797
fronteiras, taxa global **13,1%**.

- **Polo ALTO**: as 12 maiores, de 29,9% a 54,1%.
- **Polo ZERO**: **17 vozes com zero decepadas**. Não é ruído de amostra
  pequena — a maior tem **85 fronteiras internas**, e 0 em 85 a uma taxa base
  de 13% tem probabilidade da ordem de **6e-6**.

### 4.1 Três colunas estão MORTAS (medido em 1.185 vozes, não em 29)

|coluna|estado na tabela inteira|
|---|---|
|`tts_silence_ms`|NULL em **1.185 de 1.185**|
|`tts_crossfade_ms`|NULL em **1.185 de 1.185**|
|`lora_alpha`|**um único** valor distinto (16)|

`tts_crossfade_ms` era a hipótese mais atraente que eu tinha ao começar:
crossfade governa exatamente a **junção de chunk**, que é onde a fronteira
interna mora. Ela não explica nada porque **não carrega nada**. Medi na tabela
inteira justamente pra não declarar coluna morta em cima de 29 linhas.

### 4.2 `is_stock` separa os polos — e é armadilha

Na população, `is_stock=true` dá **28,2%** contra **11,5%** (2,44×). Parecia
achado. **Não é:** as **7 vozes `is_stock` da base são todas do MESMO dono**
(`a661ec71`). Não é uma classe de produto, é o catálogo de uma conta — o mesmo
cohort do item 7, agora com 7 em vez de 5. É a **quarta** hipótese deste card
que fica linda em amostra pequena e morre na população.

### 4.3 O lead do item 7 está REFUTADO — a entrega da ronda

O item 7 suspeitava de *"voz sem LoRA + referência curta"* e dizia que só daria
pra testar com vozes sem LoRA de **outros** donos. **Não precisou:** dentro do
próprio cohort `a661ec71` já existe a variação que separa as duas coisas.

```
sem LoRA, referência de 3 a 10s:      49,4%  34,1%  27,9%  11,7%  5,3%
com LoRA, treino de 1.249 e 3.320s:   31,1%  12,1%
```

As duas faixas **se sobrepõem inteiras**. A voz com LoRA e treino de 3.320s
bate 31,1%, acima de três das cinco sem LoRA — e a **menor** taxa de todo o
cohort (5,3%) é de uma voz **sem** LoRA. Ausência de LoRA não prediz a taxa nem
dentro do lote onde ela estava confundida. O item 7 escreveu *"não afirmo"*;
agora dá pra escrever **"não é"**.

### 4.4 Lead NOVO, com o contraexemplo na frente

A taxa é propriedade da **voz** ou do **dono**? Importa: se for do dono, a
causa mora na **gravação** (ambiente, microfone, sessão) e não no modelo — e
isso muda quem conserta. Os 7 donos com ≥2 vozes medidas:

```
686df2e1: 0,0  0,0        amplitude  0,0
8467f5a0: 0,0  3,9                   3,9
4e1b8f68: 14,7 19,2                  4,5
98886550: 14,3 20,0                  5,7
9c469699: 0,0  6,3                   6,3
72e1121f: 7,0  44,6                 37,6   <-- CONTRAEXEMPLO
a661ec71: 5,3 ... 49,4              44,1   <-- catálogo, não é usuário normal
```

5 dos 7 têm as vozes coladas (≤6,3 pontos) contra 54,1 pontos na população.
**Sugestivo — e eu paro aqui.** O `72e1121f` sozinho contradiz (7,0 e 44,6 no
mesmo dono), e são 7 donos. Este card já produziu quatro falsos positivos em
amostra pequena; não vou plantar o quinto. Teste de verdade: decomposição de
variância aninhada (dono > voz) com muito mais donos, ou duas vozes treinadas
com material da **mesma sessão de gravação**.

### 4.5 Também caiu: comprimento da referência e idioma

- `reference_transcript`: polo ALTO (9 não-stock) média **412** chars, polo
  ZERO (17) média **378**. Sem separação útil.
- Idioma: sai es 36,7% / en 21,9% / pt 12,2%, mas são **5 vozes não-pt em 3
  donos**, 3 delas do `a661ec71`. Confundido pela quarta vez com o mesmo
  cohort. **Não citar esse número.**

---

## 5. O que NÃO está feito

1. **O `#234` continua aberto e longe de fechar.** Esta ronda **eliminou**
   caminhos, não achou a causa. O que sobrou sem olhar é o **conteúdo** da
   referência — e agora ele está mais isolado, porque este passo varreu todo o
   resto do que estava gravado em `voices`. Próximo passo escrito na nota 27.
2. **O `#226` não foi medido** (item 1.2) — falta volume, não trabalho.
3. **`#15`, `#222` e `#290`** seguem travados pelos motivos do item 3. Não
   reabri, não redecidi.

---

## 6. Higiene de fim de ronda

- Nenhum código mudou nesta ronda — só leitura e medição. Nada a mandar por PR.
- Este log vai direto na `main`, como manda a ordem.
- `git log --oneline origin/main..HEAD` conferido **vazio** depois do push.
- Nada de crédito, GPU, whisper, migration, assinatura cancelada, e-mail
  individual ou em massa.
- Scripts de uso único ficaram fora do git, em `_Bugs/`:
  `2026-09-08_polos_lora.cjs`, `2026-09-08_is_stock_populacao.cjs`,
  `2026-09-08_dono_e_idioma.cjs`.
