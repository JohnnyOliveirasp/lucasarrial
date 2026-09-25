# Ronda das falhas — 25/09/2026, ~23hZ (rodou 22:40–23:1xZ)

> Conferi a primeira linha antes de escolher o nome do arquivo (aviso da ronda
> das 22h30: os nomes desta pasta não são índice confiável). `22h30` está
> ocupado pela ronda anterior; este é o `23h`.

**Método: serial (regra 8).** Um caso levado até onde dava, e o que travou está
nomeado com o passo exato.

**Esta ronda NÃO fechou incidente.** Ela corrigiu o tamanho de uma classe que
estava subcontada (3 → 4 pagantes), **derrubou 6 vítimas falsas que eu mesmo
quase publiquei**, e deu nome à pior classe da varredura do webhook, que estava
sendo exibida como "erro sem nome".

**Produção tocada:** nenhuma. Zero GPU, zero migration, zero DDL, zero crédito
movido, zero carta a aluno, zero conta criada, zero cobrança mexida. As duas
mudanças de código são em ferramenta **só-leitura** de `_frank/`.

---

## Passo fixo 1 — reconciliar os envios (ordem de 18/09)

```
node _frank/ferramentas/2026-09-18_reconciliar_envios_da_pasta.cjs --corte=2026-09-14T14:06:31Z --confirmar
```

- **1313** cartas na pasta `Sent` — **mesmo número das duas rondas anteriores**:
  nenhuma carta nova saiu.
- **1236** já tinham linha · **0 escrituráveis** na janela.
- Contagem fecha: **1313 = 1236 + 0 + 77 + 0**.
- Irmão de leitura independente (`2026-09-18_enviados_x_tabela.cjs`): **0 carta
  depois do corte**. Os dois instrumentos concordam.

Veredito: buraco **PASSIVO**. Bate.

## Passo fixo 2 — percepção travada (ordem de 17/09)

