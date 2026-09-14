# 14/09 ~20h30-21h30Z — Rotina das falhas

Método serial (regra 8): peguei **um** caso e levei até o fim. Fila **80
abertos** na abertura (1 com 30d+, 3 entre 15-30d, 29 entre 7-15d) — mesmo
número que o Vigia mediu às 20hZ.

Repo em `main`, `pull --ff-only` limpo. `_frank/ordens/README.md` lido antes de
tocar em qualquer coisa, mais a ordem de **29/08** (planilha desligada) e a
**REGRA FINAL DE CRÉDITO de 20/08**. **Nada da planilha foi lido, escrito,
classificado ou reprocessado.** Ordem de canal de **31/08**: o aviso desta ronda
foi **no grupo**, com `notify-grupo.sh`, e só lá.

## Qual peguei, e por que

Não peguei a cabeça da fila: os 8 mais velhos foram conferidos pela ronda das
19h e continuam parados em decisão alheia, prazo datado ou dinheiro do Johnny —
nenhum mudou de estado em 1h.

Peguei a **Mary** (`mary.020220@gmail.com`), que **não estava na fila**. Ela é a
exceção que a regra 8 autoriza (*dinheiro sendo cobrado errado*): pediu
cancelamento hoje às **17:37Z**, a assinatura seguia **ACTIVE** apontando
cobrança para **20/09**, e ela estava na **3ª ronda seguida** sendo relatada sem
que ninguém encostasse. O Vigia fez a parte dele (anotou 18hZ e 20hZ); a parte
que faltava era de quem **decide e conserta**, que sou eu.

## O que era, de verdade — e não era o que a fila supunha

A ronda das 18hZ deixou a pergunta em aberto assim: *"não consigo ler o corpo —
a pasta Enviados do IMAP está vazia (o SMTP não salva cópia)"*, e por isso não
dava pra saber se a Fast tinha dito *"registrei seu pedido"* (a classe do `#384`)
ou *"cancele você na Hotmart"* (orientação correta).

**Essa premissa estava errada, e era barata de derrubar.** O `ler_caixa.cjs`
tem `--enviados --para`, e a própria ronda das 13hZ de hoje já tinha **provado
em produção** que o servidor aceita `UID SEARCH TO` e que a pasta de enviados
casa o destinatário. Rodei: **uid 2303**, 17:40:16Z, corpo inteiro legível. A
pergunta ficou **3,5 h** parada por um limite que não existia.

**E a resposta não era nenhuma das duas hipóteses.** Era uma terceira, pior:

> *"vou te passar o caminho do cancelamento: (...) você acessa a área do
> comprador da Hotmart (...) Minhas compras (...) Cancelar assinatura."*

A casa mandou a **aluna** cancelar sozinha. Isso contraria a **regra 9-C**
(decisão do Johnny, 21/08), que está escrita no cabeçalho da nossa própria
ferramenta: *"Cancelamento virou AUTOMÁTICO: é o pedido do titular (...) o
Johnny não vai responder pode cancelar? — por isso isto existe"*, e *"a
salvaguarda NÃO consulta o Johnny"*. Tínhamos ferramenta e autorização
permanente, e mandamos ela se virar. Ela não conseguiu: 4 h depois, `ACTIVE`.

A resposta também **não mencionava 20/09**. Ela não tinha como saber que havia
relógio.

## O que fiz

- **Cancelei a `F0XF8RYW`.** Conferido na fonte viva **depois** de gravar, com o
  ensaio do próprio `cancelar_assinatura.cjs`: Hotmart `ACTIVE` →
  **`CANCELLED_BY_SELLER`**, nosso entitlement `active` → **`canceled`**, e a
  ferramenta agora responde *"todas já estão canceladas/inativas (idempotente)"*.
  Titularidade conferida **antes**: 1 perfil, 1 entitlement, e-mail bate.
  **Ela não será cobrada em 20/09.** Acesso segue até 20/09 e os 62.063 créditos
  seguem intactos — cancelar não encosta em crédito nem em acesso.
- **Escrevi pra ela** (Enviados **uid 2338**, cópia confirmada): está feito, não
  precisa fazer nada na Hotmart, não haverá cobrança, acesso até 20/09, créditos
  ficam. Assumi o trabalho que demos a ela, sem inventar desculpa.
- **Anotei o `#384`** (nota 7, 1 linha afetada na releitura) com a objeção e com
  a correção do fato das 18hZ.
- **Abri o `#400`** para a causa raiz, com `arquivo:linha`:
  `manual.ts:396-403`, item 2 do PLAYBOOK DE CANCELAMENTO.

## Por que o `#400` não é reabertura do `#384`

O `#384` é *"o pedido vira recado e nunca vira ação"*, e o conserto dele
(commit `9b14629`) é a varredura `saida_x_assinatura.cjs`, que tem **card** como
entrada (`:160` e `:231`). O Vigia já mostrou às 18hZ que quem não vira card não
aparece.

O `#400` é a **camada acima**: enquanto a Fast responder *"cancele você mesmo"*,
o pedido se encerra como **atendido** na cabeça da Fast **e** do aluno, então não
há motivo pra virar card — e a varredura nunca teria o que cruzar. **Consertar
só a varredura não alcança esta classe.** A Fast, aqui, executou o manual
corretamente: o defeito é o manual, não improvisação do modelo.

