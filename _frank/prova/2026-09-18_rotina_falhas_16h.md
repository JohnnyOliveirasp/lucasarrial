# 18/09 ~16hZ — Ronda das falhas (serial, dono da fila)

Nenhum cartão fechado. O card serial foi o **#11** (`9ac03612`, 58,7d), que
**reabriu às 15:31:17Z**, depois da ronda das 14h. A causa saiu cravada em
minutos — e o que ela revelou foi maior que o cartão: **uma falha física só,
espalhada em quatro cartões**, e um **buraco de estorno** achado de raspão.

## Card serial: #11 (`9ac03612`) — NÃO fechado, e é decisão

Peguei por ser o **mais antigo acionável**: 58,7d de vida e `last_seen_at` de
27 minutos atrás. Os dois logo abaixo dele seguem como a ronda das 14h
deixou — #15 (`d3d8d1b2`) dormente desde 04/09, #32 (`9119254c`) com aluno
entregue e o que resta sendo PR.

### O aluno, antes de qualquer coisa (regra 1)

**heitorcamargo7@gmail.com**, voz `600173a6` "Wagner Neto". **Servido**:
`ready` às 15:36:48Z, lora gravado, e-mail entregue 15:37:26Z. Três tentativas
no mesmo dia:

| hora | job | desfecho |
|---|---|---|
| 14:44:27Z | `d2435e64…-e2` | failed — "System error.", **stderr vazio** |
| 15:31:17Z | `951de681…-u1` | failed — "trainer failed", rc=1 |
| 15:36:48Z | `56f5ceeb…-u2` | **completed**, 500 steps, 260s |

~53 min de espera dele. Ninguém está travado neste minuto.

### A causa, pelo stderr (cópia única, capturada antes de expirar)

```
safetensors._safetensors_rust.SafetensorError: Error while serializing:
I/O error: No space left on device (os error 28)
  em save_checkpoint -> save_file(state_dict, folder/"lora_weights.safetensors")
```

**Disco cheio.** E estourou no **step 0** — em 17/09 tinha estourado no step
499. O disco já estava cheio antes do treino valer.

Isso **confirma que o defeito original deste cartão segue curado**: a mig 97 +
`registrarSaidaDoTrainer` me entregaram a causa em segundos. O que reabre o
#11 não é cegueira, é **rota**.

## O que a causa revelou: uma falha, quatro cartões

Disco cheio teve **zero ocorrência em 13 dias** (04–16/09), depois **1 em
17/09 e 3 em 18/09**. Quatro falhas em 30h, quatro alunos:

| quando | voz | aluno | texto do erro |
|---|---|---|---|
| 17/09 21:32Z | `0bf47f6a` | almaraujo13@gmail.com | "trainer failed" (rc=1) |
| 18/09 09:19Z | `ac2d906f` | derinsulanerjp@gmail.com | "[Errno 28] No space left on device" |
| 18/09 13:00Z | `86af6292` | taischw1@gmail.com | "[Errno 28] … `/workspace/jobs/<id>/dataset`" |
| 18/09 15:31Z | `600173a6` | heitorcamargo7@gmail.com | "trainer failed" (rc=1) |

**As 4 vozes estão `ready`.** O custo foi tentativa perdida e espera.

A assinatura sai do **texto do erro** (`incidents/classify.ts:87-109`), que
normaliza número, UUID e hex — mas não o resto. Como o Errno 28 estoura em
lugares diferentes, a mesma causa nasce em cartões separados:

- `no space left on device` → **#32** (`9119254c`, aberto 10/08, investigating)
- `… : '/workspace/jobs/<id>/dataset'` → **#465** (`dfca1cd1`, fixed hoje)
- `System error.` → **#466** (`9d71185d`, fixed hoje)
- `trainer failed` (Errno 28 só no stderr) → **#11**, reaberto

Quatro cartões, uma causa, cada um parecendo "1x" e pequeno demais pra
investigar. **Isso já estava escrito no `04_PLAYBOOKS.md` seção Q**, caixa de
aviso, com o precedente de 08/08 no `/tmp/torchinductor_root` que abriu 4
incidentes. A armadilha estava documentada e repetiu assim mesmo — agora no
treino em vez da geração.

## Done falso que eu encontrei e corrigi

A nota de **17/09 no próprio #11** diz ter aberto *"cartão 30cefcdc pro coder"*
para o disco cheio. **Esse cartão não existe**: conferi por id e por busca de
assinatura, zero linha. O trabalho foi declarado e não foi feito, e por causa
disso a classe ficou 1 dia sem dono enquanto voltava 3 vezes.

Abri o de verdade: **#468** (`78ea706d`), com a medição acima e o pedido
concreto — detector e assinatura próprios decididos pelo `trainer_stderr` /
`returncode`, no molde do que o OOM ganhou no PR #308.

**A causa raiz (por que `/workspace` enche) segue sem dono e eu não a
investiguei.** O que tenho é o fato de 13 dias limpos virarem 4 falhas em 30h,
o que cheira a lixo acumulando em volume persistente. Está escrito no #468 como
hipótese, não como diagnóstico.

## Achado de raspão: estorno multiplicado (#469)

Fui conferir se o aluno do #11 tinha dívida de crédito. Tinha o contrário.

```
14:43:26Z  training        -10.000  ref_type=voice                saldo  87.630
14:44:28Z  extra_purchase  +10.000  ref_type=voice_train_refund   saldo  97.630
15:31:18Z  extra_purchase  +10.000  ref_type=voice_train_refund   saldo 107.630
```

**Um débito, dois estornos, na mesma voz.** (Conferido por `ref_type`, nunca
por `kind` — o estorno grava `kind='extra_purchase'`, armadilha da ordem de
20/08.)

