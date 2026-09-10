# Ronda das falhas — 10/09/2026, ~14h40–15hZ (11h40–12h BRT)

Dono da fila (14-A). Backlog **serial**. Repo em `main`, `pull --ff-only`.
Índice de ordens lido antes de tocar em nada. Ordem de **29/08** respeitada:
nada da planilha lido, escrito, classificado, avisado ou reprocessado; nenhum
chamado de causa-planilha aberto ou reaberto. Ordem de canal de **31/08**: o
aviso desta ronda vai **no grupo**.

**Item serial:** `#344` (`b6486347`) — o mais acionável com aluno esperando, e
o único com promessa escrita da casa em aberto. Os mais velhos que ele seguem
travados em decisão do Johnny (`#15`, `#47`, `#99`, `#223`, `#254`, `#265`,
`#309`, `#313`, `#341`), e o `#226` está com a janela de medição reiniciada
(marco `> 2026-09-09 21:46:19.158105Z`), como as rondas das 12h e 15h já
registraram.

---

## 1. O que eu encontrei antes de executar (e que mudou o quadro)

### 1.1 Armadilha de instrumento NOVA — timestamp de largura zero não é ausência

Medindo com `medir_pausas_da_entrega.cjs --palavras`, a ferramenta devolveu
para a entrega `09f8f761` (Luís Felipe):

    "sucesso": em 25.12s, dura 0.00s
    "fé":      em 25.12s, dura 0.76s

Duas palavras no **mesmo instante**, uma com duração **zero**. Cara de palavra
engolida. **Não é.** Recortei o trecho 20s–27,5s e transcrevi isolado:

> `"certeza que você carrega sobre amor, dinheiro, família, sucesso, fé e,
> principalmente..."`

As cinco faladas. O whisper degenera a fronteira de palavra em leitura de lista
rápida e distribui o zero de forma **arbitrária** — no arquivo inteiro
`dinheiro` saiu 0,30s e `família` 0,28s; no recorte as duas saíram 0,00s.

**Ausência de verdade tem outra assinatura:** o token **não aparece no texto
cru**. Foi o que confirmei em `ea11989a`, onde no lugar do "Fé" o áudio diz só
"o":

> `"...família, sucesso, o e, principalmente"`

⚠️ **O veredito da ronda das 15h sobre `ea11989a`/`873fcee4` continua de pé** —
quem errou não foi ela. O que precisava de trava era o **método**: ler zero como
ausência condena áudio bom.

### 1.2 Luís Felipe já tinha um áudio bom, e ninguém tinha visto

Depois das duas quebradas (15h56 e 16h11) ele gerou **de novo às 17h44**
(`09f8f761`, mesma voz JRM, mesmo texto). Transcrevi os 95,6s inteiros e
conferi contra o texto: a lista completa **com "Fé" e "Sucesso"** está lá, e as
**três** ocorrências de "quem" estão lá.

O QA tinha marcado `faltantes_amostra = ["quem"]` com `coverage_min_visto`
**0,75** — **acima** do piso 0,65. **Falso alarme**, e é o **segundo** medido
acima do piso (o primeiro foi `ec985b5a`/"idosa", na ronda das 15h). Anotado no
`#226`: reforça o item (c).

⚠️ **Limite honesto:** "quem" **não** é alvo de ocorrência única (aparece 3×, e
o `--palavras` casa só a primeira). O veredito só foi possível porque li a
transcrição **inteira** contra o texto — não pelo `--palavras`. A regra (c) da
ronda anterior continua valendo.

**Único defeito real na `09f8f761`:** onde o texto tem "Mas." sozinho, o áudio
acrescenta sílabas ("quer mais?" / "que é mais"). É **intrusão**, não palavra
faltando.

### 1.3 O caso do Gustavo é pior do que o chamado diz

Não é só "processa" e "treina" faltando. O modelo **substituiu** palavra e
desmontou a frase:

| | |
|---|---|
| texto | "O cérebro **processa** o que repetimos. Repetir **cuidado treina** resiliência." |
| áudio entregue | "o cérebro **é o processo** que repetimos, **repetir, cuidar, treinar,** resiliência" |

Virou lista solta e **perdeu o sentido**. O fecho também caiu: texto "Segue pra
entender o seu", áudio "Pra entender o seu".

---

## 2. A execução

Os dois autorizaram por escrito. Rodei `refazer_audio_conta_da_casa.cjs`,
**sem débito**, para os dois (o gêmeo junto, como o Vigia pediu no `#344`):

| aluno | origem | custo (não cobrado) | geração nova |
|---|---|---|---|
| Gustavo Sperandio | `8062ac72` | 423 cr | `e4d23ea9` |
| Luís Felipe | `09f8f761` | 1.922 cr | `5f4165eb` |

Pipeline conferido **antes** de disparar: 13 gerações prontas em 6h, nada preso
— o gargalo de GPU das 15h é do **Vídeo Clone**, outro pool. Os dois jobs
ficaram ~2,5–3,2 min em fila (`delayTime` 146s e 191s) e entraram em execução.

---

## 3. O que eu achei na caixa e que ninguém tinha cruzado

_(preenchido abaixo)_
