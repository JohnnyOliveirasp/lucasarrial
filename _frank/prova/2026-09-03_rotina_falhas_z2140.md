# Ronda das falhas — 03/09/2026, 21:40Z (18:40 BRT)

Serial: **#222** (`3ca22d47`, alunos pagantes presos fora da própria conta) —
segue sendo o aberto mais antigo com aluno afetado (01/09 15:54Z). Quarta ronda
no mesmo serial.

Convenção de nome `_zHHMM` (hora UTC real) herdada da ronda anterior, mantida.

## Fila conferida antes de escolher

`varredura_travados.cjs`: **6 abertos** (era 5), **11 em `aguardando_aluno`**
(era 9), 2 presos. O que entrou desde as 20:40Z:

- aberto novo às **21:27Z** — "aluno insatisfeito com o realismo do Vídeo Clone"
  (mesma classe do #216, que já está em `aguardando_aluno`).
- `aguardando_aluno` **#243** e **#244** — senha / botão Configurações.

Nenhum deles fura o serial: não é produção fora do ar nem dinheiro sendo
cobrado errado. O #222 continua sendo o mais antigo com aluno afetado.

## O item levado até o fim: `qooqi.criacoes@gmail.com`

**Moyses Filipe B. Martins** · entitlement `17103499` · `external_id` OVPDAWS5
· assinatura ACTIVE · janela até **21/09 12:00Z**.

### A checagem que mudou o tratamento

A ronda anterior deixou este aluno na fila como **carta de órfão** ("crie a
conta com o e-mail da compra"), com a pista de perguntar se
`moyses.filipe@gmail.com` era dele. **As duas coisas estavam erradas**, e a
primeira consulta já mostrou isso:

| medição | resultado | controle |
|---|---|---|
| `profiles` com `qooqi` | **1 — a conta EXISTE** | 1.827 perfis |
| `auth.users` com `qooqi` | **1** | 1.827 usuários |
| Enviados para `qooqi.criacoes@` | **0** — nunca escrevemos | — |

A conta é **`gestao@qooqi.com.br`** ("Equipe Qooqi"). Mandar "crie sua conta"
para quem já tem duas seria repetir o erro que a própria ronda anterior
registrou no `dropweb` (uid 494).

### A linha do tempo, que é a história inteira do #222 num aluno só

```
21/07 11:06:18   compra como qooqi.criacoes@gmail.com   → entitlement órfão
21/07 11:08:54   cria a conta gestao@qooqi.com.br       (2m35s depois)
21/07 11:09:27   última vez que abriu essa conta         (33s de uso)
21/07 11:10:49   COMPRA DE NOVO como moyses.filipe@gmail.com
26/08 19:33:38   cria a 2ª conta, moyses.filipe@gmail.com
26/08 19:33:46   última vez que abriu essa conta         (8s de uso)
```

Comprou às 11:06, criou a conta às 11:08, não viu acesso nenhum e **comprou
outra vez às 11:10**. Depois voltou em 26/08, criou a segunda conta com o
e-mail da segunda compra, também não viu nada, e desistiu em 8 segundos.

Enquanto isso pagou **R$ 97,00 em 28/07** e **R$ 97,00 em 21/08**. Duas contas,
zero voz, zero crédito, zero acesso, **44 dias**.

### Por que o sistema nunca casou

`reconcileUserEntitlements` liga órfã por **e-mail exato**
(`.is("user_id", null).ilike("buyer_email", e)`). O e-mail da compra
(`qooqi.criacoes@gmail.com`) não é o e-mail de nenhuma das duas contas. Não
tinha como casar sozinho — é o limite que o próprio `claim.ts` documenta no
cabeçalho.

### O conserto, e por que agora ele DURA

- `entitlements.user_id` **17103499 → 29409684**, com `RETURNING`: **1 linha**.
- Cache do perfil recomposto exatamente como o `recomputeProfileAccess`
  escreve: `plan='pro'`, `access_source='hotmart'`,
  `access_until='2026-09-21 12:00Z'`. `RETURNING`: **1 linha**.
- Conferido por **instrumento independente**, não pelo eco do meu próprio
  UPDATE: `aluno.cjs gestao@qooqi.com.br` → *"acesso: ATIVO até 2026-09-21"*.

**Não creditei na mão, de propósito.** O `claim.ts` concede
`PLAN_MONTHLY_CREDITS` (100k) no próximo login, com `ref_id` = transação
`HP1375818781` (caminho **direto** do `raw_event`, que é o que o
`transactionOf()` lê). Conferi antes: **zero** `subscription_grant` para
`OVPDAWS5`/`HP1748434747`/`HP1925021336`/`HP1375818781` — não há risco de
crédito em dobro, e o crédito entra pelo caminho normal do produto, com a
escrituração certa.

**O vínculo manual agora é durável.** Era este o motivo de "conserto manual
desses casos apodrecer sozinho": o `grantAccess` gravava `null` por cima do
dono quando o e-mail da compra não tinha perfil. A guarda `donoDoEntitlement`
(`ba6a235`, já na main) impede isso. Sem ela, a renovação de ~21/09 desligaria
o que eu acabei de ligar.

### Entregue

- `--dry-run` conferido (destinatário, remetente, corpo inteiro).
- Carta enviada pelo SMTP do `suporte@` — **uid 500**, tentativa 1, **cópia
  CONFIRMADA** em Enviados.
- Login por **Google** nas duas contas (`auth.identities`), então a carta diz
  "Entrar com Google", não "sua senha" — e não esbarra no #243/#244.
- Ofereci mover para `moyses.filipe@gmail.com` se ele preferir: a escolha da
  conta é dele, e é reversível em minutos.
- Nota no #222: **15 → 16**, 1 linha afetada, conferida na releitura.
- Fato consumado postado **no grupo**.

## A pista da ronda anterior, DERRUBADA por medição

`moyses.filipe@gmail.com` **não** é conta a vincular. É o **mesmo comprador**
(o nome nas compras da `qooqi` é "Moyses Filipe B. Martins"), mas tem
entitlement **próprio** (`d83db6b3`, `0Q4KP8I9`), **já ligado**, `canceled`,
vencido em **28/07**. Vincular ali seria juntar lixo, não consertar.

O `ucode` não serviu de prova aqui: os eventos da `qooqi` têm
`f865ff00-…` só a partir de 21/08, e os do `moyses.filipe` têm `ucode` **null**.
Quem cravou foi o **nome do comprador**. Documento também não serviu: neste
comprador o campo vem **string vazia** nos 6 eventos (o controle de 4.140 de
5.475 eventos COM documento continua valendo — o zero é dele, não do
instrumento).

## 🔴 O achado da ronda: o #222 está fazendo aluno PAGAR DUAS VEZES

O `qooqi` comprou de novo 4 minutos depois porque a primeira compra não deu
acesso nenhum. Fui medir se isso é padrão. **É.**

Cruzei os **25** órfãos vivos (`user_id` null, `active`, janela futura) contra
`profiles`, por **domínio próprio** e por **nome do comprador**. Deu 9 alunos
com conta candidata. Estado de cada conta candidata, medido:

### Grupo A — já tem acesso numa conta, e a órfã é uma SEGUNDA compra

| aluno | órfã | conta que usa | mesma janela | dinheiro |
|---|---|---|---|---|
| Jackson Nogueira Alves | `jkakorio@` R$97 | `jkakoalves@` R$97 · PRO, 168k cr, 2 vozes | 19/09 | **R$194 🔴** |
| Carlos Augusto (`caplastica`) | `caplastica@` R$97 | `gutoassuncao16@` R$97 · PRO, 200k cr | 22/09 | **R$194 🔴** |
| Gabriela Louly | `gabrielalouly@hotmail` R$0 | `gabrielalouly@gmail` · PRO, 100k cr | 07/09 | R$0 (dois trials) |
| Helton Bertoldi | `heltoncontamed@` R$0 | `heltonbertoldi@` · PRO, 2 vozes | 14/09 | R$0 (dois trials) |

**Jackson é cobrança em dobro REAL e nova.** Confirmado no
`pagou_de_verdade.cjs` nos dois e-mails: **duas assinaturas paralelas**, trial
R$0 em 19/08 nas duas, e **R$97 em 26/08 em CADA uma** (`HP2303981960` e
`HP2015420285`). Duas linhas ACTIVE, mesmo produto, mesma oferta, mesma janela
(19/09). **As duas seguem ativas — repete em ~19/09** se ninguém cancelar.

⚠️ A ronda anterior teve este par na mão e concluiu *"só `caplastica` sai por
cobrança em dobro"*. Estava errado: o `jkakorio` também é, e ainda **recebeu
carta de órfão (uid 480)** tratando-o como preso fora da conta — quando ele
está usando a plataforma normalmente na outra conta, com 168k de crédito e 2
vozes. Carta errada para o problema errado.

### Grupo B — tem conta, NÃO tem acesso: consertável na mão, igual ao qooqi

| aluno | órfã (janela) | conta existente | estado da conta |
|---|---|---|---|
| Marcio Fernandes | `cdmarciofernandes@hotmail` 10/09 | `cdmarciofernandes@gmail` | free, 0 ent, 0 crédito |
| Fernanda Franzolin | `fnfranzolin@hotmail` 11/09 | `ftfranzolin@gmail` | free, 0 ent, 0 crédito |
| Jesus Peres | `iehudaperes@grupoperes` 18/09 | `diretoria@grupoperes` (mesmo domínio) | free, 10.330 cr |
| José Carlos (`dropweb`) | `atendimento@dropweb` 02/10 | `jose@dropweb` (mesmo domínio) | free, 0 ent, **visto HOJE** |

O `dropweb` recebeu carta (uid 494) mandando criar conta — e **já tinha**. A
ronda anterior chegou a anotar isso e mesmo assim a carta foi o tratamento.

**Não vinculei nenhum destes.** Cada um precisa da verificação individual que
eu fiz no `qooqi` (linha do tempo + identidade do comprador), e o serial manda
levar um por vez até o fim. Ficam prontos para a próxima ronda, que agora anda
rápido porque o levantamento está feito.

### O falso positivo, que fica registrado para ninguém vincular no automático

`allan_air@hotmail.com` ("ALLAN IOMBRILLER RODRIGUES") casou com
`wallanadaphiny@icloud.com` ("Wallana Daphiny Pereira Rodrigues") **só porque
"ALLAN" está dentro de "WALLANA" e o sobrenome bate**. São pessoas diferentes.
`cdmarciofernandes` também trouxe um segundo candidato falso
(`marciofcorreia@gmail.com`, "MARCIO FERNANDES CORREIA", que tem assinatura
própria). **O cruzamento por nome é pista, não prova** — vincular em massa por
similaridade daria acesso pago de um aluno a outra pessoa.

## O que isso muda no #222

O incidente está escrito como "5 alunos com acesso ativo presos fora da própria
conta". A medição de hoje diz que ele é maior e mais caro do que o título:

1. **O prejuízo não é só ficar preso — é comprar de novo.** Pelo menos 4 dos 25
   órfãos vivos compraram duas vezes (2 pagando de verdade, 2 em trial), e o
   `qooqi` documenta o mecanismo em 4 minutos de relógio.
2. **Carta não é o tratamento certo para todo mundo.** De 9 alunos com conta
   candidata, **zero** deviam receber "crie sua conta": 4 precisam de vínculo
   na mão, 4 precisam de estorno/cancelamento, 1 é falso positivo. Duas cartas
   já saíram erradas (`jkakorio` uid 480, `dropweb` uid 494).
3. **A causa estrutural continua intacta**: `claim.ts:39 →
   reconcileUserEntitlements` casa só por e-mail exato. Por isso o incidente
   segue `investigating`.

## Para o Johnny e o Lucas (decisão de vocês, não minha)

- **Jackson Nogueira Alves** e **Carlos Augusto**: R$97 a mais cada, cobrados
  em 26/08 e 28/08, com as duas assinaturas **ainda ativas** — repete no
  próximo ciclo. Estorno e cancelamento de uma das duas são decisão comercial
  e **ação externa**: não faço sem o "pode" de vocês. `cancelar_assinatura.cjs`
  existe e está pronto.
- **Moyses**: além da assinatura, pagou **R$ 252,45** em 28/06 na *Fábrica de
  Conteúdo Invisível* (avulsa, sob `moyses.filipe@`). O que a avulsa dá direito
  dentro do FastCloner é decisão comercial (#173) — **não mexi** e não prometi
  nada a ele sobre isso.

## Limites honestos desta ronda

1. Não consertei a causa do #222 — remediei um aluno e levantei a classe.
2. Não vinculei os 4 do Grupo B nem toquei nos 2 estornos: serial e alçada.
3. Não reverifiquei **#226**, **#234**, **#47**, os dois de áudio (decapitado /
   QA reprovado), a Katia, nem o aberto novo das 21:27Z. Não afirmo nada sobre
   eles.
4. Não escrevi para o Marcelo (3 cartas já foram, acesso vence 05/09) nem para
   o Luan (5 dias; o gatilho de 2ª tentativa é 7).
5. Os recados em `para_frank_*` e o `patch_92b1cc85` seguem **não tratados** —
   sexta ronda seguida.
6. Não abri o app, não ouvi áudio, não vi imagem: banco, envelope, Hotmart e
   código lido.
7. O cruzamento cobre quem tem **domínio próprio igual** ou **nome parecido**.
   Quem criou conta com nome e domínio diferentes do comprador **não aparece** —
   o `qooqi` só apareceu porque eu procurei a marca no e-mail, e o nome dele
   ("Equipe Qooqi") **não** casaria com "Moyses Filipe B. Martins". O número 9
   é **piso, não teto**.
