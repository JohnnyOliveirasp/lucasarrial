# Ronda das falhas — 04/09/2026, ~16:00Z (13h BRT)

Serial: **`702cc916`** (#"ENTREGAMOS AUDIO QUE O NOSSO PROPRIO QA REPROVOU"),
o mais antigo dos abertos com aluno afetado depois do `3ca22d47`. **Não
fechei** — o conserto não está em produção. Mas a medição desta ronda
**derruba a causa que estava no título do chamado** e a substitui por outra,
com controle, e isso destrava um conserto que estava parado por medo desde
01/09.

Ordem de 29/08 respeitada: nada da planilha foi lido, escrito, classificado,
avisado ou reprocessado. Canal: aviso no **grupo** (`notify-grupo.sh`),
ordem de 31/08.

---

## 1. Por que não peguei o `3ca22d47`, que é mais antigo

Ele é o mais antigo (01/09 15:54), mas está **travado em decisão de produto
com o Johnny** desde a ronda das 14:46Z: vínculo-por-confirmação no cadastro.
A mesma ronda mediu as duas chaves óbvias (CPF e e-mail normalizado) e as duas
foram reprovadas. Não há passo meu que o mova hoje. Passo que falta: resposta
do Johnny ao §6 daquela ronda.

## 2. Os dois "presos" da varredura: os dois já estavam avisados

Antes da fila, o que a varredura marcou como aluno parado — porque aluno vem
antes de limpeza de fila.

- **`marcelopersonalthe32@`** (198.950 cr, sem voz há 25 dias): **3 e-mails**,
  o último em 29/08, com a análise manual do áudio já feita (são duas pessoas
  na gravação, confirmado de ouvido em 8 pontos). A bola é dele.
- **`luanmarcal.com@`** (98.425 cr, import quebrado há 6 dias): **3 e-mails**,
  o último **hoje 04:13Z**, já apontando pro portal `/sgp` novo. A bola é dele.

Nenhum 4º e-mail. Aviso repetido é ruído, e a varredura avisa exatamente isso.
**Nenhum aluno abandonado pela nossa mão nestes dois.**

---

## 3. O achado: a culpa estava no arquivo errado há 31 notas

O título do chamado acusa `tts_qa/loop.py:341-344` (esgota tentativas e entrega
assim mesmo). As 30 notas anteriores — quase todas do Vigia — mediram
`exhausted>0` como discriminador, ronda após ronda, e concluíram "40% das
entregas com exhausted furam a régua".

Separei a terceira variável que ninguém tinha cruzado: a **escotilha
`coverage_espalhada`**.

Janela desde 02/09 02:32Z, `generations` com `qa` não nulo, régua **por linha**
(`coverage_min` = a RÉGUA, 0,85; o medido é `coverage_min_visto` — a armadilha
de instrumento que o Vigia repete toda ronda, e com razão):

| escotilha | exhausted | entregas | alunos | abaixo da régua | pior |
|---|---|---|---|---|---|
| não | =0 | 71 | 33 | **0** | 0,857 |
| não | >0 | **37** | 22 | **0** | 0,857 |
| **SIM** | >0 | 24 | 15 | **24 (100%)** | **0,333** |

**37 entregas esgotaram as tentativas e nenhuma saiu abaixo da régua.** 108
entregas sem a escotilha, zero abaixo. O ramo de esgotamento entrega a
*menos ruim* e, sozinho, nunca pôs áudio sub-régua na mão de aluno nesta
janela. **Ele não é a porta.**

A porta é uma só: `_entregar_mesmo_com_cobertura_baixa`, em
`jobs/inference.py` (~352-373). Cobertura abaixo da régua **mas** com a maior
lacuna menor que `max(coverage_qa_gap_min, 20% das palavras)` → devolve `True`,
**pula o resgate por subdivisão** e entrega.

Isso explica de uma vez a observação que o Vigia repetiu **oito rondas
seguidas** sem explicar: *"nenhuma das N carrega `coverage_rescue`"*. O resgate
não falhou nem ficou fora de alcance — **ele nunca foi chamado**, porque a
escotilha decidiu antes.

### 3-B. A honestidade sobre esta medição

A direção *"escotilha ⇒ abaixo da régua"* é **quase tautológica** por
construção: a escotilha só dispara quando a cobertura já está abaixo da régua,
e é só nesse ramo que a cobertura do chunk é registrada como entrega. Se eu
reportasse só os 24 de 24, estaria vendendo o desenho do instrumento como
achado.

A direção que vale como prova é a **inversa**: *"abaixo da régua ⇒ escotilha"*
— **108 entregas sem escotilha e zero exceção**, incluindo as 37 que
esgotaram. É essa que exonera o `loop.py`.

### 3-C. O defeito concreto, e por que ele passou

A escotilha **não tem piso**. Ela deixou passar uma entrega com cobertura
**0,333** carimbada como *"lacuna espalhada: é texto que não se fala, não fala
que sumiu"*. O comentário no próprio código dizia que a decisão ficava *"pra
medir se essa decisão está certa na prática"*. Ficou 
sem ser medida. Medida agora: na cauda, não está.

### 3-D. O custo do conserto — que é o que destrava o chamado

O que manteve este chamado sem conserto desde 01/09 foi o medo, legítimo e
documentado, de repetir a **tempestade de falha+estorno de 19/08**. Gate duro
no esgotamento atingiria **61** entregas. Um piso na escotilha, não:

| piso | entregas que iriam pro resgate | % do total | por dia |
|---|---|---|---|
| 0,60 | 4 | 3,0% | ~1,5 |
| **0,65** | **7** | **5,3%** | **~2,7** |
| 0,70 | 10 | 7,6% | ~3,8 |
| 0,80 | 15 | 11,4% | ~5,8 |

~2,7 resgates a mais por dia não é tempestade. E não é falha nem estorno: é
**mudar de estratégia**, que é o que o resgate já faz hoje no ramo da lacuna
contínua.

**Card `44a3a300` aberto pro `coder`**: piso configurável por env + override
por job (padrão `_do_job_ou_env`), branch + PR, **sem merge**, com teste e com
a saída real dos testes colada no PR.

---

## 4. A ligação com o #47 (Katia) — e é a parte que dói

A ronda das 13:49Z deixou uma pendência **sem dono**: a geração `423e390a`
apareceu na conta da Katia como *"Conta da casa — 2026-09-04"*, 35,4s contra
42,0s, **sem explicação**, e a ronda registrou honestamente *"não fui eu que
gerei, deixei quieta pra não inventar história, mas está visível pra aluna"*.

Não era mistério. É uma entrega da escotilha: **0,800 contra a régua 0,85**,
`exhausted=1`. Mesma classe das outras 23.

E aí o achado que importa. As quatro geraç&otilde;es na conta dela:

| geração | quando | nome que ela vê | dur | visto | escotilha |
|---|---|---|---|---|---|
| `1498fbe5` | 02/09 15:48 | **"02/09 - VERSAO NOVA (42s) - a palavra VOCE do segundo 34 corrigida"** | 42,0s | **0,800** | **SIM** |
| `752b46ee` | 04/09 10:53 | "04/09 - pausa natural (mesmo texto, sem respiro forcado)" | 35,0s | 1,000 | não |
| `423e390a` | 04/09 11:54 | "Conta da casa — 2026-09-04" | 35,4s | **0,800** | **SIM** |
| `9d7908f6` | 04/09 12:47 | "04/09 - teste: VOCE fora da emenda (so um ponto virou virgula)" | 36,5s | 0,929 | não |

**O áudio que nós batizamos de "VERSAO NOVA — a palavra VOCE do segundo 34
CORRIGIDA" e mandamos ela ouvir em 02/09 passou pela mesma escotilha, também
reprovado pela nossa própria checagem.** Entregamos como corrigida uma geração
que o nosso QA tinha marcado como ruim antes de sair.

Isso **inverte a hipótese** que rodou aqui por dias. A leitura corrente era
*"a régua não enxerga o defeito dela"* (calibragem circular). Nas duas
entregas que ela rejeitou, **a régua enxergou e reprovou** — e a escotilha
entregou por cima. Ela voltou hoje falando em desistir depois de ouvir uma
"versão corrigida" que estava medida como ruim antes de ser enviada. O ouvido
dela acertou pela terceira vez.

**O que eu NÃO afirmo:** `coverage_min_visto` é o **mínimo entre os chunks**,
não a fração do texto inteiro que sumiu. 0,800 **não** quer dizer "20% do áudio
faltando", e **não** medi se a palavra faltante do pior chunk é "você". Seria
bonito demais e eu não tenho a medida.

---

## 5. O que escrevi pra ela (uid **765**, cópia CONFIRMADA)

Individual, sobre caso que estou tratando — regra 8, decidi sozinho.

**Por que não esperei:** ela foi convidada às 12:49Z a julgar os áudios, e o
nome mais convidativo da lista dela é justamente o do arquivo ruim
(*"VERSAO NOVA … corrigida"*). Se ela abre esse, ouve quebrado e conclui que
mentimos de novo. Foi o silêncio que fez a Viviana explodir; aqui o risco não
era silêncio, era ela gastar o pouco de paciência que sobrou no arquivo errado.

Conteúdo: que ela estava certa e agora com número; **quais dois ignorar** e
**quais dois ouvir**, com a nota de cada um; que continuo **não afirmando
cura** e **sem dar prazo**; e que o extrato não tem lançamento desde 22/08 —
tudo conta da casa, saldo não tocado, nada a estornar (conferido linha a linha,
confirma a ronda das 13:49Z por caminho independente).

---

## 6. Registro

- `702cc916`: nota gravada, `agent_notes` 30 → **31**, 1 linha afetada,
  conferida na releitura. Status **mantido em `investigating`** — não fechei,
  porque não está resolvido.
- `ce6e157d` (#47): nota gravada, `agent_notes` 46 → **47**, 1 linha afetada,
  conferida na releitura. Status mantido em `aguardando_aluno`.

## 7. O que eu NÃO fiz

Não fechei, não reabri, não mudei status, não virei o
`TTS_TAIL_QA_INTERNO_MODO`, não mexi em crédito, não estornei, não cancelei
assinatura, não gastei GPU, não apliquei migration, não mergeei PR, não fiz
push na main de código, e não toquei em nada da planilha.

## 8. Pendências que continuam com o Johnny

Herdadas e não movidas hoje (as 1–3 são dinheiro e têm prazo):

1. **Cancelar a duplicada do Solon** — prazo **06/09**, faltam 2 dias. Sem
   resposta desde 13:49Z de ontem.
2. **Cancelar a duplicada do Jackson + estornar R$97** — ele já escolheu por
   escrito (incidente `b229e491`, hoje 14:05Z).
3. Estorno das demais duplicadas (Carlos). **lucila** segue sem decisão.
4. **`3ca22d47`/#222:** decidir o vínculo-por-confirmação no cadastro.
5. **`#246`:** compra avulsa do curso dá acesso ao FastCloner?
6. **`#234`** (`TTS_TAIL_QA_INTERNO_MODO`, +16–19% de GPU) segue pendente de
   aval — e segue travando o #47 de verdade.
7. **Migration 102** (`102_incidents_resolved_guard.sql`) não aplicada.
8. **14 branches que só existem nesta máquina**, não triados — o separador
   rascunho-vs-conserto foi reprovado na ronda das 14:46Z e o método que **não**
   funciona está registrado lá.

## 9. Passo fixo

`git fetch origin && git log --oneline origin/main..HEAD` conferido no fim
desta ronda (resultado abaixo, no commit). Nenhum código foi escrito por mim
nesta ronda — só este log, que vai direto na main.
