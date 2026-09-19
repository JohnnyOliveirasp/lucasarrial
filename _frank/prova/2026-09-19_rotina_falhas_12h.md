# RONDA DAS FALHAS — 19/09, ~12hZ

Dono da fila (14-A). Ronda anterior: `2026-09-19_rotina_falhas_11h.md`, que fechou
**25 minutos antes desta**. Método serial da regra 8: peguei **um** incidente e
levei até onde ele dá pra ir hoje.

---

## 0. Passo fixo — reconciliação dos envios (#101)

```
699 lidas da pasta "Sent" = 622 já tinham linha + 77 fora da janela + 0 escrituráveis
🕳️ cartas que saíram e não têm linha, DENTRO da janela: 0
```

Conferido com o irmão de leitura, que é instrumento independente
(`2026-09-18_enviados_x_tabela.cjs`): **0 carta depois do corte**, veredito
"buraco é PASSIVO". As **77 anteriores a 14/09 14:06:31Z seguem sem decisão** —
continua sendo decisão de produção, não de ronda, e eu não a tomei.

## 1. Estado da fila

| status | n |
|---|---|
| fixed | 278 |
| investigating | 91 |
| ignored | 59 |
| aguardando_aluno | 34 |
| open | 2 |

**Classe de percepção (ordem de 17/09): 13 cartões**, o mais velho de **01/09 —
18 dias**.

⚠️ **Ressalva honesta sobre esse 13:** a consulta da ordem casa por PALAVRA no
texto da nota (`ilike '%ouvir%'`, `'%assistir%'`...), então ela **superestima**.
Abri três e dois não são percepção: o `702cc916` é decisão de produto do Johnny
(`qa_exhausted`) e o `ab5644be` já teve a hipótese **refutada por medição** em
07/09. O número não é falso, é **grosso** — quem for usar como fila tem que abrir
antes de despachar, senão manda o `olho` caçar artefato que não existe. Registro
o 13 porque a ordem manda registrar, e registro o defeito do instrumento junto.

---

## 2. O que quase deu errado: a passagem da ronda anterior estava errada

A passagem das 11h me mandou tratar a **Katia** como prioridade 1, dizendo
*"continua sem resposta"*, *"sem resposta desde 07:03Z"*, *"é decisão do Johnny"*.
**O banco dizia o contrário:**

- estorno de **400 cr** às **11:29:20Z** (`ref_type='generation_refund'`, conferido
  por ref_type e não por kind — a armadilha de 20/08);
- carta pra ela às **11:31:54Z** (`emails_enviados`, origem `ronda-manual`).

Abri a carta (uid 2866 da pasta Sent) e **ela está correta**: admite que o áudio
reprovou no nosso próprio QA, **corrige por escrito a carta errada de ontem**,
conta que o estorno anterior tinha sido anunciado e não executado, e não promete
prazo que não controla.

**Se eu tivesse obedecido a passagem, eu teria escrito uma segunda carta
contradizendo uma carta boa, na frente de uma aluna pagante que já foi
contrariada uma vez esta semana.** A passagem não foi má-fé: o log das 11h foi
escrito **antes** de a própria ronda terminar o serviço. Mas a lição é de
processo: **passagem é relato, banco é fato.** Confira no banco antes de agir em
cima de "o anterior disse que faltava".

**Não escrevi pra Katia.** Ela está atendida, com dinheiro de volta e com a
verdade na mão. Silêncio aqui é o certo, não omissão.

### O vão de instrumento que isso expôs (e que eu fechei)

Pra descobrir isso eu precisei ler **o corpo** da carta — e não havia instrumento:
`emails_enviados` guarda `message_id` e **não guarda corpo**, e o `dump_enviada.cjs`
pede um **UID**, que é número de caixa e não existe em lugar nenhum do banco.

