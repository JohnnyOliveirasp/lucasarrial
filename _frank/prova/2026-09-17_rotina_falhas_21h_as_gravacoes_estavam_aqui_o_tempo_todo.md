# Ronda das falhas — 17/09 ~21hZ

**Item serial: o caso João Soares (`#449` / `#453` / `#454`). NÃO FECHADO —
mas o aluno saiu do escuro e a causa está medida.**

Em uma linha: **as 23 minutos de gravação que o aluno achou que tinha perdido
estavam no nosso servidor o tempo todo.** O que falhou não foi guardar o áudio
dele — foi a tela não ter dito que guardou.

---

## 0. Por que peguei este e não o mais velho

Os três cartões mais velhos da fila continuam **parados em decisão do Johnny**,
conferido antes de escolher:

| cartão | idade | dono do próximo passo |
|---|---|---|
| `#15` `d3d8d1b2` | 49,2 d | **Johnny** — a troca qualidade × entrega, entregue ontem com preço medido |
| `#226` `702cc916` | 16,0 d | **Johnny** — (a) falhar tudo × (b) só o grave, pedida 16/09 |
| `#234` `f8587cef` | 15,1 d | **Johnny** — ligar `TTS_TAIL_QA_INTERNO_MODO=reprovando` (gasta GPU) |

Nenhum tem passo meu. E a ordem permanente é explícita: **"aluno esperando vem
ANTES da limpeza da fila"**. O João é pagante (acesso até 10/10), escreveu
**três vezes** em 24 h, a última às 16:45Z, e estava travado sem conseguir usar
o produto que comprou. Peguei ele.

---

## 1. A afirmação que eu publiquei hoje e que está errada

A ronda do Vigia das 18hZ levou ao grupo, como achado principal, isto:

> *"o botão 'Enviar para treinamento' não envia treino, ele navega"* —
> `<Link href="/app/voice-cloning/new">`, sem `onSubmit`, sem POST. E:
> *"Quem clica cai num formulário 'Nova voz' em branco"*, o que
> *"dissolve o mistério dos zeros"*.

O cartão `99978e89` foi aberto com esse título às 13:44Z e fechado às 13:58Z.

**A leitura do elemento está certa e a conclusão está errada.** A navegação é
**por desenho**: o despacho do treino mora no **passo 02**, e
`voice-creator.tsx:253` busca `/api/v1/voice-clips` — ou seja, a tela de destino
**sabe** ler as gravações que estão no servidor. Trocar o `<Link>` por um POST
seria consertar o que não está quebrado.

Registro isto em primeiro lugar, e não no fim, porque foi **minha** conclusão
que foi pro grupo como fato.

## 2. O que o banco e o `ffprobe` dizem

Resolvi o `user_id` na tabela de origem antes de qualquer consulta
(`9bd61271-a98d-4249-8d97-26c0d910c43b`, via `aluno.cjs`) — a lição de ontem
sobre completar prefixo de memória. Listei o R2 por prefixo e **baixei e medi
cada arquivo**, em vez de acreditar no nome:

| arquivo | duração medida (`ffprobe`) |
|---|---|
| `gravador/take_…_34s.mp3` | 34,1 s |
| `gravador/take_…_233s.mp3` | 232,7 s |
| `gravador/take_…_122s.mp3` | 121,9 s |
| `gravador/take_…_170s.mp3` | 169,8 s |
| `gravador/take_…_300s.mp3` | 300,1 s |
| `recorder-test/ac19ec741c/take_1789570182664.mp3` | **288,0 s** |
| `recorder-test/ac19ec741c/take_1789570529649.mp3` | **242,7 s** |
| **total** | **1.389 s = 23,2 min** |

Mínimo exigido pelo treino: **1.200 s**. Ele **passa**, com 3 minutos de folga.

Os dois takes do celular **não trazem a duração no nome** (`take_<epoch>.mp3`,
sem o sufixo `_NNNs`) — é por isso que fui medir em vez de somar o nome. Se eu
tivesse somado só o que o nome declara, teria dado **859 s = 14,3 min** e eu
teria concluído que ele **não** passa no portão. Seria um número publicável e
errado, do mesmo feitio dos dois zeros de ontem.

**Os zeros do aluno são reais** — 0 vozes, 0 `training_jobs`, nenhum débito de
10k. A explicação é simples: **ele nunca submeteu o formulário.** Nada foi
cobrado dele indevidamente.

## 3. O que ele viu — a evidência é a tela dele, não a minha inferência

`frame_0012.jpg` do vídeo que ele mandou:

- URL: `fastcloner.com/app/voice-cloning/new`
- Título: **“01 · TREINAR VOZ / Nova voz”**
- Campo **Nome da voz vazio** (placeholder “Ex: Minha voz principal”)
- Bloco **“Requisitos: Mínimo 20 minutos de fala…”**
- **Declaração desmarcada**, botão **“Continuar →”**

O passo 01 é **só nome + declaração**. A lista de arquivos e o banner de
importação vivem no **passo 02**, atrás do “Continuar”. Então a tela reapresenta
**“Mínimo: 20 minutos de fala”** para quem acabou de gravar 23, e não diz uma
palavra sobre as gravações dele.

Palavras dele, e elas batem exatamente: *“ele volta para a tela inicial treinar
voz”* e *“não me dá nenhuma confirmação de enviado ou recebido, nada”*.

## 4. O defeito, em dois pedaços — e o segundo está invertido

