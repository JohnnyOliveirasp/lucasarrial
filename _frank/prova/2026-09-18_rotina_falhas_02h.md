# 18/09 ~02hZ — Ronda das falhas (serial, dono da fila)

Ronda curta e com UMA entrega fechada até produção. O resto está medido e
declarado, não prometido.

## Card serial da ronda: #52 (`37bacb68`) — fix NO AR, cartão SEGUE ABERTO

Peguei o #52 por ser o mais antigo com aluno afetado entre os acionáveis
(29,3d, 21 alunos, disparando ainda em 17/09 20:18Z).

**O #15 (`d3d8d1b2`, 49,5d) continua sendo o mais velho da fila, e eu NÃO o
peguei — de propósito.** A ronda de 17/09 20hZ o deixou com os dois próximos
passos concretos e ambos **fora da minha mão**: (a) telemetria delegada, que
está no PR #329, e (b) uma decisão de produto do Johnny sobre rigor do QA.
Classe dormente há 13 dias (última ocorrência 04/09 20:47Z). Repetir a
investigação dele seria a 8ª ronda seguida no mesmo cartão sem nada novo para
medir. Regra 8: travou, digo em que passo e sigo.

### O que esta ronda entregou

A ronda anterior (18/09 ~01hZ) achou a causa e abriu o **PR #336** — e o
deixou **não mergeado**. Fix parado em branch é exatamente a falha de 19/08
(9h presas). O trabalho desta ronda foi fechar essa ponta.

Não aceitei o relato de quem abriu: rodei eu mesmo antes de mergear.

| conferência | resultado |
|---|---|
| `npx tsx --test mandato-normalizacao.test.ts` | **28/28 pass** |
| `npx tsc --noEmit` | limpo (exit 0) |
| leitura do diff | discriminador é a conta letra-por-token, com teste de **mutação** travando as duas pontas; a guarda **se abstém** se houver pontuação no meio da soletração (preserva o invariante de fim de frase) |

Merge **`b70a9220`** (squash do PR #336).

### Prova de produção pelas 3 provas da regra 5-B

Action verde não basta — e clone velho também finge saúde (lição de 17/09).

| prova | valor |
|---|---|
| md5 do fonte servidor × `origin/main` | `fb827c616f46403ffdb1d9cd0545b143` **idêntico** |
| `BUILD_ID` | `3bH63zWfWsxB6kM4LgliI`, mtime **18/09 01:45:28Z** (merge foi 01:43Z) |
| pm2 `aiverse` | `online`, uptime **17s** na conferência |
| Action run `35296493325` | SUCCESS |

### Por que NÃO fechei (regra 14)

População: `generations` `status='failed'`, `error_message ilike '%qa_coverage%'`
→ **29 falhas, 17 alunos**, 19/08 18:11Z → 17/09 20:18Z.

Com padrão de soletração no `text_normalized`: **5 de 29**. As 2 confirmadas na
mão são `d07d0d7d` (17/09, Mariana) e `44ac6f60` (27/08).

**24 das 29 têm outra causa.** O que está curado é a soletração inventada — que
era a causa da ocorrência que REABRIU o cartão, não a causa da classe. Não
carimbo `fixed` em cima de sub-causa resolvida.

### Dinheiro: conferido, nada devido — e o zero não é cego

25 das 29 têm estorno casado por `ref_id` + `ref_type='generation_refund'`
(**nunca** por `kind` — armadilha de 20/08).

As outras 4 (`dd4b98a3`, `db811e2f`, `678267fe`, `e0de4212`) apareciam "sem
estorno". Fui atrás em vez de aceitar o número: as 4 têm **zero lançamento** no
livro-razão (`n_lancamentos=0`), ou seja **nunca foram debitadas**. Não há o que
estornar. Saldo fecha nas 29.

### Aluno

Ninguém esperando por este cartão. A Mariana (ocorrência de 17/09 20:18Z) já
refez e recebeu na mesma noite (`33affa2c` READY 20:26Z, `02f7d194` READY
20:32Z). Não escrevi pra ela: o defeito está corrigido e ela já tem o áudio —
e-mail agora seria ruído sobre um caso que ela considera encerrado.

## Correção de um instrumento MEU, na mesma ronda

Meu primeiro regex de soletração devolveu **"1 de 29"** e não pegou **nenhuma**
das duas ocorrências que eu já sabia serem do defeito. Causa: omiti os nomes de
letra de uma sílaba (`a, e, i, o, u`), e o texto real é `"Ce E Be E Sse"` — o
`E` sozinho quebrava a sequência.

Conferi contra caso conhecido **antes** de usar o número, então o `1` não virou
registro. O número que vale é **5 de 29**.

Registro o erro em vez de publicar só o número certo: instrumento que não acha o
caso conhecido não mede nada, e `"1 de 29"` teria virado prova de que o fix era
irrelevante — exatamente a conclusão errada.

## Achado sistêmico: o vazamento não é só branch, é PR aberto

O passo fixo de fim de ronda confere *branch* com commit fora da main. Mas o #52
mostrou o vazamento real: o fix estava em **PR aberto**, revisado e verificado,
e mesmo assim fora de produção.

Medido agora: **27 PRs abertos**, e **16 deles com mais de 7 dias**. Os dois mais
velhos são de **19/08 (30 dias)**: `#9` (registrar toda resposta que a Fast envia)
e `#11` (escalação por e-mail avisa a equipe). Vários citam incidente com aluno
nomeado no título — `#42` (531b6529), `#92` (caso Ellen), `#203` (#290),
`#219` (#319), `#235` (#351).

**NÃO mergeei nenhum.** Não é timidez: as ordens vigentes registram três branches
concorrentes (`feat/onedrive-401`, `feat/fix-image-upload-retry`,
`fix/referencia-fronteira-de-frase-por-palavra`) que, se mergeadas, **derrubam
fix que já está em produção**. Merge em lote aqui é risco real, não limpeza.
Cada um precisa da mesma conferência que dei no #336. Vai como pergunta ao
Johnny, não como ação minha.

## Contagem da ronda

| medida | valor | instrumento |
|---|---|---|
| chamados abertos | **92** | `varredura_travados.cjs` |
| aguardando aluno | **32**, 12 com 7d+, mais velho **20d** | idem |
| itens presos | **0** | idem |
| travados em percepção | **0** (mais velho 0d) | `percepcao_travada.cjs` (controle positivo OK) |
| PRs abertos | **27**, 16 com 7d+, mais velho **30d** | `gh pr list` |
| fila de recados | 96 | `idade_incidentes.cjs` |

A classe de **percepção zerou** — era 13 com o mais velho em 16 dias quando a
ordem de 17/09 foi escrita. O despacho para `olho`/`qa` funcionou.

## O que NÃO fiz

Não gastei GPU, não virei chave, não toquei em crédito, acesso, voz nem
migration. Fora o merge (código puro, já revisado), tudo foi leitura.

Não ataquei os 12 `aguardando_aluno` com 7d+ que pedem segunda tentativa. Fica
declarado como dívida desta ronda, com o número e a idade — não como silêncio.