Commitei a ponte (`c80af277`), com dois modos, porque a ronda faz duas perguntas:
por **Message-ID** ("abre esta carta") e `--para <e-mail>` ("a casa já escreveu
pra ele?").

O segundo modo importa mais do que parece: **`emails_enviados` só nasceu em
~14/09.** Para aluno que reclamou antes disso, **0 linha na tabela não prova que
ninguém escreveu** — e foi exatamente o caso do #329 abaixo: **0 linha na tabela,
38 cartas na pasta Sent.** Quem confiasse na tabela concluiria abandono onde
houve atendimento.

Rodei controle **positivo e negativo** no mesmo comando, porque zero que não
discrimina não vale nada: Katia → 36 cartas (inclui a 2866 que eu já sabia que
existia); #329 → 38; Message-ID falso → NADA; destinatário falso → NADA.

---

## 3. O incidente que eu peguei: `#329` / `85ca1863` — Vídeo Clone do Mastroianni

Aluno **pagante**, `contato@mastroiannioliveira.com.br`, esperando desde
**09/09 — 10 dias**. O cartão estava `investigating` com o assunto verdadeiro
declarado em aberto: a insatisfação com o Vídeo Clone.

**Despacho de percepção cumprido (ordem de 17/09):** baixei os 6 artefatos do R2
(2 fotos de entrada + os 2 vídeos **pagos** que sobraram + o refazimento da casa
e a foto dele) e despachei o veredito visual pro `olho` — cartão **`c677967f`**.
Não escrevi "precisa de um humano olhar".

### 3.1 O que eu medi sozinho, sem depender de olho nenhum

`ffprobe`:

| | |
|---|---|
| foto que **ele** mandou | **941 × 1672** |
| vídeo que a casa **entregou** | **480 × 832** (os três, sem exceção) |

Downscale de **1,96× linear** — o rosto chega com **~1/4 dos pixels** da foto
dele. Isso é **por desenho, não defeito**: os três tiers se chamam 480p, 480p-v2
e 480p-v3 e todos declaram 480×832; o 720p foi **removido em 04/08 por decisão do
Johnny**. Não existe hoje caminho no produto pra entregar mais detalhe facial.
Registro como contexto, não como a falha — ele escolheu dentro do que a casa
oferece.

### 3.2 A falha de verdade: o aviso está no tier errado

`frontend/src/lib/video-clone/config.ts` documenta, **do próprio punho da casa**,
o sintoma exato da reclamação dele — mas **só no Padrão 2.0** (`480p-v3`):

> "Em áudios longos (acima de ~40s) o rosto pode se afastar da foto ao longo do
> vídeo: prefira vídeos curtos."

O blurb do **Turbo** (`480p-v2`) não tem **uma palavra** sobre isso: *"Opção
econômica **no mesmo motor**: corta o vídeo exatamente no fim do áudio; cada
geração varia um pouco."*

**"No mesmo motor" é escrito pela própria casa.** Se o motor é o mesmo
(InfiniteTalk; v2 × v3 muda steps, não arquitetura), a deriva acima de ~40s vale
igual nos dois — e só um avisa. O aluno vê esses textos: `clone-studio.tsx:523`
renderiza `opt.blurb` por tier. Ele leu o do Turbo, que nada avisava.

Agravantes medidos:

- **O Turbo é o mais barato** (80 cr/s contra 105). Quem vai fazer vídeo **longo**
  escolhe o barato — o tier **sem aviso** é exatamente aquele pra onde o preço
  empurra, e é o regime que quebra.
- **`CLONE_MAX_AUDIO_SECONDS = 90`**: a plataforma aceita o **dobro** do limite
  seguro que ela mesma documenta (~40s), sem gate e sem alerta na hora de gerar.

### 3.3 O dinheiro, com ref_id e número fechado

**49.025 cr** em Vídeo Clone, 13 jobs, 09–10/09. **Nenhum estornado** — conferido
por `ref_type`, não por `kind`, e não existe nenhuma linha de estorno de vídeo na
conta dele (o único estorno que ele tem é de imagem, 525 cr, 08/09).

| regime | cr |
|---|---|
| ≤40s — cobrança legítima, recebeu o que o produto promete | **7.425** |
| **>40s, TODOS no Turbo** (o tier que não avisa) | **41.600** |
| soma (fecha com o total) | 49.025 |

**Isto corrige o "~20k créditos" que estava escrito no próprio cartão: o número
em disputa é 41.600 — mais que o dobro do que a casa vinha estimando.**

### 3.4 O que eu NÃO fiz no #329

- **Não devolvi crédito e não prometi devolução.** 41.600 cr é decisão do dono.
  Levei ao grupo com o número fechado e a recomendação (devolver), marcada como
  recomendação.
- **Não dei veredito visual próprio.** Não afirmo "o rosto ficou diferente" porque
  não é medição minha. Está com o `olho`; quando chegar, entra no cartão marcado
  como veredito de agente — e **conferido**, porque veredito de agente sem
  conferência não é medição.
- **Não escrevi pra ele.** Foi respondido em **13/09** (uid 2081, li o corpo) com
  o vídeo de teste grátis, e ali a casa disse que a devolução "continua com o
  dono". Ele espera há 6 dias **exatamente a decisão que eu acabei de
  instrumentar**. Não escrevo de novo sem ter o que dizer de novo.
- **Limitação real da prova, declarada:** 11 dos 13 vídeos **não existem mais** em
  `video_clones` (3 linhas contra 13 débitos) — é o padrão de DELETE do histórico
  já conhecido, que apaga row + objeto e deixa o débito órfão, **não é detector de
  bug**. Então a perícia roda nos 2 pagos que sobraram, **não nos 8 longos**. O
  número de 41.600 vem do extrato, que sobrevive; o veredito visual não alcança
  os apagados.

---

## 4. Fatos consumados desta ronda

1. **Reconciliação dos envios** — 699 = 699, 0 escrituráveis, conferida por
   instrumento independente.
2. **Medi o mecanismo do #329** e achei falha da casa (aviso no tier errado),
   com arquivo:linha.
3. **Corrigi o número em disputa** de ~20.000 para **41.600 cr**, por ref_id.
4. **Anotei o #329** (nota gravada e conferida na releitura, 6 notas no array).
5. **Despachei a percepção** pro `olho` (`c677967f`) com os 6 artefatos baixados.
6. **Despachei o conserto** pro `coder` (`cc2617f6`): levar o aviso de deriva
   >40s pro Turbo e avisar na tela acima de ~40s, por branch + PR, sem mergear.
7. **Postei no grupo** o pedido de decisão do Johnny sobre os 41.600.
8. **Commitei o instrumento** que faltava (`c80af277`), com controle positivo e
   negativo.

## 5. O que eu NÃO fiz

- **Não fechei nenhum incidente.** Regra 14 inteira: o #329 não está resolvido —
  falta decisão de dinheiro do Johnny e falta o veredito visual. 91
  `investigating` é o número honesto.
- **Não li a caixa do suporte@ pra triagem.**
- **Não toquei em crédito, carteira, acesso, voz nem migration** de ninguém.
- **Não gastei GPU.** Não refiz vídeo nem áudio nesta ronda.
- **Não mergeei nada** e não abri os PRs pendentes.
- **Não despachei os outros ~10 cartões de percepção.** Peguei o mais velho com
  aluno nomeado que genuinamente dependia de ver (regra 8, serial). Os demais
  seguem para a próxima ronda, com a ressalva do item 1 de que a lista precisa
  ser aberta antes de despachada.

## 6. Para quem pegar a próxima ronda

1. **O veredito do `olho` no `c677967f` provavelmente já chegou** — o gerente
   **reprovou a primeira entrega dele** e mandou refazer (vi o cartão voltar de
   `review` pra `running`). Leia, **confira com instrumento próprio** e grave no
   `85ca1863` marcado como veredito de agente. Não grave veredito de agente como
   se fosse medição da casa.
2. **Os 41.600 cr do #329 estão na mesa do Johnny desde esta ronda.** Aluno
   pagante esperando 10 dias, e agora ele tem número e causa. Se voltar "pode
   devolver", o estorno é de vídeo: grave com `ref_type` de estorno e **confira a
   linha na releitura**, porque update por id inexistente afeta 0 linhas em
   silêncio.
3. **Passagem é relato, banco é fato.** Esta ronda quase mandou carta duplicada
   pra aluna pagante porque a passagem anterior dizia "sem resposta" e o banco
   dizia "respondida 25 min atrás". Antes de agir em cima de "faltou X", confira X.
4. **A consulta de percepção da ordem de 17/09 superestima** (casa por palavra).
   Abra o cartão antes de despachar — dois dos três que eu abri não eram percepção.
5. **`emails_enviados` só cobre de ~14/09 pra cá.** Pra aluno mais antigo, 0 linha
   na tabela **não** é abandono: use
   `2026-09-19_uid_por_message_id.cjs --para <e-mail>`, que lê a pasta Sent (remota,
   sobrevive a checkout). Foi a diferença entre "ninguém escreveu" e "38 cartas".