**(A) O passo 01 não reconhece quem acabou de gravar.** Reapresenta o requisito
a quem já o cumpriu. Quem vem do Gravador lê como “não salvou, comecei do zero”.

**(B) A única confirmação que existe está ligada na fonte errada.**
`voice-creator.tsx:786` renderiza *“N gravações carregadas”* sob a condição
`recorderImport`. E `recorderImport` só é setado no efeito do **IndexedDB**
(~236). O efeito do servidor seta `clipesDoServidor` (253), que **nunca é
renderizado como confirmação** — só serve de guarda de erro em 813. O efeito
dos takes do celular **não seta nada** no sucesso.

Agora cruze com `voice-recorder.tsx:108-111`: **assim que o upload pro servidor
confirma, o clipe é APAGADO do IndexedDB.**

> **Upload bem-sucedido → nenhuma confirmação.
> Upload falho → banner verde.**

A confirmação aparece exatamente para quem ela **não** deveria tranquilizar. De
quebra, o atalho de `770` (`{!recorderImport && …}`, cujo comentário diz que é
escondido *“quando o aluno já veio do Gravador”*) aparece justamente pra quem
acabou de vir de lá, e o manda de volta.

É **regressão do merge de 02/09**, quando o servidor virou fonte de verdade e a
lógica de confirmação ficou presa no IndexedDB. O `#235` consertou o silêncio do
caminho antigo; o caminho novo nasceu mudo do mesmo jeito.

## 5. O que saiu daqui

- **E-mail enviado ao aluno**, individual, decisão minha (regra 8 de 21/08).
  Diz que os 23 min estão salvos, que o erro foi da nossa tela e não dele, e dá
  os 5 passos pra concluir hoje — com pedido explícito de me avisar se o botão
  **Treinar** ficar apagado, pra ele não bater numa segunda parede sozinho.
  **Cópia confirmada na pasta de enviados, uid 2675.** Chave
  `joao-gravador-passo-que-faltou` (trava anti-duplicata).
- **Cartão `fd7f4ccc`** no Mission Board pro `coder`, com os defeitos (A) e (B)
  separados, o teto de 20 arquivos, a exigência de i18n, e o teste que fecha a
  regressão: **IndexedDB vazio + servidor com clipes ⇒ a confirmação aparece.**
  Branch + PR com base `main`, **sem merge** — volta pra revisão.
  Instrução explícita de **não** trocar o `<Link>` por POST e de **não** encostar
  em `lib/audio/medicao.ts` (cicatriz dos `#203`/`#253`/`#287`).
- **Nota gravada nos três cartões** do aluno — `#449` (6→7), `#453` (3→4),
  `#454` (2→3), cada uma conferida na releitura, 1 linha afetada. A correção do
  item 1 está escrita lá dentro, não só aqui.

## 6. O que eu NÃO afirmo

- **Não digo que os 188 são vítimas disto.** 188 é quem tem acesso vivo, crédito
  pra treinar e zero voz. Não existe linha no banco dizendo quem chegou no
  Gravador e parou — os clipes moram em IndexedDB e R2, não em tabela. É **teto
  de exposição, não contagem de vítimas**, e segue sendo.
- **Não afirmo que o aluno vai conseguir agora.** Medi que o áudio dele passa no
  portão dos 20 min e que a tela de destino sabe buscar os arquivos. Não vi a
  tela dele depois do “Continuar”. Por isso o e-mail pede retorno, e por isso os
  três cartões continuam **`aguardando_aluno`** — não marquei `fixed` em cima de
  uma previsão (regra 14).
- **Não afirmo que (A) e (B) são a causa de todo caso parecido.** São a causa
  **deste**, com o frame da tela dele como prova.

## 7. Estado e dinheiro

Não gastei GPU, não virei chave, não toquei em crédito, acesso, voz nem
migration. Não li, escrevi, classifiquei nem reprocessei nada da planilha
(ordem de 29/08). Não abri chamado de atendimento/processo/decisão. Leitura no
banco, no R2 e no código, mais um `ffprobe` em cópia local.

Cartões do aluno seguem `aguardando_aluno`. Nenhum incidente fechado nesta
ronda — e **isso é resposta legítima**: o conserto de tela não subiu e o aluno
ainda não treinou. Fechar aqui seria fechar mais rápido do que resolvo.

## 8. Lição

Ontem a lição foi *“todo zero precisa provar que é um zero”*. Hoje ela tem irmã:
**todo número que veio de um rótulo precisa provar que veio de uma medição.**

O nome do arquivo (`take_…_300s.mp3`) parece dado. Não é — é rótulo escrito por
quem gravou. Os cinco do navegador traziam o sufixo e batiam com o `ffprobe`. Os
dois do celular **não traziam**, e somar só o que o nome declarava daria 14,3
min: eu teria dito ao aluno *“faltam 6 minutos, grave mais”* — mandando um
pagante regravar áudio que ele já tinha entregue, por causa de uma convenção de
nome de arquivo.

E tem a lição maior, que é sobre pressa: eu li o `<Link>`, vi que não havia
POST, e a conclusão *“o botão não envia”* era **verdadeira sobre o elemento e
falsa sobre o sistema**. O que me salvou não foi desconfiar — foi ir ver o
**passo seguinte** antes de publicar. Achado que explica o sintoma na primeira
leitura é o mais perigoso que existe, porque ele desliga a vontade de procurar o
resto. **Ler o elemento não é ler o fluxo.**
