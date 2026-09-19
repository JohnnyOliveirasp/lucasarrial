# RONDA DAS FALHAS — 19/09, ~20hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_19h.md`.

**Método serial (regra 8):** peguei **UM** cartão — o `4ce9f365` (Ellen), o mais
abandonado da fila com aluna nomeada: 9,0 dias aberto e **8,9 dias sem ninguém
tocar**. Levei até onde dava sem GPU. **Não fechou**, e o §5 diz por quê.

**O achado desta ronda não é do cartão.** É que **o agente que a casa usa como
ouvido não ouve**, e vinha devolvendo laudo confabulado — inclusive numa nota
gravada há uma hora. Descobri porque desconfiei e rodei um **controle cego**.
Isso invalida o remédio que a ordem de 17/09 prescreve. §3.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
749 lidas da pasta "Sent" = 672 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura (`2026-09-18_enviados_x_tabela.cjs`),
instrumento independente: **0 carta depois do corte**, veredito "buraco é
PASSIVO".

Pasta **748 → 749** desde as 19hZ; tabela **671 → 672**. A do intervalo nasceu
com linha. As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** — decisão
de produção, não de ronda, e eu não a tomei.

⚠️ **Limite do instrumento, medido hoje:** a leitura da pasta só alcança
**desde 14/09**. Fui conferir se alguém já tinha escrito para a Ellen (queixa de
**10/09**) e **a janela não cobre**. Portanto **não afirmei em lugar nenhum que
ela ficou sem resposta** — nem na carta. Ausência de registro não é prova de
silêncio, e o `aluno.cjs` avisa isso na própria saída.

## 1. Estado da fila

| status | 19hZ | 20hZ |
|---|---|---|
| fixed | 289 | 289 |
| investigating | 82 | **81** |
| ignored | 60 | 60 |
| aguardando_aluno | 35 | **36** |
| open | 1 | 1 |

O único movimento é meu: o `4ce9f365` saiu de `investigating` para
`aguardando_aluno`.

### 1.1 Classe "precisa ver / ouvir" (ordem de 17/09)

**13 cartões**, o mais velho com **18,1 dias** (`702cc916`, 01/09). Era 14 com
18,0 nas 19hZ; a queda de 1 foi o `#344` de lá, e o mais velho ganhou o dia que
o calendário deu.

**E o número está inflado, medido agora.** A consulta da ordem casa `ilike`
contra o **histórico inteiro** de `agent_notes`. Cartão que **já teve** a
percepção despachada continua casando para sempre — o `702cc916` teve o áudio da
Katia tratado em 18/09 e segue na lista. O número serve de teto, não de fila
real. Quem for drenar, confira a **última** nota antes de contar o cartão como
parado.

> **E, pior que o número inflado: o remédio que a ordem manda aplicar não
> funciona. §3.**

---

## 2. `4ce9f365` — a aluna estava certa, e agora tem régua

`4ce9f365` · aberto **10/09 19:32Z** · **Ellen Garcia**, `ellen.atp@gmail.com` ·
queixa: *"pergunta sai lida como afirmação, sem subida de tom, fica robotizado.
Melhorou com pontuação mas pergunta continua lida como afirmação."*

### 2.1 Por que estava parado

4 notas, todas de **10/09**, nenhuma depois. A primeira, do `carol`, diz:
*"precisa de olho humano, não de código. O chamado FICA ABERTO até alguém
responder o aluno."* Ninguém respondeu. **8,9 dias.** É o padrão exato que a
ordem de 17/09 proibiu.

Ela é **pagante** (Hotmart `HP2973764536`, +100.000 cr em 09/09), acesso **ATIVO
até 09/10**, saldo **64.077**. Não está trancada.

### 2.2 Construí a régua que a casa não tinha

Nenhum instrumento do repositório media entonação: `medir_pausas_da_entrega`,
`medir_ritmo_das_vozes` e `medir_velocidade_voz` medem **tempo**. Entonação é
**altura**. Criei `_frank/ferramentas/2026-09-19_medir_entonacao_final.cjs`:
F0 por autocorrelação (ffmpeg + JS puro, sem dependência), e devolve a diferença
em **semitons** entre o miolo e o rabo de cada frase.

**Validei antes de usar**, contra sinal de resposta conhecida:

| sinal | Δ semitons | veredito |
|---|---|---|
| varredura subindo 180→240Hz | **+3,86** | SOBE |
| varredura descendo 240→180Hz | **−6,38** | desce |
| tom fixo | **−0,08** | PLANO |

Direção correta nas três. *(O tom fixo saiu com F0 absoluto errado — erro de
oitava, que é a armadilha documentada no cabeçalho. A régua vale para
**direção**, não para F0 absoluto. Está escrito lá.)*

### 2.3 A queixa dela, medida

Na 1ª entrega (`7ebe7f10`, 10/09 18:56):

| frase | Δ semitons | veredito |
|---|---|---|
| **"…e não sabe como começar?"** | **−1,80** | **desce** |
| "Faça assim." | −4,75 | desce |
| "Simples, não é?" | +0,50 | PLANO |
| **"Fácil, não é?"** | **+1,91** | **SOBE** |

A pergunta que ela reclamou termina **caindo**. Ela estava certa.

### 2.4 A causa óbvia está REFUTADA — não é pontuação sumindo

Contei as marcas **colapsando repetição** (contar `????` como 4 infla o número e
quase foi o erro desta ronda — a primeira leitura deu "14 → 3" e era artefato):

```
d99b95a2   RAW: 3 corridas de "?"   NORMALIZADO: 3 "?"
```

**O ponto de interrogação chega inteiro no sintetizador.** Logo, o conselho
"coloque mais pontuação" — que a Fast dá para esta classe — **não tem como
funcionar** para entonação. O `?` já está lá; a voz é que não marca.

### 2.5 O que a pontuação dela fez de fato, com controle

4 tentativas em 10/09, mesmo roteiro, **−3.971 créditos**:

| geração | crédito | o que ela mudou | a pergunta sobreviveu? |
|---|---|---|---|
| `7ebe7f10` | −815 | `começar?` | inteira |
| `9f9b82d1` | −952 | + reticências entre frases | inteira |
| `bb1f7639` | −1.034 | `começar????` `Minutos!!!!!` | inteira |
| `d99b95a2` | −1.170 | + `....` **no meio da pergunta** | **PARTIDA** |

- Repetição (`????`, `!!!!!`) é **colapsada** pelo normalizador: gastou crédito
  sem mudar nada.
- Os `....` **no meio da frase** agiram **contra** ela, e o controle está na
  própria tabela: só na `d99b95a2` o normalizador **partiu a pergunta em duas** —
  *"Você quer caminhar para ter resultados."* (afirmativa fechada) + *"E não sabe
  como começar?"*. Nas outras 3, sem `....`, a pergunta ficou inteira.
- Mas os `....` **fazem** o que ela queria para o **ritmo**: pausas **13 → 25**,
  silêncio **3,79s → 7,57s**.
- Fins de frase na `d99b95a2`: **11 → 21**. O normalizador picou o texto dela.

