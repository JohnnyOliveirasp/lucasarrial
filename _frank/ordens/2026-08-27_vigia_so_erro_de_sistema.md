# ORDEM — O Vigia abre chamado SÓ para erro de SISTEMA (27/08)

Pedido do Johnny, 27/08: *"calibrar este Vigia para pegar somente erros que são
de sistema, e verificar se os erros que ele está apontando realmente são
corretos."*

Amplia a 14-A. **Não muda quem fecha** (o Frank). Muda **o que o Vigia abre**.

---

## 1. O que foi medido antes de escrever esta ordem

31 chamados abertos pelo Vigia desde 18/08 (`reported_by='vigia'`), lidos um a
um com o desfecho de cada um:

| | |
|---|---|
| eram **erro de sistema** e estavam **certos** | **19** (69, 71, 74, 75, 86, 98, 110, 113, 127, 129, 131, 136, 138, 146 …) |
| eram **erro de sistema** e estavam **ERRADOS** (`ignored`) | **5** — #100, #112, #125, #135, #152 |
| **não eram erro de sistema** (processo / atendimento / decisão) | **8** — #87, #95, #120, #132, #143, #150, #151, #153 |

Dos 24 chamados "técnicos", **5 eram falsos (21 %)**. E o padrão dos falsos não
é aleatório — **três dos cinco são acusação de DINHEIRO feita olhando só o
ledger, sem abrir o código que cobra**:

- **#100** "38 contas free consumiram 330.400 sem crédito" — era o caminho
  `debitCreditsOnboarding`, autorizado a ficar negativo pelo Johnny em 21/08.
  O próprio Vigia registrou que "não abriu nenhum arquivo de código".
- **#125** "28 % dos áudios entregues sem débito" — amostra automática (grátis
  por design) + admin isento + gerações que a equipe refez por conta da casa.
- **#152** "Adriana pagou 3.600 por 2 cenas bloqueadas e não foi estornada" —
  a moderação bloqueia **antes** de cobrar; as cenas tinham `debit_ref` NULO.
  O Vigia casou débito com cena por **timestamp**; os 3.600 pagaram outras
  duas cenas, **entregues**. Estornar em cima disso pagaria em dobro.

Os outros dois: **#112** duplicata de classe já aberta (#52) e **#135** decisão
de produto que o Johnny fechou ele mesmo (trial desligado).

Ou seja: o Vigia **enxerga bem** o que é fila presa, arquivo que some, config
errada, guarda que julga pelo estado velho. **Erra quando faz conta de dinheiro
sem ler quem cobra**, e **gasta chamado** com coisa que é processo.

## 2. A regra — o que VIRA chamado

O Vigia abre incidente **somente** quando o defeito é do **sistema**: código,
infra, ou dado que o **nosso** sistema produziu errado. Teste de bolso, antes
de abrir:

> **"Se o código/infra estivesse certo, isso não teria acontecido?"**
> Sim → chamado. Não → não é chamado.

Exemplos que **são** chamado: cena marcada `failed` com o vídeo pronto no Kie
(#147); guarda que pula material novo por causa de um veredito velho (#146);
foto que sobe em dobro pro R2 (#75); e-mail acima do teto que ninguém lê (#98);
`resolved_at` que não é preenchido (#110).

Exemplos que **NÃO são** chamado — e para onde vão:

| o que o Vigia viu | é | vai para |
|---|---|---|
| aluno esperando resposta humana, pré-venda, pedido de reembolso, cancelamento | **atendimento** | avisa o grupo do time (`avisar_grupo.cjs`) — a Fast/Frank respondem. Sem chamado. |
| ordem que não foi executada, cron que não foi ligado, turno vago | **processo** | 1 linha no relatório da ronda (`_frank/prova/`) e **1 mensagem no Telegram** pro Johnny. Sem chamado. |
| "isto deveria ter sido decidido e não foi" | **decisão** | Telegram pro Johnny, com a pergunta em 1 linha. Sem chamado. |
| chamado fechado de um jeito que o Vigia discorda | **objeção** | nota no **próprio** chamado fechado (14-A já diz isso). Sem chamado novo. |
| a mesma classe de falha que já tem chamado aberto | **reincidência** | soma ocorrência no chamado que existe (o sistema faz sozinho pela `signature`). Sem chamado novo. |

**Aluno esperando não é bug.** Dói, precisa de gente, mas o lugar de "precisa
de gente" é o grupo do time, não a fila de incidentes. A fila mede a saúde do
**sistema**; quando ela mistura os dois, o Johnny abre o `/admin` e não sabe se
o produto está quebrado ou se a Fast está atrasada.

## 3. A regra — o que o Vigia CONFERE antes de abrir

Três checagens, **obrigatórias**, escritas na nota de abertura:

1. **"Já existe?"** — procurar na fila (aberta E fechada) pela classe. Se a
   classe está aberta, é ocorrência, não chamado (#112 foi isto).
2. **"Já foi corrigido?"** — `git log origin/main` desde a última ronda **e
   `gh pr list --state open`**. Há ~20 PRs abertos do Frank esperando aval;
   um deles pode ser exatamente o conserto. Abrir chamado pra bug que já tem PR
   é pedir pra alguém refazer trabalho pronto.
3. **Se envolve DINHEIRO (crédito, débito, estorno, cobrança):**
   - casar `credit_transactions.ref_id` com o campo de referência da tabela
     (`studio_scenes.debit_ref`, `generations.id`…). **Timestamp é pista,
     nunca prova** — o loop cria/despacha/cobra em sequência e o débito da
     cena boa cai antes do INSERT da bloqueada seguinte;
   - **abrir o arquivo que cobra** e dizer na nota `arquivo:linha` de onde o
     débito nasce e de onde o estorno nasceria. Se a nota não tem
     `arquivo:linha`, o chamado não pode afirmar "cobrou e não estornou";
   - lembrar o que é grátis por design: amostra automática do treino,
     `bypassesBilling` de admin, refeito por conta da casa
     (`refazer_audio_conta_da_casa.cjs`), onboarding que pode ficar negativo.

   Um chamado de dinheiro errado não é só ruído: **o Frank estorna por ele**
   (até 20 k/caso sozinho). O #152 teria pago 3.600 em dobro.

## 4. O que NÃO muda

- 14-A inteira: o Vigia **abre e anota**, o Frank **decide e fecha**. O Vigia
  continua não reabrindo, não escrevendo pra aluno, não tocando em crédito.
- O Vigia continua **medindo tudo** que mede hoje — cobertura, escotilha,
  filas, cenas presas, e-mails sem resposta. O que muda é **o destino** do
  achado (chamado × grupo × Telegram × relatório), não a vigilância.
- O ouvido humano: o que depende de OUVIR ou VER continua indo pro grupo
  (`ask_humans`), nunca vira veredito do Vigia.

## 5. Como se mede se esta ordem funcionou

Daqui a 7 dias (03/09), a mesma consulta:

```sql
select status, count(*) from incidents
 where reported_by='vigia' and created_at >= '2026-08-27' group by 1;
```

Alvo: **`ignored` ≤ 10 %** dos abertos (hoje 21 %), e **zero** chamado com
`categoria='atendimento'` ou `kind` começando com `processo`/`atendimento`.
Se o Frank fechar um chamado do Vigia como `ignored`, a nota de fechamento diz
**qual das três checagens do §3 faltou** — é assim que a ordem se corrige.
