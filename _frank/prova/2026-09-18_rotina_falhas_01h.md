# Ronda das falhas — 18/09, ~01hZ

**Item serial: `#52` (`37bacb68`), classe `qa_coverage`. NÃO FECHADO — mas a
ocorrência que reabriu o cartão ontem às 21:24Z tem causa nomeada, lida no
código, e correção especificada em PR.**

Em uma linha: **o mesmo texto, byte a byte, passou três vezes e morreu uma — e
o que mudou não foi o áudio nem o texto da aluna, foi o sorteio do
normalizador, que o portão de qualidade mede como se fosse verdade.**

---

## 0. Por que peguei este

Ordens lidas antes de tocar em qualquer coisa: `_frank/ordens/README.md`
(índice), `2026-08-29_desligar_vigia_e_frank.md` (planilha desligada) e
`2026-09-17_percepcao_nao_e_desculpa_pra_parar.md` (a mais nova).

Fila: **89 abertos** (84 investigating + 5 open), mais velho 49,5 d.
Consulta de percepção da ordem de 17/09: **0 cartões** travados por falta de
ver/ouvir/assistir — o Vigia despachou os que havia na ronda das 00hZ, e o
controle positivo do script reencontrou o `#310`, então o zero é medido, não
cego.

Pelos três mais velhos eu não passo: `#15`, `#226` e `#234` seguem com o
próximo passo no colo do Johnny (troca qualidade × entrega, falhar tudo × só o
grave, ligar o QA reprovando). O seguinte na fila por idade é o **`#52`**, 29,3
dias, 33 ocorrências, 21 alunos — e ele tinha uma propriedade que os outros não
tinham: **reabriu sozinho às 21:24Z de ontem**, por reincidência, e ninguém
tinha encostado nele depois disso. Cartão que volta a disparar e fica sem dono
é como classe fechada que segue viva: esconde defeito nosso.

## 1. Primeiro o aluno e o dinheiro, antes de investigar

A ocorrência é a geração `d07d0d7d` (Mariana, `excellerconsultoria`, 17/09
20:18:54Z).

**Ninguém está esperando.** Ela refez e recebeu: `33affa2c` READY às 20:26:28
(223,1 s) e `02f7d194` READY às 20:32:59 (182,6 s) — o mesmo texto cru.

**Ninguém está devendo.** Conferido por `ref_type='generation_refund'`, **nunca
por `kind`** (a armadilha medida em 20/08, que quase pagou em dobro para 13
alunos). Toda geração `failed` da janela tem débito −1.521 e estorno +1.521
casados por `ref_id`: `d07d0d7d`, `4f8d300a`, `d7823195`, `174859a0`,
`6f1247e6`. As três READY foram cobradas e não estornadas, que é o certo.
Saldo fecha. Não mexi em crédito.

Só depois disso fui investigar.

## 2. A causa

Quatro gerações, o **mesmo `text_raw` byte a byte** (md5 `d45e7c5bede6`, 1.521
chars), em 14 minutos, produziram **quatro `text_normalized` diferentes**:
1.530, 1.531, 1.548 e 1.563 chars, quatro md5 distintos.

A aluna é consultora tributária e escreveu, na grafia fonética dela,
`Ceêbêéssi` e `íbêéssi` — ela queria ouvir as siglas **CBS** e **IBS** da
Reforma Tributária. Os testes curtos dela às 01:32 e às 19:57 (`"c.b.s, cê-bê-esse,
C B S…"`, `"Ceêbêéssi, íbêéssi"`) mostram que ela passou a madrugada caçando
essa pronúncia.

Nas três rodadas que **deram certo**, o normalizador deixou a palavra dela
intacta. Na rodada que **falhou**, e só nela, ele a expandiu em soletração:
`Cê Ê Bê Ê Sse` e `Í Bê Ê Sse`.

O QA de cobertura compara o áudio com o texto **já reescrito**. Quem afirma
isso não sou eu — é `mandato-normalizacao.ts:26-28`:

> *"o QA de intrusão do worker compara o áudio com o texto JÁ reescrito — ele
> nunca vê o texto do aluno."*

O whisper devolve `CBS`, nunca `ce e be e sse`. A cobertura do chunk desaba:
**0,344** na rodada que falhou, contra **0,833** de mínimo visto nas que
passaram.

Daí em diante é mecânica, e a telemetria do próprio job confirma passo a passo:
0,344 está abaixo do piso `coverage_espalhada_min` (0,65), então a escotilha
`_entregar_mesmo_com_cobertura_baixa` não pode salvar
(`coverage_espalhada_piso_terminal=1`); vai pro resgate (`coverage_rescue=2`,
`coverage_rescue_nivel2=2`); o nível 2 também falha
(`coverage_rescue_failed=1`, `coverage_exhausted=1`); `_resultado_incompleto`
marca FAILED e o webhook estorna.

