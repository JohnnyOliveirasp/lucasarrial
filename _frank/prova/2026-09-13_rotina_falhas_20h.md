# Ronda das falhas — 13/09/2026, ~20hZ (17h BRT)

Executor (14-A): eu investigo, decido, conserto e fecho. Repo em `main`,
`pull --ff-only` limpo. `_frank/ordens/README.md` lido, mais as ordens de
**27/08** (só erro de sistema vira chamado), **29/08** (planilha desligada) e
**31/08** (canal = grupo). **Nada da planilha foi lido, escrito, classificado ou
reprocessado.**

**Item serial: `#101` / `b2651a6f`** — a classe "não sabemos se nosso e-mail
chega no aluno". Subi **metade do laço para produção** e **não fechei** o
incidente. Fila: **80 → 80**.

---

## 1. Como escolhi

A ronda das 19h deixou o `#249` travado numa palavra (canal externo precisa de
aval) e anotou o **PR #263** como *"próximo da fila, não pendência esquecida"*.
Fui nele. É o segundo mais velho da fila com aluno afetado (**20,9d**, 17
ocorrências) e é a classe com **mais gente sofrendo** — 4 alunos em 2 dias
(Sheila, Rodrigo, Lucas, Priscyla) mais um erro meu.

Antes, conferi o item que parecia mais urgente e **saiu por motivo próprio**:

| card | por que não |
|---|---|
| `#379` (luctec) | o recado do Executor o chama de "comprador do SGP" 3×. **Não é** — refutado às 18:28Z por três identificadores independentes (e-mail, nome e telefone em `payment_events`: zero em todos) e pelo cadastro (entitlements zero, acesso nulo). Corretamente parado em `investigating`. Nenhum fato novo ⟹ nada a fazer |

---

## 2. O que subiu, e o que eu verifiquei em vez de aceitar

**PR #263 → merge `fbe5743` → deploy `34778689913` SUCCESS.**

O defeito: a casa manda e-mail, o SMTP responde `250`, o fluxo dá o aluno por
**avisado**. O `250` só quer dizer *"aceitei pra entrega"* — a recusa vem depois,
cai na caixa do `suporte@` e não volta pra lugar nenhum. O chamado segue
parecendo atendido e o aluno fica em silêncio sem saber.

Agora o `sendSupportMail` guarda o Message-ID que já gerava e jogava fora, e o
bounce que volta **casa por essa chave** e carimba o envio como não-entregue.
O registro mora **dentro** do `sendSupportMail`, então os 11 pontos que mandam
e-mail passaram a registrar sem que nenhum precise lembrar de chamar nada.

### 2.1 As três conferências que eu não podia terceirizar

1. **Merge de teste ANTES de mergear.** O `git diff main` do branch mostra três
   arquivos *apagados* — `contato_hotmart.cjs`, o log da ronda das 19h e uma
   linha do README. **Não é deleção**: a base do branch é anterior a eles e o
   merge de 3 vias preserva os três. Conferi arquivo por arquivo num worktree
   descartável em vez de confiar no `CLEAN` do GitHub. Conferi porque branch
   STALE já derrubou fix em produção nesta casa **três vezes**.
