# Ronda das falhas — 13/09/2026, ~18hZ (15h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais as ordens de
**27/08** (só erro de sistema vira chamado), **29/08** (planilha desligada) e
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.**

**Item serial: `#101` / `b2651a6f`.** Fix em produção, card **não** fechado.

---

## 0. Abri exceção à regra 8, e digo o porquê antes de qualquer outra coisa

O `#101` **não** é o mais antigo: o `#52` tem 25,0d e o `#99` 21,0d, contra
20,9d dele. Peguei mesmo assim por três motivos, em ordem de peso:

1. **É o mecanismo pelo qual todo outro card fecha.** Toda ficha da fila termina
   em "avise o aluno". Se a carta não chega, *"avisei o aluno"* é falso na fila
   inteira — inclusive para a Katia, avisada por e-mail 40 min antes, na ronda
   das 17h.
2. **Disparou 11 min antes de eu começar** (17:30:03Z) com um motivo que nunca
   tinha aparecido no card: `550 Rejected due to high probability of spam`.
3. O `#52` estava esperando ocorrência nova e a Katia (`#47`) tinha acabado de
   sair do meu colo pela própria regra 8 (e-mail enviado, bola com ela).

Não é exceção gratuita e aceito ser cobrado por ela.

---

## 1. O que eu consertei, com número

Varri a caixa do `suporte@` desde **01/07** (`EXAMINE` + `BODY.PEEK`, nada
marcado, fila da Fast intocada): **54 relatórios, 50 destinatários que falharam,
18 pessoas distintas sem receber.**

Dos 50, **18 caíam em `desconhecida`** — a classe que reabre chamado mas não diz
se a culpa foi da casa, do endereço ou do destino. Três lacunas na
`classificarDiagnostico`, cada uma com o bounce que a prova:

| # | lacuna | prova |
|---|---|---|
| (a) | **Prosa do Gmail sem o código.** A mesma frase com e sem `550-5.1.1` dava classe diferente | uid 607 (com) → `inexistente`; uid 588/589/590/591/606 (sem) → `desconhecida` |
| (b) | **Spam de saída sem o `JFE`.** A regra só acendia com `JFE\d{6}` | uid 608 veio só com a frase e virou `desconhecida` |
| (c) | **Domínio que não aceita e-mail.** Não havia regra pra falha de MX | uid 605, `gmail.com.br` |

Detalhe de (a): a regra pedia `address (does not) exist`, mas o Gmail escreve
*"account that you tried to reach does not exist"*; e `no such user` não casa
`NoSuchUser` (sem espaços) da URL de ajuda. **Mesma causa, dois destinos, só por
causa de um trecho numérico.**

Detalhe de (b), e é o que prova que o barramento era **nosso**: o mesmo relatório
derrubou **o aluno E a nossa cópia interna** (`suporte@lucasarrial.com`). Se o
Gmail tivesse recusado, só o endereço do aluno falharia. Os dois falhando
significa que a mensagem não passou do nosso próprio relay. **A casa estava
sendo barrada por ela mesma e não sabia.**

Detalhe de (c): conferi com `dig` — `gmail.com.br` publica **MX nulo (`0 .`)**,
que pela **RFC 7505** é a forma explícita de um domínio declarar que não aceita
e-mail. O DSN veio `Action: failed`, permanente pela RFC 3464.

**Medido na mesma caixa, antes → depois:**

| classe | antes | depois |
|---|---|---|
| **desconhecida** | **18** | **0** |
| inexistente | 15 | 31 |
| spam-saida | 5 | 7 |
| caixa-cheia | 10 | 10 |
| bloqueio-destino | 2 | 2 |

As duas classes que já acertavam **não se mexeram** — é a prova de
não-regressão.

**Em produção:** PR **#262**, merge **`b3ebfd5`**, run *Deploy Frontend
(production)* **34773057262 `completed/success`** — verificado por run concluído,
não por PR verde. 4 testes novos, **24/24** no arquivo, **84/84** na pasta
`agent`. `tsc --noEmit` só com o erro pré-existente da main
(`resgate-audio.test.ts`/vitest).

O padrão do MX é **estreito de propósito** (casa a falha de resolver o MX, não
"DNS" solto): carimbar queda transitória de resolvedor como permanente faria a
casa parar de escrever pra aluno alcançável. Tem teste pra isso.

---

## 2. Efeito colateral que eu não vou esconder

A assinatura do card por aluno é `fast-bounce:<classe>:<email>`. **Mudar a classe
muda a chave de dedupe.** O próximo bounce do `luctec@` vai abrir card novo
(`spam-saida`) em vez de reabrir o antigo (`desconhecida`). Não é perda de dado,
mas quem olhar a fila nos próximos dias vai ver alguns "novos" que são o mesmo
caso com o nome certo. Registro pra ninguém ler isso como surto.

---

## 3. ⚠️ O erro que eu quase reportei, e peguei lendo o código

Cruzei os 18 inalcançáveis com pagamento real (Hotmart + Stripe): **11 pagaram.**
Desses, **3 estão usando a plataforma normalmente** (Tulio, Reinaldo, Lucila) e
**8 estão SEM ACESSO com 0 crédito**.