`percepcao_travada.cjs`: **0** cartões · mais velho **0d**. Controle positivo
(#310) OK, negativo (#518) descontado, **569** incidentes varridos (eram 566).
Nada a despachar pro `olho`/`qa`.

> ⚠️ Ler junto com o `bb1e87d3` (Vigia, 22hZ): ele abriu o **#585** dizendo que
> este detector é **cego em 13% da frota**. O "0" que eu publico aqui é o número
> do instrumento, e o próprio instrumento está sob objeção. Não leia como saúde.

## Passo fixo 3 — estado da fila

**166 abertos** · **95** com 7d+ (início e fim iguais: não abri nem fechei).

---

## O caso serial: o `#582`, e por que ele estava subcontado

Peguei o `#582` — **não** o `#398` que o `escolher_o_abandonado.cjs` apontou. O
`#398` (welrisson, 11,0d, `aguardando_aluno`) foi lido antes de ser descartado:
o aluno **foi medido e respondido** em 14/09 (e-mail uid 2313, dois estornos
conferidos por `ref_id`), e regra 8 é explícita — esperar resposta de aluno não
é estar travado.

O `#582` entra na **única exceção** da regra 8: dinheiro sendo cobrado errado
agora. Três pagantes sem conta, R$ 2.926,09 + USD 40.

### A parte que era minha, e estava destravada

As partes (a) conceder acesso e (b) parar/estornar dependem do "pode" do Johnny.
A parte **(c)** — "ninguém lê `payment_events.error`" — é minha e não depende de
ninguém. Fui atrás dela.

### O que achei: o instrumento existe desde 09/09 e ninguém roda

`varrer_erros_webhook.cjs` (#324) lê exatamente essa coluna desde **09/09**.
Rodei com `--dias 30`: **114 erros · 70 pedem ação · 44 ruído**, com **10 pessoas
nomeadas** em 3 classes acionáveis, a mais velha de **22 dias**.

**É a doutrina de 21/09 pela terceira ronda seguida.** O `#315` gravava e
ninguém lia (9 dias). As 414 guardas do worker existiam e nada as executava.
Agora: a varredura existe, funciona, e **ninguém a executa**.

E tem um agravante próprio: a classe DESTE cartão caía em
**`desconhecido`** — o balde "erro que esta varredura não sabe classificar".
Mesmo quem rodasse não leria como grave.

---

## O erro que eu quase publiquei, e a régua que o derrubou

A primeira medição dizia **"9 de 10 nunca entraram"**. Escrito assim, seria
manchete: nove pagantes trancados. **Seis daqueles nove não são vítimas.**

Usei `auth.users.last_sign_in_at` como prova de entrada. Está certo contra
`access_until` (o webhook cria o direito no ato do pagamento, inclusive pra quem
nunca recebeu senha — foi assim que o `prova_raio` pariu os 147 falsos de
18/08). **Mas é régua errada pra duas classes inteiras:**

| quem | por que NÃO é vítima |
|---|---|
| **4 compradores de SGP** (jcesaram, patricia.bp170, marcio.laosa, amanda.rosaleal) | O caminho do SGP é o wizard `/sgp` com verificação de e-mail, **não** login de plataforma. Entitlement nenhum e crédito 0 são o **desenho** (#324). O `#505`/22-09 registra que usar o clone exige assinar à parte — regra comercial do Lucas de 31/08. |
| **gabriel.pereira** | A "assinatura" dele é **R$ 0** — é **trial**. O que pagou foi R$297 num curso avulso, em 22/03. O entitlement `canceled` vencido em 05/09 está **certo**. É a classe do `#333` (trial de R$0 chamado de compra paga). |

**A prova de que a régua mentia estava num cartão da própria casa:** a
`amanda.rosaleal` aparece "NUNCA ENTROU" e o **`#375`** mostra ela **usando o
produto** — 6 fotos aprovadas, clicando Continuar. Se eu tivesse publicado o 9,
teria acusado a casa de trancar uma aluna que estava trabalhando dentro dela.

> **A lição, escrita pra não repetir: régua boa contra um erro não é régua boa
> contra todos.** `last_sign_in_at` derruba o falso positivo do `access_until` e
> **cria** um falso positivo novo em toda classe cujo produto não passa por
> login. Placar de "trancados" sem separar por PRODUTO inventa vítima — e a
> vítima inventada some quando alguém confere, junto com a credibilidade do
> número verdadeiro que estava no meio.

---

## O que sobrou, e é real: o 4º pagante

**`scandovieri41@hotmail.com`** — não estava em cartão nenhum.

| medição | resultado |
|---|---|
| `pagou_de_verdade.cjs` | **assinatura FastCloner R$97 COMPLETE 26/07 e R$97 COMPLETE 26/08** (dois ciclos) + R$2.697,60 em avulsas (297 + 597 + 1.803,60) |
| `auth.users` | **NÃO EXISTE** |
| `profiles` | **NÃO EXISTE** |
| `entitlements` | `active`/7851642 até **2026-09-26** — **SEM `user_id`** |

O direito existe e **não há usuário ligado a ele**. Não é "a senha não chegou":
**não há porta**. Está assim há **22 dias** e o direito **vence 26/09 — amanhã**.

Se vencer assim, é o **`#207`** de novo: em 11/09 o Vigia avisou que uma garantia
vencia em ~11,7h, ninguém viu, e o aluno ficou com R$97 sem devolução.

O `#428` nomeia ele, mas o `#428` é sobre **o canal do aviso nunca entregar** —
não sobre ele estar sem conta.

### O que fiz com isso

1. **Grupo, na hora** (regra de canal + "pagante travado avisa NA HORA"): o caso,
   o vencimento de amanhã, e o pedido do "pode" pra criar o acesso. Já postado.
2. **`#582` anotado** (2 → 3 notas, `investigating` preservado, 1 linha afetada
   conferida na releitura): a classe passa a ter **4** nomes, com as 6 exclusões
   escritas **com o motivo**, pra ninguém reacusar essas pessoas na próxima ronda.
3. **NÃO criei conta, não concedi acesso, não estornei, não escrevi pro aluno.**
   Criar conta é produção e dinheiro — segue no "pode" do Johnny, igual (a) e (b).

---

## O conserto durável desta ronda

Ferramenta **só-leitura**, sem risco de produção.

**1. `varrer_erros_webhook.cjs` — a pior classe ganhou nome.**
`compra órfã paga sem aviso novo%` saía como `desconhecido`; agora é
`orfa_paga_calada`, **ordem 0** (imprime primeiro), com a ação escrita pra quem
atende: confirmar com `pagou_de_verdade` (trial de R$0 não conta), levar pro
Johnny porque criar conta é produção, e **olhar o `access_until`** antes que
venza com a pessoa nunca tendo entrado.

Controle de mutação, medido antes/depois no mesmo comando:

| | antes | depois |
|---|---|---|
| `ERRO QUE ESTA VARREDURA NÃO SABE CLASSIFICAR` | **8** | **6** |
| `COMPRA ÓRFÃ **PAGA** E O AVISO FOI CALADO` | — | **2** |
| total · pedem ação · ruído | 114 · 70 · 44 | **114 · 70 · 44** |

As duas linhas saíram do balde e entraram na classe nomeada; **nenhuma outra
classe se moveu** e o total não mudou.

**2. `2026-09-25_pagante_da_varredura_entrou.cjs` (novo, só lê).** Responde "o
acusado pela varredura ENTROU?" e carrega escrito, no cabeçalho, as **duas**
armadilhas: por que `access_until` não prova entrada, e por que
`last_sign_in_at` **não serve pra SGP** — a que me mordeu hoje.

---

## O que esta ronda NÃO resolveu

- **O `#582` não fechou.** Passo que falta: o "pode" do Johnny pras partes (a) e
  (b). Sem ele não há o que eu execute.
- **Ninguém executa a varredura.** Dei nome à classe, mas **não** criei o
  caminho que a roda sozinha e abre chamado. Isso é a parte (c) de verdade e
  **continua aberta** — hoje ela depende de alguém lembrar de rodar, que é
  exatamente o defeito que produziu os 22 dias do scandovieri41.
- **`scandovieri41` não tem cartão próprio.** Ficou anotado dentro do `#582`
  (mesma classe, mesmo bloqueio, um dono só). Se o "pode" demorar, ele precisa
  de cartão.
- Não toquei em nenhuma das pendências nomeadas abaixo.

## Fila ao fim da ronda

**166 abertos** · **95** com 7d+ · percepção travada: **0** (sob objeção do #585).

### Pendências nomeadas (paradas, não "em andamento")

1. 🔴 **`#582` — o "pode" pros pagantes.** Agora são **4**: R$ 2.926,09 + USD 40
   + o scandovieri41 (R$194 em assinatura). **Vence amanhã** no caso dele.
2. 🔴 **`payment_events.error` não vira chamado sozinho.** Hoje só ganhou nome.
3. 🔴 **`#249`** (Glauber, R$ 694, 42 dias) e **`#250`** (Anderson, R$ 733,60,
   50 dias) — "pode" do WhatsApp. A medição do CPF inválido **segue só no log**.
4. 🔴 **Decisão curso × plataforma** (28 alunos + carta do Rafael). **Venceu 25/09.**
5. 🔴 **`#702cc916` — 25d**, destrava a cabeça da fila (`#52`, 38d, 22 alunos).
6. **Fila de decisão do Johnny: 18 cartões, 53 alunos**, mais velho 24d — **o
   lote segue sem ser montado**, terceira ronda seguida.
7. **`#426`** — os 309/349 do lote de 04/09.
8. **`patch_cfde107d`** do Vigia esperando revisão.
9. **77 cartas anteriores a 14/09** — segue sem decisão de escrituração.
10. **`#585`** (novo, Vigia): o detector de percepção é cego em 13% da frota.
11. **`#398`** — o buraco de CLASSE segue aberto: o gatilho é 2-em-6h **por
    aluno**, então em 14/09 o mesmo defeito derrubou **4 alunos** e a fila
    mostrou **1**. Quem falha uma vez é invisível. Não mexi nisto hoje.
12. **`emails_enviados.bounce_em` sub-registra** · **`sgp_fracassos` com 0 linhas**.

### A lição desta ronda

**Três rondas seguidas acharam o mesmo defeito em formas diferentes:** o `#315`
gravava e ninguém lia; as 414 guardas existiam e nada as rodava; a varredura do
webhook funciona e ninguém a executa. A casa é boa em construir instrumento e
ruim em **consultá-lo** — e o custo não aparece no dia em que o instrumento
nasce, aparece 22 dias depois, num pagante cujo acesso vence amanhã.

**E o corolário novo, que é meu erro desta ronda:** quando finalmente se lê o
instrumento, a pressa de publicar o número é o próximo defeito. Eu tinha "9
pagantes trancados" pronto pra postar. Eram **1**. A diferença entre os dois
números não estava em consulta nenhuma — estava em conferir, caso a caso, se a
régua servia pro produto daquela pessoa.