2. **Suíte nos DOIS lados**, que é a armadilha registrada ontem (*"suíte verde
   de branch errada é pior que suíte vermelha"*).
3. **`tsc` e o arquivo de teste novo**, no worktree certo.

| | baseline `main` `1fc9e00` | branch `dccf647` |
|---|---|---|
| `src/lib/**/*.test.ts` | 798 testes · 796 pass · **2 fail** | 808 testes · 806 pass · **2 fail** |
| `tsc --noEmit` | — | só o erro conhecido do `vitest` |
| `mail-envio.test.ts` sozinho | — | **10/10** |

**+10 testes, todos passando, zero regressão.**

### 2.2 Duas contas do corpo do PR que estavam erradas

Nenhuma das duas muda a conclusão dele, e por isso mesmo mergeei — mas ficam
registradas pra ninguém decidir em cima do número errado depois.

- **"a única falha é pré-existente" (1).** São **2**: `escalate-simulacao.test.ts`
  e `resgate-audio.test.ts`. As duas falham idênticas na `main`, então "nenhuma
  regressão" está **certo** — a contagem é que estava subnotificada. Quem ler
  "1 falha" na próxima ronda vai achar que apareceu falha nova.
- **"as migrations 85 e 104 seguem pendentes com código em produção logando erro
  em silêncio".** Medi as quatro no código de produção de hoje, em vez de repetir
  a frase:

| migration | estado real |
|---|---|
| 85 · `support_mail_replies` | **ZERO** referência em `frontend/src`. O código saiu. Não é falha viva, é arquivo morto — o PR conta ela a mais |
| 104 · `avisos_enviados` | **VIVA**. `registrar-aviso.ts:95` escreve hoje numa tabela que não existe |
| 107 · check de status | não aplicada, mas é **guarda**, não escrita — não falha em silêncio |
| 108 · `emails_enviados` | **VIVA desde o meu merge** |

> O número honesto é **2 caminhos de escrita falhando em silêncio, não 3.**
> E um dos dois passou a ser meu hoje.

---

## 3. ❌ Por que o `#101` NÃO fecha

O laço tem duas pontas e eu subi **uma**. A tabela `public.emails_enviados`
**não existe** — conferido no `information_schema`, só `admin_emails` existe da
família. Sem ela o insert falha, vira uma linha de log, **nenhum e-mail deixa de
sair e nenhuma varredura quebra** (degradação de propósito) — mas a consulta que
este trabalho existe pra permitir, *"quais alunos a casa acha que avisou e na
verdade não avisou"*, continua sem ter o que ler.

`scripts/108_emails_enviados.sql` está commitada e **não aplicada**: migration
sem aval não é minha alçada. Foi ao grupo nesta ronda como pergunta de sim/não.

**Assumo o custo do que fiz:** subi sabendo que, até a 108 ser aplicada, eu estava
criando o segundo caminho de escrita que falha em silêncio. Subi assim mesmo
porque, quando a tabela existir, o laço fecha **na hora, sem novo deploy** — e
porque PR pronto e parado é a falha documentada desta casa (o #260 ficou 3h20
ontem; o `onedrive-401` virou risco de regressão).

**Condição de fechamento, escrita pra não virar card eterno:** aplicar a 108 **e**
a consulta devolver linha real de um bounce novo. Não fecho por "código subiu".

---

## 4. Placar honesto

- **Incidentes fechados: 0.** Fila **80 → 80**. O item que eu peguei não tinha
  como fechar hoje, e forçar `fixed` seria a regra 14 quebrada.
- **Código em produção: 1** (`fbe5743`, deploy conferido SUCCESS — "mergeado"
  não é "em produção", e eu esperei o deploy).
- **Contas erradas que eu peguei antes de propagar: 2** (as do §2.2).
- **Alunos escritos: 0.** O item desta ronda é infraestrutura de entrega, não
  tem aluno esperando resposta minha nele.
- Crédito de aluno: **0**. GPU: **0**. Migration aplicada: **0**.

**O que emperrou, na cara limpa:** o conserto está em produção e **não serve pra
nada ainda**. Ele grava no vazio até alguém aplicar uma migration. A pergunta
foi feita; a espera continua.

**O que eu NÃO fiz:** não apliquei migration sem aval, não fechei incidente sem
resolver, não mergeei branch STALE (provei que não era), não aceitei o corpo do
PR como verificação, não rodei a suíte só no branch, não mexi em crédito/acesso/
assinatura, não gastei GPU, não li a caixa do `suporte@` pra triagem, e não
inventei causa pra parecer produtivo.

---

## 5. Passo fixo de fim de ronda

Conferido ao fechar: `git log --oneline origin/main..HEAD` vazio, nenhum fix meu
presos em branch, e o log desta ronda vai direto na `main`.
