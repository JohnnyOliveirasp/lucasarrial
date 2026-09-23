# Ronda das falhas — 23/09/2026 ~12h40–13h30Z

Dono da fila (regra 14-A). Serial (regra 8). Nada de GPU, nada de migration,
nada de crédito movido. **Produção tocada: 1 merge** (patch do Vigia, item 2).

---

## 1. Passos fixos — os dois limpos, e os dois conferidos por instrumento independente

**Reconciliação dos envios** (passo fixo desde 18/09):
`1088 lidas da pasta Sent · 1011 já tinham linha · 77 fora da janela (--corte) · 0 escrituráveis`.
A contagem fecha (1088 = 1088). Conferido com o **irmão de leitura**
(`2026-09-18_enviados_x_tabela.cjs`), que é instrumento independente:
**0 carta depois do corte** fora da tabela. O buraco segue passivo.

⚠️ As **77 anteriores a 14/09 14:06:31Z** continuam sem decisão — é o que o
`--corte` exclui, e não é defeito novo. Quem for decidir, decide com o
`cobreDesde` de `contato-tentativas.ts` na mão.

**Percepção travada** (`percepcao_travada.cjs`, ordem de 17/09):
**0 cartões**, controle positivo (#310) e negativo (#518) OK, 514 varridos.

---

## 2. Patch do Vigia — fila DRENADA (era o passo 1-B, antes do resto)

### `patch_b6b777eb` → **PR #414, merge `229dd8fe`, deploy SUCCESS**

O defeito: `fraseDeAcessoParaAgente` tem 5 ramos; quatro dizem ao modelo o que
ele **não pode** afirmar. O ramo `sem_acesso` devolvia só o fato seco
("SEM assinatura ativa.") e confiava que ele concluiria. **Não conclui:** em
21/09 08:54:39Z, com o contexto CORRETO na mão (`free / SEM assinatura ativa /
Saldo 0`), a Fast disse à aluna que ela podia "continuar usando a plataforma
normalmente". Conta com zero entitlement, zero crédito, 16 dias de espera.
Mesma classe do #198 e do #303 — **a linha que falta vira afirmação errada.**

O conserto aponta para o **SALDO** em vez de negar geração em bloco: conta sem
assinatura e COM crédito avulso gera normalmente, e negar seria o mesmo defeito
virado ao contrário.

**Revisão refeita por mim, não herdada do relatório do autor** (regra 14-B, e o
`tsc` verde não é revisão):
- `tsc --noEmit` exit **0** — binário do `node_modules`, exit code real.
  *(A régua de 12h30 vale: exit depois de `|` é do último comando do pipe.)*
- `eslint` exit **0** nos 2 arquivos · `node --test` **10/10**
- **Prova de mutação:** revertido o ramo ao texto antigo → **1 teste cai**;
  restaurado → 10/10. O teste guarda o comportamento, não o texto.
- **Caller conferido à mão:** único é `agent/account.ts:362`, que interpola —
  sem comparação por igualdade, sem limite de tamanho.

### As duas chaves `patch_*` apagadas com DELETE

`patch_b6b777eb` (aplicada) e `patch_eac94e82` (já em produção pelo PR #413,
conferido por conteúdo na `origin/main`). **Fila de patches: 0.**
DELETE de verdade, 1 linha cada — não `update({value:null})`, que devolve 23502
e deixa a chave viva (foi assim que três rondas "limparam" sem limpar).

---

## 3. A cabeça da fila está TODA parada em decisão do Johnny — conferido um a um

Antes de escolher, conferi os quatro mais velhos. **Nenhum está esperando
trabalho meu:**

| cartão | idade | o que falta, exatamente |
|---|---|---|
| `c726c5ae` | 105,9d | "pode" pro merge do **PR #214** + semear o dedupe na mesma janela; e decisão de dinheiro sobre 23 assinaturas vivas de gente sem conta |
| `d3d8d1b2` | 55,0d | **PR #404** aberto, aguardando merge |
| `b706b32e` | 40,4d | perna de código **já em produção**; falta só a decisão dos 10.000 cr |
| `702cc916` | 21,8d | decisão (a)manter / (b)falhar sem cobrar / (c)entregar avisando — escalada há **21 dias** |

⏰ **A cobrança do `GGMWWE5Q` cai em 26/09 — 3 dias.** É da classe do
`c726c5ae`: gente com assinatura viva cobrando R$97/mês que nunca entrou na
plataforma. Não é decisão minha e continua no colo do Johnny.

---

## 4. O cartão que eu levei até onde dava: `#37bacb68` (34,8d, 22 alunos)

Mais antigo **não bloqueado**. A nota 63 (ronda das 12hZ) deixou o passo
marcado: *medir a taxa de alucinação por presença de lista longa, antes de
mexer no worker.* Executei.

Instrumento novo, **só leitura**:
`_frank/ferramentas/2026-09-23_alucinacao_por_lista_longa.cjs`
1.800 gerações com `qa`, 1.791 na população. Paginado (o SELECT corta em 1000).
Controle positivo **e** negativo no detector, ambos abortando com exit 2.

### 4.1 A hipótese não se sustenta como alvo de conserto

|  | n | taxa média |
|---|---|---|
| COM lista longa | 53 | **8,7%** |
| SEM lista longa | 1738 | 1,2% |
| COM lista, **sem o Diego** | 49 | **4,0%** |

A hipótese **nasceu** do caso do Diego, então medi-la com ele dentro é circular.
Tirado ele, o efeito **cai pela metade**. Sobra 3,3x com n=49: direcional, não
causa.

E **não é uniforme**: controlado por comprimento, 1000–2000 chars dá 13,2% x
1,1%, mas **500–1000 chars some** (0,9% x 0,7%). Efeito que desaparece numa
faixa inteira do meio não é mecanismo.

### 4.2 Por que ela não serve: os sobreviventes têm explicação melhor

Conferi **um a um** os 8 casos fora-do-Diego com lista longa que alucinaram.
**5 dos 8 não são prosa em português:** texto em inglês (3), **prompt de imagem
colado no gerador de voz**, roteiro com rubrica e emoji, soletração de sigla.
Os 2 que são prosa em português são os de **menor** taxa (4,8% e 2,4%).
O que esses casos têm em comum não é vírgula: é **texto que não é fala corrida
em português**.

### 4.3 O preditor de verdade já está na nossa telemetria

`coverage_idioma_prob`, que o próprio QA grava. **Dose-resposta monótona:**

| idioma | n | taxa média | alucinaram |
|---|---|---|---|
| 0,0–0,3 | 5 | **43,1%** | 100,0% |
| 0,3–0,6 | 11 | 28,8% | 90,9% |
| 0,6–0,9 | 13 | 22,6% | 38,5% |
| 0,9–1,0 | 252 | **3,9%** | 24,6% |

De 43,1% a 3,9% sem inversão. Separa muito melhor que lista longa (4,0% x 1,2%).
**Limite declarado:** o campo só existe em **281 das 1.791** (15,7%). Não sei
por que só nessas e **não** afirmo a taxa da população inteira a partir delas.

> **Consequência prática:** *não* construa detector de lista no worker. Era o
> conserto óbvio e a medição diz que mira no lugar errado — seria a terceira
> tentativa refutada nesta família (chunker refutado na nota 63; heurística por
> energia reprovada 2x na família Katia).

### 4.4 Hipótese levantada e descartada na mesma ronda

O texto do Diego tem cara de modelo da casa ("Olá! Este é um teste de voz…").
Se a plataforma o oferecesse, o defeito seria de todo aluno novo que clicasse
no exemplo. **Fui ver: o texto não está no repositório**, e só 4 gerações na
base inteira o usam — as 4 do Diego. Não é modelo nosso. Onde ele arrumou o
texto eu não sei, e não invento.

> ### ⚠️ CORREÇÃO DA MESMA RONDA — a conclusão ficou, a prova teve que ser refeita
>
> Quando publiquei isto acima, uma das duas buscas que eu usei era um
> **`grep -r` de bash varrendo a raiz do repositório**. Fui controlá-la depois
> (porque era um ZERO que CONCORDAVA com a minha conclusão, e essa é
> exatamente a hora de desconfiar) e ela **REPROVOU no controle positivo**:
> procurando `fraseDeAcessoParaAgente`, string que eu *sabia* estar no repo —
> eu tinha acabado de ler o arquivo — ela devolveu **nada**. Nunca terminou a
> varredura no tempo dado, e o `2>/dev/null` escondia isso.
>
> Refeito com **ripgrep**, que passou no mesmo controle (**6 arquivos** para a
> string conhecida): o texto do Diego **continua não existindo no repositório**
> — buscado por 4 trechos distintos, inclusive o da lista de números.
>
> **A conclusão não mudou. O que mudou é que agora ela tem prova.** Publiquei
> apoiado, em parte, num instrumento cego, e acertei por sorte.
>
> **Régua (vale mais que o caso):** *zero que concorda com a sua hipótese não
> vale nada sem controle positivo — e "eu acabei de ler esse arquivo" é o
> controle positivo mais barato que existe.* É a MESMA lição do base64 de
> 18/09 e do bloco de exclusão do item 7 desta ronda. **Três vezes na mesma
> família, a terceira dentro da ronda que escreveu a régua.**
>
> O que segurou a conclusão de pé não foi o grep, e isso importa: foi a
> evidência independente de que **só 4 gerações em 1.791 usam o texto, e as 4
> são da mesma voz**. Se a casa oferecesse o texto, ele apareceria espalhado
> por muitos alunos. Sempre que der, prenda a conclusão na evidência que não
> depende da ferramenta que você não controlou.

---

## 5. O que isto entregou pro `#702cc916` (o portão), sem eu ir atrás

**13 gerações com ≥50% de alucinação. 9 delas estão `ready` — entregues.**
Entre as entregues, com 100%: `TUCUNARÉ!!!! SEXTOOOUUUUU!!!`, um texto em
**alemão**, um texto de **um caractere** (`"o"`), e soletração de sigla.

Isso muda o **tamanho** da decisão parada há 21 dias, não só a acrescenta: o
cartão estava dimensionado como defeito de *margem* (0,808 contra piso 0,85 —
raspando). O portão entrega também o caso **total**, onde o que saiu quase não
tem relação com o texto pedido. Entre "passou raspando" e "passou com 100%
inventado" ele não distingue — **não está mal calibrado, não está barrando.**

**Limite declarado:** não transcrevi as 9. Na ronda das 12hZ transcrevi UMA
(a do Diego) e a transcrição bateu com a telemetria. Aqui afirmo o que o campo
`qa` diz, **e digo que é o campo `qa` que está dizendo.**

---

## 6. Instrumento da própria ronda consertado: a contagem estava cega há 2 dias

`idade_incidentes.cjs` filtrava só `open`/`investigating`.

> **107 pelo filtro velho · 142 com `aguardando_aluno` — 35 cartões invisíveis**,
> o mais velho com 25,9d, todos com aluno nomeado.

O `03_ROTINA.md` já tinha sido corrigido para isso em **21/09**; **o script não
foi junto**. A doc mandava contar certo e a ferramenta que a ronda de fato roda
continuou contando errado por mais 2 dias. Corrigido, com a quebra por status
impressa (`open 8 · investigating 99 · aguardando_aluno 35`).

Conferi que **não mudou a escolha de hoje** — a ordem dos mais velhos é a mesma.

---

## 7. Erro meu, medido e corrigido — vai como régua

O bloco "sem o Diego" imprimiu, na primeira versão, números **idênticos** aos de
cima, e eu quase reportei *"a hipótese sobrevive à exclusão"*. Causa: o SELECT
não trazia `voice_id`, o conjunto de exclusão saiu **vazio**, e a exclusão não
excluiu nada. **Zero silencioso que CONCORDAVA com a hipótese** — a mesma
família do base64 de 18/09.

Corrigido, e o script agora **aborta (exit 2)** se não achar exatamente as 4
gerações da voz do caso vivo.

> **Régua:** bloco de exclusão que não prova QUE excluiu não testa nada.

---

## 8. O que eu NÃO fiz, e por quê

- **Não fechei o `37bacb68`.** Não consertei a causa. Tenho um remédio a menos
  pra tentar, um preditor medido, e prova nova pro portão — mas `fixed` aqui
  violaria a regra 14.
- **Não estornei as 9 entregues com ≥50%.** É a classe cuja decisão de dinheiro
  está com o Johnny. Não é minha alçada.
- **Não escrevi pro Diego nesta ronda.** A promessa viva dele foi honrada na
  passagem das 12h30 (estorno de 1.944 conferido no banco + carta uid 3255).
  Não há promessa vencida em aberto minha aqui.
- **Não mexi nos outros 3 da cabeça da fila** — regra 8, um cartão até o fim.

---

## 9. Fim de ronda

- Produção tocada: **PR #414** (merge `229dd8fe`, deploy SUCCESS conferido).
- Migration: **nenhuma**. DDL: **nenhum**. GPU: **nenhuma**. Crédito: **nada movido**.
- Fila de patches do Vigia: **0** (2 chaves apagadas com DELETE).
- Grupo: postado — fato consumado, sem código, sem saída de terminal.
- Log **na main**.

### Pendências nomeadas (paradas, não "em andamento")

1. ⏰ **Cobrança `GGMWWE5Q` em 26/09 — 3 dias.** Classe do `c726c5ae`.
2. **PR #214** — "pode" + semear o dedupe na MESMA janela (dry-run diz 4 a registrar, 0 já registrados).
3. **PR #404** — aguardando merge (`d3d8d1b2`).
4. **10.000 cr do `b706b32e`** — código em produção, falta só a decisão.
5. **`702cc916`** — decisão parada há 21d, agora com o tamanho real medido.
6. **`37bacb68`** — causa viva. Próximo passo com evidência: **entrada que não é
   fala corrida em PT-BR**, não lista. O sistema já mede (`coverage_idioma_prob`).
7. **`olho` mudo** — card `4b645b24`. Não remedi hoje; o caminho que funcionou
   segue sendo whisper-1 direto.
8. **77 cartas anteriores a 14/09** — sem decisão de escrituração.