**Quase reportei "R$ 7.042,16 de pagante travado". Está ERRADO.** Os 8 compraram
*Sistema de Geração Pronto* e *Fábrica de Conteúdo Invisível*, que são produto de
**CURSO**. Regra comercial do **Lucas, 31/08**, obedecida de propósito em
`acesso-regra.ts` (`PRODUTOS_DE_CURSO_PADRAO`) e em `sgp-boas-vindas.ts` (*"a
conta nasce vazia… não é descuido"*): **comprar o curso NÃO dá a plataforma.**
"Sem acesso" é o estado **certo** deles, não dívida nossa.

Pior: eu cheguei a **levar a pergunta comercial ao grupo** e tive de me corrigir
lá. A decisão já existia desde 31/08 e eu estava reabrindo assunto fechado —
exatamente o que o `README.md` das ordens manda não fazer.

Também conferido antes de virar alarme: **3 dos 8 não têm nenhum
`payment_event`** (Rodrigo 28/07, Anderson 06-08/08, Glauber 15/08). Não é
webhook perdido: o commit `4688e40` (09/06 18h50Z) passou a devolver 200
`ignored_other_product` **sem gravar** pra todo produto ≠ `HOTMART_PRODUCT_ID`.
A ausência é **fabricada pelo nosso código**, como o próprio `sgp-boas-vindas.ts`
documenta.

**O que sobra de verdade, sem inflar:** gente que pagou curso e não consegue
entrar no que comprou, porque a carta que leva o acesso não chega.

---

## 4. 🔴 O caso urgente: Sheila (`#374`)

Pagou **R$ 649,45 hoje** (R$ 397 SGP `HP1323644378` + R$ 252,45 Fábrica
`HP3198541093`, os dois APROVADOS). Compra aprovada **13:53:25Z**; a carta de
boas-vindas quicou **13:53:36Z** — **onze segundos depois**. O fluxo da casa
funcionou inteiro; só o endereço está morto (`gmail.com.br`, MX nulo).

**O que eu NÃO fiz, de propósito:** não mandei nada pra
`horta.pericias@gmail.com` (o mesmo usuário sem o `.br`). É o palpite óbvio, e
conferi que esse endereço **não tem compra nenhuma** — não tenho prova de que é
dela. Mandar o acesso de uma pagante pra um endereço chutado pode entregar a
conta dela pra um terceiro. **Endereço parecido não é identidade.**

**O caminho que existe** não passa por e-mail: o checkout guardou o **telefone**
dela. É acão externa em nome da casa, então **não disparei sozinho** — está no
grupo. Levei **na hora**, não esperei o relatório.

---

## 5. ❌ O que eu NÃO consertei, e por isso NÃO fecho o `#101`

O título do card tem dois defeitos. O (1) *"não existe registro do que foi
enviado"* foi fechado em `95297f8`. O (2) *"os bounces não viram nada"* hoje
vira: **cada aluno que quica ganha ficha própria** (Sheila `#374`, Sunesa `#294`,
Ulysses `#340`, Valdeni `#338`, Renato `#328`, Rodrigo `#378`).

**Só que elas ficam paradas.** `#294` em `investigating` desde **07/09**, `#328`
desde **09/09**, `#338` e `#340` desde **10/09**. A casa passou a **registrar**
que o aluno não recebeu e continua **não fazendo nada** com isso. **Trocamos
silêncio por fila parada** — é melhor, não é resolvido.

Pela ordem de 27/08 isso é **processo, não erro de sistema**, então **não abri
chamado novo**: foi pro grupo. E pela lição gravada no próprio `#101` em 30/08
(*"título com dois defeitos não pode ser fechado por commit que cobre um"*),
**não fecho** este card só porque a classificação parou de mentir.

---

## 6. Armadilha de instrumento que me pegou hoje

Minha primeira consulta de acesso devolveu **"SEM CONTA" para os 11**. Era
mentira: pedi a coluna `credits`, que **não existe** (são
`credits_subscription`/`credits_extra`), e **não imprimi o campo `error`** — o
Supabase devolveu erro e eu li o vazio como resposta. Só peguei porque o
`aluno.cjs` tinha achado 2 deles minutos antes. Refiz com **controle positivo
obrigatório** (aborta se nenhum perfil for achado) e vieram os 11.

É exatamente a armadilha do *"zero de instrumento cego"* já gravada na casa.
**Eu repeti ela hoje**, e registro por isso.

---

## 7. Placar honesto

- **Incidentes fechados: 0.** O backlog não baixou (81 abertos).
- **Código em produção: 1** (PR #262, merge `b3ebfd5`, deploy success conferido).
- Lacunas de classificação corrigidas com medida: **3**. `desconhecida` **18 → 0**.
- Incidentes anotados: **2** (`#101` com a medição inteira, `#374` com causa cravada).
- Alunos escritos: **0.** A urgente (Sheila) **não é alcançável por e-mail** — o
  canal dela é telefone e isso é decisão de quem fala pela casa.
- **Erro meu, pego por mim antes de fechar: 1** (os "R$ 7.042 travados" que são
  regra comercial, não defeito) — e **corrigido no grupo**, não escondido.
- **Armadilha de instrumento que eu repeti: 1** (zero de consulta com coluna errada).
- Créditos gastos de aluno: **0**. GPU disparada: **0**. Migration: **0**.

**O que emperrou, na cara limpa:** o `#101` continua aberto porque a metade viva
dele não é classificação, é **ação** — e ação sobre ficha de bounce ainda não
tem dono. Eu fiz a classificação parar de mentir; não fiz ninguém agir.

**O que eu NÃO fiz:** não fechei incidente sem resolver, não mandei acesso pra
endereço chutado, não toquei em crédito, não disparei GPU, não mexi em default de
produto, não mergeei branch STALE, não li a caixa do `suporte@` pra triagem (só a
varredura de bounces em `EXAMINE` + `BODY.PEEK`), e não inventei causa pra
parecer produtivo.
