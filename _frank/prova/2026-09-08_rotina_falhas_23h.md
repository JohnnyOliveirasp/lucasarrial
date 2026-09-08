# Ronda das falhas — 08/09/2026, ~23h40–00h20Z (Frank, dono da fila)

Repo sincronizado (`main`, `pull --ff-only`) e `_frank/ordens/README.md` lido
antes de tocar em qualquer coisa. Nada da planilha foi lido, classificado,
aberto ou reaberto (ordem de 29/08). Canal: **grupo** (ordem de 31/08).

**Card levado adiante:** `#226` (`702cc916`) — o mais antigo ACIONÁVEL da fila,
e o que tinha plano de medição escrito para esta ronda.
**Estado no fim:** `#226` segue `investigating`, agora com o conserto **medido
em produção**: funciona como projetado, com **custo zero de falha**. Uma nota
nova no `#314` fechando a pergunta "há outras vítimas?". Zero GPU, zero crédito,
zero e-mail, zero migration, zero código, zero PR.

---

## 0. A ronda em uma linha

**O conserto do `#226` está no ar e pega: abaixo do piso caiu de 7 em 124 para
0 de verdade em 45, sem produzir nenhuma falha nem estorno — mas a única
entrega "quebrada" que sobrou é um texto de UMA LETRA, e foi ela que quase me
fez escrever um defeito que não existe.**

## 1. Por que o `#226`, e não outro

Regra 8: o mais antigo com aluno afetado. Ordenando os 45 abertos por
`first_seen_at`, os três primeiros estão **travados e não por falta de
investigação**:

- `#312` (91,3 d) e `#313` (91,3 d) — decisão **comercial** do Johnny
  (honrar ou revogar os 15 entitlements vitalícios). Conferido: nenhuma ordem
  nova em `_frank/ordens/`, nada novo no git.
- `#15` (40,4 d) — a ronda das 21h refutou as duas hipóteses com medição e
  concluiu que o que falta é **ocorrência nova**, não análise.

O `#222` (7,3 d) teve o varejo encerrado hoje e o que sobra nele é decisão. O
próximo acionável é o `#226` — e ele tinha, na própria nota, o plano do que
medir. Peguei esse.

## 2. O conserto está no ar? Sim — e o build dele aparece CANCELADO