**A cauda já existe na fila**, e não é hipótese: `#385` (*"tenta cancelar na
Hotmart e recebe erro"*) e `#325` (*"não está achando a opção de cancelar"*) são
alunas que receberam o passo a passo, tentaram, falharam e voltaram a escrever.

## O erro que eu quase cometi, e que é a parte mais importante desta ronda

Ao ler o manual, achei que tinha encontrado um segundo defeito grave: a Fast
prometeu à Mary que *"seus créditos **pagos** não expiram"*, sendo que ela
**nunca pagou** (`pagou_de_verdade.cjs`: SEM PAGAMENTO, 0 BRL — conferido também
por nome, sobrenome e prefixo, existe 1 perfil só, sem segundo endereço). O
próprio manual proíbe essa frase para quem está no teste
(`manual.ts:389-395`), e existe máquina real de expiração
(`credits/trial-expiry.ts` + `expire_trial_credits`, teto de 10 dias) que
zeraria os 62.063 dela em **23/09**.

Eu estava **a um comando de mandar um segundo e-mail "me corrigindo"** e avisar
a aluna de que os créditos iam expirar. **Fui medir antes de escrever, e a
correção é que estava errada:**

- os 97 marcadores `zeroed` são **todos** de até **18/08**; desde então a
  varredura não resolveu **ninguém**;
- há perfis com acesso vencido desde **início de agosto** ainda com **100.000**
  créditos intactos.

Ou seja: o zeramento está **parado desde ~18-20/08**, que é exatamente quando o
Johnny fechou o assunto com a **REGRA FINAL DE CRÉDITO de 20/08** — *"o saldo
não zera, o saldo não fica parado, não há confisco"* —, ordem **mais nova** que
a regra do trial de 18/08 e que, pelo índice, **vence**. O que eu ia chamar de
defeito é a decisão do Johnny funcionando.

**Se eu tivesse "corrigido" a aluna, teria assustado ela com uma expiração que a
casa decidiu não aplicar** — e teria sido eu, não a Fast, contando a mentira.
Não mandei segundo e-mail: o primeiro está de acordo com a ordem vigente.

**E não abri nada sobre crédito, de propósito.** A ordem de 20/08 proíbe
expressamente reabrir, escalar ou refinar o assunto: *"aplique a regra acima e
feche"*. Registrei o desalinhamento do manual dentro do `#400` como **fato para
quem for tratar**, explicitamente sem propor mudança. Só o Johnny levanta
crédito.

## O que NÃO fiz, e por quê

- **Não toquei nos outros pedidos de cancelamento abertos** (`#368`, `#336`,
  `#325`, `#307`, `#300`). Vários envolvem **reembolso/garantia** (não é minha
  alçada) ou assinatura **duplicada**, onde cancelar a errada transforma pedido
  banal em incidente grave — é o que a salvaguarda de titularidade existe pra
  impedir. Cada um exige conferência individual, e a regra 8 manda fechar um
  caso antes de abrir outro. **Ficam nomeados aqui para a próxima ronda.**
- **Não mandei segundo e-mail pra Mary** (motivo acima).
- **Não mexi em crédito, acesso, plano nem entitlement** — o cancelamento não
  encosta neles.
- Não apliquei migration, não mergeei PR, não abri PR, não gastei GPU, não
  toquei nos branches STALE, não liguei nem mandei WhatsApp, **não toquei em
  e-mail não lido** (leitura com `BODY.PEEK`, critério `SEEN`), e **não li nem
  reprocessei nada da planilha**.
- **Não marquei nada como `fixed` que não estivesse resolvido** (regra 14).

## Lições

1. **Limite declarado por uma ronda anterior é hipótese, não fato.** "A pasta
   Enviados está vazia" parou a investigação por 3,5 h, e o desmentido custou um
   comando — que outra ronda do mesmo dia já tinha provado funcionar. Antes de
   herdar um "não dá pra ver", teste se ainda não dá.
2. **Quando a casa tem ferramenta e autorização, mandar o aluno se virar é
   defeito, não economia.** A Mary não conseguiu. Duas outras também não.
3. **Medir antes de se corrigir vale tanto quanto medir antes de afirmar.** Eu
   quase mandei uma "correção" honesta em intenção e falsa em conteúdo. O que
   me segurou foi conferir se a máquina de expiração estava **rodando**, e não
   só se ela **existia**. Código no repositório não é código em execução.
4. **Ordem mais nova vence, inclusive contra código e manual.** O manual carrega
   linguagem pré-20/08 e a máquina obedece à decisão nova. Ler só o código teria
   me dado a resposta errada.

## Estado do repo ao fim da ronda

- **nenhum código subiu nesta ronda** — só este log, 1 cancelamento, 1 e-mail,
  1 nota e 1 incidente novo (`#400`). Logo não há branch `feat/` com commit
  preso.
- Fila: **80 → 81** aberto (abri o `#400` e não fechei nenhum). O relatório diz
  isso sem maquiagem: o caso da Mary foi resolvido **fora** da fila, e o que
  entrou na fila foi a causa raiz que ninguém tinha nomeado.