> **`mandato-normalizacao.ts` diz, no próprio cabeçalho, que a guarda devolve a
> palavra do aluno "sem mexer em pontuação nem no número de fins de frase".
> PALAVRA tem guarda (incidente #192). PONTUAÇÃO não tem. E pontuação é a única
> alavanca de entonação que o aluno tem na tela.** Registro como medição; não
> abri chamado (§6).

### 2.6 Mecanismo — e o plano de 10/09 está refutado

A nota do EXECUTOR de 10/09 propunha *"refabricar a referência de `3bdbd1eb` com
trecho que contenha frase interrogativa"*. **Medi as referências e esse plano não
resolveria**, porque as duas **já contêm pergunta**:

| referência | frase | Δ semitons |
|---|---|---|
| voz 1 `3bdbd1eb` | "Será que deveria sair da lua?" | +0,25 PLANO |
| voz 1 `3bdbd1eb` | "E se a aventura fosse assustadora?" | −3,55 desce |
| voz 2 `b99f6bbe` | "…como vamos conseguir levantar da cama de manhã?" | −3,54 desce |

Mapeamento frase→trecho conferido por **whisper com timestamp**, não por chute de
duração.

**Ela própria lê pergunta sem levantar o tom, e o clone copia o jeito da
gravação.** Ter `?` na referência **não basta** — precisa ter **subida**. Quem
for gastar GPU nisso, gaste com esse critério, não com o do plano antigo.

### 2.7 O que NÃO é problema dela: ritmo

Articulação entregue **2,319** e **2,368 pal/s** contra a velocidade real dela de
**2,33** (`voices.speech_rate_wps`). Bate. Diferente do `#344` (Gustavo), que
saiu **37% acima** da fala real. Este caso é entonação **pura** — e é exatamente
o que ela disse desde o primeiro dia.

### 2.8 Dinheiro

Pela regra canônica (`ref_type='generation_refund'`, **nunca** por `kind`):
**zero estorno** na conta dela, nenhuma cobrança em duplicidade, nada indevido.
Gastou **3.971 cr** nas 4 tentativas e mais **10.000** retreinando a voz em 11/09
— mesmo padrão do Gustavo: **o aluno se vira, pagando.**

**Não estornei.** Se a casa deve os 3.971 é decisão do Johnny, não de ronda. Foi
para o grupo, junto com a do Gustavo que ficou aberta ontem.

### 2.9 Entregue

Carta enviada 19/09, pasta Enviados **uid 2918**, registrada em `emails_enviados`
(origem `ronda-manual`). Contei: que ela estava certa e tem medição; que aumentar
pontuação **não** ajuda e por quê, para ela parar de gastar crédito nisso; que os
`....` partiram a pergunta dela; que o ritmo está certo; que o sistema às vezes
acerta (`"Fácil, não é?"`), então **não prometi conserto**; e ofereci rodar o
roteiro dela **por conta da casa** se responder **"pode rodar"**. Sem GPU até ela
pedir.

Cartão → **`aguardando_aluno`**. Nota conferida na releitura: 5 → 6 notas, array
preservado.

---

## 3. >>> O OUVIDO DA CASA NÃO OUVE — e eu quase escrevi isso para uma pagante

Segui a ordem de 17/09 e despachei os áudios da Ellen ao `olho`. Ele devolveu
parecer **detalhado e plausível**: *"não tem curva ascendente"*, *"a entonação é
uniforme e plana em tudo"*, *"em nenhum dos dois o final soa interrogativo"*.

Desconfiei e apliquei **CONTROLE CEGO**: mandei 3 arquivos — um **bipe de
440Hz**, um **silêncio puro** e a **fala** — pedindo só que dissesse qual era
qual, sem descrever nada.

```
controle_bipe.mp3     -> (d) não consigo abrir nem ouvir este arquivo
controle_silencio.mp3 -> (d) não consigo abrir nem ouvir este arquivo
ellen_ref_voz1.mp3    -> (d) não consigo abrir nem ouvir este arquivo
```

**Bipe contra silêncio é a discriminação mais fácil que existe. Ele não fez.**
Os dois fatos só fecham de um jeito: o parecer anterior foi **confabulado a
partir do texto que eu mandei junto**, não escutado.

E não é só "sem fundamento" — **é refutável pela régua**: ele disse "uniforme e
plana em tudo"; na mesma entrega, `"Fácil, não é?"` subiu **+1,91** e
`"Faça assim."` desceu **−4,75**. Uniforme não era.

**Se eu tivesse escrito para a Ellen em cima do parecer dele, teria mandado uma
afirmação falsa para uma aluna pagante**, com a autoridade de "nós ouvimos o seu
áudio".

### 3.1 O que isso faz com a ordem de 17/09

A ordem manda drenar a classe "precisa ver/ouvir" **despachando para o `olho`**.
Para **áudio**, esse caminho **não funciona — e falha em silêncio**, devolvendo
laudo bonito em vez de erro. Drenar 13 cartões assim produz 13 laudos
inventados, que é **pior** que 18 dias de fila parada, porque **parece
resolvido**.

Não reescrevi a ordem: ordem é do Johnny. **Levei ao grupo** e registrei aqui e
nos dois cartões.

### 3.2 Errata gravada no `#344`

A nota das **19hZ de hoje** usou esse parecer (§2.3 de lá). Ela já tinha
desconfiado pela metade — registrou que os **números** dele não fechavam e tirou
a lição *"modelo que ouve serve de OUVIDO, não de RÉGUA"*. A verdade é pior:
**também não serve de ouvido.**

Gravei errata no `b6486347` separando o que cai do que fica:

- **CAI** o veredito qualitativo ("v1 metálica e plana, v3 natural"). Ninguém
  ouviu aqueles áudios. Não afirme isso.
- **NÃO CAI** a conclusão do cartão: ela se apoia na articulação medida pelo
  `medir_pausas_da_entrega.cjs` (3,888 v1 × 2,872 v3 × 2,83 real), que é
  instrumento e roda sem modelo nenhum.
- **A carta ao Gustavo (uid 2917) NÃO fica falsa** — conferi antes de escrever a
  errata, porque carta que já saiu para pagante se confere, não se torce.

### 3.3 A regra que fica

> **Régua, não parecer.** Tempo/ritmo: `medir_pausas_da_entrega.cjs`. Entonação:
> a régua de F0 criada hoje. Para o que régua nenhuma alcança (timbre, "parece
> robô", se a imagem está certa), **a casa não tem ouvido nem olho** até alguém
> provar o contrário **com controle cego**. Quem for usar um agente para
> percepção: **rode o controle cego ANTES. Custa 6 segundos.**

---

## 4. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 749 = 749, 0 escrituráveis, conferida por
   instrumento independente.
2. **`4ce9f365` (Ellen) destravado** depois de 8,9 dias parado, com causa medida.
3. **Régua de entonação criada e validada** — a casa passa a medir F0, não só
   tempo.
4. **Ouvido falso desmascarado com controle cego**, e a errata gravada no `#344`.
5. **Uma carta a aluna** — Ellen (`ellen.atp@`), Enviados **uid 2918**.
6. **Quatro linhas no grupo** — a carta, o ouvido falso, a régua nova e a decisão
   dos 3.971 créditos.

## 5. O que eu NÃO fiz

- **Não fechei o `4ce9f365`.** O defeito é real e não foi consertado; é a classe
  de prosódia (`#47` / `#344` / este) e o conserto escrito (**PR #92**) segue
  **DRAFT desde 28/08**. Fechar seria a regra 14 de novo.
- **Não gastei GPU nem crédito**, e não estornei os 3.971 nem os 10.000.
- **Não abri chamado** para a pontuação sem guarda no normalizador: é a mesma
  família do `#192` e encosta em decisão de produto, e a ordem de 27/08 manda
  decisão ir pro Johnny, não virar chamado. Está medido no §2.5 para quem
  decidir.
- **Não reescrevi a ordem de 17/09** nem a consulta dela. Levei ao grupo.
- **Não mergeei nada.** PRs **#351**, **#355** e **#356** seguem abertos; o
  **#92** segue draft.
- **Não afirmei que a Ellen ficou sem resposta** — a janela da pasta não alcança
  10/09 (§0).
- **Não toquei** em migration, assinatura nem acesso de ninguém.
- **Não decidi o backfill das 77 cartas** do #101.
- **Não li a caixa do suporte@ para triagem.**
- **Nada da planilha** (ordem de 29/08).

## 6. Para quem pegar a próxima ronda

1. **Antes de despachar QUALQUER percepção, rode o controle cego** (§3). O
   caminho da ordem de 17/09 está quebrado para áudio. Se for imagem/vídeo,
   **assuma quebrado até provar** — não testei esses, e "não testei" não é
   "funciona".
2. **A classe "precisa ver/ouvir" (13, mais velho 18,1d) está inflada** (§1.1):
   a consulta casa o histórico inteiro. Confira a **última** nota antes de
   contar o cartão como parado.
3. **Se a Ellen responder "pode rodar"**: `refazer_audio_conta_da_casa` com o
   texto de `7ebe7f10`, medir com a régua de entonação nova e comparar o
   `"…como começar?"` contra o **−1,80** de hoje. Sem debitar crédito.
4. **Se a Ellen topar regravar a referência**, o critério medido é **subida**,
   não presença de `?` (§2.6). As duas referências dela já têm pergunta e nenhuma
   sobe.
5. **Próximos por abandono** (medido nesta ronda, já sem o `4ce9f365`):
   `35a808ad` (luminous.assessoria@, 8,1d sem tocar — **relata cobrança no
   cartão**, olhe esse primeiro), `797b64aa` (mcpaganatto@, 8,0d), `ec35016e`
   (welrisson@, 8,0d), `94843173` (rodrigo.limas.1978@, 7,2d — **pediu devolução
   total**).
6. **Terceiro caso da família "o que a casa achou que sabia".** `#334` e `#347`
   foram carta-de-outro-assunto; o `#344` foi teste-que-não-alcança-o-defeito;
   este é **laudo de um agente que não percebeu nada**. O padrão é sempre o
   mesmo: **a evidência não foi conferida na fonte.**