Armadilha nova, que ia derrubar conserto bom: o build do `c1db335` (o PR #176,
que É o conserto) está **`cancelled`** — o run `34240346781` foi superado 2 min
depois pelo `2adb080` (PR #213). Quem olhar a linha do PR #176 no `gh` conclui
que não subiu. **Subiu:** `2adb080` é merge commit cujo tree contém o `c1db335`,
e o build dele (`34240571817`) fechou **success 15:22:32Z**.

Não aceitei workflow verde como prova (lição do apagão de 05/09) — fui no banco.
A chave `coverage_espalhada_piso` nasce com este PR:

| dia | entregas | com a chave nova |
|---|---|---|
| 04/09 | 39 | 0 |
| 05/09 | 23 | 0 |
| 06/09 | 35 | 0 |
| 07/09 | 66 | 0 |
| **08/09** | 68 | **1** |

Primeira ocorrência na base inteira: **08/09 22:26:11Z**. O código novo rodou em
produção.

**O que isso não prova:** que a frota inteira está na imagem nova. Uma
ocorrência prova **um** worker.

## 3. O erro que eu quase cometi (e que a próxima ronda ia herdar)

Vi a chave nova em **1** geração e ausente em outras entregas pós-deploy que
usaram a mesma escotilha, e li isso como **frota mista** — metade dos workers
na imagem velha. Ia ser um achado grave e **está errado**.

Fui no código antes de escrever: `inference.py:473-495` só grava a chave quando
`coverage < piso`; acima do piso o caminho incrementa apenas
`coverage_espalhada`. Todas as entregas pós-deploy sem a chave estão **acima de
0,65**. São consistentes com o código novo. Nenhuma linha contradiz o rollout —
o que é diferente de provar o rollout, e está escrito assim na nota.

## 4. O conserto pega — depois de separar o artefato de instrumento

Corte no deploy (15:22:32Z), `generations` `ready` com `coverage_min_visto`:

| janela | entregas | alunos | < 0,85 | < 0,65 | zero |
|---|---|---|---|---|---|
| ANTES | 124 | 49 | 24 | **7** | 3 |
| DEPOIS | 45 | 14 | 5 | **1** | 1 |

**A única abaixo do piso depois do deploy não é entrega quebrada.** A
`f88b149f` tem texto de **1 caractere**: a letra `o`. Cobertura 0 num texto de
1 char é artefato — não há o que o whisper case. O `coverage_idioma_detectado:
"en"` com probabilidade 0,209 no mesmo registro é a mesma coisa: não se detecta
idioma de uma letra.

Conferi no outro sentido, para não vender resultado bom com régua torta: as 7 de
ANTES são textos **reais** (2045, 769, 557, 380, 380, 126 e 124 chars) e as 3 em
zero são falhas de verdade.

**Com o artefato separado: abaixo do piso depois do deploy = 0 de verdade em 45.**

**A força disso, dita honestamente:** sob a taxa de antes (7/124 = 5,6%), sair
zero em 45 tem probabilidade **~7,6%**. É **sinal, não prova**. 8,2h de produção
não fecham a classe.

## 5. O mecanismo funcionou de ponta a ponta

Na `f88b149f` dá para ver o desenho inteiro num registro só:
`coverage_espalhada_piso:1` (o piso **bloqueou** no gate 1/2 e mandou pro
resgate — `coverage_rescue_nivel2:1`) e depois
`coverage_espalhada_piso_terminal:1` (no fim da linha o piso só **contou** e
entregou). É exatamente o que o docstring descreve: ganho nos gates 1 e 2,
terceira porta preservada de propósito.

## 6. O custo que fui procurar e não existe

Este era o risco real: `False` no gate terminal significa job falho + **estorno
automático**, que é a tempestade de 19/08.

| janela | gerações | janela | `failed` |
|---|---|---|---|
| ANTES | 163 | 63,2h | **0** |
| DEPOIS | 60 | 8,2h | **0** |

Zero falha e zero estorno nos dois lados. O PR não comprou o ganho com falha de
aluno.

## 7. Achado que vale mais que o número: a régua tem dois zeros falsos

A régua de cobertura marca 0 em dois casos que **não são defeito nosso**:

1. **Texto ultracurto** — a `f88b149f`, 1 char.
2. **Texto em outro idioma** — a `b7806399` (0,4) é texto em **inglês**
   (*"SkyDiveThru Ireland has not started operations just yet…"*) e as
   `6a100d56`/`f9280354` (0,455 e 0,435) são português **europeu**
   (*"Olá, malta… Counter Strike"*).

Quem contar "entregas abaixo do piso" sem separar isso persegue fantasma — foi o
que quase aconteceu comigo. Ficou registrado na nota o filtro para a próxima
medição: `length(text_normalized) >= 40` + conferir `coverage_idioma_*` antes de
chamar qualquer número de defeito.

## 8. `#314` — fechei a pergunta que o card deixou aberta

O `#314` (aberto às 22:55Z) registrou honestamente que **não** tinha procurado
vítimas passadas. Procurei.

- **O reparo do Jesus Peres continua de pé**, reconferido na fonte: `A1ZH3SEI`
  com `user_id` = `347eccc3` (a conta que ele usa), `active`, até 18/09.
  ⏳ **A fuse de 18/09 segue armada** — o destino em caso de evento continua
  sendo `4656e845`, que nunca logou.
- **Exposição hoje = 1**, com a mesma consulta do card. Nenhuma linha nova.
- **Vítimas passadas: nenhuma encontrada.** `entitlements` não tem trilha de
  auditoria, então transferência já revertida é invisível por consulta direta —
  limitação estrutural. Usei o rastro que a transferência deixa no **dinheiro**:
  saldo em contas com `last_sign_in_at IS NULL`. Deu 17 contas, **todas
  explicadas** (14 compradores que nunca usaram, a conta da casa, o Fernando
  reparado hoje, e o Iran).
- **O `#222` do Fernando não está armado**, e conferi de propósito porque o
  reparo tem a mesma forma: `alinecuida@gmail.com` **não tem perfil**, então não
  há para quem transferir. Vira gatilho a vigiar, não problema de hoje.

**⚠️ Anti-alarme registrado:** o `iran@ogr.com.br` aparece com saldo
**negativo** (−10.525) numa conta que nunca logou, o que parece impossível
("conta que nunca logou não gera"). **Fui conferir antes de abrir chamado:** o
vigia já media isso em 07/09 no `#298` — são −10.000 do treino de voz e −525 do
avatar, marcados *"onboarding: pode ficar negativo"*, numa conta criada **pelo
SGP**. Conta de onboarding legitimamente tem `last_sign_in_at` nulo e débito.
Não é vítima e não é dinheiro perdido. É o padrão dos `#100`/`#125`/`#152`:
acusar dinheiro olhando um lado só do livro.

## 9. Falha de processo: a ronda das 22h55 não deixou log

A ronda que abriu o `#314` (criado **22:55:33Z**) fez trabalho pesado e que
**mexeu em dinheiro** — transferiu titularidade de entitlement, concedeu 100.000
créditos, zerou uma conta fantasma e escreveu para um aluno. **Não há log dela
em `_frank/prova/`**: o último arquivo de ronda é o das 21h, e nenhum log do dia
cita o `#314`. A árvore está limpa e não há nada preso em branch — o registro
simplesmente não foi escrito.

**O que salvou:** a `description` do `#314` é excepcionalmente completa e carrega
a linha do tempo, as pré-condições conferidas e a prova relida do banco. A
informação não se perdeu — mas ela está só no incidente, e o `_frank/prova/` é
onde a próxima ronda procura. Registro aqui para o dia não ficar com um buraco
entre 21h e 23h40.

## 10. O que NÃO está feito

1. **O `#226` continua aberto.** A terceira porta (gate terminal) segue
   entregando áudio abaixo do piso, **por decisão deliberada de 04/09**. O PR
   estreitou o buraco sem cobrar nada; não o fechou. Fechar seria mentir.
2. **45 entregas não sustentam "zerou".** Falta re-medir com ≥150 pós-deploy.
3. **`#312`, `#313` e a compensação do Fernando** seguem travados na decisão do
   Johnny.
4. **A fuse do `#314` em 18/09** continua armada — o reparo do Jesus comprou 10
   dias, não consertou a causa.
5. **Não escrevi para aluno nesta ronda.** O único aluno tocado pela medição
   (Samuel Nogueira) não foi prejudicado: a `f88b149f` foi a geração de 1 letra
   e 18 min depois ele gerou o texto real (`429f17e4`) com cobertura 0,909.

## 11. Higiene de fim de ronda

- **Zero código, zero PR** nesta ronda — só medição e escrituração.
- Escritas: **2 notas** (`#226` nota 38, `#314` nota 1), via
  `anotar_incidente.cjs --confirmar`, as duas conferidas na releitura.
- Este log vai **direto na `main`**, com `git branch --show-current` conferido
  imediatamente antes do commit.
- Nada de crédito, GPU, whisper, migration, assinatura ou e-mail.
- Nada da planilha tocado.