## 3. O buraco no código

`mandato-normalizacao.ts:450`:

```
if (op.cru.length !== 1 || op.saida.length !== 1) continue;
```

A guarda de mandato só inspeciona substituição **1-para-1**. Expansão
**1-para-N** passa intacta, de propósito e documentado ("é justamente ali que
mora o trabalho legítimo"). Soletração inventada é exatamente uma expansão
1-para-N: **nunca foi olhada por guarda nenhuma.**

E a regra 1 da guarda usa CAIXA ALTA como sinal de sigla (`cruEmCaixaAlta`) —
mas a palavra dela é `Ceêbêéssi`, não `CBS`. Nem esse sinal a protegia.

## 4. Por que a correção de 24/08 *deste mesmo cartão* não pegou isto

Em 24/08, por este incidente, entrou em `maior_lacuna` e `palavras_faltantes` a
regra da "palavra FALÁVEL": token de 1 letra não conta, porque sigla soletrada
`B P C, L O A S` vira 7 tokens de 1 letra e o whisper escreve `BPC LOAS` (caso
tulliojeronimo, 23/08 — o mesmo roteiro falhou 2× soletrado e passou escrito
"Bê pê cê").

É o mesmo defeito, um mês depois, e passou ao largo por duas diferenças:

1. aqui o modelo soletrou com **nomes de letra** (`ce`, `be`, `sse` — 2 e 3
   chars), que passam folgados pelo corte de `len >= 2`;
2. a correção foi aplicada a `maior_lacuna` e à telemetria, mas **não a
   `chunk_coverage`**, que é o portão que reprova. `chunk_coverage` não tem
   filtro nenhum.

> **Registro contra o meu próprio otimismo:** corrigir só `maior_lacuna` **não
> teria salvado** esta geração. Com 0,344 o piso derruba antes de a forma do
> buraco importar. Quem mexer precisa atacar o NÚMERO, não só a forma. Era o
> patch que eu ia propor primeiro, e ele seria cerimônia.

## 5. Tamanho da classe — com o limite dito na cara

Varri as gerações desde 19/08 procurando run de soletração no
`text_normalized`. São **três**:

| geração | data | aluna | desfecho |
|---|---|---|---|
| `44ac6f60` | 27/08 | `7c642d01` | **FAILED** qa_coverage, `coverage_best 0` |
| `269a85e9` | 04/09 | `99a6fad2` | READY |
| `d07d0d7d` | 17/09 | Mariana | **FAILED** qa_coverage, `coverage_best 0,344` |

⚠️ **n = 3. Isto não é estatística e eu não vou fingir que é.** O que sustenta
a conclusão é que as duas falhas são de `qa_coverage`, são de **alunas
diferentes**, estão a **três semanas** uma da outra, e o mecanismo está lido no
código linha a linha.

⚠️ E o inverso também não vale: "2 de 3" **não** é 67% de falha. É que a
soletração é rara no corpus e que, quando aparece, o portão não tem defesa.

## 6. A armadilha de instrumento que eu quase comi

A ronda de ontem ~21hZ encontrou a **mesma** não-determinação e a arquivou, com
razão, como armadilha de **medição**: *"não meça por md5 de `text_normalized`,
meça por `text_raw`"* (nota no `execucao.ts`, entrada "runpod completed").

Eu li aquela nota **depois** de já ter os quatro md5 na mão, e o reflexo foi
tratá-la como nota de rodapé de outro cartão. Ela é mais que isso:

> **A mesma instabilidade que estraga a medição é a moeda girando que decide se
> o portão reprova.** O que era rodapé de um cartão é a causa raiz de outro.

## 7. Por que NÃO fechei

A causa está nomeada e tem correção proposta, mas **nada disso está em
produção**. O cartão tem 33 ocorrências e 21 alunos: a soletração explica
**duas** delas, não as 33. Fechar aqui seria trocar "achei uma causa" por
"resolvi a classe" — exatamente o que a regra 14 proíbe.

**Não escrevi para a aluna.** Ela recebeu o áudio e o dinheiro está certo;
carta agora seria ruído, não atendimento.

## 8. O que foi despachado

Card **`462f1043`** (`coder`): tratar expansão 1-para-N na guarda e reverter
quando **todos** os tokens de saída forem nomes de letra **e** o número de
letras da palavra crua não bater com o número de tokens.

O discriminador é o ponto: `cbs` (3 letras) → `ce be esse` (3 tokens) é
trabalho **legítimo** e continua passando; `Ceêbêéssi` (9 letras) → 5 tokens
não bate e volta a ser a palavra da aluna. Caixa alta sozinha **não** serve de
discriminador — sigla minúscula expandida é trabalho bom e seria quebrada.

Vai por branch + PR, **sem merge**, sem GPU, sem migration.

## 9. Próximo passo de quem pegar o `#52`

1. Revisar/mergear o PR do `462f1043` e conferir **em produção** (main deploya;
   card "completed" não é produção).
2. Decidir a questão maior, que sobrevive ao patch: **o portão de cobertura
   mede o áudio contra um texto que um LLM reescreve de forma
   não-determinística.** Enquanto for assim, qualquer reescrita ousada do
   normalizador pode reprovar áudio bom. O caminho de fundo — dar ao QA o
   `text_raw` da aluna como referência de desempate — está apontado como
   fraqueza conhecida no próprio `mandato-normalizacao.ts:26-28` e **não está
   feito**.
3. As outras 31 ocorrências deste cartão **continuam sem causa atribuída por
   mim**.

## 10. Estado e dinheiro

Não mexi em crédito, acesso, assinatura, plano nem entitlement. **Não gastei
GPU e não gerei áudio nenhum.** Não subi código para a main, não apliquei
migration. Não li, escrevi, classifiquei nem reprocessei nada da planilha
(ordem de 29/08). Não li a caixa do suporte@ para triagem. Uma anotação
gravada (`#52`, 54 → 55 notas, 1 linha afetada, conferida na releitura).
**0 incidentes fechados, 0 reabertos, 0 abertos.**

Zero fechados é resposta legítima nesta ronda: o defeito está vivo, a correção
não está em produção, e o cartão cobre mais do que a causa que eu nomeei.

## 11. A lição

> **Uma correção que trata o sintoma no instrumento errado parece cobertura e
> não é.** Em 24/08 este cartão recebeu a regra da "palavra falável" — e ela
> foi para `maior_lacuna` e para a telemetria, que *descrevem*, mas não para
> `chunk_coverage`, que *reprova*. O defeito voltou pela mesma porta um mês
> depois, com nomes de letra em vez de letras soltas.
>
> Vizinha da lição de ontem ("controle que testa só o passo em que eu já
> confiava é cerimônia"): aqui, **régua consertada no lugar que não decide é a
> mesma cerimônia**, com aparência melhor ainda, porque o commit existe.

---

# Adendo — a correção saiu, verificada contra produção (mesma ronda, ~01h30Z)

O card `462f1043` voltou. **PR #336** (`feat/guarda-soletracao-inventada`),
**não mergeado**.

## Não aceitei o relato do operário — conferi eu mesmo

Rodei a guarda do branch em cima do `text_raw` e do `text_normalized` **reais
da geração `d07d0d7d`**, puxados do banco. Não a paráfrase do teste: o texto que
matou o job.

| verificação | resultado |
|---|---|
| `Ceêbêéssi` volta pro texto | ✅ |
| `íbêéssi` volta pro texto | ✅ |
| `Cê Ê Bê Ê Sse` sumiu | ✅ |
| `Í Bê Ê Sse` sumiu | ✅ |
| expansão legítima de `60%` ("sessenta por cento") preservada | ✅ |
| invariante de fim de frase | 13 → 13 ✅ |
| `abstida` | false |

A frase reconstruída fica **idêntica** à das três rodadas que deram certo com o
mesmo texto cru.

Testes: **28/28** (eram 21 na main — 7 novos). `tsc --noEmit`: **limpo**.

## Erro meu na especificação

Mandei o operário rodar `npx vitest run`. O runner deste arquivo é
**`node --test`** — no vitest ele diz *"No test suite found"* e sai **FAIL**.
Se eu tivesse lido só o "FAIL" da minha própria instrução, teria reprovado um
patch correto. O teste estava certo; a instrução é que estava errada.

## Ressalva que vai junto com o patch

Nas reversões aparece uma entrada cujo lado de saída é `"ce e be e sse e i be"`:
o alinhamento LCS **absorveu a conjunção "e"** no meio do run, porque `"e"`
também é nome de letra. **Neste texto o resultado saiu correto** — conferi, o
"e do" sobreviveu — mas o mecanismo existe e pode, em outro texto, engolir uma
conjunção legítima entre duas siglas soletradas.

Não é bloqueador (o pior caso devolve a palavra do aluno, que é o lado
conservador), mas quem mergear precisa saber que está lá. Está escrito no PR e
no cartão.

## Por que NÃO mergeei

Mexe no caminho de **toda** geração, e a classe é de **2 ocorrências em 30
dias**. Não é urgência que justifique merge sem revisão humana à 1h da manhã. A
regra da casa é clara: card "completed" não é produção, e só a main deploya.

O `#52` segue **open**, agora com 56 notas.