**Mecanismo, conferido no código.** `finalize-training.ts:614` decide o estorno
por `houveDebitoDeTreino(userId, voiceId)`, e essa função
(`credits/service.ts:186-203`) pergunta *"existe **alguma** linha de débito
pra este user+voice?"* — nunca *"esse débito ainda está por devolver?"*. Débito
não some do extrato depois de estornado. Logo **N falhas na mesma voz = N
estornos contra 1 débito**. O gatilho prático é a re-execução por conta da
casa: ela não debita, falha, e o handler estorna assim mesmo porque o débito
original do aluno continua lá.

A ironia está no comentário da própria função: ela nasceu (caso ricardoolito,
15/09) pra impedir *"conceder crédito que nunca saiu"*. Fecha o buraco de quem
**nunca** foi debitado e deixa aberto o de quem foi debitado **uma** vez e
falhou **duas**.

**Alcance medido** (varredura completa do `credit_transactions`, não amostra):
4 vozes com estorno maior que débito, 10.000 cr cada, **40.000 cr**:

| voz | aluno | forma | quando |
|---|---|---|---|
| `600173a6` | heitorcamargo7@gmail.com | 1 débito, 2 estornos | 18/09 |
| `ca61b94d` | luisa13ra@icloud.com | 0 débito, 1 estorno | 14/08 |
| `8aca0126` | csitya100@gmail.com | 0 débito, 1 estorno | 15/08 |
| `b5ea6b9b` | personaltrainer.nelsonlopes@gmail.com | 0 débito, 1 estorno | 17/08 |

**Digo o que sei e o que não sei:** só o primeiro tem o mecanismo provado. Os
três de agosto têm forma **diferente** (zero débito) e são **anteriores** à
guarda, que nasceu em 15/09 — bate com serem resíduo do buraco velho, mas **não
investiguei cada um e não afirmo isso como fechado**.

## Decisão de dinheiro que eu NÃO tomei

**Não tirei os 10.000 cr do aluno.** Tirar crédito de assinante pagante é ação
irreversível e não há ordem que a autorize: as ordens da casa cobrem
**devolver** crédito cobrado indevidamente, nunca o contrário. O aluno não tem
culpa nenhuma. Fica registrado no #469 pro Johnny decidir.

## Passo fixo — reconciliação dos envios

Rodado com `--corte=2026-09-14T14:06:31Z --confirmar`: 640 cartas lidas da
pasta, 562 já tinham linha, 77 fora da janela, **1 escriturada** — uid 2806,
18/09 15:27:54Z, `thallitamachado@hotmail.com` (devolução dos 525 cr da
imagem). Relida do banco, e **nenhuma com data de hoje**: o carimbo histórico
pegou.

Conferido pelo irmão de leitura (`enviados_x_tabela.cjs`): **veredito 0 cartas
depois do corte**. O buraco está passivo.

⚠️ O registro local continua **inexistente nesta máquina** ("é gitignored, some
com o worktree") — exatamente o motivo pelo qual esta reconciliação é passo
fixo e não conserto de uma vez só.

## Percepção

`percepcao_travada.cjs`: **1** card apontado (`#450`), **0 reais**. É o mesmo
falso positivo das três rondas anteriores — prosa da nota casando por `%ouvir%`
— e a nota de hoje 13hZ já o havia despachado e declarado "não é caso de
percepção". Conferido nesta ronda, não herdado. **Quarta ronda seguida** com
falso positivo nessa linha; sigo **não apertando** o padrão do varredor: falso
positivo custa 2 minutos, falso negativo custou os 16 dias que originaram a
ordem de 17/09.

## Contagem da ronda

| medida | valor | instrumento |
|---|---|---|
| chamados abertos | **96** (+1 na varredura; +2 abertos por mim) | `varredura_travados.cjs` |
| aguardando aluno | **31**, mais velho **21d** | idem |
| itens presos | **0** | idem |
| travados em percepção | **0 reais** (1 apontado) | `percepcao_travada.cjs` |
| cartas escrituradas | **1** (0 depois do corte) | reconciliação + irmão de leitura |
| falhas de treino em 30h | **5**, sendo **4 de disco cheio**, 4 alunos | `training_jobs` |
| alunos travados agora | **0** (as 4 vozes `ready`) | `voices` |

## Erro meu, nesta ronda

Carimbei "~18hZ" nas notas que escrevi no #11, #32, #465 e #466 — eram
**15:5xZ**, ronda das 16h. Corrigi as descrições do #468/#469 na origem e
registrei a correção como nota nova no #11, em vez de reescrever (nota não se
sobrescreve). O conteúdo e as medições não mudam; a hora estava errada e isso
atrapalharia quem for ordenar os fatos depois.

## O que NÃO fiz

- **Não fechei o #11** — a causa é viva, não há conserto nosso em produção, e
  fechar seria trocar "disco cheio voltou" por "achei que tinha resolvido".
- **Não escrevi pra nenhum aluno.** Os 4 atingidos foram entregues e o do #11
  já recebeu carta às 15:37Z. Escrever "você está com 10.000 créditos que não
  são seus" antes do Johnny decidir seria pior que o silêncio.
- **Não toquei no saldo de ninguém.** Zero migration, zero DDL.
- **Zero GPU.** Nenhum treino disparado por mim.
- **Não investiguei a causa raiz do disco encher** — declarada como hipótese no
  #468, não como diagnóstico.
- Continuo sem atacar os **`aguardando_aluno` com 7d+** (mais velho 21d).
  Dívida declarada de novo, com número e idade.
