# Ronda das falhas — 24/09 ~11h45–12h30Z (Frank, dono da fila)

**Desfecho: ZERO incidente fechado. O que esta ronda entregou foi (a) a
descoberta de que o número do `#537` estava **inflado 2,5x** por uma regra podre
do meu próprio instrumento, com o conserto e a trava pra não voltar; (b) um
**segundo aluno pagante** da classe, que a lista inflada escondia; (c) carta
enviada a ele, o primeiro contato que a casa teve com ele na vida; (d) o fix de
código despachado ao `coder` com o vocabulário já auditado.**

Gasto: **zero GPU, zero crédito de aluno movido, zero migration, zero merge,
zero código de produção tocado, zero voz curada.** Escritas: 1 nota de
incidente, 1 campo `affected_emails`, 1 carta, 1 card no Mission Board, 1
ferramenta corrigida, este log.

Fila não baixou. É resposta legítima e está explicada abaixo.

---

## 1. Passos fixos da ronda

| Passo | Resultado |
|---|---|
| `reconciliar_envios_da_pasta --corte=2026-09-14T14:06:31Z --confirmar` | **0** carta escriturável. **1176 = 1176**, nenhuma sumiu (1099 já com linha + 77 fora da janela). Igual às 11hZ: nenhuma carta nova no intervalo. |
| `enviados_x_tabela` (irmão de leitura, independente) | **VEREDITO: 0 carta depois do corte.** Buraco segue **passivo**. |
| `percepcao_travada.cjs` | **0** travados · mais velho **0d**. Controle positivo (#310) e negativo (#518) OK, 530 varridos. |
| `pagante_trancado.cjs` | **0** pagante trancado · 0 na fronteira · **1 sem prova** (`drfabiovilhena29@gmail.com`, sem subscriber code no payload) — o mesmo de ontem e de hoje cedo, sem fato novo |
| Censo da fila | **116** abertos (estável) · **69 com 7d+** (+1) · mais velho **106,8d** |
| `fechados_que_disparam` | 17 fechados com sinal de vida, **2 vivos nas 48h** — `#544` e `#523`, **os dois já apurados** (o `#544` na ronda das 11hZ, o `#523` antes). **Nenhum fechado novo disparando.** |
| `esperando_johnny` | **17** parados em decisão · mais velho **55d** · **54 alunos** atrás da fila |

---

## 2. Por que este cartão, e não a cabeça da fila

As cabeças (`c726c5ae` 106,8d, `d3d8d1b2` 55,9d, `b706b32e`, `37bacb68`,
`702cc916`, `8b8fc4c8`, `7ed72ad0`) seguem **em decisão do Johnny**. Desci
conferindo um a um os mais velhos **acionáveis** e os três primeiros também
estavam travados fora da minha alçada, o que registro porque é o retrato da
fila hoje:

- `af06731f` (26,8d) — bola legitimamente do aluno desde 22/09, segunda
  tentativa feita, prazo de 7d ainda correndo.
- `446c3ae4` (17,6d) — trava no "pode" do Johnny pro e-mail de reparação dos 8
  (lote). 20 dias de espera. Metade de código já provada.
- `8c29740f` (19,8d) — não é mais bounce: o que destrava o aluno é a entrega do
  `#426`, que é decisão de dinheiro sobre 231–309 pessoas.

Peguei o **`#537` / `cfa488b5`** (17,7d): cartão de **classe**, com aluno
afetado, e o único da faixa em que o passo seguinte era **meu**.

---

## 3. `#537` — o número deste cartão era falso, e eu produzi o falso

### 3.1 O que estava escrito, e o que é

O instrumento de 23/09 (`2026-09-23_referencia_de_despedida.cjs`) marcava
**10 vozes** na família "despedida". Li o `reference_transcript` **inteiro** das
10 e registrei **qual regra disparou em cada uma**. São **4**, não 10.

Os 6 falsos positivos, com o trecho que os marcou:

| voz | trecho que marcou | o que é de verdade |
|---|---|---|
| `27f22432` | "voltou para casa menos **cansado**" | narrando uma viagem |
| `2ec55e46` | "cheguei bem **cansada** em casa" | roteiro de rotina do dia |
| `f2496819` | "Tem gente que chega **cansada**" | descrevendo os alunos dela |
| `c176dfe5` | "você já acordou **cansado** e pensou" | copy de anúncio |
| `8f640ad4` | "só fiquei **cansada** no final" | contando um passeio |
| `1477c630` | "**vou finalizar** semana que vem com vocês" | terminar um *feedback*, não a gravação |

**Cinco das seis vieram de uma regra sozinha, `/\bcansad[ao]\b/`: ela marcou 5 e
acertou ZERO.** "Cansado" é palavra de conteúdo, não de encerramento. Saiu.
E `vou finalizar`/`vou encerrar` agora exige a **gravação** por perto (≤30 chars
de `grava|audio|leitura|video|aqui`) — é exatamente essa exigência que separa o
caso real do falso.

Com os **mesmos 1405 registros**, antes → depois:

```
familia despedida   10  ->    4
uniao com score ruim 130 ->  125
donos                117 ->  112
```

### 3.2 A lição de instrumento, que vale mais que o número

O **controle positivo passava verde com a regra podre do lado.** Motivo: o texto
da Aline casa em **três** regras boas ao mesmo tempo ("fecho aqui", "já está
bom", "vou finaliz"). Ele exercitava **um** caminho e certificava a **marca
inteira**.

> **Controle positivo em um caso só valida o caminho daquele caso.**

E o controle negativo que existia (as 2 vozes da Aline **já curadas**) não
pegaria nada disso — voz curada não contém a palavra "cansado". Por isso o
`CTRL_NEG` agora carrega **os 6 falsos positivos nomeados**: se qualquer um
voltar a aparecer, o script **para** em vez de imprimir número inflado.

Isto é da mesma família do `percepcao_travada` (41 falsos em 17/09) e do
`dump_enviada` (o "0 cartas" por base64 em 18/09): **zero de instrumento cego
não é zero medido — e dez de instrumento largo não é dez.**

---

## 4. O achado que sobrou: segundo aluno pagante da classe

A regra nova revelou um caso que a lista inflada escondia no meio do ruído:
**`8225f199` "CHRIS 03"**, de **Christian da Silva Rocha**
(`jcsconsultoriadigital@gmail.com`), treinada 04/09. A referência dele é:

> "...vou encerrar essa gravação já se foram 28 minutos, tudo bem eu vou juntar
> esses 28 minutos, com os mais os outros 20 e alguma coisinha que tem lá, e
> nessa mistura de 20 daqui e 20 de lá vai dar 40."

**Ele não está falando: está administrando arquivo.** Mesmo mecanismo da Aline
(1 arquivo longo → `primary` → a janela cai no fim).

**O padrão se repete, medido:** treinou **3×** (CHRIS 01 19/08, CHRIS 02 20/08,
CHRIS 03 04/09) = **30.000 créditos**. A Aline treinou 5× = 50.000. Depois da
CHRIS 03 ele gerou em 04–05/09 e **parou de gerar**, apesar de seguir logando
(último acesso 22/09).

⚠️ **Isto é indício, não causa.** Não ouvi as gerações dele e não perguntei.
Registro como indício justamente para não virar fato por repetição.

**Pagante, conferido na Hotmart viva:** R$ 394 COMPLETE (avulsa Fábrica R$ 297
17/08 + assinatura R$ 97 04/09). `rec#3` OVERDUE. Saldo 121.300 cr.

Somei `8225f199` ao **controle positivo** do instrumento: é o único caso que
exercita a regra nova — sem ele, ela podia morrer sem ninguém notar. E somei o
e-mail dele a `affected_emails` do cartão (antes 1, depois 2, relido do banco).

---

## 5. Escrevi pra ele (regra 8: individual, decido sozinho)

**Enviados uid 3345, cópia CONFIRMADA**, registrado em `emails_enviados`
(chave `referencia-encerramento-chris-cfa488b5`). Conferi antes: **0 cartas**
nossas para ele na pasta Sent. Esta é a primeira vez que a casa fala com ele.

A carta diz: (a) o defeito é nosso, com o trecho que virou o modelo da voz dele
**citado literalmente**; (b) posso trocar o recorte por outro pedaço da **mesma
gravação**, sem custo, sem regravar, sem crédito, se ele responder "pode";
(c) **não ouvi os vídeos dele** — vou pelo trecho, que é o que eu consigo medir
daqui, e se ele está satisfeito não mexo em nada; (d) não prometi voz idêntica;
(e) sobre os 30.000 cr dos 3 treinos prometi **levar** a quem decide,
explicitamente **sem prometer devolução** (crédito é decisão do Johnny).

**Não curei a voz dele.** A cura troca o modelo de uma voz que ele não pediu pra
mexer — mesma razão pela qual a ronda de 23/09 deixou as 3 vozes antigas da
Aline intactas. Ofereci e espero o "pode".

---

## 6. O fix de código, despachado

Card **`41e23505`** no Mission Board, dono `coder`.

A causa, nomeada: `score_reference_transcript`
(`runpod-worker/voice_pipeline/reference.py:29`) sabe punir bordão, fronteira de
frase e frase-tema repetida, e **não tem nenhuma noção de "isto é a pessoa
falando SOBRE a gravação"**. A prova está nos próprios números do cartão: a ref
da Aline tirou **12,5** e a do Christian **9,0**, quando o corte de candidata
ruim é **25**. **A heurística aprovou as duas.**

O pedido é **termo aditivo** (penalidade ~70) com o vocabulário **já auditado
por mim** contra as 1405 vozes — mandei **portar do `.cjs`** em vez de
reinventar, e mandei explicitamente **não incluir "cansado"**, com o motivo
medido junto. Travas escritas no card: não tocar em `cut_mode` /
`_cut_snapped_candidate` / `_candidate_offsets` / `marcarFimDeFrase` / `wps` /
`rate_penalty` (PR #151 e #379, **estão em produção**), não mergear, branch + PR
base `main`, e prova obrigatória nos dois sentidos (os 4 reais sobem acima de
25; os 6 falsos positivos **não** ganham a penalidade).

---

## 7. Dívida declarada

A heurística está portada em **três** lugares: `reference.py`,
`_heal_ref_boundary.cjs` e o `2026-09-23_referencia_de_despedida.cjs`. Mexi
**só no terceiro**, que é instrumento de medição e não toca aluno. Quando o PR
do `coder` subir, os outros dois ficam defasados entre si — **isso precisa de
conferência, não de fé.**

---

## 8. O que precisa do Johnny (sem novidade minha nesta ronda)

Os mesmos de 11hZ, sem re-escalar (doutrina de 17/09: **lote, não repetição**):

1. **WhatsApp/telefone** para os 10 pagantes do `#249` (R$ 8.250,27, mais antigo
   44d). A alternativa por e-mail já foi eliminada por medição.
2. **Crédito do Gemini** (`olho`, `pesquisa`, `social`) — é o operário que ouve
   e vê. Enquanto não sai, "ouvir a voz do aluno" continua fora do meu alcance,
   e é por isso que a carta ao Christian declara que eu **não ouvi**.
3. Decisão (c) do `#234` (`TTS_TAIL_QA_INTERNO_MODO=reprovando`), na mesa **sem**
   recomendação minha.

---

## 9. Fim de ronda

- Log e instrumento commitados na **main** (regra 25-B). Nenhum código de
  produção tocado, nenhum PR aberto por mim.
- Escritas conferidas na releitura: `#537` **1 linha afetada, 1 → 2 notas**,
  status mantido `investigating`, `resolution_note` **não tocada** (0 chars);
  `affected_emails` **1 → 2**, relido do banco depois de gravar.
- Carta: `uid 3345` conferido na pasta remota, não no que o script planejava.

---

## 10. ADENDO — o que quebrou NA PRÓPRIA RONDA, depois do log acima

Escrito às ~11h57Z, depois que o corpo deste log já estava fechado. Registro
porque ronda que esconde o próprio tropeço não serve de prova.

### 10.1 O shell morreu cego, e o diagnóstico óbvio estava errado

Ao ir commitar este log, a ferramenta Bash parou de funcionar **inteira**:
`Exit code 1`, stdout e stderr **vazios**. Nem `echo alive` respondia. Despachei
um subagente pra terminar o commit e ele bateu no mesmo muro e concluiu "a Bash
está quebrada neste ambiente" — **diagnóstico errado**, e errado pela mesma
razão que o meu: não existe mensagem de erro.

A causa só apareceu porque tentei criar um worktree e o **git** falou o que o
shell não falava:

```
fatal: could not write to '/tmp/frank-land-main/.git': Disk quota exceeded
```

**`/tmp` é um tmpfs de 16G, estava com 13G usados (80%).** Entulho, ~9 GB só nos
dez maiores, tudo **worktree abandonado** de rondas e reviews anteriores
(`wt_ficha`, `gerente-358`, `gerente-react-branch`, `pr328-review`, `wt439`...).
Inodes estavam ok (33%) — era espaço mesmo. Escrever arquivo em `/tmp` devolvia
`EDQUOT`.

Lição que fica, e vale além desta ronda: **`Exit code 1` sem saída nenhuma não é
"a ferramenta quebrou", é "não consigo escrever em disco".** O agente fica cego
justamente no momento em que mais precisa enxergar.

### 10.2 O meu log caiu na branch do `coder` — a falha que estas ordens mandam caçar

Pior que o shell. O `coder`, despachado por mim no card `41e23505`, foi trabalhar
**no mesmo diretório em que eu estava rodando a ronda** e deu checkout numa
branch nova (`feat/referencia-nao-clona-encerramento`) **debaixo de mim**.

Resultado medido: meu commit caiu na **branch de feature**, não na main, e ainda
com **mensagem mentirosa** — `fix(#410): chamado aberto na chave velha volta a
somar`, sobra de um `/tmp/msg.txt` de outra sessão que o `-F` pegou antes de eu
reescrever o arquivo:

```
23540ef9  em feat/referencia-nao-clona-encerramento
          _frank/prova/2026-09-24_rotina_falhas_12h.md + a correção do instrumento
```

É exatamente o modo de falha que o passo fixo de fim de ronda existe pra pegar
(*"em 19/08 um fix de aluno ficou 9h preso assim"*). Desta vez pegou — mas pegou
**por acidente**, porque o shell caiu e eu fui olhar; não porque a conferência
rodou. Isso é sorte, não processo, e escrevo assim de propósito.

**Remediado à mão:** conteúdo replantado na main pelo commit **`f327906f`**, via
worktree descartável em `/mnt/Data/_land_main` (já removido, e **fora do /tmp**
justamente por causa de 10.1). Push conferido, `git log origin/main..HEAD`
**vazio**, e os dois arquivos conferidos **na `origin/main`**, não no que o
script pretendia fazer.

**Dívida que fica:** o `23540ef9` **continua** na branch do `coder` com o título
falso. Quem fechar o PR do `41e23505` tem que **derrubar esse commit** — o
conteúdo já está na main, e deixá-lo lá planta um "fix(#410)" mentiroso no
histórico da feature.

### 10.3 Despachado

Card **`ed5957d2`**, dono `coder`, com os dois defeitos e as duas travas pedidas:
operário nunca dá checkout na árvore compartilhada (worktree próprio, entregue
pronto pelo despacho ou hook que recuse), e worktree de agente não nasce mais em
`/tmp` (tmpfs, é RAM) e sim em `/mnt/Data` (916G, 4% usado). A limpeza dos ~9 GB
foi pedida como **lista para eu autorizar**, não como apagar — regra #101/#210:
worktree abandonado pode conter commit não publicado, e foi assim que trabalho
morreu em 23/09.

### 10.4 O que isto NÃO invalida

Nada do que está nos itens 1 a 7 dependeu do shell que caiu: a medição das 1405
vozes, a auditoria das 10, a carta ao Christian (uid 3345, cópia confirmada na
pasta remota), a nota do `#537` e o `affected_emails` foram todos gravados e
**relidos do banco** antes da queda. O que a queda atingiu foi só o transporte do
registro — e o registro está na main.
